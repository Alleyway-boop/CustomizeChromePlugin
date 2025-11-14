<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import {
  NButton,
  NIcon,
  NModal,
  NInput,
  NAlert,
  NEmpty,
  NTooltip,
  NCard,
  NThing,
  NAvatar
} from 'naive-ui'
import { useElementHover } from '@vueuse/core'
import { configManager } from '../utils/config'

// 简单的防抖函数实现
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = window.setTimeout(() => func(...args), wait)
  }
}

// Props 定义
interface Props {
  whitelist?: string[]
  currentDomain?: string
}

const props = withDefaults(defineProps<Props>(), {
  whitelist: () => [],
  currentDomain: ''
})

// Emits 定义
interface Emits {
  'add': [domain: string]
  'remove': [domain: string]
  'add-current': []
}

const emit = defineEmits<Emits>()

// 响应式数据
const isModalOpen = ref(false)
const manualDomain = ref('')
const isLoading = ref(false)
const showDeleteConfirm = ref(false)
const pendingDeleteDomain = ref('')
const localWhitelist = ref<string[]>([])
const domainInputError = ref('')
const isDomainValid = ref(false)

// 组件挂载时同步白名单数据
onMounted(async () => {
  try {
    await configManager.initialize()
    localWhitelist.value = [...props.whitelist]
  } catch (error) {
    console.error('Failed to initialize config manager:', error)
    localWhitelist.value = [...props.whitelist]
  }
})

// 监听外部白名单变化
watch(() => props.whitelist, (newList) => {
  localWhitelist.value = [...newList]
}, { deep: true })

// 计算属性
const isCurrentDomainWhitelisted = computed(() => {
  return props.currentDomain && localWhitelist.value.includes(props.currentDomain)
})

const hasWhitelistItems = computed(() => {
  return localWhitelist.value.length > 0
})

