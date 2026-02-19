/**
 * WebExtension Polyfill Mock for Vitest Testing
 * Provides complete mock implementation of browser.* API
 */

import { vi } from 'vitest'

// Mock Tab interface (webextension-polyfill)
interface MockBrowserTab {
  id: number
  url?: string
  title?: string
  active: boolean
  pinned: boolean
  windowId: number
  index: number
  status?: 'loading' | 'complete'
  audible?: boolean
  discarded?: boolean
  autoDiscardable?: boolean
  mutedInfo?: { muted: boolean }
  favIconUrl?: string
  hidden?: boolean
  highlighted?: boolean
  incognito?: boolean
  selected?: boolean
}

// Mock Storage area (webextension-polyfill - Promise-based)
interface MockBrowserStorageArea {
  get(keys: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(keys: string | string[]): Promise<void>
  clear(): Promise<void>
  getBytesInUse(keys?: string | string[] | null): Promise<number>
}

// Inline type definitions (avoiding namespace references)
interface BrowserTabsQueryInfo {
  active?: boolean
  pinned?: boolean
  audible?: boolean
  muted?: boolean
  highlighted?: boolean
  currentWindow?: boolean
  lastFocusedWindow?: boolean
  status?: 'loading' | 'complete'
  discarded?: boolean
  hidden?: boolean
  windowId?: number
  windowType?: 'normal' | 'popup' | 'panel' | 'app' | 'devtools'
  url?: string | string[]
  title?: string
  index?: number
  cookieStoreId?: string
  openerTabId?: number
}

interface BrowserTabsCreateProperties {
  windowId?: number
  index?: number
  url?: string
  active?: boolean
  pinned?: boolean
  openerTabId?: number
  cookieStoreId?: string
}

interface BrowserTabsUpdateProperties {
  url?: string
  active?: boolean
  highlighted?: boolean
  pinned?: boolean
  muted?: boolean
  openerTabId?: number
}

interface BrowserTabsMessageSendOptions {
  frameId?: number
}

interface BrowserTabsTabChangeInfo {
  status?: 'loading' | 'complete'
  url?: string
  title?: string
  favIconUrl?: string
  discarded?: boolean
}

interface BrowserTabsTab {
  id: number
  index: number
  windowId: number
  groupId?: number
  openerTabId?: number
  highlighted: boolean
  active: boolean
  pinned: boolean
  lastAccessed?: number
  audible?: boolean
  discarded?: boolean
  autoDiscardable?: boolean
  mutedInfo?: { muted: boolean }
  url?: string
  title?: string
  favIconUrl?: string
  status?: 'loading' | 'complete'
  pendingUrl?: string
  width?: number
  height?: number
  sessionId?: string
  cookieStoreId?: string
  isArticle?: boolean
  isInReaderMode?: boolean
}

interface BrowserRuntimeMessageSender {
  id?: string
  tab?: BrowserTabsTab
  frameId?: number
  url?: string
}

interface BrowserRuntimeInstalledDetails {
  reason?: 'install' | 'update' | 'browser_update'
  previousVersion?: string
  id?: string
  temporary?: boolean
}

interface BrowserRuntimePort {
  name: string
  sender?: BrowserRuntimeMessageSender
  disconnect: () => void
  postMessage: (message: unknown) => void
  onDisconnect: { addListener: (callback: (port: BrowserRuntimePort) => void) => void }
  onMessage: { addListener: (callback: (message: unknown, port: BrowserRuntimePort) => void) => void }
}

interface BrowserWindowsWindow {
  id?: number
  focused: boolean
  top?: number
  left?: number
  width?: number
  height?: number
  tabs?: BrowserTabsTab[]
  incognito: boolean
  type?: 'normal' | 'popup' | 'panel' | 'app' | 'devtools' | 'detached_panel'
  state?: 'normal' | 'minimized' | 'maximized' | 'fullscreen' | 'docked'
  alwaysOnTop: boolean
  sessionId?: string
}

interface BrowserWindowsGetInfo {
  populate?: boolean
  windowTypes?: ('normal' | 'popup' | 'panel' | 'app' | 'devtools')[]
}

interface BrowserWindowsCreateData {
  url?: string | string[]
  tabId?: number
  left?: number
  top?: number
  width?: number
  height?: number
  focused?: boolean
  incognito?: boolean
  type?: 'normal' | 'popup' | 'panel' | 'detached_panel' | 'app' | 'devtools'
  state?: 'normal' | 'minimized' | 'maximized' | 'fullscreen'
}

interface BrowserWindowsUpdateInfo {
  left?: number
  top?: number
  width?: number
  height?: number
  focused?: boolean
  drawAttention?: boolean
  state?: 'normal' | 'minimized' | 'maximized' | 'fullscreen'
}

interface BrowserStorageStorageChange {
  oldValue?: unknown
  newValue?: unknown
}

interface BrowserContextMenusCreateProperties {
  type?: 'normal' | 'checkbox' | 'radio' | 'separator'
  id?: string
  title?: string
  checked?: boolean
  contexts?: ('all' | 'page' | 'frame' | 'selection' | 'link' | 'editable' | 'image' | 'video' | 'audio' | 'launcher' | 'browser_action' | 'page_action' | 'action')[]
  onclick?: (info: BrowserContextMenusOnClickData, tab?: BrowserTabsTab) => void
  parentId?: string | number
  documentUrlPatterns?: string[]
  targetUrlPatterns?: string[]
  enabled?: boolean
}

interface BrowserContextMenusUpdateProperties {
  type?: 'normal' | 'checkbox' | 'radio' | 'separator'
  title?: string
  checked?: boolean
  contexts?: ('all' | 'page' | 'frame' | 'selection' | 'link' | 'editable' | 'image' | 'video' | 'audio' | 'launcher' | 'browser_action' | 'page_action' | 'action')[]
  onclick?: (info: BrowserContextMenusOnClickData, tab?: BrowserTabsTab) => void
  parentId?: string | number
  documentUrlPatterns?: string[]
  targetUrlPatterns?: string[]
  enabled?: boolean
}

interface BrowserContextMenusOnClickData {
  menuItemId: string | number
  parentMenuItemId?: string | number
  mediaType?: 'image' | 'video' | 'audio'
  linkUrl?: string
  srcUrl?: string
  pageUrl?: string
  frameUrl?: string
  frameId?: number
  selectionText?: string
  editable?: boolean
  wasChecked?: boolean
  checked?: boolean
}

// Mock Storage API
const createMockBrowserStorageArea = (): MockBrowserStorageArea => ({
  get: vi.fn((keys: string | string[] | Record<string, unknown> | null) => {
    const data: Record<string, unknown> = {}

    // Handle array of keys - return object with those keys
    if (Array.isArray(keys)) {
      keys.forEach(key => {
        data[key] = undefined
      })
    } else if (typeof keys === 'string') {
      data[keys] = undefined
    } else if (keys && typeof keys === 'object') {
      // Handle object with default values
      Object.assign(data, keys)
    }

    return Promise.resolve(data)
  }),
  set: vi.fn((_items: Record<string, unknown>) => {
    return Promise.resolve()
  }),
  remove: vi.fn((_keys: string | string[]) => {
    return Promise.resolve()
  }),
  clear: vi.fn(() => {
    return Promise.resolve()
  }),
  getBytesInUse: vi.fn((_keys?: string | string[] | null) => {
    return Promise.resolve(0)
  }),
})

// Create event listener mock - using any to avoid constraint issues with callback types
function createEventListenerMock<T>() {
  const listeners: Set<T> = new Set()

  return {
    addListener: vi.fn((callback: T) => {
      listeners.add(callback)
    }),
    removeListener: vi.fn((callback: T) => {
      listeners.delete(callback)
    }),
    hasListener: vi.fn((callback: T) => {
      return listeners.has(callback)
    }),
    listeners,
  }
}

// Mock browser API (webextension-polyfill)
export const browser = {
  // Tabs API
  tabs: {
    get: vi.fn((tabId: number) => {
      const tab: MockBrowserTab = {
        id: tabId,
        url: 'https://example.com',
        title: 'Example',
        active: true,
        pinned: false,
        windowId: 1,
        index: 0,
        status: 'complete',
      }
      return Promise.resolve(tab)
    }),
    getCurrent: vi.fn(() => {
      const tab: MockBrowserTab = {
        id: 1,
        url: 'https://example.com',
        title: 'Example',
        active: true,
        pinned: false,
        windowId: 1,
        index: 0,
        status: 'complete',
      }
      return Promise.resolve(tab)
    }),
    query: vi.fn((_queryInfo: BrowserTabsQueryInfo) => {
      const tabs: MockBrowserTab[] = []
      return Promise.resolve(tabs)
    }),
    create: vi.fn((createProperties: BrowserTabsCreateProperties) => {
      const tab: MockBrowserTab = {
        id: Date.now(),
        url: createProperties.url,
        title: createProperties.url ? 'New Tab' : undefined,
        active: createProperties.active ?? true,
        pinned: false,
        windowId: 1,
        index: 0,
        status: 'complete',
      }
      return Promise.resolve(tab)
    }),
    update: vi.fn((tabId: number, updateProperties: BrowserTabsUpdateProperties) => {
      const tab: MockBrowserTab = {
        id: tabId,
        url: updateProperties.url ?? 'https://example.com',
        title: 'Updated Tab',
        active: true,
        pinned: false,
        windowId: 1,
        index: 0,
        status: 'complete',
      }
      return Promise.resolve(tab)
    }),
    remove: vi.fn((_tabIds: number | number[]) => {
      return Promise.resolve()
    }),
    sendMessage: vi.fn((_tabId: number, _message: unknown, _options?: BrowserTabsMessageSendOptions) => {
      return Promise.resolve(undefined)
    }),
    onActivated: createEventListenerMock<(activeInfo: { tabId: number; windowId: number }) => void>(),
    onUpdated: createEventListenerMock<(tabId: number, changeInfo: BrowserTabsTabChangeInfo, tab: BrowserTabsTab) => void>(),
    onRemoved: createEventListenerMock<(tabId: number, removeInfo: { windowId: number; isWindowClosing: boolean }) => void>(),
    onReplaced: createEventListenerMock<(addedTabId: number, removedTabId: number) => void>(),
  },

  // Storage API
  storage: {
    local: createMockBrowserStorageArea(),
    sync: createMockBrowserStorageArea(),
    session: createMockBrowserStorageArea(),
    onChanged: {
      addListener: vi.fn((_callback: (changes: Record<string, BrowserStorageStorageChange>, areaName: string) => void) => {}),
      removeListener: vi.fn((_callback: (changes: Record<string, BrowserStorageStorageChange>, areaName: string) => void) => {}),
      hasListener: vi.fn((_callback: (changes: Record<string, BrowserStorageStorageChange>, areaName: string) => void) => false),
    },
  },

  // Runtime API
  runtime: {
    id: 'test-extension-id',
    getURL: vi.fn((path: string) => `moz-extension://test-extension-id/${path}`),
    getManifest: vi.fn(() => ({
      manifest_version: 3,
      name: 'Test Extension',
      version: '1.0.0',
    })),
    sendMessage: vi.fn((_message: unknown) => {
      return Promise.resolve(undefined)
    }),
    sendNativeMessage: vi.fn((_application: string, _message: unknown) => {
      return Promise.resolve(undefined)
    }),
    getBackgroundPage: vi.fn(() => {
      return Promise.resolve(window)
    }),
    openOptionsPage: vi.fn(() => {
      return Promise.resolve(true)
    }),
    setUninstallURL: vi.fn((_url: string) => {
      return Promise.resolve(undefined)
    }),
    reload: vi.fn(() => {}),
    requestUpdateCheck: vi.fn(() => {
      return Promise.resolve({ status: 'no_update' })
    }),
    restart: vi.fn(() => {}),
    restartAfterDelay: vi.fn((_seconds: number) => {}),
    onMessage: {
      addListener: vi.fn((_callback: (message: unknown, sender: BrowserRuntimeMessageSender, sendResponse: (response?: unknown) => void) => boolean | void) => {
        return true
      }),
      removeListener: vi.fn((_callback: (message: unknown, sender: BrowserRuntimeMessageSender, sendResponse: (response?: unknown) => void) => boolean | void) => {}),
      hasListener: vi.fn((_callback: (message: unknown, sender: BrowserRuntimeMessageSender, sendResponse: (response?: unknown) => void) => boolean | void) => false),
    },
    onInstalled: createEventListenerMock<(details: BrowserRuntimeInstalledDetails) => void>(),
    onSuspend: createEventListenerMock<() => void>(),
    onSuspendCanceled: createEventListenerMock<() => void>(),
    onUpdateAvailable: createEventListenerMock<(details: { version: string }) => void>(),
    onConnect: createEventListenerMock<(port: BrowserRuntimePort) => void>(),
    onConnectExternal: createEventListenerMock<(port: BrowserRuntimePort) => void>(),
    onMessageExternal: {
      addListener: vi.fn((_callback: (message: unknown, sender: BrowserRuntimeMessageSender, sendResponse: (response?: unknown) => void) => boolean | void) => true),
      removeListener: vi.fn((_callback: (message: unknown, sender: BrowserRuntimeMessageSender, sendResponse: (response?: unknown) => void) => boolean | void) => {}),
      hasListener: vi.fn((_callback: (message: unknown, sender: BrowserRuntimeMessageSender, sendResponse: (response?: unknown) => void) => boolean | void) => false),
    },
  },

  // Windows API
  windows: {
    get: vi.fn((windowId: number, _getInfo?: BrowserWindowsGetInfo) => {
      const win: BrowserWindowsWindow = {
        id: windowId,
        focused: true,
        top: 0,
        left: 0,
        width: 1920,
        height: 1080,
        tabs: [],
        type: 'normal',
        state: 'normal',
        incognito: false,
        alwaysOnTop: false,
      }
      return Promise.resolve(win)
    }),
    getCurrent: vi.fn((_getInfo?: BrowserWindowsGetInfo) => {
      const win: BrowserWindowsWindow = {
        id: 1,
        focused: true,
        top: 0,
        left: 0,
        width: 1920,
        height: 1080,
        tabs: [],
        type: 'normal',
        state: 'normal',
        incognito: false,
        alwaysOnTop: false,
      }
      return Promise.resolve(win)
    }),
    getAll: vi.fn((_getInfo?: BrowserWindowsGetInfo) => {
      const windows: BrowserWindowsWindow[] = []
      return Promise.resolve(windows)
    }),
    create: vi.fn((createData?: BrowserWindowsCreateData) => {
      const win: BrowserWindowsWindow = {
        id: Date.now(),
        focused: true,
        top: createData?.top ?? 0,
        left: createData?.left ?? 0,
        width: createData?.width ?? 1920,
        height: createData?.height ?? 1080,
        tabs: [],
        type: createData?.type ?? 'normal',
        state: createData?.state ?? 'normal',
        incognito: false,
        alwaysOnTop: false,
      }
      return Promise.resolve(win)
    }),
    update: vi.fn((windowId: number, _updateInfo: BrowserWindowsUpdateInfo) => {
      const win: BrowserWindowsWindow = {
        id: windowId,
        focused: true,
        top: 0,
        left: 0,
        width: 1920,
        height: 1080,
        tabs: [],
        type: 'normal',
        state: 'normal',
        incognito: false,
        alwaysOnTop: false,
      }
      return Promise.resolve(win)
    }),
    remove: vi.fn((_windowId: number) => {
      return Promise.resolve()
    }),
    onFocusChanged: createEventListenerMock<(windowId: number) => void>(),
    onCreated: createEventListenerMock<(win: BrowserWindowsWindow) => void>(),
    onRemoved: createEventListenerMock<(windowId: number) => void>(),
  },

  // Context Menus API
  contextMenus: {
    create: vi.fn((_createProperties: BrowserContextMenusCreateProperties) => {
      return Promise.resolve('menu-id')
    }),
    update: vi.fn((_id: string | number, _updateProperties: BrowserContextMenusUpdateProperties) => {
      return Promise.resolve(true)
    }),
    remove: vi.fn((_menuItemId: string | number) => {
      return Promise.resolve(true)
    }),
    removeAll: vi.fn(() => {
      return Promise.resolve(undefined)
    }),
    onClicked: createEventListenerMock<(info: BrowserContextMenusOnClickData, tab?: BrowserTabsTab) => void>(),
  },
}

// Assign to global scope - using type assertion for test environment
;(globalThis as Record<string, unknown>).browser = browser

export default browser
