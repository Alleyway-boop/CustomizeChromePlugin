import { ref } from 'vue';
import browser from 'webextension-polyfill';
import { Message, SendResponse, TabStatus, FreezeTabStatus } from './types';
import { safeAsync, safeStorage, safeTabs, ExtensionError, ErrorCodes, isValidDomain, normalizeDomain } from './utils/error-handler';
import { SmartScheduler } from './utils/performance';
import { configManager } from './utils/config';
import {
  DEFAULT_FREEZE_TIMEOUT_MINUTES,
  BADGE_ZERO_TEXT,
  BADGE_COLOR,
  BADGE_TEXT_COLOR,
  STORAGE_KEY_DEBUG_ENABLED,
  STORAGE_KEY_FREEZE_TIMEOUT,
  STORAGE_KEY_FREEZE_PINNED,
  STORAGE_KEY_WHITELIST,
  STORAGE_KEY_FREEZE_TAB_LIST,
  STORAGE_KEY_UNFREEZE_COUNTS,
  UNFREEZE_COUNT_THRESHOLD,
} from './constants';

// Debug mode state
let DEBUG_MODE = false;
function debugLog(...args: unknown[]) {
  if (DEBUG_MODE) {
    console.log('[DEBUG]', ...args);
  }
}

// 配置和状态
let whitelist: string[] = [];
let FreezeTimeout: number = 20; // 默认值，单位：分钟
const FreezePinned = ref(false);

// Performance optimization: Use Map for O(1) lookups instead of O(n) array.find()
let tabStatusMap: Map<number, TabStatus> = new Map();
let freezeTabStatusMap: Map<number, FreezeTabStatus> = new Map();

// For backwards compatibility, expose arrays for UI that expects them
let tabStatusList: TabStatus[] = [];
let freezeTabStatusList: FreezeTabStatus[] = [];

// Debounce freeze operations to prevent double-freeze
const freezingInProgress: Set<number> = new Set();

// Unfreeze count tracking for smart whitelist suggestions
let unfreezeCountMap: Map<string, number> = new Map();

// Badge update function - shows frozen tab count on extension icon
async function updateBadge() {
  const count = freezeTabStatusMap.size;
  try {
    if (chrome.action && chrome.action.setBadgeText) {
      if (count === 0) {
        await chrome.action.setBadgeText({ text: BADGE_ZERO_TEXT });
      } else {
        await chrome.action.setBadgeText({ text: String(count) });
      }
      await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
      debugLog('Badge updated:', count === 0 ? BADGE_ZERO_TEXT : count);
    }
  } catch (error) {
    console.warn('Failed to update badge:', error);
  }
}

// 白名单数据验证和清理
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
browser.storage.sync.get(['FreezeTimeout', 'FreezePinned', 'whitelist', STORAGE_KEY_DEBUG_ENABLED]).then(async (res: { FreezeTimeout?: number; FreezePinned?: boolean; whitelist?: string[]; debugEnabled?: boolean }) => {
  if (res.FreezeTimeout) FreezeTimeout = res.FreezeTimeout;
  if (res.FreezePinned !== undefined) FreezePinned.value = res.FreezePinned;
  if (res.debugEnabled !== undefined) DEBUG_MODE = res.debugEnabled;

  // 验证和清理白名单数据
  if (res.whitelist) {
    const cleanedWhitelist = await validateAndCleanWhitelist(res.whitelist);
    whitelist = cleanedWhitelist;

    // 如果清理过程中移除了无效数据，保存清理后的结果
    if (cleanedWhitelist.length !== res.whitelist.length) {
      debugLog('Cleaned whitelist data during initialization:', {
        original: res.whitelist.length,
        cleaned: cleanedWhitelist.length,
        removed: res.whitelist.length - cleanedWhitelist.length
      });
      await safeStorage.set({ whitelist: cleanedWhitelist });
    }
  } else {
    whitelist = [];
  }

  debugLog('Initial config:', { FreezeTimeout, FreezePinned, whitelist, debugEnabled: DEBUG_MODE });
  
  // Update badge on startup
  await updateBadge();
});

