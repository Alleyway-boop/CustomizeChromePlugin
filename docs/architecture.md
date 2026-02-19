# CustomizeChromePlugin - System Architecture

This document describes the system architecture, data flow, and module dependencies of the CustomizeChromePlugin browser extension.

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Module Structure](#module-structure)
4. [Data Flow](#data-flow)
5. [Component Communication](#component-communication)
6. [State Management](#state-management)
7. [Extension Lifecycle](#extension-lifecycle)
8. [Security Considerations](#security-considerations)

---

## Overview

CustomizeChromePlugin is a browser extension that automatically freezes inactive tabs to save memory while preserving critical tabs via a whitelist system. The architecture follows the Chrome Extension Model V3 with cross-browser compatibility through `webextension-polyfill`.

### Key Design Principles

- **Separation of Concerns**: Background logic, content injection, and UI are completely separated
- **Message-Based Communication**: All inter-component communication uses message passing
- **Event-Driven Architecture**: Reacts to browser events (tab changes, storage updates, etc.)
- **Defensive Programming**: Extensive error handling and validation throughout

---

## System Architecture

### High-Level Architecture Diagram

```
+-----------------------------------------------------------------------+
|                           Browser Environment                          |
|                                                                       |
|  +----------------+      +----------------+      +----------------+  |
|  |  Popup UI      |      |  Options Page  |      | Content Script |  |
|  |  (popup.ts)    |      |  (options_ui)  |      | (content.ts)   |  |
|  |                |      |                |      |                |  |
|  |  - Popup.vue   |      |  - Option.vue  |      | - Visibility   |  |
|  |  - Components  |      |  - Whitelist   |      | - Activity     |  |
|  +--------+-------+      +--------+-------+      +--------+-------+  |
|           |                        |                       |          |
|           | browser.runtime        | browser.runtime       |          |
|           | sendMessage            | sendMessage           |          |
|           v                        v                       v          |
|  +------------------------------------------------------------------+ |
|  |                    Background Script (background.ts)            | |
|  |                                                                  | |
|  |  +----------------+  +----------------+  +------------------+  | |
|  |  | Tab Manager    |  | Whitelist      |  | Freeze Manager   |  | |
|  |  | - Track tabs   |  | Manager        |  | - Freeze tabs    |  | |
|  |  | - Monitor      |  | - CRUD ops     |  | - Restore tabs   |  | |
|  |  | - Update time  |  | - Validation   |  | - Snapshot UI    |  | |
|  |  +----------------+  +----------------+  +------------------+  | |
|  +------------------------------------------------------------------+ |
|           |                        |                       |          |
|           | browser.storage        | browser.tabs          |          |
|           v                        v                       v          |
|  +----------------+      +----------------+      +----------------+  |
|  | Chrome Storage |      |  Tabs API      |      | Context Menus  |  |
|  | - Config       |      |  - Query       |      | - Freeze action |  |
|  | - Whitelist    |      |  - Update      |      | - Whitelist    |  |
|  | - Frozen tabs  |      |  - Events      |      |                |  |
|  +----------------+      +----------------+      +----------------+  |
|                                                                       |
+-----------------------------------------------------------------------+
```

### Extension Entry Points

| File | Type | Purpose |
|------|------|---------|
| `background.ts` | Service Worker | Core logic, tab management, message handling |
| `content.ts` | Content Script | Page visibility tracking, user activity monitoring |
| `popup.ts` | Popup | Extension popup UI |
| `options_ui.ts` | Options Page | Settings and whitelist management |

---

## Module Structure

### Source Code Organization

```
src/
├── background.ts              # Background service worker entry point
├── content.ts                 # Content script for all web pages
├── popup.ts                   # Popup UI entry point
├── options_ui.ts              # Options page entry point
│
├── components/                # Vue components
│   ├── WhitelistManager.vue   # Whitelist CRUD interface
│   ├── Y-Input.tsx            # Custom input component
│   ├── Y-Menu.tsx             # Custom menu component
│   ├── Y-Slider.tsx           # Custom slider component
│   └── Y-Table.tsx            # Custom table component
│
├── pages/                     # Vue pages
│   ├── Popup.vue              # Main popup UI
│   └── Option.vue             # Options/settings page
│
├── utils/                     # Utility modules
│   ├── config.ts              # Configuration management
│   ├── error-handler.ts       # Error handling & validation
│   ├── performance.ts         # Performance optimization
│   └── index.ts               # Message type definitions
│
└── modules/                   # Feature modules
    └── BrowserDB/             # Database utilities
```

### Module Responsibilities

#### Background Script (`background.ts`)

**Core Functions:**
- `addTabToList()` - Add new tab to tracking
- `updateTabInList()` - Update existing tab info
- `removeTabFromList()` - Remove closed tab
- `FreezeTab()` - Freeze a tab with snapshot
- `restoreAllFrozenTabs()` - Restore all frozen tabs
- `checkAndFreezeTabs()` - Periodic freeze check
- `calculateRemainingTime()` - Calculate time until freeze

**Message Handlers:**
- `UpDateLastUseTime` - Update activity timestamp
- `UpdatePageInfo` - Handle URL/title changes
- `GetTabStatusList` - Return all tracked tabs
- `GetWhitelist`, `AddToWhitelist`, `RemoveFromWhitelist` - Whitelist CRUD
- `RestoreAllFrozenTabs` - Restore all frozen tabs
- `SetPageVisible`, `SetPageHidden` - Visibility updates

#### Content Script (`content.ts`)

**Core Functions:**
- `notifyPageUpdate()` - Report URL/title changes
- `notifyVisibilityChange()` - Report visibility state changes
- Activity monitoring - Track user interactions
- History API patching - Detect SPA navigation

**Event Listeners:**
- `visibilitychange` - Page Visibility API
- `focus`/`blur` - Window focus changes
- `mousedown`, `keydown`, `scroll` - User activity
- `popstate`, `hashchange` - Navigation events

#### Utility Modules

**config.ts**
- `ConfigManager` - Centralized configuration management
- Singleton pattern with change notifications
- Storage synchronization and validation

**error-handler.ts**
- `safeAsync()` - Safe async wrapper
- `withRetry()` - Retry with exponential backoff
- `safeStorage`, `safeTabs` - Validated API wrappers
- Domain validation functions

**performance.ts**
- `debounce()`, `throttle()` - Function throttling
- `SmartScheduler` - Periodic task scheduler
- `CacheManager` - TTL-based caching
- `MemoryMonitor` - Memory usage tracking

---

## Data Flow

### Tab Lifecycle Flow

```
User opens tab
     |
     v
browser.tabs.onCreated
     |
     v
addTabToList()
     |
     v
tabStatusList.push(newTab)
     |
     v
[Waiting period]
     |
     v
User activity detected (content.ts)
     |
     v
UpDateLastUseTime message
     |
     v
tabStatus.lastUseTime = Date.now()
     |
     v
[Time passes, no activity]
     |
     v
checkAndFreezeTabs() runs
     |
     v
elapsed > FreezeTimeout?
     |
     +---> YES ---> FreezeTab()
     |              |
     |              v
     |         captureVisibleTab()
     |              |
     |              v
     |         Update to freeze page
     |              |
     |              v
     |         freezeTabStatusList.push()
     |
     +---> NO ---> Continue monitoring
```

### Message Flow: Popup to Background

```
User clicks "Get Status" in Popup
     |
     v
Popup.vue sends GetTabStatusList message
     |
     v
browser.runtime.sendMessage({ GetTabStatusList: true })
     |
     v
background.ts receives message
     |
     v
getAllTabsRemainingTime()
     |
     v
calculateRemainingTime() for each tab
     |
     v
sendResponse({ response: tabData[] })
     |
     v
Popup receives response
     |
     v
Update UI with tab list
```

### Message Flow: Content to Background

```
User interacts with page
     |
     v
content.ts detects activity
     |
     v
browser.runtime.sendMessage({ UpDateLastUseTime: true })
     |
     v
background.ts receives message with sender.tab
     |
     v
Find tab in tabStatusList
     |
     v
Update tabStatus.lastUseTime
     |
     v
sendResponse({ response: 'Updated' })
```

### Whitelist Update Flow

```
User adds domain to whitelist
     |
     v
Option.vue sends AddToWhitelist message
     |
     v
browser.runtime.sendMessage({ AddToWhitelist: 'example.com' })
     |
     v
background.ts receives message
     |
     v
normalizeDomain() -> 'example.com'
     |
     v
isValidDomain() validation
     |
     v
whitelist.push('example.com')
     |
     v
safeStorage.set({ whitelist })
     |
     v
browser.storage.onChanged fires
     |
     v
background.ts updates local whitelist
     |
     v
sendResponse({ response: { success: true, message: '...' } })
```

---

## Component Communication

### Message Categories

#### 1. Synchronous Messages (Quick Response)

- `getTabId` - Returns tab ID immediately
- `GetFreezeTabList` - Returns frozen tabs array
- `GetVisibleTabs` - Returns visible tab IDs

#### 2. Asynchronous Messages (Delayed Response)

- `GetTabStatusList` - Calculates remaining time for all tabs
- `GetRemainingTime` - Calculates for single tab
- `RestoreAllFrozenTabs` - Restores multiple tabs
- `GetWhitelist` - Returns whitelist array

#### 3. Fire-and-Forget Messages

- `UpDateLastUseTime` - Updates timestamp, no response needed
- `UpdatePageInfo` - Updates URL/title, minimal response
- `SetPageVisible`/`SetPageHidden` - Updates visibility state

### Communication Patterns

**Request-Response Pattern**

```typescript
// Sender
const response = await browser.runtime.sendMessage({
  GetTabStatusList: true
});
handleResponse(response.response);

// Receiver (background.ts)
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.GetTabStatusList) {
    getAllTabsRemainingTime().then(result => {
      sendResponse({ response: result });
    });
    return true; // Keep channel open for async
  }
});
```

**Broadcast Pattern**

```typescript
// Content script to background
browser.runtime.sendMessage({ UpDateLastUseTime: true });

// Multiple listeners can receive (though only background in this case)
```

**Tab-Specific Messaging**

```typescript
// Background to content script
browser.tabs.sendMessage(tabId, {
  type: 'getPageInfo'
}).then(response => {
  console.log(response.response);
});
```

---

## State Management

### In-Memory State

**Background Script State:**
```typescript
let tabStatusList: TabStatus[] = [];          // Active tabs tracking
let freezeTabStatusList: FreezeTabStatus[] = []; // Frozen tabs
let whitelist: string[] = [];                  // Protected domains
let FreezeTimeout: number = 20;                // Minutes before freeze
const FreezePinned = ref(false);               // Freeze pinned setting
```

**Content Script State:**
```typescript
let currentTabId: number | null = null;        // Current tab ID
let lastUrl: string = window.location.href;    // Last tracked URL
let currentVisibilityState: string;            // Page visibility
let lastVisibilityReport: string;              // Last reported state
let lastActivityTime: number = 0;              // Throttle tracker
```

### Persistent State (Chrome Storage)

| Key | Type | Scope | Updated By |
|-----|------|-------|------------|
| `FreezeTimeout` | number | Sync | Options page |
| `FreezePinned` | boolean | Sync | Options page |
| `whitelist` | string[] | Sync | Options page, Context menu |
| `freezeTabStatusList` | FreezeTabStatus[] | Sync | Background script |

### State Synchronization

```
User changes setting in Options
        |
        v
ConfigManager.updateConfig()
        |
        v
browser.storage.sync.set()
        |
        v
browser.storage.onChanged listener
        |
        v
Background script updates local state
        |
        v
All operations use new value
```

---

## Extension Lifecycle

### Installation and Startup

```
1. Extension Installed
   |
   v
2. browser.runtime.onInstalled
   |
   v
3. createContextMenus() - Create context menu items
   |
   v
4. browser.tabs.query({}) - Get all existing tabs
   |
   v
5. addTabToList() for each existing tab
   |
   v
6. setInterval(checkAndFreezeTabs, 60000) - Start monitoring
```

### Normal Operation

```
1. User opens/closes/activates tabs
   |
   v
2. Browser events fire (onCreated, onRemoved, onActivated)
   |
   v
3. Background script handlers update tabStatusList
   |
   v
4. Content scripts report activity
   |
   v
5. Periodic check freezes inactive tabs
```

### Content Script Injection

```
1. Page loads
   |
   v
2. Browser injects content.ts
   |
   v
3. Send { getTabId: true } message
   |
   v
4. Receive tab ID from background
   |
   v
5. Initialize page tracking
   |
   v
6. Start sending activity updates
```

---

## Security Considerations

### Input Validation

All user inputs are validated before use:

```typescript
// Domain validation
isValidDomain(domain) -> boolean

// URL validation
isValidUrl(url) -> boolean

// Tab ID validation
isValidTabId(id) -> boolean
```

### Storage Security

- Only non-sensitive data stored in `storage.sync`
- No user credentials or personal information stored
- Domain names normalized to prevent bypasses

### Message Security

- Message types validated before processing
- Sender information checked for sensitive operations
- No arbitrary code execution via messages

### Permissions Model

```json
{
  "permissions": [
    "storage",      // Configuration storage
    "tabs",         // Tab management
    "activeTab",    // Current tab access
    "contextMenus"  // Right-click menu
  ]
}
```

### CSP (Content Security Policy)

The extension follows CSP guidelines:
- No inline scripts in HTML
- No eval() or similar dynamic code
- External resources limited to extension files

---

## Module Dependencies

### Dependency Graph

```
background.ts
    ├── browser (webextension-polyfill)
    ├── utils/index.ts (Message, Response types)
    ├── utils/error-handler.ts (safeAsync, safeStorage, etc.)
    ├── utils/performance.ts (SmartScheduler)
    └── utils/config.ts (configManager)

content.ts
    ├── browser (webextension-polyfill)
    └── utils/index.ts (Message types)

popup.ts
    ├── vue
    ├── pages/Popup.vue
    └── virtual:uno.css

options_ui.ts
    ├── vue
    ├── pages/Option.vue
    └── virtual:uno.css

utils/config.ts
    └── utils/error-handler.ts (safeStorage, ExtensionError)

utils/error-handler.ts
    └── browser (webextension-polyfill)

utils/performance.ts
    └── utils/error-handler.ts (safeAsync)
```

### Import Analysis

**Circular Dependencies:** None

**Shared Utilities:**
- `utils/index.ts` - Type definitions shared across all modules
- `utils/error-handler.ts` - Error handling used by background and config
- `utils/performance.ts` - Performance utilities available but not heavily used

**Module Coupling:**
- Low coupling between UI components and background logic
- Communication only through message passing
- Utility modules are independent and reusable

---

## Performance Optimization

### Smart Scheduling

The `SmartScheduler` class in `utils/performance.ts` provides optimized task execution:

```typescript
// Instead of multiple intervals, use single scheduler
const scheduler = new SmartScheduler();
scheduler.addTask('checkFreeze', checkAndFreezeTabs, 60000);
scheduler.addTask('cleanup', cleanupFrozenTabs, 3600000);
scheduler.start(1000); // Check every second
```

### Debouncing and Throttling

User activity events are throttled to reduce message frequency:

```typescript
// 5 second throttle for activity events
const ACTIVITY_THROTTLE = 5000;

// 2 second throttle for scroll events
const SCROLL_THROTTLE = 2000;
```

### Memory Management

- Periodic cleanup of closed tabs from freeze list
- TTL-based cache with automatic expiration
- Efficient data structures (Map, Set) for lookups

---

## Browser Compatibility

### Chrome (Manifest V3)

- Service Worker instead of background page
- `chrome.runtime.getURL()` for extension URLs
- `chrome.storage.sync` for settings

### Firefox (Manifest V2 with polyfill)

- Background scripts with polyfill
- `browser.runtime.sendMessage()` unified API
- Same storage API through polyfill

### Cross-Browser Strategy

Use `webextension-polyfill` to normalize differences:

```typescript
import browser from 'webextension-polyfill';

// Works on both Chrome and Firefox
const tabs = await browser.tabs.query({ active: true });
```

---

## Extension Points

### Adding New Message Types

1. Add type to `Message` interface in `utils/index.ts`
2. Add handler in `background.ts` message listener
3. Implement sending logic in content script or popup

### Adding New Configuration Options

1. Add to `AppConfig` interface in `utils/config.ts`
2. Add default to `DEFAULT_CONFIG`
3. Add validation in `validateConfig()`
4. Update UI to modify the value

### Adding New Event Handlers

1. Add listener in `background.ts` or `content.ts`
2. Follow existing patterns for event handling
3. Ensure proper cleanup if needed

---

## See Also

- [API Documentation](./api.md)
- [Development Plan](./planning/DEVELOPMENT_PLAN.md)
- [Technical Roadmap](./planning/TECHNICAL_ROADMAP.md)
