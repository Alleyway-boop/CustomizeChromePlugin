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

// 常量定义 - 避免魔法数字
const PERIODIC_CHECK_INTERVAL_MS = 30 * 1000; // 每30秒更新一次 lastUseTime
const ACTIVITY_THROTTLE_MS = 5 * 1000; // 5秒内只重置一次
const SCROLL_THROTTLE_MS = 2 * 1000; // 2秒内只响应一次滚动
const NOTIFY_DELAY_MS = 100; // 通知延迟时间
const NOTIFY_PAGE_UPDATE_DEBOUNCE_MS = 500; // notifyPageUpdate 防抖延迟

/** Current tab ID assigned by background script */
let currentTabId: number | null = null;
/** Last tracked URL for change detection */
let lastUrl: string = window.location.href;

/** Current page visibility state from Page Visibility API */
let currentVisibilityState: string = document.visibilityState;
/** Last reported visibility state to prevent duplicate reports */
let lastVisibilityReport: string = currentVisibilityState;

/** notifyPageUpdate 防抖定时器 */
let notifyPageUpdateTimeout: number | null = null;

// Memory leak fix: Store interval ID for cleanup
let activityCheckInterval: number | null = null;
const ACTIVITY_CHECK_INTERVAL_MS = 1000 * 30; // 30 seconds

/**
 * Notifies background script of page URL or title changes
 * Only sends update if changes are detected to reduce message traffic
 * 使用防抖避免短时间内多次调用
 */
function notifyPageUpdate() {
    if (!currentTabId) return;

    // 如果已有待执行的通知，取消并重新计时（防抖）
    if (notifyPageUpdateTimeout !== null) {
        clearTimeout(notifyPageUpdateTimeout);
    }

    notifyPageUpdateTimeout = window.setTimeout(() => {
        notifyPageUpdateTimeout = null;
        doNotifyPageUpdate();
    }, NOTIFY_PAGE_UPDATE_DEBOUNCE_MS);
}

/**
 * 执行实际的页面更新通知
 */
function doNotifyPageUpdate() {
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
        // Resume activity check when visible
        resumeActivityCheck();
    } else {
        message = { SetPageHidden: true };
        // Pause activity check when hidden to save resources
        pauseActivityCheck();
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

// Memory leak fix: Activity check with proper cleanup
function startActivityCheck() {
    // Clear any existing interval first
    if (activityCheckInterval !== null) {
        clearInterval(activityCheckInterval);
    }

    activityCheckInterval = window.setInterval(() => {
        // Only send updates if page is visible to save resources
        if (document.visibilityState === 'visible') {
            browser.runtime.sendMessage({ getTabActive: true }).then((res) => {
                const tabActive = res as Response;
                if (tabActive.response) {
                    browser.runtime.sendMessage({ UpDateLastUseTime: true });
                    // 定期检查页面信息变化
                    notifyPageUpdate();
                }
            }).catch(() => {
                // Ignore errors - page might be closed
            });
        }
    }, ACTIVITY_CHECK_INTERVAL_MS);
}

function stopActivityCheck() {
    if (activityCheckInterval !== null) {
        clearInterval(activityCheckInterval);
        activityCheckInterval = null;
        console.log('Activity check interval stopped');
    }
}

function pauseActivityCheck() {
    if (activityCheckInterval !== null) {
        clearInterval(activityCheckInterval);
        activityCheckInterval = null;
        console.log('Activity check paused');
    }
}

function resumeActivityCheck() {
    if (activityCheckInterval === null) {
        startActivityCheck();
        console.log('Activity check resumed');
    }
}
browser.runtime.sendMessage({ getTabId: true }).then((tabId) => {
    currentTabId = tabId as number;

    // 初始化页面信息
    setTimeout(() => {
        notifyPageUpdate();
        // 初始报告页面可见性状态
        notifyVisibilityChange();
        // Start activity check
        startActivityCheck();
    }, 1000);
}).catch(() => {
    // 忽略错误
});

// Memory leak fix: Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopActivityCheck();
    browser.runtime.sendMessage({ DeleteTab: true });
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

// BUG-014: 添加 null 检查，避免在目标为 null 时抛出异常
const titleTarget = document.querySelector('title') || document.head;
if (titleTarget) {
    titleObserver.observe(titleTarget, {
        childList: true,
        subtree: true
    });
} else {
    console.warn('Could not find title element or head to observe');
}

// Note: The old setInterval has been replaced by startActivityCheck()
// which is started during initialization and properly cleaned up on page unload.

/**
 * User Activity Monitoring
 * Listens for common user interaction events to reset the freeze timer
 * Throttled to 5 seconds between updates to reduce message traffic
 */
const userActivityEvents = [
    'mousedown', 'click', 'keydown', 'scroll', 'touchstart', 'mousemove'
];

let lastActivityTime = 0;

userActivityEvents.forEach(eventType => {
    document.addEventListener(eventType, () => {
        const now = Date.now();
        if (now - lastActivityTime > ACTIVITY_THROTTLE_MS) {
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
        }, SCROLL_THROTTLE_MS);
    }
}, { passive: true });

/**
 * Cleanup on page unload
 * Notifies background script to remove this tab from tracking
 */
window.addEventListener('beforeunload', () => {
    browser.runtime.sendMessage({ DeleteTab: true });
    // 断开 MutationObserver 连接，避免内存泄漏
    titleObserver.disconnect();
});
