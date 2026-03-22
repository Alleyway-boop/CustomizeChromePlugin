import { ref } from 'vue';
import browser from 'webextension-polyfill';
import { Message, SendResponse } from './utils';
import { safeAsync, safeStorage, safeTabs, ExtensionError, ErrorCodes, isValidDomain, normalizeDomain } from './utils/error-handler';
import { SmartScheduler } from './utils/performance';
import { configManager } from './utils/config';
import { isDomainMatch, domainsToWhitelistItems } from './utils/whitelist-utils';
import type { WhitelistItem } from './types/whitelist';

// 常量定义 - 避免魔法数字
const CHECK_INTERVAL_MS = 60 * 1000; // 每分钟检查一次冻结
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 每小时清理一次冻结标签页
const TAB_UPDATE_DEBOUNCE_MS = 500; // 标签页更新去重时间

// 配置和状态
let whitelist: string[] = [];
let FreezeTimeout: number = 20; // 默认值，单位：分钟
const FreezePinned = ref(false);

interface TabStatus {
  tabId: number;
  url: string;
  icon: string;
  title: string;
  lastUseTime: number;
  windowId?: number;
  active?: boolean;
  isVisible?: boolean; // 页面是否真正可见（基于Page Visibility API）
  visibilityState?: 'visible' | 'hidden' | 'prerender' | 'unloaded';
}

interface FreezeTabStatus {
  tabId: number;
  url: string;
  icon: string;
  title: string;
}

let tabStatusList: TabStatus[] = [];
let freezeTabStatusList: FreezeTabStatus[] = [];

/**
 * Validates and cleans whitelist data from storage
 * Removes invalid entries, normalizes domain names, and eliminates duplicates
 *
 * @param inputWhitelist - Raw whitelist data from storage (unknown type)
 * @returns Promise resolving to cleaned array of valid domain names
 *
 * @example
 * const cleaned = await validateAndCleanWhitelist(['example.com', 'invalid..domain', 'Example.Com']);
 * // Returns: ['example.com']
 */
async function validateAndCleanWhitelist(inputWhitelist: unknown): Promise<string[]> {
  if (!Array.isArray(inputWhitelist)) {
    console.warn('Invalid whitelist data from storage, expected array, got:', typeof inputWhitelist);
    return [];
  }

  const cleanedWhitelist: string[] = [];

  for (const item of inputWhitelist) {
    if (typeof item === 'string' && item.trim()) {
      const normalizedDomain = normalizeDomain(item.trim());
      if (normalizedDomain && isValidDomain(normalizedDomain)) {
        if (!cleanedWhitelist.includes(normalizedDomain)) {
          cleanedWhitelist.push(normalizedDomain);
        }
      } else {
        console.warn('Invalid domain in whitelist, removing:', item);
      }
    } else {
      console.warn('Invalid item in whitelist, expected string, got:', typeof item);
    }
  }

  return cleanedWhitelist;
}

// 初始化
browser.storage.sync.get(['FreezeTimeout', 'FreezePinned', 'whitelist', 'autoRecovery']).then(async (res: { FreezeTimeout?: number; FreezePinned?: boolean; whitelist?: string[]; autoRecovery?: boolean }) => {
  if (res.FreezeTimeout) FreezeTimeout = res.FreezeTimeout;
  if (res.FreezePinned !== undefined) FreezePinned.value = res.FreezePinned;

  // 验证和清理白名单数据
  if (res.whitelist) {
    const cleanedWhitelist = await validateAndCleanWhitelist(res.whitelist);
    whitelist = cleanedWhitelist;

    // 如果清理过程中移除了无效数据，仅记录日志，不在这里保存
    // 避免循环：存储监听器会处理后续的保存操作
    if (cleanedWhitelist.length !== res.whitelist.length) {
      console.log('Cleaned whitelist data during initialization:', {
        original: res.whitelist.length,
        cleaned: cleanedWhitelist.length,
        removed: res.whitelist.length - cleanedWhitelist.length
      });
      // 不再保存，由 storage 监听器统一处理
    }
  } else {
    whitelist = [];
  }

  console.log('Initial config:', { FreezeTimeout, FreezePinned, whitelist });

  // autoRecovery: 扩展加载时自动恢复所有冻结的标签页
  if (res.autoRecovery === true) {
    console.log('Auto-recovery enabled, restoring frozen tabs...');
    const result = await restoreAllFrozenTabs();
    console.log('Auto-recovery result:', result);
  }
});

// 监听存储变化
browser.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'sync') {
    if (changes.FreezeTimeout) FreezeTimeout = changes.FreezeTimeout.newValue as number;
    if (changes.FreezePinned) FreezePinned.value = changes.FreezePinned.newValue as boolean;

    if (changes.whitelist) {
      const cleanedWhitelist = await validateAndCleanWhitelist(changes.whitelist.newValue);
      whitelist = cleanedWhitelist;

      // 如果清理过程中移除了无效数据，保存清理后的结果
      if (Array.isArray(changes.whitelist.newValue) && cleanedWhitelist.length !== changes.whitelist.newValue.length) {
        console.log('Cleaned whitelist data during storage change:', {
          original: changes.whitelist.newValue.length,
          cleaned: cleanedWhitelist.length,
          removed: changes.whitelist.newValue.length - cleanedWhitelist.length
        });
        await safeStorage.set({ whitelist: cleanedWhitelist });
      }
    }
  }
});

// 在加载存储的冻结标签页之后添加日志
browser.storage.sync.get('freezeTabStatusList').then((res) => {
  if (res.freezeTabStatusList) {
    freezeTabStatusList = res.freezeTabStatusList as FreezeTabStatus[];
    console.log('Loaded freezeTabStatusList:', freezeTabStatusList);
  }
});

// BUG-006: 用于 onUpdated 去重的 Set
const recentlyUpdatedTabs = new Set<number>();

