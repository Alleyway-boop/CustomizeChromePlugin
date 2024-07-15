import { Status } from 'naive-ui/es/progress/src/interface';
import { ref, toRef, watch } from 'vue';
import Browser, { Runtime } from 'webextension-polyfill';
import browser from 'webextension-polyfill';
import { Message, SendResponse } from './utils';

const FreezeTimeout = ref();
browser.storage.sync.get('FreezeTimeout').then((res) => {
  if (res.FreezeTimeout) {
    FreezeTimeout.value = res.FreezeTimeout;
  }
});
const FreezePinned = ref(false);
browser.storage.sync.get('FreezePinned').then((res) => {
  if (res.FreezePinned) {
    FreezePinned.value = res.FreezePinned;
  }
});
// 一个列表用于存储所有的 tabId 与其当前的url
interface TabStatus {
  tabId: number;
  url: string;
  icon: string;
  title: string;
  lastUseTime: number;
}
const tabStatusList: TabStatus[] = [];
interface FreezeTabStatus {
  tabId: number;
  url: string;
  icon: string;
  title: string;
}
const freezeTabStatusList: FreezeTabStatus[] = [];
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: 'sampleContextMenu',
    title: '冻结此页面',
    contexts: ['page'],
    documentUrlPatterns: ['http://*/*', 'https://*/*']
  })
})
browser.contextMenus.onClicked.addListener((info, tab) => {
  FreezeTab(tab?.id!)
})
browser.runtime.onMessage.addListener((request: Message, sender, sendResponse: SendResponse) => {
  if (request.getTabId) {
    if (sender.tab && sender.tab.id !== undefined) {
      sendResponse({ response: 'Tab ID fetched', tabId: sender.tab.id });
      // 查看当前tab是否是固定的tab
      SavePageList(sender);
    } else {
      sendResponse({ response: 'Failed to get Tab ID' });
    }
    return true;
  }
  if (request.UpDateLastUseTime) {
    if (sender.tab && sender.tab.id !== undefined) {
      const tabId = sender.tab.id;
      const tabStatus = tabStatusList.find((item) => item.tabId === tabId);
      console.log('tabStatus update TIme :', tabStatus);
      if (tabStatus) {
        tabStatus.lastUseTime = Date.now();
        sendResponse({ response: 'Update last use time' });
      } else {
        sendResponse({ response: 'Tab not found' });
      }
    } else {
      sendResponse({ response: 'Failed to get Tab ID' });
    }
    return true;
  }
  if (request.getTabActive) {
    if (sender.tab && sender.tab.active) {
      sendResponse({ response: true });
    } else {
      sendResponse({ response: false });
    }
    return true;
  }
  if (request.GetTabStatusList) {
    sendResponse({ response: tabStatusList });
    return true;
  }
  if (request.DeleteTab) {
    if (sender.tab && sender.tab.id !== undefined) {
      deleteTab(sender.tab.id);
    }
    return true;
  }
  if (request.GetFreezeTabList) {
    sendResponse({ response: freezeTabStatusList });
    return true;
  }
  if (request.RecoverFreezeTab) {
    recoverFreeTab();
    return true;
  }
  if (request.async) {
    // 异步处理示例
    setTimeout(() => {
      sendResponse({ response: 'Async response after delay' });
    }, 1000);
    return true; // 表示 sendResponse 将在异步处理后被调用
  } else {
    sendResponse({ response: 'Background received the message' });
  }
  return true; // 返回 true 来指示 sendResponse 将被异步调用
});
// 获取当前 tabId 并保存到 tabStatusList
function SavePageList(sender: Runtime.MessageSender) {
  if (sender.tab && sender.tab.id !== undefined) {
    const tabStatus = tabStatusList.find((item) => item.tabId === sender.tab?.id);
    if (tabStatus) {
      tabStatus.lastUseTime = Date.now();
    } else {
      tabStatusList.push({
        tabId: sender.tab.id,
        url: sender.tab.url || '',
        icon: sender.tab.favIconUrl || '',
        title: sender.tab.title || '',
        lastUseTime: Date.now(),
      });
    }
    console.log('tabStatusList:', tabStatusList);
  }
}
// 定时轮询没有获取到icon的tab
setInterval(() => {
  tabStatusList.forEach((item) => {
    if (item.icon.length === 0 && item.tabId !== undefined) {
      browser.tabs.get(item.tabId).then((tab) => {
        item.icon = tab.favIconUrl || '';
      });
    }
  });
}, 1000 * 30);
function deleteTab(tabId: number) {
  const index = tabStatusList.findIndex((tab) => tab.tabId === tabId);
  if (index !== -1) {
    tabStatusList.splice(index, 1);
  }
}
// 发送消息到特定的 content script
function sendMessageToContentScript(tabId: number, message: object) {
  browser.tabs.sendMessage(tabId, message).then((response) => {
    console.log('Response from content script:', response);
  });
}

