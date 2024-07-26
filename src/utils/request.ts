import { createAlova } from 'alova';
import fetchAdapter from 'alova/fetch';

const alovaInstance = createAlova({
    id: `CustomizePlugin:${Date.now()}`,
    baseURL: import.meta.env.baseUrl,
    requestAdapter: fetchAdapter(),
    timeout: 3000,
});