import { Status } from 'naive-ui/es/progress/src/interface';
import { ref, toRef } from 'vue';
import Browser, { Runtime } from 'webextension-polyfill';
import browser from 'webextension-polyfill';

interface Message {
  greeting?: string;
  async?: boolean;
  getTabId?: boolean;
  tabId?: number;
  UpDateLastUseTime?: boolean;
}

// 一个列表用于存储所有的 tabId 与其当前的url
interface TabStatus {
  tabId: number;
  url: string;
  icon: string;
  title: string;
  lastUseTime: number;
}
const tabStatusList: TabStatus[] = [];
interface Response {
  response: string;
  tabId?: number;
}

type SendResponse = (response?: Response) => void;

browser.runtime.onMessage.addListener((request: Message, sender, sendResponse: SendResponse) => {
  console.log('Received message from content script:', request, sender);
  if (request.getTabId) {
    if (sender.tab && sender.tab.id !== undefined) {
      sendResponse({ response: 'Tab ID fetched', tabId: sender.tab.id });
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
      if (tabStatus) {
        tabStatus.lastUseTime = Date.now();
        console.log('tabStatusList:', tabStatusList);
        sendResponse({ response: 'Update last use time' });
      } else {
        sendResponse({ response: 'Tab not found' });
      }
    } else {
      sendResponse({ response: 'Failed to get Tab ID' });
    }
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
    tabStatusList.push({
      tabId: sender.tab.id,
      url: sender.tab.url || '',
      icon: sender.tab.favIconUrl || '',
      title: sender.tab.title || '',
      lastUseTime: Date.now(),
    });
    console.log('tabStatusList:', tabStatusList);
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

setInterval(() => {
  // 每20秒检查一次所有的 tabStatusList，如果有超过 5 分钟未使用的 tab，则发送消息到 content script
  const now = Date.now();
  tabStatusList.forEach((item) => {
    if (now - item.lastUseTime > 1000 * 10) {
      sendMessageToContentScript(item.tabId, { greeting: 'Hello from background 再不更新时间可就把你放小黑屋了' });
      // 修改当前tab的url
      browser.tabs.update(item.tabId, { url: browser.runtime.getURL('src/options.html') + `?title=${item.title}&url=${item.url}&icon=${item.icon}` });
      // 移除 tabStatusList 中的该项
      const index = tabStatusList.findIndex((tab) => tab.tabId === item.tabId);
      if (index !== -1) {
        tabStatusList.splice(index, 1);
      }
    }
  });
}
  , 1000 * 20);