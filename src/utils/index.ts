interface Message {
  greeting?: string;
  async?: boolean;
  getTabId?: boolean;
  UpDateLastUseTime?: boolean;
  getTabActive?: boolean;
  GetTabStatusList?: boolean;
  GetWhiteList?: boolean;
  DeleteTab?: boolean;
  GetFreezeTabList?: boolean;
  RecoverFreezeTab?: boolean;
  RecoverTab?: boolean;
  RemoveFreezeTab?: number;
  GotoTaskPage?: boolean;
  data?: unknown;
}

interface TabStatus {
  tabId: number;
  url: string;
  icon: string;
  title: string;
  lastUseTime: number;
}

interface FreezeTabStatus {
  tabId: number;
  url: string;
  icon: string;
  title: string;
}
interface Response {
  response: string | TabStatus[] | FreezeTabStatus[] | boolean | number | undefined;
  tabId?: number;
}
type SendResponse = (response?: Response) => void;
export type { Message, Response, SendResponse, TabStatus, FreezeTabStatus }