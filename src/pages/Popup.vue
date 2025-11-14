<template>
  <div class="flex flex-col gap-4 w-[380px] p-4 bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-[500px]">
    <!-- 头部标题 -->
    <div
      class="flex justify-between items-center p-3 bg-white/70 backdrop-blur-sm rounded-xl shadow-sm border border-white/20">
      <div class="flex items-center gap-3">
        <div
          class="w-8 h-8 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
          <div class="i-carbon-dashboard text-white text-lg"></div>
        </div>
        <h1 class="text-lg font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">Tab
          Manager</h1>
      </div>
      <div class="flex items-center gap-2 px-2 py-1 bg-amber-100/80 rounded-full">
        <div class="i-carbon-warning-alt text-amber-600 text-sm animate-pulse"></div>
        <span class="text-xs font-medium text-amber-700">Auto Freeze</span>
      </div>
    </div>

    <!-- 标签页列表和设置区域 -->
    <NScrollbar trigger="none" style="max-height: 400px;">
      <NCollapse :accordion="true" class="gap-2">
        <!-- 设置折叠面板 -->
        <NCollapseItem title="Settings"
          class="border-0 bg-white/60 backdrop-blur-sm rounded-xl shadow-sm overflow-hidden">
          <div class="p-4">
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between p-2 bg-gray-50/50 rounded-lg gap-10">
                <div class="flex items-center gap-2">
                  <div class="i-carbon-time text-blue-500"></div>
                  <span class="text-sm font-medium text-gray-700 text-nowrap">Freeze Timer:</span>
                </div>
                <div class="flex items-center gap-2">
                  <NInputNumber v-model:value="FreezeTimeout" :min="1" :max="360" size="small"
                    @update:value="SetFreezeTimeout()" class="w-auto min-w-0" />
                  <span class="text-sm text-gray-600 font-medium">min</span>
                </div>
              </div>
              <div class="flex items-center justify-between p-2 bg-gray-50/50 rounded-lg">
                <div class="flex items-center gap-2">
                  <div class="i-carbon-pin text-blue-500"></div>
                  <span class="text-sm font-medium text-gray-700">Freeze Pinned:</span>
                </div>
                <NSwitch v-model:value="FreezePinned" @update:value="setFreezePinned()" />
              </div>
            </div>
          </div>
        </NCollapseItem>

        <!-- 活跃标签页 -->
        <NCollapseItem title="Active Tabs"
          class="border-0 bg-white/60 backdrop-blur-sm rounded-xl shadow-sm overflow-hidden">
          <template #header-extra>
            <div class="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full">
              <div class="i-carbon-fire text-white text-sm animate-pulse"></div>
              <span class="text-xs font-bold text-white">{{ TabStatusList.length }}</span>
            </div>
          </template>

          <div class="flex flex-col gap-2 p-3">
            <div v-for="(item, index) in TabStatusList" :key="index" @click="GotoTab(item.tabId)"
              class="group relative overflow-hidden rounded-xl border backdrop-blur-sm transition-all duration-300 cursor-pointer hover:scale-[1.02] hover:shadow-lg"
              :class="{
                'border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50 hover:border-sky-300 hover:shadow-sky-100/50': item.remainingMinutes === -1,
                'border-rose-200 bg-gradient-to-br from-rose-50 to-red-50 hover:border-rose-300 hover:shadow-rose-100/50': item.remainingMinutes <= 1 && item.remainingMinutes !== -1,
                'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 hover:border-amber-300 hover:shadow-amber-100/50': item.remainingMinutes <= 5 && item.remainingMinutes > 1,
                'border-gray-200 bg-gradient-to-br from-white to-gray-50 hover:border-indigo-300 hover:shadow-indigo-100/50': item.remainingMinutes > 5
              }">

              <!-- 背景装饰 -->
              <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" :class="{
                'bg-gradient-to-r from-sky-500/5 to-blue-500/5': item.remainingMinutes === -1,
                'bg-gradient-to-r from-rose-500/5 to-red-500/5': item.remainingMinutes <= 1 && item.remainingMinutes !== -1,
                'bg-gradient-to-r from-amber-500/5 to-orange-500/5': item.remainingMinutes <= 5 && item.remainingMinutes > 1,
                'bg-gradient-to-r from-indigo-500/5 to-blue-500/5': item.remainingMinutes > 5
              }">
              </div>

              <div class="relative flex items-center gap-3 p-4">
                <!-- 图标容器 -->
                <div class="flex-shrink-0 relative">
                  <div class="absolute inset-0 rounded-lg opacity-20 blur-sm" :class="{
                    'bg-gradient-to-br from-sky-400 to-blue-500': item.remainingMinutes === -1,
                    'bg-gradient-to-br from-rose-400 to-red-500': item.remainingMinutes <= 1 && item.remainingMinutes !== -1,
                    'bg-gradient-to-br from-amber-400 to-orange-500': item.remainingMinutes <= 5 && item.remainingMinutes > 1,
                    'bg-gradient-to-br from-indigo-400 to-blue-500': item.remainingMinutes > 5
                  }">
                  </div>
                  <div class="relative w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                    <img v-if="item.icon" :src="item.icon" class="w-6 h-6 rounded" />
                    <div v-else class="i-carbon-document text-gray-400 text-lg"></div>
                  </div>
                </div>

                <!-- 内容 -->
                <div class="flex-1 min-w-0">
                  <!-- 标题和时间 -->
                  <div class="flex items-center justify-between mb-3">
                    <h3
                      class="font-semibold text-sm text-gray-900 truncate pr-2 group-hover:text-indigo-600 transition-colors">
                      {{ item.title || 'Unknown Page' }}
                    </h3>
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <!-- 状态指示器 -->
                      <div class="relative">
                        <div class="absolute inset-0 rounded-full animate-pulse opacity-30" :class="{
                          'bg-sky-500': item.remainingMinutes === -1,
                          'bg-rose-500': item.remainingMinutes <= 1 && item.remainingMinutes !== -1,
                          'bg-amber-500': item.remainingMinutes <= 5 && item.remainingMinutes > 1,
                          'bg-emerald-500': item.remainingMinutes > 15,
                          'bg-yellow-500': item.remainingMinutes > 5 && item.remainingMinutes <= 15
                        }">
                        </div>
                        <div class="relative w-2 h-2 rounded-full" :class="{
                          'bg-sky-500': item.remainingMinutes === -1,
                          'bg-rose-500': item.remainingMinutes <= 1 && item.remainingMinutes !== -1,
                          'bg-amber-500': item.remainingMinutes <= 5 && item.remainingMinutes > 1,
                          'bg-emerald-500': item.remainingMinutes > 15,
                          'bg-yellow-500': item.remainingMinutes > 5 && item.remainingMinutes <= 15
                        }">
                        </div>
                      </div>

                      <span class="text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1" :class="{
                        'bg-sky-100 text-sky-700 border border-sky-200': item.remainingMinutes === -1,
                        'bg-rose-100 text-rose-700 border border-rose-200': item.remainingMinutes <= 1 && item.remainingMinutes !== -1,
                        'bg-amber-100 text-amber-700 border border-amber-200': item.remainingMinutes <= 5 && item.remainingMinutes > 1,
                        'bg-emerald-100 text-emerald-700 border border-emerald-200': item.remainingMinutes > 15,
                        'bg-yellow-100 text-yellow-700 border border-yellow-200': item.remainingMinutes > 5 && item.remainingMinutes <= 15
                      }">
                        <span v-if="item.remainingMinutes === -1" class="inline-flex items-center gap-1">
                          <div class="w-2 h-2 bg-sky-500 rounded-full animate-pulse"></div>
                          {{ formatRemainingTime(item.remainingMinutes) }}
                        </span>
                        <span v-else>
                          {{ formatRemainingTime(item.remainingMinutes) }}
                        </span>
                      </span>
                    </div>
                  </div>

                  <!-- 进度条和时间 -->
                  <div class="flex items-center gap-3">
                    <span class="text-xs text-gray-500 flex-shrink-0 font-medium">
                      {{ new Date(item.lastUseTime).toLocaleTimeString('en-US', {
                        hour: '2-digit', minute: '2-digit'
                      })
                      }}
                    </span>
                    <!-- 活动状态时显示活动指示器，否则显示进度条 -->
                    <div v-if="item.remainingMinutes === -1" class="flex-1 flex items-center justify-center">
                      <div class="flex items-center gap-2 text-sky-600">
                        <div class="w-3 h-3 bg-sky-500 rounded-full animate-pulse"></div>
                        <span class="text-xs font-medium">Active</span>
                      </div>
                    </div>
                    <div v-else class="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                      <div class="h-full relative rounded-full transition-all duration-700 ease-out shadow-sm" :class="{
                        'bg-gradient-to-r from-rose-400 to-red-500 animate-pulse': item.remainingMinutes <= 1,
                        'bg-gradient-to-r from-amber-400 to-orange-500': item.remainingMinutes <= 5,
                        'bg-gradient-to-r from-yellow-400 to-amber-500': item.remainingMinutes > 5 && item.remainingMinutes <= 15,
                        'bg-gradient-to-r from-emerald-400 to-green-500': item.remainingMinutes > 15
                      }" :style="{ width: Math.max(12, (item.remainingMinutes / (FreezeTimeout || 20)) * 100) + '%' }">
                        <div class="absolute inset-0 bg-white/20 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </NCollapseItem>

        <!-- 冻结标签页 -->
        <NCollapseItem title="Frozen Tabs"
          class="border-0 bg-white/60 backdrop-blur-sm rounded-xl shadow-sm overflow-hidden">
          <template #header-extra>
            <div class="flex items-center gap-2">
              <!-- 恢复所有按钮 -->
              <button v-if="freezeTabStatusList.length > 0" @click="restoreAllFrozenTabs"
                class="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white rounded-full transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md">
                <div class="i-carbon-sun text-white text-xs"></div>
                <span class="text-xs font-bold">Restore All</span>
              </button>

              <!-- 冻结计数 -->
              <div class="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full">
                <div class="i-carbon-snowflake text-white text-sm"></div>
                <span class="text-xs font-bold text-white">{{ freezeTabStatusList.length }}</span>
              </div>
            </div>
          </template>

          <div class="flex flex-col gap-2 p-3">
            <div v-for="(item, index) in freezeTabStatusList" :key="index" @click="GotoTab(item.tabId)"
              class="group relative overflow-hidden rounded-xl border backdrop-blur-sm transition-all duration-300 cursor-pointer hover:scale-[1.02] hover:shadow-lg bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 hover:border-cyan-300 hover:shadow-cyan-100/50">

              <!-- 冰霜效果背景 -->
              <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div class="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-cyan-500/5"></div>
                <div
                  class="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2220%22 height=%2220%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cdefs%3E%3Cpattern id=%22snow%22 x=%220%22 y=%220%22 width=%2220%22 height=%2220%22 patternUnits=%22userSpaceOnUse%22%3E%3Ccircle cx=%222%22 cy=%222%22 r=%221%22 fill=%22white%22 opacity=%220.3%22/%3E%3Ccircle cx=%2212%22 cy=%228%22 r=%220.5%22 fill=%22white%22 opacity=%220.2%22/%3E%3Ccircle cx=%228%22 cy=%2214%22 r=%220.8%22 fill=%22white%22 opacity=%220.25%22/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=%22100%25%22 height=%22100%25%22 fill=%22url(%23snow)%22/%3E%3C/svg%3E')] opacity-20">
                </div>
              </div>

              <div class="relative flex items-center gap-3 p-4">
                <!-- 图标容器 -->
                <div class="flex-shrink-0 relative">
                  <div
                    class="absolute inset-0 rounded-lg opacity-30 blur-sm bg-gradient-to-br from-blue-400 to-cyan-500">
                  </div>
                  <div
                    class="relative w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm border border-blue-100">
                    <img v-if="item.icon" :src="item.icon" class="w-6 h-6 rounded opacity-70" />
                    <div v-else class="i-carbon-document text-blue-400 text-lg"></div>
                  </div>
                  <!-- 冻结徽章 -->
                  <div
                    class="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-sm">
                    <div class="i-carbon-snowflake text-white text-[8px]"></div>
                  </div>
                </div>

                <!-- 内容 -->
                <div class="flex-1 min-w-0">
                  <h4
                    class="font-semibold text-sm text-gray-900 truncate mb-1 group-hover:text-blue-600 transition-colors">
                    {{ item.title }}
                  </h4>
                  <p class="text-xs text-gray-500 truncate mb-2">{{ item.url }}</p>

                  <!-- 状态信息 -->
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1 px-2 py-1 bg-blue-100/80 rounded-full">
                      <div class="i-carbon-snowflake text-blue-600 text-xs"></div>
                      <span class="text-xs font-medium text-blue-700">Frozen</span>
                    </div>
                    <div class="text-xs text-gray-400 font-medium">
                      Inactive
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 空状态提示 -->
            <div v-if="freezeTabStatusList.length === 0"
              class="flex flex-col items-center justify-center py-8 text-center">
              <div
                class="w-16 h-16 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl flex items-center justify-center mb-3">
                <div class="i-carbon-snowflake text-blue-500 text-2xl"></div>
              </div>
              <h3 class="text-sm font-semibold text-gray-700 mb-1">No Frozen Tabs</h3>
              <p class="text-xs text-gray-500">Tabs will be frozen automatically when inactive</p>
            </div>
          </div>
        </NCollapseItem>
      </NCollapse>
    </NScrollbar>
  </div>