// 监听标签页更新事件（包括URL变化）
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // BUG-006: 去重逻辑 - 如果tab已在最近更新列表中，跳过
  if (recentlyUpdatedTabs.has(tabId)) {
    return;
  }

  if (changeInfo.url || changeInfo.title) {
    // 如果URL或标题发生变化，更新tabStatusList中的信息
    const tabStatus = tabStatusList.find(item => item.tabId === tabId);
    if (tabStatus) {
      if (changeInfo.url) {
        console.log('Tab URL changed:', { tabId, oldUrl: tabStatus.url, newUrl: changeInfo.url });
        tabStatus.url = changeInfo.url;
      }
      if (changeInfo.title) {
        console.log('Tab title changed:', { tabId, oldTitle: tabStatus.title, newTitle: changeInfo.title });
        tabStatus.title = changeInfo.title;
      }
      if (changeInfo.favIconUrl) {
        tabStatus.icon = changeInfo.favIconUrl;
      }
    }

    // BUG-006: 添加到最近更新列表，debounce时间后自动移除
    recentlyUpdatedTabs.add(tabId);
    setTimeout(() => {
      recentlyUpdatedTabs.delete(tabId);
    }, TAB_UPDATE_DEBOUNCE_MS);
  }
});

/**
 * Adds a new tab to the tracking list
 * Skips pinned tabs (if FreezePinned is disabled) and non-HTTP(S) URLs
 *
 * @param tab - The tab object to add
 *
 * @example
 * const tab = await browser.tabs.get(123);
 * addTabToList(tab);
 */
function addTabToList(tab: browser.Tabs.Tab) {
  if (tab.id === undefined) return;
  if (tab.pinned && !FreezePinned.value) return;
  if (!tab.url?.startsWith('http')) return;

  const existingTab = tabStatusList.find(item => item.tabId === tab.id);
  if (existingTab) return;

  const newTab: TabStatus = {
    tabId: tab.id,
    url: tab.url || '',
    icon: tab.favIconUrl || '',
    title: tab.title || '',
    lastUseTime: Date.now(),
    windowId: tab.windowId,
    active: tab.active,
    isVisible: tab.active, // 新创建的标签页，active为true时初始为可见
    visibilityState: tab.active ? 'visible' : 'hidden'
  };
  tabStatusList.push(newTab);
  console.log('New tab added:', newTab);
}

/**
 * Updates an existing tab's information in the tracking list
 * If the tab doesn't exist, adds it as a new entry
 *
 * @param tab - The tab object with updated information
 *
 * @example
 * updateTabInList({ id: 123, url: 'https://newurl.com', ... });
 */
function updateTabInList(tab: browser.Tabs.Tab) {
  if (tab.id === undefined) return;

  const existingTab = tabStatusList.find(t => t.tabId === tab.id);
  if (existingTab) {
    existingTab.url = tab.url || '';
    existingTab.icon = tab.favIconUrl || '';
    existingTab.title = tab.title || '';
    existingTab.windowId = tab.windowId;
    existingTab.active = tab.active;
    // 注意：不在这里直接更新可见性状态，让content script通过Page Visibility API来管理
    console.log('Tab updated:', existingTab);
  } else {
    addTabToList(tab);
  }
}

/**
 * Removes a tab from both active and frozen tracking lists
 *
 * @param tabId - The ID of the tab to remove
 *
 * @example
 * removeTabFromList(123);
 */
function removeTabFromList(tabId: number) {
  const index = tabStatusList.findIndex(tab => tab.tabId === tabId);
  const freezeIndex = freezeTabStatusList.findIndex(tab => tab.tabId === tabId);
  if (index !== -1) {
    tabStatusList.splice(index, 1);
    console.log('Tab removed:', tabId);
  }
  if (freezeIndex !== -1) {
    freezeTabStatusList.splice(freezeIndex, 1);
    saveFreeTab();
    console.log('Frozen tab removed:', tabId);
  }
}

// 标签页事件监听
browser.tabs.onCreated.addListener(addTabToList);
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log('Tab updated:', tabId, changeInfo, tab);
  if (tab.url) updateTabInList(tab);
});

// 监听标签页激活事件，重置倒计时
browser.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await browser.tabs.get(activeInfo.tabId);
  if (tab.id && tab.url) {
    const tabStatus = tabStatusList.find(item => item.tabId === tab.id);
    if (tabStatus) {
      const oldTime = tabStatus.lastUseTime;
      tabStatus.lastUseTime = Date.now();
      console.log(`Reset countdown due to tab activation for tab ${tab.id}:`, {
        url: tab.url,
        title: tab.title,
        oldTime: new Date(oldTime).toLocaleTimeString(),
        newTime: new Date(tabStatus.lastUseTime).toLocaleTimeString()
      });
    } else {
      addTabToList(tab);
    }
  }
});

browser.tabs.onRemoved.addListener(removeTabFromList);

// 监听窗口焦点变化，重置活动标签页倒计时
browser.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === browser.windows.WINDOW_ID_NONE) return; // 忽略失去焦点的情况

  try {
    const tabs = await browser.tabs.query({ active: true, windowId });
    if (tabs.length > 0 && tabs[0].id) {
      const tab = tabs[0];
      const tabStatus = tabStatusList.find(item => item.tabId === tab.id);
      if (tabStatus) {
        const oldTime = tabStatus.lastUseTime;
        tabStatus.lastUseTime = Date.now();
        console.log(`Reset countdown due to window focus for tab ${tab.id}:`, {
          url: tab.url,
          title: tab.title,
          windowId,
          oldTime: new Date(oldTime).toLocaleTimeString(),
          newTime: new Date(tabStatus.lastUseTime).toLocaleTimeString()
        });
      }
    }
  } catch (error) {
    console.error('Error handling window focus change:', error);
  }
});

// 初始化时获取所有已打开的标签页
browser.tabs.query({}).then(tabs => {
  tabs.forEach(tab => {
    if (tab.id !== undefined) addTabToList(tab);
  });
});