// 示例：发送消息到当前活动的 content script
browser.runtime.onInstalled.addListener(() => {
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    if (tabs.length > 0) {
      const activeTabId = tabs[0].id;
      if (activeTabId !== undefined) {
        // sendMessageToContentScript(activeTabId, { greeting: 'Hello from background' });
      }
    }
  });
});
function FreezeTab(tabId: number) {
  browser.tabs.get(tabId).then((tab) => {
    // 修改当前tab的url
    console.log('tabxxx:', tab);
    browser.tabs.update(tabId, { url: browser.runtime.getURL('src/options.html') + `?title=${tab.title}&url=${tab.url != undefined ? encodeURIComponent(tab.url) : tab.url}&icon=${tab.favIconUrl}` });
    // 移除 tabStatusList 中的该项
    const index = tabStatusList.findIndex((tab) => tab.tabId === tabId);
    if (index !== -1) {
      tabStatusList.splice(index, 1);
    }
  });
}
setInterval(() => {
  // 每20秒检查一次所有的 tabStatusList，如果有超过 5 分钟未使用的 tab，则发送消息到 content script
  browser.storage.sync.get('FreezeTimeout').then((res) => {
    if (res.FreezeTimeout) {
      FreezeTimeout.value = res.FreezeTimeout;
    }
  });
  const now = Date.now();
  tabStatusList.forEach((item) => {
    if (now - item.lastUseTime > 1000 * 60 * FreezeTimeout.value) {
      browser.tabs.get(item.tabId).then((tab) => {
        if (tab.pinned && !FreezePinned.value) {
          return;
        }
        sendMessageToContentScript(item.tabId, { greeting: 'Hello from background 再不更新时间可就把你放小黑屋了' });
        // 修改当前tab的url
        browser.tabs.update(item.tabId, { url: browser.runtime.getURL('src/options.html') + `?title=${item.title}&url=${item.url}&icon=${item.icon}` });
        // 移除 tabStatusList 中的该项
        const index = tabStatusList.findIndex((tab) => tab.tabId === item.tabId);
        if (index !== -1) {
          tabStatusList.splice(index, 1);
        }
      });
    }
  });
  GetAllFreeTab();
}
  , 1000 * 5);
function GetAllFreeTab() {
  // 获取当前浏览器页面所有的冻结页面
  // 每次获取之前先清空之前的数据
  freezeTabStatusList.splice(0, freezeTabStatusList.length);
  browser.tabs.query({}).then((tabs) => {
    tabs.forEach((tab) => {
      if (tab.url?.includes('options.html') && freezeTabStatusList.findIndex((item) => item.tabId === tab.id) === -1) {
        freezeTabStatusList.push({
          tabId: tab.id!,
          url: tab.url || '',
          icon: tab.favIconUrl || '',
          title: tab.title || '',
        });
      }
    });
    saveFreeTab();
  });
}
watch(tabStatusList, (newVal) => {
  GetAllFreeTab();
});

// 保存冻结的tab，以便下次插件被加载时恢复
async function saveFreeTab() {
  await browser.storage.sync.set({ 'freezeTabStatusList': freezeTabStatusList });
}

async function recoverFreeTab() {
  let TempFreezeTabStatusList: FreezeTabStatus[] = [];
  TempFreezeTabStatusList = freezeTabStatusList;
  await browser.storage.sync.get('freezeTabStatusList').then((res) => {
    if (res.freezeTabStatusList) {
      res.freezeTabStatusList.forEach((item: FreezeTabStatus) => {
        // 跳过已经打开的页面
        if (tabStatusList.findIndex((tab) => tab.tabId === item.tabId) !== -1) {
          return;
        }
        // 跳过页面上已经存在的冻结页面
        if (TempFreezeTabStatusList.findIndex((tab) => tab.tabId === item.tabId) !== -1) {
          return;
        }
        browser.tabs.create({ url: item.url });
      });
    }
  });
}