import Browser from "webextension-polyfill";

interface Message {
    greeting?: string;
    async?: boolean;
}

interface Response {
    response: string;
}
type SendResponse = (response?: Response) => void;

export type { Message, Response, SendResponse }