</template>

<script lang="ts" setup>
import { NCollapse, NCollapseItem, NInputNumber, NSwitch, NScrollbar } from 'naive-ui';
import { onMounted, onUnmounted, ref } from 'vue';
import browser from 'webextension-polyfill';
import type { TabStatus, FreezeTabStatus, Message, Response, SendResponse } from '../utils';

// 扩展 TabStatus 接口包含剩余时间
interface ExtendedTabStatus extends TabStatus {
  remainingMinutes: number;
}

const FreezePinned = ref<boolean>();
const FreezeTimeout = ref<number>();
const TabStatusList = ref<ExtendedTabStatus[]>([]);
const freezeTabStatusList = ref<FreezeTabStatus[]>([]);
let updateTimer: number | null = null;
let lastTabStatusHash: string = ''; // 用于检测状态变化
let updateInterval = 3000; // 默认更新间隔
let noChangeCount = 0; // 连续无变化次数计数器

// 格式化剩余时间显示
function formatRemainingTime(minutes: number): string {
  // 特殊值 -1 表示活动状态
  if (minutes === -1) return '活动中';
  if (minutes <= 0) return '即将冻结';
  if (minutes < 1) return '1分钟内';
  if (minutes < 60) return `${minutes}分钟`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}小时${remainingMinutes}分` : `${hours}小时`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}天${remainingHours}小时` : `${days}天`;
}

