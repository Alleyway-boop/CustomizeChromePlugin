import { createPinia, defineStore } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { ref } from 'vue'
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
const State = defineStore({
    id: 'state',
    state: () => ({
        PageList: ref([]),
    }),
    getters: {
        getPageList(): any {
            return this.PageList
        }
    },
    actions: {
        setPageList(pageList: any) {
            this.PageList = pageList
        }
    }
})
export default pinia
