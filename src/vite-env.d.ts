/// <reference types="vite/client" />
/// <reference types="webextension-polyfill" />

// Browser 类型声明
declare namespace browser {
  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
      title?: string;
      favIconUrl?: string;
      pinned?: boolean;
      windowId?: number;
    }
    
    interface QueryInfo {
      active?: boolean;
      pinned?: boolean;
      windowId?: number;
    }
    
    interface UpdateUpdatePropertiesType {
      url?: string;
      active?: boolean;
    }
    
    function get(tabId: number): Promise<Tab>;
    function query(queryInfo: QueryInfo): Promise<Tab[]>;
    function update(tabId: number, updateProperties: UpdateUpdatePropertiesType): Promise<Tab>;
    function remove(tabId: number): Promise<void>;
    function captureVisibleTab(windowId?: number, options?: { format?: string; quality?: number }): Promise<string>;
    
    interface OnCreatedEvent {
      addListener(callback: (tab: Tab) => void): void;
    }
    
    interface OnUpdatedEvent {
      addListener(callback: (tabId: number, changeInfo: any, tab: Tab) => void): void;
    }
    
    interface OnRemovedEvent {
      addListener(callback: (tabId: number, removeInfo: any) => void): void;
    }
    
    const onCreated: OnCreatedEvent;
    const onUpdated: OnUpdatedEvent;
    const onRemoved: OnRemovedEvent;
  }
  
  namespace runtime {
    function getURL(path: string): string;
    function sendMessage(message: any): Promise<any>;
    
    interface OnMessageEvent {
      addListener(callback: (message: any, sender: any, sendResponse: (response?: any) => void) => void): void;
    }
    
    interface OnInstalledEvent {
      addListener(callback: (details: any) => void): void;
    }
    
    interface OnStartupEvent {
      addListener(callback: () => void): void;
    }
    
    const onMessage: OnMessageEvent;
    const onInstalled: OnInstalledEvent;
    const onStartup: OnStartupEvent;
  }
  
  namespace storage {
    namespace sync {
      function get(keys: string[]): Promise<any>;
      function set(items: Record<string, any>): Promise<void>;
      function remove(keys: string[]): Promise<void>;
      
      interface OnChangedEvent {
        addListener(callback: (changes: any, areaName: string) => void): void;
      }
      
      const onChanged: OnChangedEvent;
    }
    
    namespace local {
      function get(keys: string[]): Promise<any>;
      function set(items: Record<string, any>): Promise<void>;
    }
  }
  
  namespace contextMenus {
    interface CreateProperties {
      id: string;
      title: string;
      contexts?: string[];
      documentUrlPatterns?: string[];
    }
    
    interface OnClickedEvent {
      addListener(callback: (info: any, tab?: tabs.Tab) => void): void;
    }
    
    function create(createProperties: CreateProperties): Promise<void>;
    function removeAll(): Promise<void>;
    const onClicked: OnClickedEvent;
  }
  
  namespace system {
    namespace memory {
      interface MemoryInfo {
        capacity: number;
        availableCapacity: number;
      }
      
      function getInfo(): Promise<MemoryInfo>;
    }
  }
}

// JSX 类型声明
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
    interface Element {
      [key: string]: any;
    }
    interface ElementClass {
      [key: string]: any;
    }
    interface ElementAttributesProperty {
      [key: string]: any;
    }
    interface ElementChildrenAttribute {
      [key: string]: any;
    }
  }
}