// 获取时间状态的颜色
function getTimeStatusColor(minutes: number): string {
  if (minutes === -1) return '#0ea5e9'; // 天蓝色：活动中
  if (minutes <= 1) return '#dc2626'; // 红色：即将冻结
  if (minutes <= 5) return '#ea580c'; // 橙色：警告
  if (minutes <= 15) return '#ca8a04'; // 黄色：注意
  return '#16a34a'; // 绿色：安全
}

// 计算标签页状态的哈希值，用于检测变化
function calculateTabStatusHash(tabList: ExtendedTabStatus[]): string {
  const hashData = tabList.map(tab => ({
    id: tab.tabId,
    active: tab.remainingMinutes === -1,
    time: Math.floor(tab.remainingMinutes / 10) * 10 // 精确到10秒，避免频繁变化
  }));
  return JSON.stringify(hashData);
}

// 智能更新标签页时间信息
function updateTabTimes() {
  browser.runtime.sendMessage({ GetTabStatusList: true }).then((response: any) => {
    if (response && response.response) {
      const newTabList = response.response as ExtendedTabStatus[];
      const currentHash = calculateTabStatusHash(newTabList);

      // 检测状态是否发生变化
      if (currentHash !== lastTabStatusHash) {
        console.log('Tab status changed, updating UI');
        TabStatusList.value = newTabList;
        lastTabStatusHash = currentHash;

        // 状态发生变化，重置计数器并加快更新频率
        noChangeCount = 0;
        if (updateInterval > 1000) {
          updateInterval = 1000; // 变化时每秒更新一次
          restartUpdateTimer();
        }
      } else {
        noChangeCount++;

        // 连续无变化时降低更新频率
        if (noChangeCount >= 5 && updateInterval < 10000) {
          updateInterval = Math.min(updateInterval * 2, 10000); // 最多10秒更新一次
          restartUpdateTimer();
          console.log(`No tab status changes for ${noChangeCount} updates, slowing down to ${updateInterval}ms`);
        }
      }
    }
  }).catch((error) => {
    console.error('Error updating tab times:', error);
  });
}

