<script lang="ts" setup>
import { NCollapse, NCollapseItem, NInputNumber, NSwitch, NTooltip, NIcon, NScrollbar, NLayout } from 'naive-ui';
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
const RecoverTab = ref(false);
interface TabStatus {
  tabId: number;
  url: string;
  icon: string;
  title: string;
  lastUseTime: number;
}
const TabStatusList = ref<TabStatus[]>([]);
interface FreezeTabStatus {
  tabId: number;
  url: string;
  icon: string;
  title: string;
}
const freezeTabStatusList = ref<FreezeTabStatus[]>([]);
interface Response {
  response: string | TabStatus[];
  tabId?: number;
}

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
  browser.runtime.sendMessage({ getTabStatusList: true }).then((response) => {
    TabStatusList.value = response === undefined ? [] : response.tabStatusList;
  });

  browser.runtime.sendMessage({ getFreezeTabStatusList: true }).then((response) => {
    console.log('Received freezeTabStatusList:', response.freezeTabStatusList);
    freezeTabStatusList.value = response.freezeTabStatusList;
  });
  getFreezeTimeout()
});
// 先直接获取一次
GetAllTabStatusList();
setInterval(() => {
  GetAllTabStatusList();
  browser.storage.sync.get('freezeTabStatusList').then((result) => {
    // console.log('freezeTabStatusList:', result.freezeTabStatusList);
    if (result.freezeTabStatusList && result.freezeTabStatusList.length > 0) {
      RecoverTab.value = true
    } else {
      RecoverTab.value = false
    }
  }).catch((error) => {
    console.error('Error getting freezeTabStatusList:', error);
  });
}, 1000);
function GetAllTabStatusList() {
  browser.runtime.sendMessage({ GetTabStatusList: true }).then((response) => {
    TabStatusList.value = response.response;
  });
  browser.runtime.sendMessage({ GetFreezeTabList: true }).then((response) => {
    freezeTabStatusList.value = response.response;
  });
}
function RecoverAllTab() {
  browser.runtime.sendMessage({ RecoverTab: true }).catch((error) => {
    console.error('Error RecoverTab:', error);
  });
}
function GotoTab(tabId: number) {
  browser.runtime.sendMessage({ GotoTaskPage: true,data:tabId }).catch((error) => {
    console.error('Error GotoTaskPage:', error);
  });
}
</script>

<template class="w-300px h-400px p-0 m-0">
  <NLayout class="select-none">
    <div class="h-full flex flex-col gap-16px items-center mt-3">
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
      <NScrollbar trigger="none">
        <NCollapse :accordion="true" class="w-[calc(100%-8px)]">
          <NCollapseItem title="当前活跃页面">
            <div class="flex flex-col gap-8px w-full" v-for="(item, index) in TabStatusList" :key="index" @click="GotoTab(item.tabId)">
              <div class="flex justify-between items-center m-l m-r">
                <NTooltip>
                  <template #trigger>
                    <div class="flex gap-8px items-center border-b-solid b-1px w-full h-46px">
                      <!-- <p class="m-l-10px">{{ index + 1 + '.' }}</p> -->
                      <img :src="item.icon" class="w-16px h-16px" />
                      <p class="overflow-hidden text-ellipsis whitespace-nowrap w-200px">{{ item.title }}</p>
                    </div>
                  </template>
                  <div> {{ new Date(item.lastUseTime).toLocaleString() }}</div>
                </NTooltip>
              </div>
            </div>
            <template #header-extra>
              <NIcon size="26">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
                  <defs>
                    <linearGradient id="flameGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style="stop-color:#ff4500;stop-opacity:1" />
                      <stop offset="50%" style="stop-color:#ff8c00;stop-opacity:1" />
                      <stop offset="100%" style="stop-color:#ffff00;stop-opacity:1" />
                    </linearGradient>
                  </defs>
                  <path fill="url(#flameGradient)"
                    d="M7.9 20.875q-1.75-1.05-2.825-2.863Q4 16.2 4 14q0-2.825 1.675-5.425q1.675-2.6 4.6-4.55q.55-.375 1.138-.038Q12 4.325 12 5v1.3q0 .85.588 1.425q.587.575 1.437.575q.425 0 .813-.187q.387-.188.687-.538q.2-.25.513-.313q.312-.062.587.138Q18.2 8.525 19.1 10.275q.9 1.75.9 3.725q0 2.2-1.075 4.012q-1.075 1.813-2.825 2.863q.425-.6.663-1.313Q17 18.85 17 18.05q0-1-.375-1.887q-.375-.888-1.075-1.588L12 11.1l-3.525 3.475q-.725.725-1.1 1.6Q7 17.05 7 18.05q0 .8.238 1.512q.237.713.662 1.313ZM12 21q-1.25 0-2.125-.863Q9 19.275 9 18.05q0-.575.225-1.112q.225-.538.65-.963L12 13.9l2.125 2.075q.425.425.65.95q.225.525.225 1.125q0 1.225-.875 2.087Q13.25 21 12 21Z" />
                </svg>
              </NIcon>
            </template>
          </NCollapseItem>
          <NCollapseItem title="已冻结Tab">
            <div class="flex flex-col gap-8px w-full" v-for="(item, index) in freezeTabStatusList" :key="index"  @click="GotoTab(item.tabId)">
              <div class="flex justify-between items-center m-l m-r m-b-0">
                <div class="flex gap-8px items-center border-b-solid b-1px w-full h-46px">
                  <!-- <p class="m-l-10px">{{ index + 1 + '.' }}</p> -->
                  <img :src="item.icon" class="w-16px h-16px" />
                  <p class="overflow-hidden text-ellipsis whitespace-nowrap w-200px">{{ item.title }}</p>
                </div>
              </div>
            </div>
            <template #header-extra>
              <NIcon size="26">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
                  <defs>
                    <linearGradient id="snowflakeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style="stop-color:#85d3fa;stop-opacity:1" />
                      <stop offset="100%" style="stop-color:#c1ebfd;stop-opacity:1" />
                    </linearGradient>
                  </defs>
                  <path fill="url(#snowflakeGradient)"
                    d="M20 10q-.425 0-.712-.288T19 9t.288-.712T20 8t.713.288T21 9t-.288.713T20 10M10 22v-3.6L7.4 21L6 19.6l4-4V14H8.4l-4 4L3 16.6L5.6 14H2v-2h3.6L3 9.4L4.4 8l4 4H10v-1.6l-4-4L7.4 5L10 7.6V4h2v3.6L14.6 5L16 6.4l-4 4V12h8v2h-3.6l2.6 2.6l-1.4 1.4l-4-4H12v1.6l4 4l-1.4 1.4l-2.6-2.6V22zm9-15V2h2v5z" />
                </svg>
              </NIcon>
            </template>
          </NCollapseItem>
        </NCollapse>
      </NScrollbar>
    </div>
  </NLayout>

</template>

<style>
html,
body {
  width: 300px;
  height: 500px;
  padding: 0;
  margin: 0;
}

body {
  background-color: rgb(252, 252, 252);
}
</style>