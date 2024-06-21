import Browser from "webextension-polyfill";

interface Message {
    greeting?: string;
    async?: boolean;
    getTabId?: boolean;
    UpDateLastUseTime?: boolean;
    getTabActive?: boolean;
    GetTabStatusList?: boolean;
    DeleteTab?: boolean;
    GetFreezeTabList?: boolean;
    RecoverFreezeTab?: boolean;
  }
  interface Response {
    response: string | any[] | boolean | number | undefined;
    tabId?: number;
  }
type SendResponse = (response?: Response) => void;

export type { Message, Response, SendResponse }