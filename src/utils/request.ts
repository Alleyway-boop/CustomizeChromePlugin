import { createAlova } from 'alova';
import fetchAdapter from 'alova/fetch';
import vueHook from 'alova/vue';
const alovaInstance = createAlova({
    statesHook: vueHook,
    cacheFor: null,
    cacheLogger: true,
    id: `CustomizePlugin:${Date.now()}`,
    baseURL: import.meta.env.baseUrl,
    requestAdapter: fetchAdapter(),
    timeout: 3000,
});