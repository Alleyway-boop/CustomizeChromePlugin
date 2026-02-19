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
  // New bulk whitelist operations
  AddMultipleToWhitelist?: string[];
  RemoveMultipleFromWhitelist?: string[];
  ClearWhitelist?: boolean;
  ExportWhitelist?: boolean;
  ImportWhitelist?: { data: string; onConflict?: 'skip' | 'overwrite' | 'keep' };
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
interface BulkOperationResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: string[];
  message: string;
}

interface WhitelistExportData {
  version: string;
  exportedAt: number;
  items: unknown[];
}

interface WhitelistImportResult {
  success: boolean;
  imported: number;
  failed: number;
  duplicates: number;
  errors: string[];
  processed?: number;
  message?: string;
}

interface Response {
  response: string | string[] | TabStatus[] | FreezeTabStatus[] | boolean | number | undefined | { url?: string; title?: string } | { success: boolean; message: string; restoredCount?: number } | BulkOperationResult | WhitelistExportData | WhitelistImportResult | number[];
  tabId?: number;
  error?: string;
}
type SendResponse = (response?: Response) => void;
export type { Message, Response, SendResponse, TabStatus, FreezeTabStatus, BulkOperationResult }