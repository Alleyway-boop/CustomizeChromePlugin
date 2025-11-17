import { ref } from 'vue';
import browser from 'webextension-polyfill';
import { Message, SendResponse } from './utils';
import { safeAsync, safeStorage, safeTabs, ExtensionError, ErrorCodes, isValidDomain, normalizeDomain } from './utils/error-handler';
import { SmartScheduler } from './utils/performance';
import { configManager } from './utils/config';

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
browser.storage.sync.get(['FreezeTimeout', 'FreezePinned', 'whitelist']).then(async (res: { FreezeTimeout?: number; FreezePinned?: boolean; whitelist?: string[] }) => {
  if (res.FreezeTimeout) FreezeTimeout = res.FreezeTimeout;
  if (res.FreezePinned !== undefined) FreezePinned.value = res.FreezePinned;

  // 验证和清理白名单数据
  if (res.whitelist) {
    const cleanedWhitelist = await validateAndCleanWhitelist(res.whitelist);
    whitelist = cleanedWhitelist;

    // 如果清理过程中移除了无效数据，保存清理后的结果
    if (cleanedWhitelist.length !== res.whitelist.length) {
      console.log('Cleaned whitelist data during initialization:', {
        original: res.whitelist.length,
        cleaned: cleanedWhitelist.length,
        removed: res.whitelist.length - cleanedWhitelist.length
      });
      await safeStorage.set({ whitelist: cleanedWhitelist });
    }
  } else {
    whitelist = [];
  }

  console.log('Initial config:', { FreezeTimeout, FreezePinned, whitelist });
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

// 监听标签页更新事件（包括URL变化）
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
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
  }
});

// 标签页管理函数
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

// 冻结标签页函数
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

// 恢复所有冻结的标签页
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

// 检查和冻结标签页
async function checkAndFreezeTabs() {
  const now = Date.now();

  // 获取当前活动标签页信息
  const activeTabs = await browser.tabs.query({ active: true });
  const activeTabIds = new Set(activeTabs.map(tab => tab.id).filter(id => id !== undefined));

  // 获取所有可见的标签页（通过 Page Visibility API）
  const visibleTabIds = tabStatusList
    .filter(tab => tab.isVisible === true && tab.visibilityState === 'visible')
    .map(tab => tab.tabId);

  for (const item of tabStatusList) {
    if (isTabFrozen(item.tabId)) continue;

    const itemUrl = new URL(item.url).hostname;
    if (whitelist.includes(itemUrl)) continue;

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
      FreezeTab(item.tabId);
    }
  }
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

// 获取所有标签页的剩余时间信息
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

// 辅助函数
function isTabFrozen(tabId: number): boolean {
  return freezeTabStatusList.some(tab => tab.tabId === tabId);
}

async function saveFreeTab() {
  await browser.storage.sync.set({ 'freezeTabStatusList': freezeTabStatusList });
}

// 定期检查是否需要冻结标签页
setInterval(() => {
  checkAndFreezeTabs().catch(error => {
    console.error('Error in checkAndFreezeTabs:', error);
  });
}, 60000); // 每分钟检查一次

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

// 清理功能
function cleanupFrozenTabs() {
  browser.tabs.query({}).then(tabs => {
    const currentTabIds = tabs.map(tab => tab.id);
    freezeTabStatusList = freezeTabStatusList.filter(frozenTab =>
      currentTabIds.includes(frozenTab.tabId)
    );
    saveFreeTab();
  });
}

// 每小时清理一次
setInterval(cleanupFrozenTabs, 3600000);