// Load unfreeze counts from storage for smart whitelist suggestions
browser.storage.sync.get(STORAGE_KEY_UNFREEZE_COUNTS).then((res: { [key: string]: number }) => {
  if (res[STORAGE_KEY_UNFREEZE_COUNTS]) {
    try {
      const counts = JSON.parse(res[STORAGE_KEY_UNFREEZE_COUNTS]);
      unfreezeCountMap = new Map(Object.entries(counts));
      debugLog('Loaded unfreeze counts:', unfreezeCountMap);
    } catch (e) {
      debugLog('Failed to parse unfreeze counts:', e);
    }
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
    const loadedList = res.freezeTabStatusList as FreezeTabStatus[];
    freezeTabStatusList = loadedList;
    // Initialize Map for O(1) lookups
    freezeTabStatusMap = new Map(loadedList.map(tab => [tab.tabId, tab]));
    console.log('Loaded freezeTabStatusList:', freezeTabStatusList);
  }
});

// 监听标签页更新事件（包括URL变化）
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.title) {
    // 如果URL或标题发生变化，更新tabStatusMap中的信息
    const tabStatus = tabStatusMap.get(tabId);
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
      // Update the Map entry
      tabStatusMap.set(tabId, tabStatus);
      // Sync to array for backwards compatibility
      const index = tabStatusList.findIndex(t => t.tabId === tabId);
      if (index !== -1) {
        tabStatusList[index] = tabStatus;
      }
    }
  }
});

// 标签页管理函数
function addTabToList(tab: browser.Tabs.Tab) {
  if (tab.id === undefined) return;
  if (tab.pinned && !FreezePinned.value) return;
  if (!tab.url?.startsWith('http')) return;

  // Use Map for O(1) lookup
  if (tabStatusMap.has(tab.id)) return;

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
  
  // Store in Map for O(1) lookups
  tabStatusMap.set(tab.id, newTab);
  // Also maintain array for backwards compatibility
  tabStatusList.push(newTab);
  console.log('New tab added:', newTab);
}

function updateTabInList(tab: browser.Tabs.Tab) {
  if (tab.id === undefined) return;

  // Use Map for O(1) lookup
  const existingTab = tabStatusMap.get(tab.id);
  if (existingTab) {
    existingTab.url = tab.url || '';
    existingTab.icon = tab.favIconUrl || '';
    existingTab.title = tab.title || '';
    existingTab.windowId = tab.windowId;
    existingTab.active = tab.active;
    // Update Map
    tabStatusMap.set(tab.id, existingTab);
    // Sync to array for backwards compatibility
    const index = tabStatusList.findIndex(t => t.tabId === tab.id);
    if (index !== -1) {
      tabStatusList[index] = existingTab;
    }
    // 注意：不在这里直接更新可见性状态，让content script通过Page Visibility API来管理
    console.log('Tab updated:', existingTab);
  } else {
    addTabToList(tab);
  }
}

