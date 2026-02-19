/**
 * Chrome API Mock for Vitest Testing
 * Provides complete mock implementation of Chrome Extension APIs
 */

import { vi } from 'vitest'

// Mock Tab interface
interface MockTab {
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

// Mock Storage area
interface MockStorageArea {
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
  getBytesInUse: ReturnType<typeof vi.fn>
}

// Inline type definitions (avoiding namespace references)
interface TabsQueryInfo {
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

interface TabsCreateProperties {
  windowId?: number
  index?: number
  url?: string
  active?: boolean
  pinned?: boolean
  openerTabId?: number
  cookieStoreId?: string
}

interface TabsUpdateProperties {
  url?: string
  active?: boolean
  highlighted?: boolean
  pinned?: boolean
  muted?: boolean
  openerTabId?: number
}

interface TabsMessageSendOptions {
  frameId?: number
}

interface TabsTabChangeInfo {
  status?: 'loading' | 'complete'
  url?: string
  title?: string
  favIconUrl?: string
  discarded?: boolean
}

interface TabsTab {
  id?: number
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
}

interface RuntimeMessageSender {
  id?: string
  tab?: TabsTab
  frameId?: number
  url?: string
}

interface RuntimeInstalledDetails {
  reason?: 'install' | 'update' | 'browser_update' | 'chrome_update' | 'shared_module_update'
  previousVersion?: string
  id?: string
}

interface RuntimePort {
  name: string
  sender?: RuntimeMessageSender
  disconnect: () => void
  postMessage: (message: unknown) => void
  onDisconnect: { addListener: (callback: (port: RuntimePort) => void) => void }
  onMessage: { addListener: (callback: (message: unknown, port: RuntimePort) => void) => void }
}

interface WindowsWindow {
  id?: number
  focused: boolean
  top?: number
  left?: number
  width?: number
  height?: number
  tabs?: TabsTab[]
  incognito?: boolean
  type?: 'normal' | 'popup' | 'panel' | 'app' | 'devtools' | 'detached_panel'
  state?: 'normal' | 'minimized' | 'maximized' | 'fullscreen' | 'docked'
  alwaysOnTop?: boolean
  sessionId?: string
}

interface WindowsGetInfo {
  populate?: boolean
  windowTypes?: ('normal' | 'popup' | 'panel' | 'app' | 'devtools')[]
}

interface WindowsCreateData {
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

interface WindowsUpdateInfo {
  left?: number
  top?: number
  width?: number
  height?: number
  focused?: boolean
  drawAttention?: boolean
  state?: 'normal' | 'minimized' | 'maximized' | 'fullscreen'
}

interface StorageStorageChange {
  oldValue?: unknown
  newValue?: unknown
}

interface ContextMenusCreateProperties {
  type?: 'normal' | 'checkbox' | 'radio' | 'separator'
  id?: string
  title?: string
  checked?: boolean
  contexts?: ('all' | 'page' | 'frame' | 'selection' | 'link' | 'editable' | 'image' | 'video' | 'audio' | 'launcher' | 'browser_action' | 'page_action' | 'action')[]
  onclick?: (info: ContextMenusOnClickData, tab?: TabsTab) => void
  parentId?: string | number
  documentUrlPatterns?: string[]
  targetUrlPatterns?: string[]
  enabled?: boolean
}

interface ContextMenusUpdateProperties {
  type?: 'normal' | 'checkbox' | 'radio' | 'separator'
  title?: string
  checked?: boolean
  contexts?: ('all' | 'page' | 'frame' | 'selection' | 'link' | 'editable' | 'image' | 'video' | 'audio' | 'launcher' | 'browser_action' | 'page_action' | 'action')[]
  onclick?: (info: ContextMenusOnClickData, tab?: TabsTab) => void
  parentId?: string | number
  documentUrlPatterns?: string[]
  targetUrlPatterns?: string[]
  enabled?: boolean
}

interface ContextMenusOnClickData {
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
const createMockStorageArea = (): MockStorageArea => ({
  get: vi.fn((keys: string | string[] | Record<string, unknown> | null, callback?: (items: Record<string, unknown>) => void) => {
    const data: Record<string, unknown> = {}
    if (callback) {
      callback(data)
    }
    return Promise.resolve(data)
  }),
  set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
    if (callback) callback()
    return Promise.resolve()
  }),
  remove: vi.fn((keys: string | string[], callback?: () => void) => {
    if (callback) callback()
    return Promise.resolve()
  }),
  clear: vi.fn((callback?: () => void) => {
    if (callback) callback()
    return Promise.resolve()
  }),
  getBytesInUse: vi.fn((keys: string | string[] | null, callback?: (bytesInUse: number) => void) => {
    if (callback) callback(0)
    return Promise.resolve(0)
  }),
})

// Mock Chrome API
export const chrome = {
  // Tabs API
  tabs: {
    get: vi.fn((tabId: number | null, callback?: (tab: MockTab) => void) => {
      const tab: MockTab = {
        id: 1,
        url: 'https://example.com',
        title: 'Example',
        active: true,
        pinned: false,
        windowId: 1,
        index: 0,
        status: 'complete',
      }
      if (callback) callback(tab)
      return Promise.resolve(tab)
    }),
    getCurrent: vi.fn((callback?: (tab: MockTab) => void) => {
      const tab: MockTab = {
        id: 1,
        url: 'https://example.com',
        title: 'Example',
        active: true,
        pinned: false,
        windowId: 1,
        index: 0,
        status: 'complete',
      }
      if (callback) callback(tab)
      return Promise.resolve(tab)
    }),
    query: vi.fn((queryInfo: TabsQueryInfo, callback?: (results: MockTab[]) => void) => {
      const tabs: MockTab[] = []
      if (callback) callback(tabs)
      return Promise.resolve(tabs)
    }),
    create: vi.fn((createProperties: TabsCreateProperties, callback?: (tab: MockTab) => void) => {
      const tab: MockTab = {
        id: Date.now(),
        url: createProperties.url,
        title: createProperties.url ? 'New Tab' : undefined,
        active: createProperties.active ?? true,
        pinned: false,
        windowId: 1,
        index: 0,
        status: 'complete',
      }
      if (callback) callback(tab)
      return Promise.resolve(tab)
    }),
    update: vi.fn((tabId: number, updateProperties: TabsUpdateProperties, callback?: (tab: MockTab) => void) => {
      const tab: MockTab = {
        id: tabId,
        url: updateProperties.url ?? 'https://example.com',
        title: 'Updated Tab',
        active: true,
        pinned: false,
        windowId: 1,
        index: 0,
        status: 'complete',
      }
      if (callback) callback(tab)
      return Promise.resolve(tab)
    }),
    remove: vi.fn((tabIds: number | number[], callback?: () => void) => {
      if (callback) callback()
      return Promise.resolve()
    }),
    sendMessage: vi.fn((tabId: number, message: unknown, options?: TabsMessageSendOptions, callback?: (response: unknown) => void) => {
      if (callback) callback({})
      return Promise.resolve(true)
    }),
    onActivated: {
      addListener: vi.fn((_callback: (activeInfo: { tabId: number; windowId: number }) => void) => {}),
      removeListener: vi.fn((_callback: (activeInfo: { tabId: number; windowId: number }) => void) => {}),
      hasListener: vi.fn((_callback: (activeInfo: { tabId: number; windowId: number }) => void) => false),
    },
    onUpdated: {
      addListener: vi.fn((_callback: (tabId: number, changeInfo: TabsTabChangeInfo, tab: TabsTab) => void) => {}),
      removeListener: vi.fn((_callback: (tabId: number, changeInfo: TabsTabChangeInfo, tab: TabsTab) => void) => {}),
      hasListener: vi.fn((_callback: (tabId: number, changeInfo: TabsTabChangeInfo, tab: TabsTab) => void) => false),
    },
    onRemoved: {
      addListener: vi.fn((_callback: (tabId: number, removeInfo: { windowId: number; isWindowClosing: boolean }) => void) => {}),
      removeListener: vi.fn((_callback: (tabId: number, removeInfo: { windowId: number; isWindowClosing: boolean }) => void) => {}),
      hasListener: vi.fn((_callback: (tabId: number, removeInfo: { windowId: number; isWindowClosing: boolean }) => void) => false),
    },
    onReplaced: {
      addListener: vi.fn((_callback: (addedTabId: number, removedTabId: number) => void) => {}),
      removeListener: vi.fn((_callback: (addedTabId: number, removedTabId: number) => void) => {}),
      hasListener: vi.fn((_callback: (addedTabId: number, removedTabId: number) => void) => false),
    },
  },

  // Storage API
  storage: {
    local: createMockStorageArea(),
    sync: createMockStorageArea(),
    session: createMockStorageArea(),
    onChanged: {
      addListener: vi.fn((_callback: (changes: Record<string, StorageStorageChange>, areaName: string) => void) => {}),
      removeListener: vi.fn((_callback: (changes: Record<string, StorageStorageChange>, areaName: string) => void) => {}),
      hasListener: vi.fn((_callback: (changes: Record<string, StorageStorageChange>, areaName: string) => void) => false),
    },
  },

  // Runtime API
  runtime: {
    id: 'test-extension-id',
    getURL: vi.fn((path: string) => `chrome-extension://test-extension-id/${path}`),
    getManifest: vi.fn(() => ({
      manifest_version: 3,
      name: 'Test Extension',
      version: '1.0.0',
    })),
    sendMessage: vi.fn((message: unknown, callback?: (response: unknown) => void) => {
      if (callback) callback({})
      return Promise.resolve(true)
    }),
    sendNativeMessage: vi.fn((application: string, message: unknown, callback?: (response: unknown) => void) => {
      if (callback) callback({})
      return Promise.resolve(true)
    }),
    getBackgroundPage: vi.fn((callback?: (backgroundPage: Window) => void) => {
      if (callback) callback(window as Window)
      return Promise.resolve(window)
    }),
    openOptionsPage: vi.fn((callback?: () => void) => {
      if (callback) callback()
      return Promise.resolve(true)
    }),
    setUninstallURL: vi.fn((url: string, callback?: () => void) => {
      if (callback) callback()
      return Promise.resolve(undefined)
    }),
    reload: vi.fn(() => {}),
    requestUpdateCheck: vi.fn((callback?: (status: string, details?: { version: string }) => void) => {
      if (callback) callback('no_update')
      return Promise.resolve({ status: 'no_update' })
    }),
    restart: vi.fn(() => {}),
    restartAfterDelay: vi.fn((_seconds: number) => {}),
    onMessage: {
      addListener: vi.fn((_callback: (message: unknown, sender: RuntimeMessageSender, sendResponse: (response?: unknown) => void) => boolean | void) => {
        return true
      }),
      removeListener: vi.fn((_callback: (message: unknown, sender: RuntimeMessageSender, sendResponse: (response?: unknown) => void) => boolean | void) => {}),
      hasListener: vi.fn((_callback: (message: unknown, sender: RuntimeMessageSender, sendResponse: (response?: unknown) => void) => boolean | void) => false),
    },
    onInstalled: {
      addListener: vi.fn((_callback: (details: RuntimeInstalledDetails) => void) => {}),
      removeListener: vi.fn((_callback: (details: RuntimeInstalledDetails) => void) => {}),
      hasListener: vi.fn((_callback: (details: RuntimeInstalledDetails) => void) => false),
    },
    onSuspend: {
      addListener: vi.fn((_callback: () => void) => {}),
      removeListener: vi.fn((_callback: () => void) => {}),
      hasListener: vi.fn((_callback: () => void) => false),
    },
    onSuspendCanceled: {
      addListener: vi.fn((_callback: () => void) => {}),
      removeListener: vi.fn((_callback: () => void) => {}),
      hasListener: vi.fn((_callback: () => void) => false),
    },
    onUpdateAvailable: {
      addListener: vi.fn((_callback: (details: { version: string }) => void) => {}),
      removeListener: vi.fn((_callback: (details: { version: string }) => void) => {}),
      hasListener: vi.fn((_callback: (details: { version: string }) => void) => false),
    },
    onConnect: {
      addListener: vi.fn((_callback: (port: RuntimePort) => void) => {}),
      removeListener: vi.fn((_callback: (port: RuntimePort) => void) => {}),
      hasListener: vi.fn((_callback: (port: RuntimePort) => void) => false),
    },
    onConnectExternal: {
      addListener: vi.fn((_callback: (port: RuntimePort) => void) => {}),
      removeListener: vi.fn((_callback: (port: RuntimePort) => void) => {}),
      hasListener: vi.fn((_callback: (port: RuntimePort) => void) => false),
    },
    onMessageExternal: {
      addListener: vi.fn((_callback: (message: unknown, sender: RuntimeMessageSender, sendResponse: (response?: unknown) => void) => boolean | void) => true),
      removeListener: vi.fn((_callback: (message: unknown, sender: RuntimeMessageSender, sendResponse: (response?: unknown) => void) => boolean | void) => {}),
      hasListener: vi.fn((_callback: (message: unknown, sender: RuntimeMessageSender, sendResponse: (response?: unknown) => void) => boolean | void) => false),
    },
  },

  // Windows API
  windows: {
    get: vi.fn((windowId: number, callback?: (win: WindowsWindow) => void) => {
      const win: WindowsWindow = {
        id: windowId,
        focused: true,
        top: 0,
        left: 0,
        width: 1920,
        height: 1080,
        tabs: [],
        type: 'normal',
        state: 'normal',
      }
      if (callback) callback(win)
      return Promise.resolve(win)
    }),
    getCurrent: vi.fn((callback?: (win: WindowsWindow) => void) => {
      const win: WindowsWindow = {
        id: 1,
        focused: true,
        top: 0,
        left: 0,
        width: 1920,
        height: 1080,
        tabs: [],
        type: 'normal',
        state: 'normal',
      }
      if (callback) callback(win)
      return Promise.resolve(win)
    }),
    getAll: vi.fn((getInfo?: WindowsGetInfo, callback?: (windows: WindowsWindow[]) => void) => {
      const windows: WindowsWindow[] = []
      if (callback) callback(windows)
      return Promise.resolve(windows)
    }),
    create: vi.fn((createData?: WindowsCreateData, callback?: (win: WindowsWindow) => void) => {
      const win: WindowsWindow = {
        id: Date.now(),
        focused: true,
        top: createData?.top ?? 0,
        left: createData?.left ?? 0,
        width: createData?.width ?? 1920,
        height: createData?.height ?? 1080,
        tabs: [],
        type: createData?.type ?? 'normal',
        state: createData?.state ?? 'normal',
      }
      if (callback) callback(win)
      return Promise.resolve(win)
    }),
    update: vi.fn((windowId: number, updateInfo: WindowsUpdateInfo, callback?: (win: WindowsWindow) => void) => {
      const win: WindowsWindow = {
        id: windowId,
        focused: true,
        top: 0,
        left: 0,
        width: 1920,
        height: 1080,
        tabs: [],
        type: 'normal',
        state: 'normal',
      }
      if (callback) callback(win)
      return Promise.resolve(win)
    }),
    remove: vi.fn((windowId: number, callback?: () => void) => {
      if (callback) callback()
      return Promise.resolve()
    }),
    onFocusChanged: {
      addListener: vi.fn((_callback: (windowId: number) => void) => {}),
      removeListener: vi.fn((_callback: (windowId: number) => void) => {}),
      hasListener: vi.fn((_callback: (windowId: number) => void) => false),
    },
    onCreated: {
      addListener: vi.fn((_callback: (win: WindowsWindow) => void) => {}),
      removeListener: vi.fn((_callback: (win: WindowsWindow) => void) => {}),
      hasListener: vi.fn((_callback: (win: WindowsWindow) => void) => false),
    },
    onRemoved: {
      addListener: vi.fn((_callback: (windowId: number) => void) => {}),
      removeListener: vi.fn((_callback: (windowId: number) => void) => {}),
      hasListener: vi.fn((_callback: (windowId: number) => void) => false),
    },
  },

  // Context Menus API
  contextMenus: {
    create: vi.fn((createProperties: ContextMenusCreateProperties, callback?: () => void) => {
      if (callback) callback()
      return Promise.resolve('menu-id')
    }),
    update: vi.fn((id: string | number, updateProperties: ContextMenusUpdateProperties, callback?: () => void) => {
      if (callback) callback()
      return Promise.resolve(true)
    }),
    remove: vi.fn((menuItemId: string | number, callback?: () => void) => {
      if (callback) callback()
      return Promise.resolve(true)
    }),
    removeAll: vi.fn((callback?: () => void) => {
      if (callback) callback()
      return Promise.resolve(undefined)
    }),
    onClicked: {
      addListener: vi.fn((_callback: (info: ContextMenusOnClickData, tab?: TabsTab) => void) => {}),
      removeListener: vi.fn((_callback: (info: ContextMenusOnClickData, tab?: TabsTab) => void) => {}),
      hasListener: vi.fn((_callback: (info: ContextMenusOnClickData, tab?: TabsTab) => void) => false),
    },
  },
}

// Assign to global scope - using type assertion for test environment
;(globalThis as Record<string, unknown>).chrome = chrome

// Also assign to browser for webextension-polyfill compatibility
;(globalThis as Record<string, unknown>).browser = {
  storage: chrome.storage,
  tabs: chrome.tabs,
  runtime: chrome.runtime,
  windows: chrome.windows,
  contextMenus: chrome.contextMenus
}

export default chrome