// 重启更新定时器
function restartUpdateTimer() {
  if (updateTimer) {
    clearInterval(updateTimer);
  }
  updateTimer = setInterval(updateTabTimes, updateInterval);
}

// 启动智能实时更新
function startRealTimeUpdates() {
  updateTabTimes();

  // 初始化快速更新阶段
  updateInterval = 500; // 初始快速更新
  restartUpdateTimer();

  // 快速更新阶段后恢复正常频率
  let fastUpdateCount = 0;
  const fastUpdateTimer = setInterval(() => {
    updateTabTimes();
    fastUpdateCount++;

    // 快速更新10次后切换到智能更新模式
    if (fastUpdateCount >= 10) {
      clearInterval(fastUpdateTimer);
      updateInterval = 1000; // 正常开始时每秒更新一次
      restartUpdateTimer();
      console.log('Fast update phase completed, switching to intelligent updates');
    }
  }, 500);
}

// 停止实时更新
function stopRealTimeUpdates() {
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
  }
}

function setFreezePinned() {
  browser.storage.sync.set({ "FreezePinned": FreezePinned.value }).catch((error) => {
    console.error('Error setting FreezePinned:', error);
  });
}

function SetFreezeTimeout() {
  browser.storage.sync.set({ "FreezeTimeout": FreezeTimeout.value }).catch((error) => {
    console.error('Error setting FreezeTimeout:', error);
  });
}

