<script setup lang="ts">
/**
 * WhitelistBulkActions Component
 * Provides bulk action buttons for selected whitelist items
 * Only visible when items are selected
 */

import { computed } from 'vue';
import { NButton, NTooltip } from 'naive-ui';

// Props
interface Props {
  selectedCount: number;
}

const props = withDefaults(defineProps<Props>(), {
  selectedCount: 0
});

// Emits
interface Emits {
  'deleteSelected': []
  'exportSelected': []
  'clearSelection': []
}

const emit = defineEmits<Emits>();

// Computed
const hasSelection = computed(() => props.selectedCount > 0);
const selectionLabel = computed(() => {
  return props.selectedCount === 1
    ? '1 item selected'
    : `${props.selectedCount} items selected`;
});
</script>

<template>
  <transition name="slide-in">
    <div v-if="hasSelection" class="whitelist-bulk-actions">
      <div class="flex items-center justify-between bg-white/60 backdrop-blur-sm rounded-lg border border-white/20 px-4 py-3">
        <!-- Selection count -->
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
          <span class="text-sm font-medium text-gray-700">{{ selectionLabel }}</span>
        </div>

        <!-- Action buttons -->
        <div class="flex items-center gap-2">
          <!-- Delete selected button -->
          <n-tooltip>
            <template #trigger>
              <n-button
                size="tiny"
                type="error"
                class="bg-gradient-to-r from-rose-400 to-red-500 text-white border-none"
                @click="emit('deleteSelected')"
              >
                <template #icon>
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </template>
                Delete ({{ selectedCount }})
              </n-button>
            </template>
            Remove selected domains from whitelist
          </n-tooltip>

          <!-- Export selected button -->
          <n-tooltip>
            <template #trigger>
              <n-button
                size="tiny"
                class="bg-gradient-to-r from-cyan-400 to-blue-500 text-white border-none"
                @click="emit('exportSelected')"
              >
                <template #icon>
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </template>
                Export ({{ selectedCount }})
              </n-button>
            </template>
            Export selected domains to JSON
          </n-tooltip>

          <!-- Clear selection button -->
          <n-tooltip>
            <template #trigger>
              <n-button
                size="tiny"
                @click="emit('clearSelection')"
              >
                <template #icon>
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </template>
                Clear
              </n-button>
            </template>
            Clear selection
          </n-tooltip>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.whitelist-bulk-actions {
  margin-bottom: 12px;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Slide-in animation */
.slide-in-enter-active {
  transition: all 0.3s ease-out;
}

.slide-in-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-in-enter-to {
  opacity: 1;
  transform: translateY(0);
}
</style>
