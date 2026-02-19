# CustomizeChromePlugin API Documentation

This document provides comprehensive API documentation for the CustomizeChromePlugin browser extension.

## Table of Contents

1. [Message Passing API](#message-passing-api)
2. [Chrome Storage API](#chrome-storage-api)
3. [Configuration Interface](#configuration-interface)
4. [Utility Functions](#utility-functions)
5. [Type Definitions](#type-definitions)

---

## Message Passing API

The extension uses Chrome's message passing API to communicate between background scripts, content scripts, and popup UI.

### Message Types

All messages conform to the `Message` interface:

```typescript
interface Message {
  // Tab identification
  getTabId?: boolean;

  // Tab status updates
  UpDateLastUseTime?: boolean;
  UpdatePageInfo?: boolean;
  url?: string;
  title?: string;

  // Tab queries
  type?: string;
  getTabActive?: boolean;
  GetTabStatusList?: boolean;
  GetRemainingTime?: boolean;
  GetVisibleTabs?: boolean;
  tabId?: number;

  // Tab lifecycle
  DeleteTab?: boolean;

  // Freeze management
  GetFreezeTabList?: boolean;
  RecoverFreezeTab?: boolean;
  RecoverTab?: boolean;
  RemoveFreezeTab?: number;
  RestoreAllFrozenTabs?: boolean;

  // Whitelist management
  GetWhitelist?: boolean;
  AddToWhitelist?: string;
  RemoveFromWhitelist?: string;

  // Page visibility
  SetPageVisible?: boolean;
  SetPageHidden?: boolean;

  // Navigation
  GotoTaskPage?: boolean;
  data?: unknown;
}
```

### Response Format

All responses conform to the `Response` interface:

```typescript
interface Response {
  response: string | string[] | TabStatus[] | FreezeTabStatus[] | boolean | number |
             { url?: string; title?: string } |
             { success: boolean; message: string; restoredCount?: number } |
             number[] | undefined;
  tabId?: number;
  error?: string;
}
```

### Common Message Patterns

#### Sending Messages from Content Script

```typescript
import browser from 'webextension-polyfill';

// Simple message (fire and forget)
browser.runtime.sendMessage({ UpDateLastUseTime: true });

// Message with response
const response = await browser.runtime.sendMessage({
  getTabId: true
});
console.log('Tab ID:', response.response);

// Message with data
browser.runtime.sendMessage({
  UpdatePageInfo: true,
  url: window.location.href,
  title: document.title
});
```

#### Sending Messages from Background Script

```typescript
// Send to specific tab
const tabId = 123;
browser.tabs.sendMessage(tabId, {
  type: 'getPageInfo'
}).then((response) => {
  console.log('Page info:', response.response);
});
```

#### Sending Messages from Popup UI

```typescript
// Get tab status list
const response = await browser.runtime.sendMessage({
  GetTabStatusList: true
});
const tabs = response.response as TabStatus[];

// Restore all frozen tabs
const result = await browser.runtime.sendMessage({
  RestoreAllFrozenTabs: true
});
console.log(result.response.message);
```

### Message Handlers

#### Update Last Use Time

Updates the last activity timestamp for a tab, preventing it from being frozen.

```typescript
// Content Script
browser.runtime.sendMessage({ UpDateLastUseTime: true });
```

#### Update Page Info

Notifies the background script of URL or title changes.

```typescript
// Content Script
browser.runtime.sendMessage({
  UpdatePageInfo: true,
  url: window.location.href,
  title: document.title
});
```

#### Get Tab Status List

Retrieves all tracked tabs with their remaining time before freeze.

```typescript
// Any context
const response = await browser.runtime.sendMessage({
  GetTabStatusList: true
});
const tabs = response.response as Array<{
  tabId: number;
  title: string;
  url: string;
  icon: string;
  remainingMinutes: number;
  lastUseTime: number;
}>;
```

#### Get Remaining Time

Gets the remaining time before a specific tab is frozen.

```typescript
// Any context
const response = await browser.runtime.sendMessage({
  GetRemainingTime: true,
  tabId: 123
});
const remainingMinutes = response.response as number;
// -1 means tab is active/visible
// 0 means tab will be frozen soon
// positive number = minutes remaining
```

#### Whitelist Operations

```typescript
// Get whitelist
const response = await browser.runtime.sendMessage({
  GetWhitelist: true
});
const whitelist = response.response as string[];

// Add to whitelist
const result = await browser.runtime.sendMessage({
  AddToWhitelist: 'example.com'
});

// Remove from whitelist
const result = await browser.runtime.sendMessage({
  RemoveFromWhitelist: 'example.com'
});
```

#### Page Visibility Updates

```typescript
// Content Script - page became visible
browser.runtime.sendMessage({ SetPageVisible: true });

// Content Script - page became hidden
browser.runtime.sendMessage({ SetPageHidden: true });
```

#### Freeze Management

```typescript
// Get frozen tabs list
const response = await browser.runtime.sendMessage({
  GetFreezeTabList: true
});
const frozenTabs = response.response as FreezeTabStatus[];

// Restore all frozen tabs
const result = await browser.runtime.sendMessage({
  RestoreAllFrozenTabs: true
});

// Remove specific tab from freeze list
await browser.runtime.sendMessage({
  RemoveFreezeTab: 123
});
```

---

## Chrome Storage API

The extension uses Chrome's storage API (`browser.storage.sync`) for persisting configuration and state.

### Storage Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `FreezeTimeout` | number | 20 | Minutes before inactive tabs are frozen |
| `FreezePinned` | boolean | false | Whether to freeze pinned tabs |
| `whitelist` | string[] | [] | Domains that should never be frozen |
| `freezeTabStatusList` | FreezeTabStatus[] | [] | List of currently frozen tabs |

### Reading Storage

```typescript
import browser from 'webextension-polyfill';

// Get specific keys
const data = await browser.storage.sync.get([
  'FreezeTimeout',
  'FreezePinned',
  'whitelist'
]);
const timeout = data.FreezeTimeout as number;
const freezePinned = data.FreezePinned as boolean;
const whitelist = data.whitelist as string[];

// Get all storage
const allData = await browser.storage.sync.get(null);
```

### Writing Storage

```typescript
// Set single value
await browser.storage.sync.set({
  FreezeTimeout: 30
});

// Set multiple values
await browser.storage.sync.set({
  FreezeTimeout: 30,
  FreezePinned: true,
  whitelist: ['example.com', 'trusted-site.org']
});
```

### Watching for Changes

```typescript
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    if (changes.FreezeTimeout) {
      console.log('FreezeTimeout changed:',
        changes.FreezeTimeout.oldValue,
        '->',
        changes.FreezeTimeout.newValue
      );
    }
  }
});
```

### Safe Storage Operations

The extension provides safe storage wrappers with error handling:

```typescript
import { safeStorage } from './utils/error-handler';

// Get with error handling
try {
  const data = await safeStorage.get<number>(['FreezeTimeout']);
  console.log(data.FreezeTimeout);
} catch (error) {
  console.error('Storage error:', error);
}

// Set with error handling
await safeStorage.set({ FreezeTimeout: 30 });

// Remove with error handling
await safeStorage.remove(['oldKey']);
```

---

## Configuration Interface

### ConfigManager Class

The `ConfigManager` class provides a centralized configuration management system.

```typescript
import { configManager } from './utils/config';

// Initialize (call once on extension load)
await configManager.initialize();

// Get current configuration
const config = configManager.getConfig();

// Update configuration
await configManager.updateConfig({
  freezeTimeout: 30,
  freezePinned: true
});

// Reset to defaults
await configManager.resetToDefaults();

// Whitelist helpers
await configManager.addToWhitelist('example.com');
await configManager.removeFromWhitelist('example.com');
const isWhitelisted = configManager.isWhitelisted('example.com');

// Subscribe to changes
const unsubscribe = configManager.subscribe((newConfig) => {
  console.log('Config changed:', newConfig);
});
// Later: unsubscribe();
```

### Configuration Schema

```typescript
interface AppConfig {
  freezeTimeout: number;      // 1-360 minutes
  freezePinned: boolean;       // Freeze pinned tabs
  whitelist: string[];         // Protected domains
  enabled: boolean;            // Extension enabled
  cleanupInterval: number;     // 1-1440 minutes
  maxTabs: number;             // 1-1000 tabs
  snapshotQuality: number;     // 10-100 JPEG quality
  autoRecovery: boolean;       // Auto-recover frozen tabs
  notifications: boolean;      // Show notifications
  debugMode: boolean;          // Enable debug logging
}
```

---

## Utility Functions

### Error Handling

```typescript
import {
  safeAsync,
  withRetry,
  ExtensionError,
  ErrorCodes
} from './utils/error-handler';

// Safe async wrapper
const result = await safeAsync(async () => {
  return await browser.tabs.get(tabId);
});
if (result) {
  // Success
} else {
  // Error handled
}

// Retry with backoff
const data = await withRetry(
  async () => await fetchWithRetry(url),
  3,      // max retries
  1000    // delay between retries
);

// Custom error
throw new ExtensionError(
  'Tab not found',
  ErrorCodes.TAB_ERROR,
  { tabId }
);
```

### Validation Functions

```typescript
import {
  isValidUrl,
  isValidTabId,
  isValidDomain,
  normalizeDomain
} from './utils/error-handler';

// Validate URL
if (isValidUrl('https://example.com')) {
  // Valid HTTP/HTTPS URL
}

// Validate tab ID
if (isValidTabId(123)) {
  // Valid positive integer
}

// Validate domain
if (isValidDomain('example.com')) {
  // Valid domain format
}

// Normalize domain
const normalized = normalizeDomain('https://sub.example.com:8080/path');
// Returns: 'sub.example.com'
```

### Performance Utilities

```typescript
import {
  debounce,
  throttle,
  SmartScheduler,
  CacheManager
} from './utils/performance';

// Debounce function calls
const debouncedSearch = debounce((query: string) => {
  performSearch(query);
}, 300);

debouncedSearch('test'); // Only executes after 300ms of no calls

// Throttle function calls
const throttledScroll = throttle(() => {
  updateScrollPosition();
}, 100);

window.addEventListener('scroll', throttledScroll);

// Smart scheduler for periodic tasks
const scheduler = new SmartScheduler();

scheduler.addTask(
  'checkTabs',
  async () => await checkAndFreezeTabs(),
  60000,    // 60 second interval
  true      // enabled
);

scheduler.start(1000); // Check every second if tasks need to run

// Cache manager
const cache = new CacheManager<any>(300000); // 5 minute TTL

cache.set('key', data);
const cached = cache.get('key');
```

### Tab Operations

```typescript
import { safeTabs } from './utils/error-handler';

// Get tab with validation
try {
  const tab = await safeTabs.get(123);
  console.log(tab.url);
} catch (error) {
  if (error instanceof ExtensionError) {
    console.error(error.code, error.message);
  }
}

// Query tabs
const activeTabs = await safeTabs.query({
  active: true,
  currentWindow: true
});

// Update tab
await safeTabs.update(123, {
  active: true
});
```

---

## Type Definitions

### TabStatus

Represents a tracked tab with its state and metadata.

```typescript
interface TabStatus {
  tabId: number;                          // Unique tab identifier
  url: string;                            // Current URL
  icon: string;                           // Favicon URL
  title: string;                          // Page title
  lastUseTime: number;                    // Timestamp of last activity
  windowId?: number;                      // Browser window ID
  active?: boolean;                       // Currently active in window
  isVisible?: boolean;                    // Page Visibility API state
  visibilityState?: 'visible' | 'hidden' | 'prerender' | 'unloaded';
}
```

### FreezeTabStatus

Represents a frozen tab with its saved state.

```typescript
interface FreezeTabStatus {
  tabId: number;                          // Original tab identifier
  url: string;                            // Original URL to restore
  icon: string;                           // Favicon
  title: string;                          // Page title
}
```

### Message Request/Response

```typescript
interface Message {
  // See Message Types section above
}

interface Response {
  response: /* varies by message type */;
  tabId?: number;
  error?: string;
}

type SendResponse = (response?: Response) => void;
```

### Error Codes

```typescript
enum ErrorCodes {
  STORAGE_ERROR = 'STORAGE_ERROR',        // Storage operation failed
  TAB_ERROR = 'TAB_ERROR',                // Tab operation failed
  NETWORK_ERROR = 'NETWORK_ERROR',        // Network request failed
  VALIDATION_ERROR = 'VALIDATION_ERROR',  // Input validation failed
  PERMISSION_ERROR = 'PERMISSION_ERROR'   // Missing permissions
}
```

---

## Usage Examples

### Complete Workflow: Add Tab to Whitelist

```typescript
// 1. User clicks "Add to Whitelist" button in popup
async function handleAddToWhitelist(url: string) {
  try {
    // 2. Extract domain from URL
    const domain = new URL(url).hostname;

    // 3. Send message to background script
    const response = await browser.runtime.sendMessage({
      AddToWhitelist: domain
    });

    // 4. Handle response
    const result = response.response as {
      success: boolean;
      message: string
    };

    if (result.success) {
      console.log('Success:', result.message);
    } else {
      console.error('Failed:', result.message);
    }
  } catch (error) {
    console.error('Communication error:', error);
  }
}
```

### Complete Workflow: Monitor Tab Activity

```typescript
// In content script
function monitorTabActivity() {
  // Report initial state
  browser.runtime.sendMessage({
    UpdatePageInfo: true,
    url: window.location.href,
    title: document.title
  });

  // Watch for visibility changes
  document.addEventListener('visibilitychange', () => {
    const message = document.visibilityState === 'visible'
      ? { SetPageVisible: true }
      : { SetPageHidden: true };
    browser.runtime.sendMessage(message);
  });

  // Watch for user activity
  const events = ['mousedown', 'keydown', 'scroll'];
  const throttledUpdate = throttle(() => {
    browser.runtime.sendMessage({ UpDateLastUseTime: true });
  }, 5000);

  events.forEach(event => {
    document.addEventListener(event, throttledUpdate);
  });
}
```

---

## Browser Compatibility

This API is designed to work with both Chrome and Firefox using the `webextension-polyfill` library.

### Chrome Manifest V3

```javascript
// manifest.json
{
  "permissions": [
    "storage",
    "tabs",
    "activeTab"
  ],
  "background": {
    "service_worker": "background.js"
  }
}
```

### Firefox Manifest V2

```javascript
// manifest.json
{
  "permissions": [
    "storage",
    "tabs",
    "activeTab"
  ],
  "background": {
    "scripts": ["background.js"]
  }
}
```

---

## Error Handling Best Practices

1. **Always wrap storage operations** in try-catch or use `safeStorage`
2. **Validate message responses** before using the data
3. **Handle missing tabs** gracefully (tabs may be closed while processing)
4. **Use error codes** to identify error types programmatically
5. **Log errors** for debugging but don't expose sensitive information

```typescript
// Example of robust message handling
async function safeSendMessage(message: Message): Promise<Response | null> {
  try {
    const response = await browser.runtime.sendMessage(message);

    if (response && response.error) {
      console.error('Message error:', response.error);
      return null;
    }

    return response;
  } catch (error) {
    console.error('Send failed:', error);
    return null;
  }
}
```

---

## See Also

- [Architecture Documentation](./architecture.md)
- [Project README](../README.md)
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/)
- [WebExtension Polyfill](https://github.com/mozilla/webextension-polyfill)
