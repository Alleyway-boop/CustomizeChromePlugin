/**
 * Content Script - Page Visibility and Activity Monitoring
 *
 * This script is injected into every web page to:
 * - Track page visibility state using Page Visibility API
 * - Monitor user activity to prevent unwanted tab freezing
 * - Report page navigation changes (including SPA routes)
 * - Communicate with background script for tab status updates
 */

import browser from 'webextension-polyfill';
import { SendResponse, Response, Message } from './utils/index';

/** Current tab ID assigned by background script */
let currentTabId: number | null = null;
/** Last tracked URL for change detection */
let lastUrl: string = window.location.href;

/** Current page visibility state from Page Visibility API */
let currentVisibilityState: string = document.visibilityState;
/** Last reported visibility state to prevent duplicate reports */
let lastVisibilityReport: string = currentVisibilityState;

/**
 * Notifies background script of page URL or title changes
 * Only sends update if changes are detected to reduce message traffic
 */
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

/**
 * Notifies background script of page visibility state changes
 * Throttles duplicate reports of the same state
 */
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

/**
 * Initializes the content script by:
 * 1. Getting the tab ID from background script
 * 2. Reporting initial page information
 * 3. Reporting initial visibility state
 */
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

/**
 * Listens for messages from background script
 * Handles getPageInfo requests by returning current URL and title
 */
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

/**
 * Page Navigation Monitoring
 * Patches browser History API to detect SPA navigation changes
 * Notifies background script of any URL changes
 */
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;
const originalBack = history.back.bind(history);
const originalForward = history.forward.bind(history);

history.pushState = function (...args) {
    originalPushState.apply(history, args);
    setTimeout(notifyPageUpdate, 100);
};

history.replaceState = function (...args) {
    originalReplaceState.apply(history, args);
    setTimeout(notifyPageUpdate, 100);
};

history.back = function (...args) {
    originalBack.apply(history, args);
    setTimeout(notifyPageUpdate, 100);
};

history.forward = function (...args) {
    originalForward.apply(history, args);
    setTimeout(notifyPageUpdate, 100);
};

/** Listens for browser back/forward navigation */
window.addEventListener('popstate', () => {
    setTimeout(notifyPageUpdate, 100);
});

/** Listens for hash-based route changes (common in SPAs) */
window.addEventListener('hashchange', () => {
    setTimeout(notifyPageUpdate, 100);
});

/** Observes page title changes for dynamic content */
const titleObserver = new MutationObserver(() => {
    setTimeout(notifyPageUpdate, 100);
});

titleObserver.observe(document.querySelector('title') || document.head, {
    childList: true,
    subtree: true
});

/**
 * Periodic activity check
 * Confirms tab is still active and updates last use time
 * Runs every 30 seconds to maintain tab activity
 */
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

/**
 * User Activity Monitoring
 * Listens for common user interaction events to reset the freeze timer
 * Throttled to 5 seconds between updates to reduce message traffic
 */
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

/**
 * Scroll activity monitoring with separate throttle
 * Scroll events can fire very frequently, so they use a 2-second throttle
 */
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

/**
 * Cleanup on page unload
 * Notifies background script to remove this tab from tracking
 */
window.addEventListener('beforeunload', () => {
    browser.runtime.sendMessage({ DeleteTab: true });
});