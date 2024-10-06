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
  RemoveFreezeTab?: number;
}
interface Response {
  response: string | any[] | boolean | number | undefined;
  tabId?: number;
}
type SendResponse = (response?: Response) => void;
// todo 将数据保存到服务器
function Save2server() {

}
export type { Message, Response, SendResponse }