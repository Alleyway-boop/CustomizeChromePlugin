<script lang="ts" setup>
import { NDataTable, NInputNumber, NSwitch } from 'naive-ui';
import { onMounted, ref, watch } from 'vue';
import browser from 'webextension-polyfill';
import { useDebounceFn } from '@vueuse/core'
console.log("Hello from the popup!");
browser.runtime.sendMessage({ GetTabStatusList: true }).then((response) => {
  console.log('GetTabStatusList:', response);
});
const FreezePinned = ref();
const FreezeTimeout = ref();
const disabled = ref(true);
interface TabStatus {
  tabId: number;
  url: string;
  icon: string;
  title: string;
  lastUseTime: number;
}
interface Response {
  response: string | TabStatus[];
  tabId?: number;
}
const TabStatusList = ref<TabStatus[]>([]);

function setFreezePinned() {
  browser.storage.sync.set({ "FreezePinned": FreezePinned.value }).catch((error) => {
    console.error('Error setting FreezePinned:', error);
  });
}
function SetFreezeTimeout() {
  console.log('SetFreezeTimeout:', FreezeTimeout.value);
  browser.storage.sync.set({ "FreezeTimeout": FreezeTimeout.value }).catch((error) => {
    console.error('Error setting FreezeTimeout:', error);
  });
}
function getFreezePinned() {
  browser.storage.sync.get('FreezePinned').then((result) => {
    if (result.FreezePinned === undefined) {
      // 默认清理固定标签页
      browser.storage.sync.set({ "FreezePinned": true }).catch((error) => {
        console.error('Error setting FreezePinned:', error);
      });
      FreezePinned.value = true;
    }
    FreezePinned.value = result.FreezePinned;
  }).catch((error) => {
    console.error('Error getting FreezePinned:', error);
  });
}
function getFreezeTimeout() {
  browser.storage.sync.get('FreezeTimeout').then((result) => {
    console.log('getFreezeTimeout:', result.FreezeTimeout);
    if (result.FreezeTimeout === undefined) {
      // 默认值
      result.FreezeTimeout = 20;
      browser.storage.sync.set({ "FreezeTimeout": result.FreezeTimeout }).catch((error) => {
        console.error('Error setting FreezeTimeout:', error);
      });
    }
    FreezeTimeout.value = result.FreezeTimeout;
  }).catch((error) => {
    console.error('Error getting FreezeTimeout:', error);
  });
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.FreezePinned) {
    console.warn('Storage onChanged:', changes.FreezePinned.newValue);
    FreezePinned.value = changes.FreezePinned.newValue;
  }
});
const FreezeTimeoutDebouncedFn = useDebounceFn(() => {
  SetFreezeTimeout();
}, 1000)
const FreezePinnedDebouncedFn = useDebounceFn(() => {
  setFreezePinned();
}, 1000)
watch(FreezePinned, (newValue, oldValue) => {
  FreezePinnedDebouncedFn();
});
watch(FreezeTimeout, (newValue, oldValue) => {
  FreezeTimeoutDebouncedFn();
});
onMounted(() => {
  getFreezePinned();
  getFreezeTimeout();
});
// 先直接获取一次
browser.runtime.sendMessage({ GetTabStatusList: true }).then((response) => {
  TabStatusList.value = response.response;
});
setInterval(() => {
  browser.runtime.sendMessage({ GetTabStatusList: true }).then((response) => {
    TabStatusList.value = response.response;
  });
}, 1000);
</script>

<template class="w-300px h-400px p-0 m-0">
  <div class="h-full flex flex-col gap-16px items-center">
    <img src="/icon-with-shadow.svg" class=" w-50px h-50px" />
    <h1 class="text-18px font-bold m-0">YuanFang</h1>
    <div class="flex justify-between content-center items-center  m-10px">
      <NSwitch v-model:value="disabled" />
      <NInputNumber v-model:value="FreezeTimeout" max="360" min="3" size="small" :disabled="disabled" />
      <div class="w-full">分钟后冻结标签页</div>
    </div>
    <NSwitch v-model:value="FreezePinned" :round="false">
      <template #checked>
        清理固定标签页
      </template>
      <template #unchecked>
        不清理固定标签页
      </template>
    </NSwitch>
    <!-- 显示当前被插件管理的页面 -->
    <div class="flex flex-col gap-8px w-full" v-for="(item, index) in TabStatusList">
      <div class="flex justify-between items-center m-l m-r m-b-0">
        <div class="flex gap-8px items-center border-b-solid b-1px w-full h-30px">
          <p class="m-l-10px">{{ index + 1+'.'}}</p>
          <img :src="item.icon" class="w-16px h-16px" />
          <p class="overflow-hidden text-ellipsis whitespace-nowrap w-200px">{{ item.title }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
html,
body {
  width: 300px;
  height: 400px;
  padding: 0;
  margin: 0;
}

body {
  background-color: rgb(252, 252, 252);
}
</style>