/**
 * Freezes a tab by capturing its visible state and replacing it with a freeze page
 * The original URL and snapshot are stored for later restoration
 *
 * @param tabId - The ID of the tab to freeze
 * @returns Promise that resolves when the tab is frozen
 *
 * @example
 * await FreezeTab(123);
 */
async function FreezeTab(tabId: number) {
  try {
    const tab = await browser.tabs.get(tabId);

    // 尝试从 content script 获取最新的页面信息
    let latestUrl = tab.url || '';
    let latestTitle = tab.title || '';

    try {
      const pageInfo = await browser.tabs.sendMessage(tabId, { type: 'getPageInfo' }) as any;
      if (pageInfo && pageInfo.response && typeof pageInfo.response === 'object') {
        const responseObj = pageInfo.response as { url?: string; title?: string };
        latestUrl = responseObj.url || latestUrl;
        latestTitle = responseObj.title || latestTitle;
        console.log('Got latest page info from content script:', { url: latestUrl, title: latestTitle });
      }
    } catch (error) {
      // content script 可能已失效，使用 tab 对象中的信息
      console.log('Could not get page info from content script, using tab data:', error);
    }

    let snapshot = await browser.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 50 });
    const freezePageUrl = browser.runtime.getURL('src/options.html') +
      `?title=${encodeURIComponent(latestTitle)}&url=${encodeURIComponent(latestUrl)}&icon=${encodeURIComponent(tab.favIconUrl || '')}`;

    await browser.tabs.update(tabId, { url: freezePageUrl });
    await new Promise(resolve => setTimeout(resolve, 500));
    await browser.tabs.sendMessage(tabId, { type: 'setSnapshot', snapshot });

    removeTabFromList(tabId);
    freezeTabStatusList.push({
      tabId: tab.id!,
      url: latestUrl,
      icon: tab.favIconUrl || '',
      title: latestTitle,
    });

    console.log('Tab frozen with latest info:', {
      tabId: tab.id,
      url: latestUrl,
      title: latestTitle
    });

    saveFreeTab();
  } catch (error) {
    console.error('Error freezing tab:', error);
  }
}

/**
 * Restores all frozen tabs to their original URLs
 * Removes invalid entries from the freeze list
 *
 * @returns Promise resolving to operation result with success status, message, and count
 *
 * @example
 * const result = await restoreAllFrozenTabs();
 * console.log(`Restored ${result.restoredCount} tabs`);
 */
async function restoreAllFrozenTabs(): Promise<{ success: boolean; message: string; restoredCount: number }> {
  try {
    if (freezeTabStatusList.length === 0) {
      return { success: true, message: 'No frozen tabs to restore', restoredCount: 0 };
    }

    let restoredCount = 0;

    // 获取当前所有打开的标签页
    const currentTabs = await browser.tabs.query({});
    const currentTabIds = new Set(currentTabs.map(tab => tab.id));

    // 遍历所有冻结的标签页并恢复
    for (const frozenTab of [...freezeTabStatusList]) {
      try {
        // 检查标签页是否仍然存在
        if (!currentTabIds.has(frozenTab.tabId)) {
          freezeTabStatusList = freezeTabStatusList.filter(tab => tab.tabId !== frozenTab.tabId);
          continue;
        }

        // 恢复标签页到原始URL
        await browser.tabs.update(frozenTab.tabId, { url: frozenTab.url });

        // 等待页面加载完成
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 将恢复的标签页添加回活跃列表
        const restoredTab = await browser.tabs.get(frozenTab.tabId);
        if (restoredTab) {
          addTabToList(restoredTab);
        }

        // 从冻结列表中移除
        freezeTabStatusList = freezeTabStatusList.filter(tab => tab.tabId !== frozenTab.tabId);
        restoredCount++;

      } catch (error) {
        // 如果恢复失败，从冻结列表中移除以避免重复尝试
        freezeTabStatusList = freezeTabStatusList.filter(tab => tab.tabId !== frozenTab.tabId);
      }
    }

    // 保存更新后的冻结列表
    await saveFreeTab();

    const message = restoredCount > 0
      ? `Successfully restored ${restoredCount} frozen tabs`
      : 'No tabs were restored';

    return { success: true, message, restoredCount };

  } catch (error) {
    return { success: false, message: 'Failed to restore frozen tabs', restoredCount: 0 };
  }
}

/**
 * Checks if a domain matches any whitelist entry with wildcard support
 *
 * @param domain - The domain to check
 * @returns true if the domain matches a whitelist entry
 */
function isDomainInWhitelist(domain: string): boolean {
  const whitelistItems = domainsToWhitelistItems(whitelist);
  return whitelistItems.some(item => isDomainMatch(domain, item));
}

/**
 * Checks all tracked tabs and freezes those that have exceeded the timeout
 * Skips active, visible, and whitelisted tabs
 * Uses Page Visibility API state to determine actual visibility
 *
 * @returns Promise that resolves when check is complete
 *
 * @example
 * await checkAndFreezeTabs();
 */
