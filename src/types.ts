/**
 * Shared TypeScript interfaces for the extension
 */

// Tab status for active tabs
export interface TabStatus {
  tabId: number;
  url: string;
  icon: string;
  title: string;
  lastUseTime: number;
  windowId?: number;
  active?: boolean;
  isVisible?: boolean; // 页面是否真正可见（基于Page Visibility API）
  visibilityState?: 'visible' | 'hidden' | 'prerender' | 'unloaded';
}

// Tab status for frozen tabs
export interface FreezeTabStatus {
  tabId: number;
  url: string;
  icon: string;
  title: string;
}

// Message types for background script communication
export interface Message {
  greeting?: string;
  async?: boolean;
  getTabId?: boolean;
  UpDateLastUseTime?: boolean;
  UpdatePageInfo?: boolean;
  url?: string;
  title?: string;
  type?: string;
  getTabActive?: boolean;
  GetTabStatusList?: boolean;
  GetRemainingTime?: boolean;
  tabId?: number;
  DeleteTab?: boolean;
  GetFreezeTabList?: boolean;
  RecoverFreezeTab?: boolean;
  RecoverTab?: boolean;
  RemoveFreezeTab?: number;
  GotoTaskPage?: boolean;
  data?: unknown;
  // Whitelist CRUD operations
  GetWhitelist?: boolean;
  AddToWhitelist?: string;
  RemoveFromWhitelist?: string;
  // Restore all frozen tabs operation
  RestoreAllFrozenTabs?: boolean;
  // Page visibility operations
  SetPageVisible?: boolean;
  SetPageHidden?: boolean;
  GetVisibleTabs?: boolean;
}

// Response types
export interface PageInfoResponse {
  url?: string;
  title?: string;
}

export interface RestoreAllResult {
  success: boolean;
  message: string;
  restoredCount: number;
}

export type ResponseData = string | string[] | TabStatus[] | FreezeTabStatus[] | boolean | number | undefined | PageInfoResponse | RestoreAllResult | number[];

export interface Response {
  response: ResponseData;
  tabId?: number;
  error?: string;
}

export type SendResponse = (response?: Response) => void;

// Extended tab status with remaining time (for UI)
export interface ExtendedTabStatus extends TabStatus {
  remainingMinutes: number;
}

// Storage types
export interface StorageConfig {
  FreezeTimeout?: number;
  FreezePinned?: boolean;
  whitelist?: string[];
  freezeTabStatusList?: FreezeTabStatus[];
  backgroundImage?: string;
}

// Whitelist operation result
export interface WhitelistOperationResult {
  success: boolean;
  message: string;
}