function removeTabFromList(tabId: number) {
  // Remove from Map (O(1) operation)
  const wasInMap = tabStatusMap.delete(tabId);
  
  // Also remove from array for backwards compatibility
  const index = tabStatusList.findIndex(tab => tab.tabId === tabId);
  if (index !== -1) {
    tabStatusList.splice(index, 1);
    console.log('Tab removed:', tabId);
  }
  
  // Remove from freeze map and array
  const freezeWasInMap = freezeTabStatusMap.delete(tabId);
  const freezeIndex = freezeTabStatusList.findIndex(tab => tab.tabId === tabId);
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
    // Use Map for O(1) lookup
    const tabStatus = tabStatusMap.get(tab.id);
    if (tabStatus) {
      const oldTime = tabStatus.lastUseTime;
      tabStatus.lastUseTime = Date.now();
      // Update Map
      tabStatusMap.set(tab.id, tabStatus);
      // Sync to array
      const index = tabStatusList.findIndex(t => t.tabId === tab.id);
      if (index !== -1) {
        tabStatusList[index] = tabStatus;
      }
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
      // Use Map for O(1) lookup
      const tabStatus = tabStatusMap.get(tab.id);
      if (tabStatus) {
        const oldTime = tabStatus.lastUseTime;
        tabStatus.lastUseTime = Date.now();
        // Update Map
        tabStatusMap.set(tab.id, tabStatus);
        // Sync to array
        const index = tabStatusList.findIndex(t => t.tabId === tab.id);
        if (index !== -1) {
          tabStatusList[index] = tabStatus;
        }
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

// 冻结标签页函数
async function FreezeTab(tabId: number) {
  // Debounce: Check if already freezing or frozen
  if (freezingInProgress.has(tabId)) {
    console.log(`Tab ${tabId} is already being frozen, skipping`);
    return;
  }
  
  // Check if already frozen using Map (O(1))
  if (freezeTabStatusMap.has(tabId)) {
    console.log(`Tab ${tabId} is already frozen, skipping`);
    return;
  }

  try {
    freezingInProgress.add(tabId);
    
    const tab = await browser.tabs.get(tabId);

    // 尝试从 content script 获取最新的页面信息
    let latestUrl = tab.url || '';
    let latestTitle = tab.title || '';

    try {
      const pageInfoResponse = await browser.tabs.sendMessage(tabId, { type: 'getPageInfo' });
      const pageInfo = pageInfoResponse as { response?: { url?: string; title?: string } };
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
    
    // Add to freeze map (O(1))
    const frozenTab: FreezeTabStatus = {
      tabId: tab.id!,
      url: latestUrl,
      icon: tab.favIconUrl || '',
      title: latestTitle,
    };
    freezeTabStatusMap.set(tabId, frozenTab);
    freezeTabStatusList.push(frozenTab);

    console.log('Tab frozen with latest info:', {
      tabId: tab.id,
      url: latestUrl,
      title: latestTitle
    });

    saveFreeTab();
    updateBadge(); // Update badge after freezing
  } catch (error) {
    console.error('Error freezing tab:', error);
  } finally {
    freezingInProgress.delete(tabId);
  }
}

// 恢复所有冻结的标签页
async function restoreAllFrozenTabs(): Promise<{ success: boolean; message: string; restoredCount: number }> {
  try {
    if (freezeTabStatusMap.size === 0) {
      return { success: true, message: 'No frozen tabs to restore', restoredCount: 0 };
    }

    let restoredCount = 0;

    // 获取当前所有打开的标签页
    const currentTabs = await browser.tabs.query({});
    const currentTabIds = new Set(currentTabs.map(tab => tab.id));

    // Get tabs to restore from Map
    const tabsToRestore = Array.from(freezeTabStatusMap.values());
    
    // 遍历所有冻结的标签页并恢复
    for (const frozenTab of tabsToRestore) {
      try {
        // 检查标签页是否仍然存在
        if (!currentTabIds.has(frozenTab.tabId)) {
          freezeTabStatusMap.delete(frozenTab.tabId);
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

        // 从冻结Map和数组中移除
        freezeTabStatusMap.delete(frozenTab.tabId);
        freezeTabStatusList = freezeTabStatusList.filter(tab => tab.tabId !== frozenTab.tabId);
        restoredCount++;

      } catch (error) {
        // 如果恢复失败，从冻结列表中移除以避免重复尝试
        freezeTabStatusMap.delete(frozenTab.tabId);
        freezeTabStatusList = freezeTabStatusList.filter(tab => tab.tabId !== frozenTab.tabId);
      }
    }

    // 保存更新后的冻结列表
    await saveFreeTab();
    await updateBadge(); // Update badge after restoring

    // Track unfreeze counts for smart whitelist suggestions
    for (const frozenTab of tabsToRestore) {
      try {
        const url = new URL(frozenTab.url);
        const domain = url.hostname;
        const currentCount = unfreezeCountMap.get(domain) || 0;
        unfreezeCountMap.set(domain, currentCount + 1);
      } catch (e) {
        // Invalid URL, skip
      }
    }
    // Persist unfreeze counts
    const countsObj = Object.fromEntries(unfreezeCountMap);
    await safeStorage.set({ [STORAGE_KEY_UNFREEZE_COUNTS]: JSON.stringify(countsObj) });
    debugLog('Updated unfreeze counts:', unfreezeCountMap);

    const message = restoredCount > 0
      ? `Successfully restored ${restoredCount} frozen tabs`
      : 'No tabs were restored';

    return { success: true, message, restoredCount };

  } catch (error) {
    return { success: false, message: 'Failed to restore frozen tabs', restoredCount: 0 };
  }
}

// 检查和冻结标签页
async function checkAndFreezeTabs() {
  const now = Date.now();

  // 获取当前活动标签页信息
  const activeTabs = await browser.tabs.query({ active: true });
  const activeTabIds = new Set(activeTabs.map(tab => tab.id).filter(id => id !== undefined));

  // 获取所有可见的标签页（通过 Page Visibility API）
  // Use Map for iteration
  const visibleTabIds: number[] = [];
  tabStatusMap.forEach(tab => {
    if (tab.isVisible === true && tab.visibilityState === 'visible') {
      visibleTabIds.push(tab.tabId);
    }
  });

  // Use Map for iteration
  tabStatusMap.forEach((item) => {
    // Check if already frozen (O(1) with Map)
    if (freezeTabStatusMap.has(item.tabId)) return;
    // Check if freeze is in progress
    if (freezingInProgress.has(item.tabId)) return;

    const itemUrl = new URL(item.url).hostname;
    if (whitelist.includes(itemUrl)) return;

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
      return;
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
      FreezeTab(item.tabId);
    }
  });
}

// 获取当前窗口的活动标签页ID
async function getCurrentActiveTabId(): Promise<number | null> {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    return tabs.length > 0 && tabs[0].id ? tabs[0].id : null;
  } catch (error) {
    console.error('Error getting current active tab:', error);
    return null;
  }
}

// 计算标签页剩余冻结时间（分钟）
async function calculateRemainingTime(tabId: number): Promise<number> {
  // Use Map for O(1) lookup
  const tab = tabStatusMap.get(tabId);
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

// 获取所有标签页的剩余时间信息
async function getAllTabsRemainingTime() {
  // Use Map values for iteration
  const tabPromises = Array.from(tabStatusMap.values()).map(async tab => ({
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

// 辅助函数
function isTabFrozen(tabId: number): boolean {
  // Use Map for O(1) lookup
  return freezeTabStatusMap.has(tabId);
}

async function saveFreeTab() {
  await browser.storage.sync.set({ 'freezeTabStatusList': freezeTabStatusList });
}

// MV3 Service Worker Compliance: Replace setInterval with chrome.alarms API
// Service workers in MV3 can be suspended/terminated at any time, making setInterval unreliable
const FREEZE_CHECK_ALARM_NAME = 'freezeCheckAlarm';
const FREEZE_CHECK_PERIOD_MINUTES = 1;

function setupFreezeCheckAlarm() {
  // Create alarm to check and freeze tabs periodically
  chrome.alarms.create(FREEZE_CHECK_ALARM_NAME, {
    delayInMinutes: FREEZE_CHECK_PERIOD_MINUTES,
    periodInMinutes: FREEZE_CHECK_PERIOD_MINUTES
  });
}

// Listen for the alarm to trigger freeze check
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FREEZE_CHECK_ALARM_NAME) {
    console.log('Freeze check alarm triggered');
    checkAndFreezeTabs().catch(error => {
      console.error('Error in checkAndFreezeTabs:', error);
    });
  }
});

// Also set up the cleanup alarm
const CLEANUP_ALARM_NAME = 'cleanupAlarm';
const CLEANUP_PERIOD_MINUTES = 60;

function setupCleanupAlarm() {
  chrome.alarms.create(CLEANUP_ALARM_NAME, {
    delayInMinutes: CLEANUP_PERIOD_MINUTES,
    periodInMinutes: CLEANUP_PERIOD_MINUTES
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CLEANUP_ALARM_NAME) {
    console.log('Cleanup alarm triggered');
    cleanupFrozenTabs();
  }
});

// Initialize alarms when extension starts
setupFreezeCheckAlarm();
setupCleanupAlarm();

// 白名单管理函数
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

// 消息处理
browser.runtime.onMessage.addListener((req: unknown, sender, sendResponse: SendResponse) => {
  const request = req as Message;
  if (request.UpDateLastUseTime && sender.tab?.id) {
    // Use Map for O(1) lookup
    const tabStatus = tabStatusMap.get(sender.tab!.id);
    console.log('Update last use time:', tabStatus);
    if (tabStatus) {
      tabStatus.lastUseTime = Date.now();
      // Update Map
      tabStatusMap.set(sender.tab!.id, tabStatus);
      // Sync to array
      const index = tabStatusList.findIndex(t => t.tabId === sender.tab!.id);
      if (index !== -1) {
        tabStatusList[index] = tabStatus;
      }
      sendResponse({ response: 'Last use time updated' });
    } else {
      addTabToList(sender.tab);
      sendResponse({ response: 'Tab added and last use time set' });
    }
  }

  // 处理页面信息更新
  if (request.UpdatePageInfo && sender.tab?.id) {
    // Use Map for O(1) lookup
    const tabStatus = tabStatusMap.get(sender.tab!.id);
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

      // Update Map
      tabStatusMap.set(sender.tab!.id, tabStatus);
      // Sync to array
      const index = tabStatusList.findIndex(t => t.tabId === sender.tab!.id);
      if (index !== -1) {
        tabStatusList[index] = tabStatus;
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
    // Find the tab being removed to track the domain
    const removedTab = freezeTabStatusList.find((tab) => tab.tabId === request.RemoveFreezeTab);
    freezeTabStatusList = freezeTabStatusList.filter((tab) => tab.tabId !== request.RemoveFreezeTab);
    freezeTabStatusMap.delete(request.RemoveFreezeTab as number);
    saveFreeTab();
    updateBadge(); // Update badge after removing frozen tab
    
    // Track unfreeze for smart whitelist suggestion
    if (removedTab) {
      try {
        const url = new URL(removedTab.url);
        const domain = url.hostname;
        const currentCount = unfreezeCountMap.get(domain) || 0;
        unfreezeCountMap.set(domain, currentCount + 1);
        const countsObj = Object.fromEntries(unfreezeCountMap);
        safeStorage.set({ [STORAGE_KEY_UNFREEZE_COUNTS]: JSON.stringify(countsObj) });
        debugLog('Updated unfreeze count for', domain, ':', currentCount + 1);
      } catch (e) {
        // Invalid URL, skip
      }
    }
    
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

  // Set debug mode
  if (request.SetDebugMode !== undefined) {
    DEBUG_MODE = request.SetDebugMode;
    await safeStorage.set({ [STORAGE_KEY_DEBUG_ENABLED]: DEBUG_MODE });
    debugLog('Debug mode set to:', DEBUG_MODE);
    sendResponse({ response: { success: true, debugEnabled: DEBUG_MODE } });
    return true;
  }

  // Get debug mode status
  if (request.GetDebugMode) {
    sendResponse({ response: DEBUG_MODE });
    return true;
  }

  // Get smart whitelist suggestions (domains unfrozen 3+ times)
  if (request.GetWhitelistSuggestions) {
    const suggestions: string[] = [];
    unfreezeCountMap.forEach((count, domain) => {
      if (count >= UNFREEZE_COUNT_THRESHOLD && !whitelist.includes(domain)) {
        suggestions.push(domain);
      }
    });
    debugLog('Whitelist suggestions:', suggestions);
    sendResponse({ response: suggestions });
    return true;
  }

  // Dismiss whitelist suggestion for a domain
  if (request.DismissWhitelistSuggestion) {
    const domain = request.DismissWhitelistSuggestion;
    unfreezeCountMap.delete(domain);
    const countsObj = Object.fromEntries(unfreezeCountMap);
    await safeStorage.set({ [STORAGE_KEY_UNFREEZE_COUNTS]: JSON.stringify(countsObj) });
    debugLog('Dismissed whitelist suggestion for:', domain);
    sendResponse({ response: { success: true } });
    return true;
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

  if (request.GotoTaskPage && request.data !== undefined) {
    browser.tabs.update(request.data as number, { active: true });
  }

  // 处理页面可见性变化
  if (request.SetPageVisible) {
    // Use Map for O(1) lookup
    const tabStatus = tabStatusMap.get(sender.tab!.id);
    if (tabStatus) {
      tabStatus.isVisible = true;
      tabStatus.visibilityState = 'visible';
      tabStatus.lastUseTime = Date.now(); // 页面可见时更新使用时间
      // Update Map
      tabStatusMap.set(sender.tab!.id, tabStatus);
      // Sync to array
      const index = tabStatusList.findIndex(t => t.tabId === sender.tab!.id);
      if (index !== -1) {
        tabStatusList[index] = tabStatus;
      }
      console.log('Page became visible:', { tabId: sender.tab!.id, url: tabStatus.url });
    }
  }

  if (request.SetPageHidden) {
    // Use Map for O(1) lookup
    const tabStatus = tabStatusMap.get(sender.tab!.id);
    if (tabStatus) {
      tabStatus.isVisible = false;
      tabStatus.visibilityState = 'hidden';
      // Update Map
      tabStatusMap.set(sender.tab!.id, tabStatus);
      // Sync to array
      const index = tabStatusList.findIndex(t => t.tabId === sender.tab!.id);
      if (index !== -1) {
        tabStatusList[index] = tabStatus;
      }
      console.log('Page became hidden:', { tabId: sender.tab!.id, url: tabStatus.url });
    }
  }

  if (request.GetVisibleTabs) {
    // Use Map for efficient filtering
    const visibleTabs: number[] = [];
    tabStatusMap.forEach(tab => {
      if (tab.isVisible === true && tab.visibilityState === 'visible') {
        visibleTabs.push(tab.tabId);
      }
    });
    sendResponse({ response: visibleTabs });
    return true;
  }

  return true;
});

// 上下文菜单
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
        const url = new URL(tab.url).hostname;
        addToWhitelist(url).then(result => {
          if (result.success) {
            console.log('Added from context menu:', result.message);
          } else {
            console.warn('Failed to add from context menu:', result.message);
          }
        });
      }
      break;
  }
});

// Keyboard shortcut command listeners
browser.commands?.onCommand?.addListener(async (command) => {
  debugLog('Keyboard command received:', command);
  if (command === 'freeze-tab') {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0].id) {
        await FreezeTab(tabs[0].id);
        debugLog('Freeze tab command executed for tab:', tabs[0].id);
      }
    } catch (error) {
      console.error('Error executing freeze-tab command:', error);
    }
  } else if (command === 'unfreeze-all') {
    try {
      const result = await restoreAllFrozenTabs();
      debugLog('Unfreeze all command executed:', result);
    } catch (error) {
      console.error('Error executing unfreeze-all command:', error);
    }
  }
});

// 清理功能
function cleanupFrozenTabs() {
  browser.tabs.query({}).then(tabs => {
    const currentTabIds = new Set(tabs.map(tab => tab.id));
    
    // Clean up freezeTabStatusMap - remove tabs that no longer exist
    freezeTabStatusMap.forEach((frozenTab, tabId) => {
      if (!currentTabIds.has(tabId)) {
        freezeTabStatusMap.delete(tabId);
      }
    });
    
    // Also clean up array for backwards compatibility
    freezeTabStatusList = freezeTabStatusList.filter(frozenTab =>
      currentTabIds.has(frozenTab.tabId)
    );
    
    saveFreeTab();
  });
}