async function checkAndFreezeTabs() {
  const now = Date.now();

  // 获取当前活动标签页信息
  const activeTabs = await browser.tabs.query({ active: true });
  const activeTabIds = new Set(activeTabs.map(tab => tab.id).filter(id => id !== undefined));

  // 获取所有可见的标签页（通过 Page Visibility API）
  const visibleTabIds = tabStatusList
    .filter(tab => tab.isVisible === true && tab.visibilityState === 'visible')
    .map(tab => tab.tabId);

  // BUG-001修复：先收集待冻结的tabId，避免在遍历时修改数组
  const tabsToFreeze: number[] = [];

  for (const item of tabStatusList) {
    if (isTabFrozen(item.tabId)) continue;

    let itemHostname: string;
    try {
      itemHostname = new URL(item.url).hostname;
    } catch (error) {
      console.warn('Invalid URL in tab status, skipping:', item.url, error);
      continue;
    }

    // BUG-009修复：使用通配符匹配的whitelist检查
    if (isDomainInWhitelist(itemHostname)) continue;

    // 🔒 关键修复：多重保护机制防止误冻结
    const isCurrentlyActive = activeTabIds.has(item.tabId);
    const isCurrentlyVisible = visibleTabIds.includes(item.tabId);

    // 如果标签页是活动的或可见的，不进行冻结检查
    if (isCurrentlyActive || isCurrentlyVisible) {
      console.log(`Skipping freeze check for active/visible tab ${item.tabId}:`, {
        active: isCurrentlyActive,
        visible: isCurrentlyVisible,
        url: item.url
      });
      continue;
    }

    // 只有在非活动且不可见的情况下才检查超时
    const elapsed = now - item.lastUseTime;
    const timeout = FreezeTimeout * 60 * 1000;

    if (elapsed > timeout) {
      console.log(`Freezing inactive tab ${item.tabId}:`, {
        elapsed: Math.round(elapsed / 1000),
        timeout: Math.round(timeout / 1000),
        url: item.url
      });
      tabsToFreeze.push(item.tabId);
    }
  }

  // 统一处理冻结，避免在遍历时修改数组
  for (const tabId of tabsToFreeze) {
    FreezeTab(tabId);
  }
}

/**
 * Gets the ID of the currently active tab in the current window
 *
 * @returns Promise resolving to tab ID or null if no active tab
 *
 * @example
 * const tabId = await getCurrentActiveTabId();
 */
async function getCurrentActiveTabId(): Promise<number | null> {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    return tabs.length > 0 && tabs[0].id ? tabs[0].id : null;
  } catch (error) {
    console.error('Error getting current active tab:', error);
    return null;
  }
}

/**
 * Calculates the remaining time (in minutes) before a tab will be frozen
 * Returns -1 for active/visible tabs (never freeze)
 *
 * @param tabId - The ID of the tab to check
 * @returns Promise resolving to minutes remaining, or -1 if tab is active
 *
 * @example
 * const minutes = await calculateRemainingTime(123);
 * if (minutes === -1) {
 *   console.log('Tab is active');
 * } else if (minutes === 0) {
 *   console.log('Tab will freeze soon');
 * } else {
 *   console.log(`${minutes} minutes until freeze`);
 * }
 */
async function calculateRemainingTime(tabId: number): Promise<number> {
  const tab = tabStatusList.find(item => item.tabId === tabId);
  if (!tab) return 0;

  // 基于页面可见性判断是否为活动状态
  // 只有真正可见的页面才被视为活动状态
  if (tab.isVisible === true && tab.visibilityState === 'visible') {
    return -1; // 特殊值表示活动状态
  }

  // 如果可见性信息不可用，回退到原来的活动标签页检测
  const activeTabId = await getCurrentActiveTabId();
  if (tabId === activeTabId) {
    return -1;
  }

  const now = Date.now();
  const elapsed = now - tab.lastUseTime;
  const timeout = FreezeTimeout * 60 * 1000;
  const remaining = timeout - elapsed;

  return Math.max(0, Math.ceil(remaining / (60 * 1000))); // 返回分钟数
}

/**
 * Gets remaining time information for all tracked tabs
 *
 * @returns Promise resolving to array of tab info with remaining minutes
 *
 * @example
 * const tabs = await getAllTabsRemainingTime();
 * tabs.forEach(tab => {
 *   console.log(`${tab.title}: ${tab.remainingMinutes} min remaining`);
 * });
 */
async function getAllTabsRemainingTime() {
  const tabPromises = tabStatusList.map(async tab => ({
    tabId: tab.tabId,
    title: tab.title,
    url: tab.url,
    icon: tab.icon,
    windowId: tab.windowId,
    active: tab.active,
    remainingMinutes: await calculateRemainingTime(tab.tabId),
    lastUseTime: tab.lastUseTime
  }));

  return await Promise.all(tabPromises);
}

/**
 * Checks if a tab is currently frozen
 *
 * @param tabId - The ID of the tab to check
 * @returns true if the tab is in the frozen list, false otherwise
 *
 * @example
 * if (isTabFrozen(123)) {
 *   console.log('Tab is frozen');
 * }
 */
function isTabFrozen(tabId: number): boolean {
  return freezeTabStatusList.some(tab => tab.tabId === tabId);
}

/** saveFreeTab 防抖定时器 */
let saveFreeTabTimeout: number | null = null;
/** 防抖延迟：500ms内多次调用只执行一次存储 */
const SAVE_FREE_TAB_DEBOUNCE_MS = 500;

/**
 * 刷新保存冻结标签页状态（立即执行，不防抖）
 * 用于需要立即保存的场景（如页面卸载前）
 */
async function flushSaveFreeTab() {
  if (saveFreeTabTimeout !== null) {
    clearTimeout(saveFreeTabTimeout);
    saveFreeTabTimeout = null;
  }
  await doSaveFreeTab();
}

/**
 * 执行实际的存储操作
 */
async function doSaveFreeTab() {
  try {
    await browser.storage.sync.set({ 'freezeTabStatusList': freezeTabStatusList });
  } catch (error) {
    console.error('Error saving freeze tab status:', error);
  }
}

/**
 * Saves the current freeze tab status list to storage
 * BUG-010修复：添加错误处理，避免存储写入失败时无感知
 * 性能优化：使用防抖机制批量处理多次快速调用
 *
 * @returns void（立即返回，实际保存会延迟执行）
 *
 * @example
 * saveFreeTab(); // 多次调用会被防抖合并
 */
function saveFreeTab() {
  // 如果已有待执行的保存，取消并重新计时（防抖）
  if (saveFreeTabTimeout !== null) {
    clearTimeout(saveFreeTabTimeout);
  }

  saveFreeTabTimeout = window.setTimeout(async () => {
    saveFreeTabTimeout = null;
    await doSaveFreeTab();
  }, SAVE_FREE_TAB_DEBOUNCE_MS);
}

