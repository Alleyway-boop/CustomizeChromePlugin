import browser from 'webextension-polyfill';
import { SendResponse, Response, Message } from './utils/index';

// 获取当前 tab 信息并监听变化
let currentTabId: number | null = null;
let lastUrl: string = window.location.href;

// 页面可见性状态管理
let currentVisibilityState: string = document.visibilityState;
let lastVisibilityReport: string = currentVisibilityState;

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

// 通知 background script 页面可见性变化
function notifyVisibilityChange() {
    if (!currentTabId) return;

    const newVisibilityState = document.visibilityState;
    currentVisibilityState = newVisibilityState;

    // 防止重复报告相同的可见性状态
    if (newVisibilityState === lastVisibilityReport) {
        return;
    }
    lastVisibilityReport = newVisibilityState;

    console.log('Visibility state changed:', {
        tabId: currentTabId,
        visibilityState: newVisibilityState,
        url: window.location.href
    });

    let message: Message;

    if (newVisibilityState === 'visible') {
        message = { SetPageVisible: true };
        // 页面变为可见时，更新最后使用时间
        browser.runtime.sendMessage({ UpDateLastUseTime: true }).catch(() => {
            // 忽略错误
        });
    } else {
        message = { SetPageHidden: true };
    }

    browser.runtime.sendMessage(message).catch((error) => {
        // 忽略错误（可能扩展已卸载）
        console.warn('Failed to report visibility change:', error);
    });
}

// init content script
browser.runtime.sendMessage({ getTabId: true }).then((tabId) => {
    currentTabId = tabId as number;

    // 初始化页面信息
    setTimeout(() => {
        notifyPageUpdate();
        // 初始报告页面可见性状态
        notifyVisibilityChange();
    }, 1000);
}).catch(() => {
    // 忽略错误
});

// 添加 Page Visibility API 监听器
document.addEventListener('visibilitychange', () => {
    console.log('Document visibility changed to:', document.visibilityState);
    notifyVisibilityChange();
});

// 监听页面焦点变化
window.addEventListener('focus', () => {
    console.log('Window gained focus');
    // 确保页面状态为可见
    if (document.visibilityState !== 'visible') {
        // 如果document.visibilityState不是visible，但我们获得了焦点，可能需要强制更新
        setTimeout(() => {
            notifyVisibilityChange();
        }, 100);
    }

    // 页面获得焦点时重置倒计时
    browser.runtime.sendMessage({ UpDateLastUseTime: true })
});

window.addEventListener('blur', () => {
    console.log('Window lost focus');
    // 窗口失去焦点时，检查是否变为隐藏
    setTimeout(() => {
        notifyVisibilityChange();
    }, 100);
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

// 监听用户交互活动，实时重置倒计时
const userActivityEvents = [
    'mousedown', 'click', 'keydown', 'scroll', 'touchstart', 'mousemove'
];

let lastActivityTime = 0;
const ACTIVITY_THROTTLE = 5000; // 5秒内只重置一次

userActivityEvents.forEach(eventType => {
    document.addEventListener(eventType, () => {
        const now = Date.now();
        if (now - lastActivityTime > ACTIVITY_THROTTLE) {
            lastActivityTime = now;
            console.log(`User activity detected: ${eventType}`);

            // 重置倒计时
            browser.runtime.sendMessage({ UpDateLastUseTime: true }).catch(() => {
                // 忽略错误
            });
        }
    }, { passive: true });
});

// 监听页面滚动（更频繁的活动）
let scrollThrottle = false;
window.addEventListener('scroll', () => {
    if (!scrollThrottle) {
        scrollThrottle = true;
        console.log('Scroll activity detected');

        browser.runtime.sendMessage({ UpDateLastUseTime: true }).catch(() => {
            // 忽略错误
        });

        setTimeout(() => {
            scrollThrottle = false;
        }, 2000); // 2秒内只响应一次滚动
    }
}, { passive: true });

// 如果当前页面即将被关闭，通知 background script 删除当前 tab
window.addEventListener('beforeunload', () => {
    browser.runtime.sendMessage({ DeleteTab: true });
});