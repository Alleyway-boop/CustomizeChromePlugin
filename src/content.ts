import browser from 'webextension-polyfill';
import { SendResponse, Response, Message } from './utils/index';

// 获取当前 tab 信息并监听变化
let currentTabId: number | null = null;
let lastUrl: string = window.location.href;

// 通知 background script 页面信息更新
function notifyPageUpdate() {
    if (!currentTabId) return;

    const currentUrl = window.location.href;
    const title = document.title;

    // 如果 URL 或标题发生变化，通知 background script
    if (currentUrl !== lastUrl || title) {
        const message: Message = {
            UpdatePageInfo: true,
            url: currentUrl,
            title: title
        };

        browser.runtime.sendMessage(message).catch(() => {
            // 忽略错误（可能页面已关闭）
        });

        lastUrl = currentUrl;
    }
}

// init content script
browser.runtime.sendMessage({ getTabId: true }).then((tabId) => {
    currentTabId = tabId as number;

    // 初始化页面信息
    setTimeout(() => {
        notifyPageUpdate();
    }, 1000);
}).catch(() => {
    // 忽略错误
});

// 监听来自 background script 的消息
browser.runtime.onMessage.addListener((request, sender, sendResponse: SendResponse) => {
    console.warn('Received message from background script:', request);

    const req = request as Message;

    if (req.type === 'getPageInfo') {
        const pageInfoResponse: Response = {
            response: {
                url: window.location.href,
                title: document.title
            }
        };
        sendResponse(pageInfoResponse);
        return true;
    }

    sendResponse({ response: 'Content script received the message' });
    return true;
});

// 监听页面导航变化
// 使用 history API 监听单页应用的路由变化
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;
const originalBack = history.back.bind(history);
const originalForward = history.forward.bind(history);

history.pushState = function(...args) {
    originalPushState.apply(history, args);
    setTimeout(notifyPageUpdate, 100);
};

history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    setTimeout(notifyPageUpdate, 100);
};

history.back = function(...args) {
    originalBack.apply(history, args);
    setTimeout(notifyPageUpdate, 100);
};

history.forward = function(...args) {
    originalForward.apply(history, args);
    setTimeout(notifyPageUpdate, 100);
};

// 监听 popstate 事件（浏览器前进后退）
window.addEventListener('popstate', () => {
    setTimeout(notifyPageUpdate, 100);
});

// 监听 hashchange 事件（hash 路由变化）
window.addEventListener('hashchange', () => {
    setTimeout(notifyPageUpdate, 100);
});

// 监听页面标题变化
const titleObserver = new MutationObserver(() => {
    setTimeout(notifyPageUpdate, 100);
});

titleObserver.observe(document.querySelector('title') || document.head, {
    childList: true,
    subtree: true
});

setInterval(() => {
    browser.runtime.sendMessage({ getTabActive: true }).then((res) => {
        const tabActive = res as Response;
        if (tabActive.response) {
            browser.runtime.sendMessage({ UpDateLastUseTime: true });
            // 定期检查页面信息变化
            notifyPageUpdate();
        }
    });
}, 1000 * 30); // 每30s更新一次 lastUseTime

// 如果当前页面即将被关闭，通知 background script 删除当前 tab
window.addEventListener('beforeunload', () => {
    browser.runtime.sendMessage({ DeleteTab: true });
});