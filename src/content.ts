import browser from 'webextension-polyfill';
import { SendResponse } from './utils/index';

// init content script
browser.runtime.sendMessage({ getTabId: true }).then((tabId) => {
    // noting to do
});

// 监听来自 background script 的消息
browser.runtime.onMessage.addListener((request, sender, sendResponse: SendResponse) => {
    console.warn('Received message from background script:', request);
    sendResponse({ response: 'Content script received the message' });
});

setInterval(() => {
    browser.runtime.sendMessage({ getTabActive: true }).then((tabActive) => {
        if (tabActive) browser.runtime.sendMessage({ UpDateLastUseTime: true });
    });
}, 1000 * 30); // 每30s更新一次 lastUseTime