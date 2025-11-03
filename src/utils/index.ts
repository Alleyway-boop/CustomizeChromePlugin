interface Message {
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
  // New whitelist CRUD operations
  GetWhitelist?: boolean;
  AddToWhitelist?: string;
  RemoveFromWhitelist?: string;
  // New restore all frozen tabs operation
  RestoreAllFrozenTabs?: boolean;
  // New page visibility operations
  SetPageVisible?: boolean;
  SetPageHidden?: boolean;
  GetVisibleTabs?: boolean;
}

interface TabStatus {
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

interface FreezeTabStatus {
  tabId: number;
  url: string;
  icon: string;
  title: string;
}
interface Response {
  response: string | string[] | TabStatus[] | FreezeTabStatus[] | boolean | number | undefined | { url?: string; title?: string } | { success: boolean; message: string } | number[];
  tabId?: number;
  error?: string;
}
type SendResponse = (response?: Response) => void;
export type { Message, Response, SendResponse, TabStatus, FreezeTabStatus }