import browser from 'webextension-polyfill';
import { SendResponse, Response } from './utils/index';

// init content script
browser.runtime.sendMessage({ getTabId: true }).then((tabId) => {
    // noting to do
});

// 监听来自 background script 的消息
browser.runtime.onMessage.addListener((request, sender, sendResponse: SendResponse) => {
    console.warn('Received message from background script:', request);
    sendResponse({ response: 'Content script received the message' });
    return true;
});

setInterval(() => {
    browser.runtime.sendMessage({ getTabActive: true }).then((res) => {
        const tabActive = res as Response;
        if (tabActive.response) browser.runtime.sendMessage({ UpDateLastUseTime: true });
    });
}, 1000 * 30); // 每30s更新一次 lastUseTime
// 如果当前页面即将被关闭，通知 background script 删除当前 tab
window.addEventListener('beforeunload', () => {
    browser.runtime.sendMessage({ DeleteTab: true });
});