// SmartScheduler实例：性能优化，使用智能调度器替代setInterval
const smartScheduler = new SmartScheduler();

// 性能优化：使用SmartScheduler替代setInterval
smartScheduler.addTask('checkAndFreezeTabs', async () => {
  await checkAndFreezeTabs();
}, CHECK_INTERVAL_MS);

smartScheduler.addTask('cleanupFrozenTabs', async () => {
  await cleanupFrozenTabs();
}, 3600000); // 每小时清理一次

smartScheduler.start(1000); // 每秒检查一次是否有任务需要执行

// BUG-013: 扩展卸载时清理 scheduler 并刷新待保存的数据
browser.runtime.onSuspend.addListener(async () => {
  smartScheduler.stop();
  await flushSaveFreeTab();
});

/**
 * Retrieves the current whitelist with validation
 * Filters out invalid domain entries
 *
 * @returns Promise resolving to array of whitelisted domain names
 *
 * @example
 * const whitelist = await getWhitelist();
 * console.log('Protected domains:', whitelist);
 */
async function getWhitelist(): Promise<string[]> {
  try {
    // 验证白名单数据完整性
    if (!Array.isArray(whitelist)) {
      console.warn('Whitelist is not an array, resetting to empty array');
      whitelist = [];
      await safeStorage.set({ whitelist });
    }

    // 过滤无效域名
    const validDomains = whitelist.filter(domain => {
      if (!domain || typeof domain !== 'string') return false;
      return isValidDomain(domain);
    });

    // 如果发现无效域名，更新白名单
    if (validDomains.length !== whitelist.length) {
      console.log('Filtered invalid domains from whitelist:', {
        original: whitelist.length,
        filtered: validDomains.length,
        removed: whitelist.length - validDomains.length
      });
      whitelist = validDomains;
      await safeStorage.set({ whitelist });
    }

    console.log('Retrieved whitelist:', validDomains);
    return [...whitelist]; // 返回副本以避免外部修改
  } catch (error) {
    console.error('Error getting whitelist:', error);
    return [];
  }
}

/**
 * Adds a domain to the whitelist
 * Normalizes the domain and validates before adding
 *
 * @param domain - The domain name to add (can be full URL or just domain)
 * @returns Promise resolving to success status and message
 *
 * @example
 * const result = await addToWhitelist('example.com');
 * if (result.success) {
 *   console.log(result.message);
 * }
 */
async function addToWhitelist(domain: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!domain || typeof domain !== 'string') {
      return { success: false, message: 'Invalid domain format' };
    }

    // 标准化域名
    const normalizedDomain = normalizeDomain(domain);

    if (!normalizedDomain) {
      return { success: false, message: 'Invalid domain format' };
    }

    // 验证域名格式
    if (!isValidDomain(normalizedDomain)) {
      return { success: false, message: `Invalid domain: ${normalizedDomain}` };
    }

    // 检查是否已存在
    if (whitelist.includes(normalizedDomain)) {
      return { success: false, message: `Domain already in whitelist: ${normalizedDomain}` };
    }

    // 添加到白名单
    whitelist.push(normalizedDomain);

    // 保存到存储
    await safeStorage.set({ whitelist });
    console.log('Added to whitelist:', normalizedDomain);

    return { success: true, message: `Added to whitelist: ${normalizedDomain}` };
  } catch (error) {
    console.error('Error adding to whitelist:', error);
    return { success: false, message: 'Failed to add domain to whitelist' };
  }
}

/**
 * Removes a domain from the whitelist
 *
 * @param domain - The domain name to remove
 * @returns Promise resolving to success status and message
 *
 * @example
 * const result = await removeFromWhitelist('example.com');
 * if (result.success) {
 *   console.log(result.message);
 * }
 */
async function removeFromWhitelist(domain: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!domain || typeof domain !== 'string') {
      return { success: false, message: 'Invalid domain format' };
    }

    // 标准化域名
    const normalizedDomain = normalizeDomain(domain);

    if (!normalizedDomain) {
      return { success: false, message: 'Invalid domain format' };
    }

    // 检查是否存在
    const index = whitelist.indexOf(normalizedDomain);
    if (index === -1) {
      return { success: false, message: `Domain not found in whitelist: ${normalizedDomain}` };
    }

    // 从白名单移除
    whitelist.splice(index, 1);

    // 保存到存储
    await safeStorage.set({ whitelist });
    console.log('Removed from whitelist:', normalizedDomain);

    return { success: true, message: `Removed from whitelist: ${normalizedDomain}` };
  } catch (error) {
    console.error('Error removing from whitelist:', error);
    return { success: false, message: 'Failed to remove domain from whitelist' };
  }
}

/**
 * Adds multiple domains to the whitelist in a single operation
 * Validates all domains before adding and skips duplicates
 *
 * @param domains - Array of domain names to add
 * @returns Promise resolving to bulk operation result
 *
 * @example
 * const result = await addMultipleToWhitelist(['example.com', 'github.com']);
 */