// 域名验证函数
const validateDomain = (domain: string): boolean => {
  if (!domain || domain.trim() === '') {
    domainInputError.value = '域名不能为空'
    return false
  }

  const trimmedDomain = domain.trim().toLowerCase()

  // 移除协议前缀
  const cleanedDomain = trimmedDomain.replace(/^https?:\/\//, '').replace(/^www\./, '')

  // 简单的域名格式验证
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

  if (!domainRegex.test(cleanedDomain)) {
    domainInputError.value = '域名格式不正确，例如：example.com'
    return false
  }

  if (cleanedDomain.length > 253) {
    domainInputError.value = '域名长度超过限制'
    return false
  }

  // 检查是否已在白名单中
  if (localWhitelist.value.includes(cleanedDomain)) {
    domainInputError.value = '该域名已在白名单中'
    return false
  }

  domainInputError.value = ''
  return true
}

// 防抖的域名验证
const debouncedValidateDomain = debounce((domain: string) => {
  isDomainValid.value = validateDomain(domain)
}, 300)

// 清理域名格式
const cleanDomainFormat = (domain: string): string => {
  const cleaned = domain.trim().toLowerCase()
  const withoutProtocol = cleaned.replace(/^https?:\/\//, '')
  const withoutWww = withoutProtocol.replace(/^www\./, '')

  // 移除路径和查询参数
  const domainOnly = withoutWww.split('/')[0]

  return domainOnly
}

// 获取域名favicon
const getFaviconUrl = (domain: string): string => {
  const cleanedDomain = cleanDomainFormat(domain)
  return `https://www.google.com/s2/favicons?domain=${cleanedDomain}&sz=32`
}

// 添加当前域名到白名单
const addCurrentDomain = () => {
  if (!props.currentDomain) {
    return
  }

  const cleanedDomain = cleanDomainFormat(props.currentDomain)

  if (localWhitelist.value.includes(cleanedDomain)) {
    return
  }

  addToWhitelist(cleanedDomain)
}

// 手动添加域名
const addManualDomain = () => {
  if (!manualDomain.value.trim()) {
    return
  }

  const cleanedDomain = cleanDomainFormat(manualDomain.value)

  // 执行最终验证
  if (!validateDomain(cleanedDomain)) {
    return
  }

  addToWhitelist(cleanedDomain)
  manualDomain.value = ''
  isModalOpen.value = false
}

// 添加到白名单的通用方法
const addToWhitelist = async (domain: string) => {
  try {
    isLoading.value = true

    // 验证域名格式
    if (!validateDomain(domain)) {
      return
    }

    // 通知父组件
    emit('add', domain)

    // 更新配置管理器
    await configManager.addToWhitelist(domain)

    // 更新本地状态
    localWhitelist.value.push(domain)
  } catch (error) {
    console.error('添加白名单失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 删除白名单项
const removeFromWhitelist = async (domain: string) => {
  try {
    isLoading.value = true
    pendingDeleteDomain.value = domain

    // 通知父组件
    emit('remove', domain)

    // 更新配置管理器
    await configManager.removeFromWhitelist(domain)

    // 更新本地状态
    localWhitelist.value = localWhitelist.value.filter(d => d !== domain)
  } catch (error) {
    console.error('删除白名单失败:', error)
  } finally {
    isLoading.value = false
    pendingDeleteDomain.value = ''
  }
}

// 格式化显示域名
const formatDomainDisplay = (domain: string): string => {
  if (domain.length > 30) {
    return domain.substring(0, 27) + '...'
  }
  return domain
}
</script>

<template>
  <div class="whitelist-manager">
    <!-- 主容器 -->
    <div class="bg-white/40 backdrop-blur-sm rounded-lg border border-white/20 p-4">
      <!-- 标题和操作区域 -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <div
            class="w-6 h-6 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center shadow-sm">
            <n-icon size="12" class="text-white">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
              </svg>
            </n-icon>
          </div>
          <h2 class="text-sm font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
            白名单管理
          </h2>
        </div>

        <div class="flex items-center gap-2">
          <!-- 添加当前网站按钮 -->
          <n-tooltip v-if="currentDomain">
            <template #trigger>
              <n-button :disabled="isCurrentDomainWhitelisted || !currentDomain" size="tiny"
                class="bg-gradient-to-r from-cyan-400 to-blue-500 text-white border-none hover:from-cyan-500 hover:to-blue-600 transition-all duration-300"
                @click="addCurrentDomain">
                <template #icon>
                  <n-icon size="12">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </n-icon>
                </template>
                添加当前
              </n-button>
            </template>
            {{ isCurrentDomainWhitelisted ? '当前网站已在白名单中' : `添加 ${currentDomain} 到白名单` }}
          </n-tooltip>

          <!-- 手动添加按钮 -->
          <n-button size="tiny"
            class="bg-gradient-to-r from-cyan-400 to-blue-500 text-white border-none hover:from-cyan-500 hover:to-blue-600 transition-all duration-300"
            @click="isModalOpen = true">
            <template #icon>
              <n-icon size="12">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </n-icon>
            </template>
            手动添加
          </n-button>
        </div>
      </div>

      <!-- 白名单列表 -->
      <div v-if="hasWhitelistItems" class="space-y-2">
        <TransitionGroup name="whitelist-item" tag="div" class="space-y-2">
          <div v-for="(domain, index) in localWhitelist" :key="domain"
            class="group relative bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200/50 p-3 hover:border-cyan-300/50 hover:shadow-md transition-all duration-300">
            <!-- 内容区域 -->
            <div class="flex items-center justify-between">
              <!-- 域名信息 -->
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <!-- Favicon -->
                <div class="relative">
                  <div class="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-blue-400/20 rounded-lg blur-sm">
                  </div>
                  <div
                    class="relative w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm border border-gray-200">
                    <img :src="getFaviconUrl(domain)" :alt="domain" class="w-6 h-6 rounded" @error="(e: Event) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const nextElement = target.nextElementSibling as HTMLElement;
                      if (nextElement) nextElement.style.display = 'flex';
                    }" />
                    <div class="hidden w-6 h-6 flex items-center justify-center text-gray-400">
                      <svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
                        <path
                          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <!-- 域名文本 -->
                <div class="flex-1 min-w-0">
                  <h3 class="font-medium text-gray-900 truncate" :title="domain">
                    {{ formatDomainDisplay(domain) }}
                  </h3>
                  <p class="text-sm text-gray-500">
                    白名单项目 #{{ index + 1 }}
                  </p>
                </div>
              </div>

              <!-- 删除按钮 -->
              <div class="flex items-center gap-2">
                <Transition name="delete-btn">
                  <n-button size="tiny" type="error"
                    class="bg-gradient-to-r from-rose-400 to-red-500 text-white border-none hover:from-rose-500 hover:to-red-600 transition-all duration-300"
                    :loading="isLoading && pendingDeleteDomain === domain" @click="removeFromWhitelist(domain)">
                    <template #icon>
                      <n-icon size="12">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </n-icon>
                    </template>
                    删除
                  </n-button>
                </Transition>
              </div>
            </div>

            <!-- 悬停时的背景效果 -->
            <div
              class="absolute inset-0 bg-gradient-to-r from-cyan-400/5 to-blue-400/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            </div>
          </div>
        </TransitionGroup>
      </div>

      <!-- 空状态 -->
      <div v-else class="py-8 text-center">
        <div
          class="w-16 h-16 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-float">
          <n-icon size="24" class="text-cyan-500">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.42-3.02 8.34-7 9.5V3.18z" />
            </svg>
          </n-icon>
        </div>
        <h3 class="text-sm font-semibold text-gray-900 mb-2">暂无白名单项目</h3>
        <p class="text-xs text-gray-600 mb-6 max-w-xs mx-auto">
          添加常用网站到白名单，它们将不会被自动冻结。支持多种添加方式：
        </p>

        <!-- 添加方式说明 -->
        <div class="space-y-3 mb-6 max-w-xs mx-auto">
          <div class="flex items-center gap-2 text-xs text-gray-600">
            <div class="w-2 h-2 bg-cyan-400 rounded-full"></div>
            <span>点击"添加当前网站"快速添加</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-600">
            <div class="w-2 h-2 bg-blue-400 rounded-full"></div>
            <span>使用"手动添加"精确输入域名</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-600">
            <div class="w-2 h-2 bg-purple-400 rounded-full"></div>
            <span>右键菜单快捷添加</span>
          </div>
        </div>

        <div class="flex justify-center gap-3">
          <n-button v-if="currentDomain" size="small"
            class="bg-gradient-to-r from-cyan-400 to-blue-500 text-white border-none hover:from-cyan-500 hover:to-blue-600 transition-all duration-300 transform hover:scale-105"
            @click="addCurrentDomain"
            :disabled="isCurrentDomainWhitelisted || isLoading">
            <template #icon>
              <n-icon size="14" v-if="!isLoading">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </n-icon>
              <n-icon size="14" v-else class="animate-spin">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.364 6.364l-2.828-2.828m-5.656-5.656l-2.828-2.828M5.636 18.364L2.808 15.536m5.656-5.656L5.636 7.052M12 8a4 4 0 110-8 4 4 0 010 8z"/>
                </svg>
              </n-icon>
            </template>
            <span v-if="!isLoading">{{ isCurrentDomainWhitelisted ? '已在白名单中' : '添加当前网站' }}</span>
            <span v-else>添加中...</span>
          </n-button>
          <n-button size="small"
            class="bg-gradient-to-r from-cyan-400 to-blue-500 text-white border-none hover:from-cyan-500 hover:to-blue-600 transition-all duration-300 transform hover:scale-105"
            @click="isModalOpen = true"
            :disabled="isLoading">
            <template #icon>
              <n-icon size="14" v-if="!isLoading">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </n-icon>
              <n-icon size="14" v-else class="animate-spin">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.364 6.364l-2.828-2.828m-5.656-5.656l-2.828-2.828M5.636 18.364L2.808 15.536m5.656-5.656L5.636 7.052M12 8a4 4 0 110-8 4 4 0 010 8z"/>
                </svg>
              </n-icon>
            </template>
            <span v-if="!isLoading">手动添加</span>
            <span v-else>加载中...</span>
          </n-button>
        </div>
      </div>
    </div>

    <!-- 手动添加模态框 -->
    <n-modal v-model:show="isModalOpen" class="max-w-md">
      <n-card title="手动添加域名" :bordered="false" size="medium"
        class="bg-gradient-to-br from-slate-700 to-slate-800 backdrop-blur-xl border border-slate-600/60">
        <template #header-extra>
          <n-button size="small" circle type="tertiary" class="text-slate-300 hover:text-white"
            @click="isModalOpen = false">
            <template #icon>
              <n-icon>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </n-icon>
            </template>
          </n-button>
        </template>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-200 mb-2">
              域名地址
            </label>
            <n-input v-model:value="manualDomain" placeholder="例如: example.com"
              class="bg-slate-600/30 border-slate-500/60" :status="domainInputError ? 'error' : (isDomainValid ? 'success' : undefined)"
              @keyup.enter="addManualDomain" @input="debouncedValidateDomain(manualDomain)" />
            <p v-if="domainInputError" class="mt-2 text-xs text-rose-400">
              {{ domainInputError }}
            </p>
            <p v-else class="mt-2 text-xs text-slate-400">
              请输入有效的域名，不需要包含 http:// 或 www.
            </p>
          </div>

          <!-- 示例域名 -->
          <div class="bg-slate-600/20 rounded-lg p-3">
            <p class="text-sm font-medium text-slate-300 mb-2">示例格式:</p>
            <div class="space-y-1">
              <div class="text-xs text-slate-400">✓ example.com</div>
              <div class="text-xs text-slate-400">✓ github.com</div>
              <div class="text-xs text-slate-400">✓ google.com</div>
              <div class="text-xs text-slate-400">✗ https://www.example.com</div>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-3">
            <n-button class="bg-slate-600/40 text-slate-200 border-slate-500/50 hover:bg-slate-600/50"
              @click="isModalOpen = false">
              取消
            </n-button>
            <n-button :loading="isLoading" :disabled="!manualDomain.trim()"
              class="bg-gradient-to-r from-cyan-400 to-blue-500 text-white border-none hover:from-cyan-500 hover:to-blue-600 transition-all duration-300"
              @click="addManualDomain">
              <template #icon>
                <n-icon>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </n-icon>
              </template>
              添加域名
            </n-button>
          </div>
        </template>
      </n-card>
    </n-modal>
  </div>
</template>

<style scoped>
/* 动画定义 */
.whitelist-item-enter-active,
.whitelist-item-leave-active {
  transition: all 0.3s ease;
}

.whitelist-item-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.whitelist-item-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.whitelist-item-move {
  transition: transform 0.3s ease;
}

.delete-btn-enter-active,
.delete-btn-leave-active {
  transition: all 0.2s ease;
}

.delete-btn-enter-from,
.delete-btn-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* 旋转动画 */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* 浮动动画 */
@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}

/* 玻璃拟态效果增强 */
.backdrop-blur-sm {
  backdrop-filter: blur(4px);
}

/* 自定义悬停效果 */
.group:hover .group-hover\:block {
  display: block;
}

/* 确保模态框层级正确 */
:deep(.n-modal-mask) {
  backdrop-filter: blur(8px);
}

:deep(.n-card) {
  border-radius: 16px;
}

/* 输入框样式增强 */
:deep(.n-input__input-el) {
  background: transparent;
  color: #e2e8f0;
}

:deep(.n-input) {
  border-radius: 12px;
}

:deep(.n-input:hover) {
  border-color: #06b6d4;
}

:deep(.n-input:focus-within) {
  border-color: #0891b2;
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.2);
}

/* 按钮样式增强 */
:deep(.n-button) {
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.n-button:hover) {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.2);
}

:deep(.n-button:active) {
  transform: translateY(0);
}

/* 卡片内容样式 */
:deep(.n-card .n-card__content) {
  padding: 1.5rem;
}

:deep(.n-card .n-card__header) {
  padding-bottom: 1rem;
}

:deep(.n-card .n-card__footer) {
  padding-top: 1rem;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .whitelist-manager {
    padding: 1rem;
  }

  .whitelist-manager .bg-white\/60 {
    padding: 1rem;
  }

  .whitelist-manager .flex {
    flex-direction: column;
    gap: 0.75rem;
  }

  .whitelist-manager .w-10 {
    width: 2rem;
    height: 2rem;
  }

  .whitelist-manager .text-lg {
    font-size: 1rem;
  }
}
</style>