function getFreezePinned() {
  browser.storage.sync.get('FreezePinned').then((result) => {
    if (result.FreezePinned === undefined) {
      browser.storage.sync.set({ "FreezePinned": true }).catch((error) => {
        console.error('Error setting FreezePinned:', error);
      });
      FreezePinned.value = true;
    }
    FreezePinned.value = result.FreezePinned as boolean;
  }).catch((error) => {
    console.error('Error getting FreezePinned:', error);
  });
}

function getFreezeTimeout() {
  browser.storage.sync.get('FreezeTimeout').then((result) => {
    if (result.FreezeTimeout === undefined) {
      browser.storage.sync.set({ "FreezeTimeout": 20 }).catch((error) => {
        console.error('Error setting FreezeTimeout:', error);
      });
      FreezeTimeout.value = 20;
    }
    FreezeTimeout.value = result.FreezeTimeout as number;
  }).catch((error) => {
    console.error('Error getting FreezeTimeout:', error);
  });
}

const GetAllTabStatusList = () => {
  browser.runtime.sendMessage({ GetTabStatusList: true }).then((response: any) => {
    TabStatusList.value = response.response;
  });
  browser.runtime.sendMessage({ GetFreezeTabList: true }).then((response: any) => {
    freezeTabStatusList.value = response.response;
  });
};

const GotoTab = (tabId: number) => {
  browser.runtime.sendMessage({ GotoTaskPage: true, data: tabId });
};

const GetFreezeTabList = () => {
  browser.runtime.sendMessage({ GetFreezeTabList: true }).then((response: any) => {
    freezeTabStatusList.value = response.response;
  });
};

