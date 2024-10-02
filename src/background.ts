import { ref } from 'vue';
import browser from 'webextension-polyfill';
import { Message, SendResponse } from './utils';

// 配置和状态
let whitelist: string[] = [];
let FreezeTimeout = 20; // 默认值，单位：分钟
const FreezePinned = ref(false);

interface TabStatus {
  tabId: number;
  url: string;
  icon: string;
  title: string;
  lastUseTime: number;
}

interface FreezeTabStatus {
  tabId: number;
  url: string;
  icon: string;
  title: string;
}

let tabStatusList: TabStatus[] = [];
let freezeTabStatusList: FreezeTabStatus[] = [];

// 初始化
browser.storage.sync.get(['FreezeTimeout', 'FreezePinned', 'whitelist']).then((res) => {
  if (res.FreezeTimeout) FreezeTimeout = res.FreezeTimeout;
  if (res.FreezePinned !== undefined) FreezePinned.value = res.FreezePinned;
  if (res.whitelist) whitelist = res.whitelist;
  console.log('Initial config:', { FreezeTimeout, FreezePinned, whitelist });
});

// 监听存储变化
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    if (changes.FreezeTimeout) FreezeTimeout = changes.FreezeTimeout.newValue;
    if (changes.FreezePinned) FreezePinned.value = changes.FreezePinned.newValue;
    if (changes.whitelist) whitelist = changes.whitelist.newValue;
  }
});

// 在加载存储的冻结标签页之后添加日志
browser.storage.sync.get('freezeTabStatusList').then((res) => {
  if (res.freezeTabStatusList) {
    freezeTabStatusList = res.freezeTabStatusList;
    console.log('Loaded freezeTabStatusList:', freezeTabStatusList);
  }
});

// 标签页管理函数
function addTabToList(tab: browser.Tabs.Tab) {
  if (tab.id === undefined) return;
  if (tab.pinned && !FreezePinned.value) return;
  if (!tab.url?.startsWith('http')) return;
  tabStatusList.forEach((item) => {
    if (item.tabId === tab.id) return;
  });
  const newTab: TabStatus = {
    tabId: tab.id,
    url: tab.url || '',
    icon: tab.favIconUrl || '',
    title: tab.title || '',
    lastUseTime: Date.now()
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
browser.tabs.onRemoved.addListener(removeTabFromList);

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
    let snapshot = await browser.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 50 });
    const freezePageUrl = browser.runtime.getURL('src/options.html') +
      `?title=${encodeURIComponent(tab.title || '')}&url=${encodeURIComponent(tab.url || '')}&icon=${encodeURIComponent(tab.favIconUrl || '')}`;

    await browser.tabs.update(tabId, { url: freezePageUrl });
    await new Promise(resolve => setTimeout(resolve, 500));
    await browser.tabs.sendMessage(tabId, { type: 'setSnapshot', snapshot });

    removeTabFromList(tabId);
    freezeTabStatusList.push({
      tabId: tab.id!,
      url: tab.url || '',
      icon: tab.favIconUrl || '',
      title: tab.title || '',
    });

    saveFreeTab();
  } catch (error) {
    console.error('Error freezing tab:', error);
  }
}

// 检查和冻结标签页
function checkAndFreezeTabs() {
  const now = Date.now();
  tabStatusList.forEach((item) => {
    if (isTabFrozen(item.tabId)) return;

    const itemUrl = new URL(item.url).hostname;
    if (whitelist.includes(itemUrl)) return;

    if (now - item.lastUseTime > FreezeTimeout * 60 * 1000) {
      FreezeTab(item.tabId);
    }
  });
}

// 辅助函数
function isTabFrozen(tabId: number): boolean {
  return freezeTabStatusList.some(tab => tab.tabId === tabId);
}

async function saveFreeTab() {
  await browser.storage.sync.set({ 'freezeTabStatusList': freezeTabStatusList });
}

// 定期检查是否需要冻结标签页
setInterval(checkAndFreezeTabs, 60000); // 每分钟检查一次

// 消息处理
browser.runtime.onMessage.addListener((request: Message, sender, sendResponse: SendResponse) => {
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
    return true;
  }
  if (request.GetTabStatusList) {
    sendResponse({ response: tabStatusList });
    return true;
  }
  if (request.GetFreezeTabList) {
    sendResponse({ response: freezeTabStatusList });
    return true;
  }
  if (request.RemoveFreezeTab) {
    freezeTabStatusList = freezeTabStatusList.filter((tab) => tab.tabId !== request.RemoveFreezeTab);
    saveFreeTab();
    sendResponse({ response: 'Tab removed from freeze list' });
    return true;
  }
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
        if (!whitelist.includes(url)) {
          whitelist.push(url);
          browser.storage.sync.set({ 'whitelist': whitelist });
        }
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