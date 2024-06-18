import browser from 'webextension-polyfill';
import { SendResponse } from './utils/index';
// 获取当前 tabId
browser.runtime.sendMessage({ getTabId: true }).then((tabId) => {
    console.log('Current tabId:', tabId);
    // // 发送消息到 background script
    // browser.runtime.sendMessage({ greeting: 'Hello from content script', tabId: tabId }).then((response) => {
    //     console.log('Response from background script:', response);
    // });
});

// 监听来自 background script 的消息
browser.runtime.onMessage.addListener((request, sender, sendResponse: SendResponse) => {
    console.log('Received message from background script:', request);
    sendResponse({ response: 'Content script received the message' });
});

setInterval(() => {
    browser.runtime.sendMessage({ UpDateLastUseTime: true }).then((response) => {
        console.log('Response from background script:', response);
    });
}, 1000 * 60 * 5); // 每 5 分钟更新一次 lastUseTime