// 恢复所有冻结的标签页
const restoreAllFrozenTabs = async () => {
  try {
    const response: any = await browser.runtime.sendMessage({ RestoreAllFrozenTabs: true });

    if (response && response.response) {
      const result = response.response;

      if (result.success) {
        // 更新冻结列表
        await GetFreezeTabList();
        await GetAllTabStatusList();

        // 显示成功通知
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300';
        notification.textContent = `Restored ${result.restoredCount} tabs`;
        document.body.appendChild(notification);

        // 3秒后移除通知
        setTimeout(() => {
          notification.style.opacity = '0';
          setTimeout(() => {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 300);
        }, 3000);
      } else {
        // 显示错误提示
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300';
        notification.textContent = result.message;
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = '0';
          setTimeout(() => {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 300);
        }, 3000);
      }
    }
  } catch (error) {
    // 显示错误通知
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300';
    notification.textContent = 'Failed to restore frozen tabs';
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
};


onMounted(async () => {
  getFreezeTimeout();
  getFreezePinned();
  GetFreezeTabList();
  GetAllTabStatusList();

  // 启动实时更新
  startRealTimeUpdates();

  // 监听冻结标签页状态变化
  setInterval(() => {
    browser.storage.sync.get('freezeTabStatusList').then((result: any) => {
      // 处理冻结状态变化
    }).catch((error) => {
      console.error('Error getting freezeTabStatusList:', error);
    });
  }, 1000);

  // 监听窗口获得焦点事件，立即更新状态
  const handleFocus = () => {
    console.log('Popup window gained focus, updating tab status');
    updateTabTimes();
  };

  // 监听窗口可见性变化
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      console.log('Popup window became visible, updating tab status');
      updateTabTimes();
    }
  };

  // 添加事件监听器
  window.addEventListener('focus', handleFocus);
  window.addEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('mouseenter', handleFocus); // 鼠标进入时也更新

  // 清理函数
  onUnmounted(() => {
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('mouseenter', handleFocus);
    stopRealTimeUpdates();
  });
});
</script>

<style scoped>
/* 现代动画效果 */
@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.7;
  }
}

@keyframes float {

  0%,
  100% {
    transform: translateY(0px);
  }

  50% {
    transform: translateY(-2px);
  }
}

@keyframes shimmer {
  0% {
    background-position: -200px 0;
  }

  100% {
    background-position: calc(200px + 100%) 0;
  }
}

.animate-pulse {
  animation: pulse 2s infinite;
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}

/* 现代折叠面板样式 */
:deep(.n-collapse-item) {
  border-radius: 12px !important;
  border: none !important;
  overflow: hidden;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

:deep(.n-collapse-item:hover) {
  transform: translateY(-1px);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

:deep(.n-collapse-item .n-collapse-item__header) {
  padding: 16px 20px !important;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.8) !important;
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

:deep(.n-collapse-item .n-collapse-item__content-wrapper) {
  background: rgba(255, 255, 255, 0.6) !important;
  backdrop-filter: blur(8px);
}

:deep(.n-collapse-item .n-collapse-item__content-inner) {
  padding: 0 !important;
}

:deep(.n-collapse-item .n-collapse-item__header-extra) {
  margin-left: auto;
}

/* 现代滚动条样式 */
:deep(.n-scrollbar) {
  border-radius: 12px;
}

:deep(.n-scrollbar .n-scrollbar-rail) {
  background: rgba(0, 0, 0, 0.05) !important;
  border-radius: 6px;
}

:deep(.n-scrollbar .n-scrollbar-bar) {
  background: linear-gradient(to bottom, #6366f1, #8b5cf6) !important;
  border-radius: 6px;
}

/* 输入框样式增强 */
:deep(.n-input-number) {
  border-radius: 8px !important;
}

:deep(.n-input-number .n-input__input-el) {
  text-align: center;
  font-weight: 600;
}

:deep(.n-switch) {
  --n-rail-color: #e5e7eb !important;
}

:deep(.n-switch.n-switch--active) {
  --n-rail-color: #6366f1 !important;
}

/* 现代悬停效果 */
.hover\:shadow-lg:hover {
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

/* 玻璃态效果 */
.glass {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.18);
}

/* 进度条现代化 */
.progress-shimmer {
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  background-size: 200px 100%;
  animation: shimmer 2s infinite;
}

/* 微交互效果 */
.micro-interact {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.micro-interact:active {
  transform: scale(0.98);
}

/* 响应式优化 */
@media (max-width: 400px) {
  .w-\[380px\] {
    width: 100vw !important;
  }
}

/* 自定义滚动条 */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: linear-gradient(to bottom, #6366f1, #8b5cf6);
  border-radius: 3px;
}

/* 状态指示器增强 */
.status-indicator {
  position: relative;
}

.status-indicator::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  background: inherit;
  opacity: 0.2;
  animation: pulse 2s infinite;
}
</style>