async function addMultipleToWhitelist(domains: string[]): Promise<{ success: boolean; message: string; processed: number; failed: number; errors: string[] }> {
  const result = {
    success: false,
    message: '',
    processed: 0,
    failed: 0,
    errors: [] as string[]
  };

  try {
    if (!Array.isArray(domains) || domains.length === 0) {
      return { ...result, message: 'Domains must be a non-empty array' };
    }

    const domainsToAdd: string[] = [];
    const existingDomains = new Set(whitelist);

    for (const domain of domains) {
      if (!domain || typeof domain !== 'string') {
        result.failed++;
        result.errors.push(`Invalid domain: ${domain}`);
        continue;
      }

      const normalizedDomain = normalizeDomain(domain.trim());
      if (!normalizedDomain || !isValidDomain(normalizedDomain)) {
        result.failed++;
        result.errors.push(`Invalid domain format: ${domain}`);
        continue;
      }

      if (existingDomains.has(normalizedDomain)) {
        result.failed++;
        result.errors.push(`Domain already in whitelist: ${normalizedDomain}`);
        continue;
      }

      domainsToAdd.push(normalizedDomain);
      existingDomains.add(normalizedDomain);
      result.processed++;
    }

    if (domainsToAdd.length > 0) {
      whitelist.push(...domainsToAdd);
      await safeStorage.set({ whitelist });
      console.log('Added multiple domains to whitelist:', domainsToAdd);
    }

    result.success = result.failed === 0 || result.processed > 0;
    result.message = `Added ${result.processed} domain${result.processed !== 1 ? 's' : ''}`;

  } catch (error) {
    console.error('Error adding multiple domains:', error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    result.message = 'Failed to add domains';
  }

  return result;
}

/**
 * Removes multiple domains from the whitelist in a single operation
 *
 * @param domains - Array of domain names to remove
 * @returns Promise resolving to bulk operation result
 *
 * @example
 * const result = await removeMultipleFromWhitelist(['example.com', 'github.com']);
 */
async function removeMultipleFromWhitelist(domains: string[]): Promise<{ success: boolean; message: string; processed: number; failed: number; errors: string[] }> {
  const result = {
    success: false,
    message: '',
    processed: 0,
    failed: 0,
    errors: [] as string[]
  };

  try {
    if (!Array.isArray(domains) || domains.length === 0) {
      return { ...result, message: 'Domains must be a non-empty array' };
    }

    const domainsToRemove = new Set(
      domains
        .filter(d => d && typeof d === 'string')
        .map(d => normalizeDomain(d.trim()))
        .filter(d => d)
    );

    if (domainsToRemove.size === 0) {
      return { ...result, message: 'No valid domains to remove' };
    }

    const originalLength = whitelist.length;
    whitelist = whitelist.filter(d => !domainsToRemove.has(d));
    const removed = originalLength - whitelist.length;

    if (removed > 0) {
      await safeStorage.set({ whitelist });
      console.log('Removed multiple domains from whitelist:', removed);
    }

    result.processed = removed;
    result.failed = domainsToRemove.size - removed;
    result.success = result.processed > 0;
    result.message = `Removed ${result.processed} domain${result.processed !== 1 ? 's' : ''}`;

  } catch (error) {
    console.error('Error removing multiple domains:', error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    result.message = 'Failed to remove domains';
  }

  return result;
}

/**
 * Clears all domains from the whitelist
 * Destructive operation with no undo
 *
 * @returns Promise resolving to bulk operation result
 *
 * @example
 * const result = await clearWhitelist();
 */
async function clearWhitelist(): Promise<{ success: boolean; message: string; processed: number; failed: number; errors: string[] }> {
  const result = {
    success: false,
    message: '',
    processed: 0,
    failed: 0,
    errors: [] as string[]
  };

  try {
    const originalLength = whitelist.length;
    whitelist = [];
    await safeStorage.set({ whitelist });

    result.processed = originalLength;
    result.success = true;
    result.message = `Cleared ${originalLength} domain${originalLength !== 1 ? 's' : ''} from whitelist`;
    console.log('Cleared whitelist');

  } catch (error) {
    console.error('Error clearing whitelist:', error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    result.message = 'Failed to clear whitelist';
  }

  return result;
}

/**
 * Exports current whitelist as JSON string
 *
 * @returns Promise resolving to JSON export data
 *
 * @example
 * const data = await exportWhitelistData();
 */
async function exportWhitelistData(): Promise<{ version: string; exportedAt: number; items: any[] }> {
  const items = whitelist.map(domain => ({
    domain,
    addedAt: Date.now(),
    isWildcard: domain.startsWith('*.')
  }));

  return {
    version: '1.0.0',
    exportedAt: Date.now(),
    items
  };
}

/**
 * Imports whitelist data from JSON string
 *
 * @param json - JSON string containing export data
 * @param onConflict - Strategy for handling duplicates: 'skip' | 'overwrite' | 'keep'
 * @returns Promise resolving to import result
 *
 * @example
 * const result = await importWhitelistData(jsonString, 'skip');
 */
async function importWhitelistData(
  json: string,
  onConflict: 'skip' | 'overwrite' | 'keep' = 'skip'
): Promise<{ success: boolean; imported: number; failed: number; duplicates: number; errors: string[] }> {
  const result = {
    success: false,
    imported: 0,
    failed: 0,
    duplicates: 0,
    errors: [] as string[]
  };

  try {
    let importData: any;
    try {
      importData = JSON.parse(json);
    } catch (parseError) {
      result.errors.push('Invalid JSON format');
      return result;
    }

    if (!importData.items || !Array.isArray(importData.items)) {
      result.errors.push('Invalid export format: missing or invalid items array');
      return result;
    }

    const existingSet = new Set(whitelist);
    const toAdd: string[] = [];

    for (const item of importData.items) {
      if (!item || !item.domain) {
        result.failed++;
        result.errors.push('Invalid item: missing domain');
        continue;
      }

      const normalizedDomain = normalizeDomain(item.domain);
      if (!normalizedDomain || !isValidDomain(normalizedDomain)) {
        result.failed++;
        result.errors.push(`Invalid domain: ${item.domain}`);
        continue;
      }

      if (existingSet.has(normalizedDomain)) {
        result.duplicates++;

        if (onConflict === 'skip') {
          continue;
        } else if (onConflict === 'overwrite') {
          // Remove existing, will add new
          whitelist = whitelist.filter(d => d !== normalizedDomain);
        } else if (onConflict === 'keep') {
          continue;
        }
      }

      toAdd.push(normalizedDomain);
      existingSet.add(normalizedDomain);
      result.imported++;
    }

    if (toAdd.length > 0) {
      whitelist.push(...toAdd);
      await safeStorage.set({ whitelist });
    }

    result.success = result.failed === 0 || result.imported > 0;

  } catch (error) {
    console.error('Error importing whitelist:', error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return result;
}

// 消息处理
browser.runtime.onMessage.addListener((req: unknown, sender, sendResponse: SendResponse) => {
  const request = req as Message;
  if (request.UpDateLastUseTime && sender.tab?.id) {
    const tabStatus = tabStatusList.find(item => item.tabId === sender.tab!.id);
    console.log('Update last use time:', tabStatus);
    if (tabStatus) {
      tabStatus.lastUseTime = Date.now();
      sendResponse({ response: 'Last use time updated' });
    } else {
      addTabToList(sender.tab);
      sendResponse({ response: 'Tab added and last use time set' });
    }
  }

  // 处理页面信息更新
  if (request.UpdatePageInfo && sender.tab?.id) {
    const tabStatus = tabStatusList.find(item => item.tabId === sender.tab!.id);
    if (tabStatus) {
      const urlChanged = request.url && request.url !== tabStatus.url;
      const titleChanged = request.title && request.title !== tabStatus.title;

      // 更新 URL 和标题
      if (urlChanged) {
        tabStatus.url = request.url as string;
        console.log('Updated tab URL:', { tabId: sender.tab!.id, newUrl: request.url });
      }
      if (titleChanged) {
        tabStatus.title = request.title as string;
        console.log('Updated tab title:', { tabId: sender.tab!.id, newTitle: request.title });
      }

      // 页面信息变化时重置倒计时（表示用户活跃）
      if (urlChanged || titleChanged) {
        const oldTime = tabStatus.lastUseTime;
        tabStatus.lastUseTime = Date.now();
        console.log(`Reset countdown due to page info update for tab ${sender.tab!.id}:`, {
          urlChanged,
          titleChanged,
          oldTime: new Date(oldTime).toLocaleTimeString(),
          newTime: new Date(tabStatus.lastUseTime).toLocaleTimeString()
        });
      }

      sendResponse({ response: 'Page info updated and countdown reset' });
    } else {
      // 如果找不到记录，创建新记录
      if (sender.tab) {
        addTabToList(sender.tab);
        sendResponse({ response: 'Tab added with page info and countdown reset' });
      }
    }
  }
  if (request.getTabId) {
    sendResponse({ response: sender.tab?.id });
  }
  if (request.GetTabStatusList) {
    getAllTabsRemainingTime().then(result => {
      sendResponse({ response: result });
    }).catch(error => {
      console.error('Error getting tab status list:', error);
      sendResponse({ response: [], error: 'Failed to get tab status' });
    });
    return true; // 异步响应
  }
  if (request.GetRemainingTime) {
    calculateRemainingTime(request.tabId as number).then(remainingTime => {
      sendResponse({ response: remainingTime });
    }).catch(error => {
      console.error('Error getting remaining time:', error);
      sendResponse({ response: 0, error: 'Failed to get remaining time' });
    });
    return true; // 异步响应
  }
  if (request.GetFreezeTabList) {
    sendResponse({ response: freezeTabStatusList });
  }
  if (request.RemoveFreezeTab) {
    freezeTabStatusList = freezeTabStatusList.filter((tab) => tab.tabId !== request.RemoveFreezeTab);
    saveFreeTab();
    sendResponse({ response: 'Tab removed from freeze list' });
  }

  // 新增：恢复所有冻结的标签页
  if (request.RestoreAllFrozenTabs) {
    restoreAllFrozenTabs().then(result => {
      sendResponse({ response: result });
    }).catch(error => {
      console.error('Error restoring all frozen tabs:', error);
      sendResponse({ response: { success: false, message: 'Failed to restore frozen tabs' } });
    });
    return true; // 异步响应
  }
    // 新的白名单 CRUD 操作
  if (request.GetWhitelist) {
    getWhitelist().then(whitelistData => {
      sendResponse({ response: whitelistData });
    }).catch(error => {
      console.error('Error getting whitelist:', error);
      sendResponse({ response: [], error: 'Failed to get whitelist' });
    });
    return true; // 异步响应
  }

  if (request.AddToWhitelist) {
    addToWhitelist(request.AddToWhitelist).then(result => {
      sendResponse({ response: result });
    }).catch(error => {
      console.error('Error adding to whitelist:', error);
      sendResponse({ response: { success: false, message: 'Failed to add domain to whitelist' } });
    });
    return true; // 异步响应
  }

  if (request.RemoveFromWhitelist) {
    removeFromWhitelist(request.RemoveFromWhitelist).then(result => {
      sendResponse({ response: result });
    }).catch(error => {
      console.error('Error removing from whitelist:', error);
      sendResponse({ response: { success: false, message: 'Failed to remove domain from whitelist' } });
    });
    return true; // 异步响应
  }

  // New bulk whitelist operations
  if (request.AddMultipleToWhitelist) {
    addMultipleToWhitelist(request.AddMultipleToWhitelist).then(result => {
      sendResponse({ response: result });
    }).catch(error => {
      console.error('Error adding multiple to whitelist:', error);
      sendResponse({ response: { success: false, message: 'Failed to add domains to whitelist', processed: 0, failed: 0, errors: [error instanceof Error ? error.message : 'Unknown error'] } });
    });
    return true; // 异步响应
  }

  if (request.RemoveMultipleFromWhitelist) {
    removeMultipleFromWhitelist(request.RemoveMultipleFromWhitelist).then(result => {
      sendResponse({ response: result });
    }).catch(error => {
      console.error('Error removing multiple from whitelist:', error);
      sendResponse({ response: { success: false, message: 'Failed to remove domains from whitelist', processed: 0, failed: 0, errors: [error instanceof Error ? error.message : 'Unknown error'] } });
    });
    return true; // 异步响应
  }

  if (request.ClearWhitelist) {
    clearWhitelist().then(result => {
      sendResponse({ response: result });
    }).catch(error => {
      console.error('Error clearing whitelist:', error);
      sendResponse({ response: { success: false, message: 'Failed to clear whitelist', processed: 0, failed: 0, errors: [error instanceof Error ? error.message : 'Unknown error'] } });
    });
    return true; // 异步响应
  }

  if (request.ExportWhitelist) {
    exportWhitelistData().then(data => {
      sendResponse({ response: data });
    }).catch(error => {
      console.error('Error exporting whitelist:', error);
      sendResponse({ response: { success: false, message: 'Failed to export whitelist' } });
    });
    return true; // 异步响应
  }

  if (request.ImportWhitelist) {
    importWhitelistData(request.ImportWhitelist.data, request.ImportWhitelist.onConflict).then(result => {
      sendResponse({ response: result });
    }).catch(error => {
      console.error('Error importing whitelist:', error);
      sendResponse({ response: { success: false, message: 'Failed to import whitelist', imported: 0, failed: 0, duplicates: 0, errors: [error instanceof Error ? error.message : 'Unknown error'] } });
    });
    return true; // 异步响应
  }

  if (request.GotoTaskPage && request.data !== undefined) {
    browser.tabs.update(request.data as number, { active: true });
  }

  // 处理页面可见性变化
  if (request.SetPageVisible) {
    const tabStatus = tabStatusList.find(item => item.tabId === sender.tab!.id);
    if (tabStatus) {
      tabStatus.isVisible = true;
      tabStatus.visibilityState = 'visible';
      tabStatus.lastUseTime = Date.now(); // 页面可见时更新使用时间
      console.log('Page became visible:', { tabId: sender.tab!.id, url: tabStatus.url });
    }
  }

  if (request.SetPageHidden) {
    const tabStatus = tabStatusList.find(item => item.tabId === sender.tab!.id);
    if (tabStatus) {
      tabStatus.isVisible = false;
      tabStatus.visibilityState = 'hidden';
      console.log('Page became hidden:', { tabId: sender.tab!.id, url: tabStatus.url });
    }
  }

  if (request.GetVisibleTabs) {
    const visibleTabs = tabStatusList.filter(tab => tab.isVisible === true && tab.visibilityState === 'visible');
    sendResponse({ response: visibleTabs.map(tab => tab.tabId) });
    return true;
  }

  // BUG-004: 添加default分支处理未知消息类型
  console.warn('Unknown message type received:', request);

  return true;
});

/**
 * Creates the extension's context menu items
 * Removes existing menus before creating new ones
 *
 * @returns Promise that resolves when menus are created
 *
 * @example
 * await createContextMenus();
 */
function createContextMenus() {
  browser.contextMenus.removeAll().then(() => {
    browser.contextMenus.create({
      id: 'FreezeTab',
      title: '冻结此页面',
      contexts: ['page'],
      documentUrlPatterns: ['http://*/*', 'https://*/*']
    });
    browser.contextMenus.create({
      id: 'whitelist',
      title: '添加到白名单',
      contexts: ['page'],
      documentUrlPatterns: ['http://*/*', 'https://*/*']
    });
  }).catch(error => {
    console.error('Error creating context menus:', error);
  });
}

browser.runtime.onInstalled.addListener(createContextMenus);
browser.runtime.onStartup.addListener(createContextMenus);

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  switch (info.menuItemId) {
    case 'FreezeTab':
      FreezeTab(tab.id);
      break;
    case 'whitelist':
      if (tab.url) {
        try {
          const url = new URL(tab.url).hostname;
          addToWhitelist(url).then(result => {
            if (result.success) {
              console.log('Added from context menu:', result.message);
            } else {
              console.warn('Failed to add from context menu:', result.message);
            }
          });
        } catch (error) {
          console.warn('Invalid URL for context menu whitelist:', tab.url, error);
        }
      }
      break;
  }
});

/**
 * Removes closed tabs from the freeze list
 * Compares against currently open tabs and removes stale entries
 *
 * @returns Promise that resolves when cleanup is complete
 *
 * @example
 * await cleanupFrozenTabs();
 */
async function cleanupFrozenTabs() {
  const tabs = await browser.tabs.query({});
  const currentTabIds = tabs.map(tab => tab.id);
  freezeTabStatusList = freezeTabStatusList.filter(frozenTab =>
    currentTabIds.includes(frozenTab.tabId)
  );
  saveFreeTab();
}

/**
 * Handles keyboard command events from browser.commands API
 * Executes the corresponding action based on the command name
 *
 * @param command - The command identifier (e.g., 'freeze-current-tab')
 *
 * @example
 * // When user presses Ctrl+Shift+F
 * // command will be 'freeze-current-tab'
 */
browser.commands.onCommand.addListener(async (command: string) => {
  console.log('Keyboard command triggered:', command);

  try {
    switch (command) {
      case 'freeze-current-tab': {
        // 冻结当前标签页
        const activeTabId = await getCurrentActiveTabId();
        if (activeTabId !== null) {
          await FreezeTab(activeTabId);
          console.log('Frozen current tab via keyboard shortcut:', activeTabId);
        }
        break;
      }

      case 'unfreeze-all-tabs': {
        // 解冻所有标签页
        const result = await restoreAllFrozenTabs();
        console.log('Unfroze all tabs via keyboard shortcut:', result);
        break;
      }

      case 'add-to-whitelist': {
        // 添加当前网站到白名单
        const activeTabId = await getCurrentActiveTabId();
        if (activeTabId !== null) {
          const tab = await browser.tabs.get(activeTabId);
          if (tab.url) {
            const hostname = new URL(tab.url).hostname;
            const result = await addToWhitelist(hostname);
            console.log('Added to whitelist via keyboard shortcut:', {
              hostname,
              result
            });
          }
        }
        break;
      }

      case 'open-popup': {
        // 打开弹出窗口 - 在 Chrome 中无法通过 API 主动打开 popup
        // 但可以打开选项页面作为替代
        console.log('Open popup command received - browser popup cannot be opened programmatically');
        break;
      }

      default:
        console.warn('Unknown keyboard command:', command);
    }
  } catch (error) {
    console.error('Error handling keyboard command:', error);
  }
});