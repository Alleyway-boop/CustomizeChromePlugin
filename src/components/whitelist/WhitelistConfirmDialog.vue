<script setup lang="ts">
/**
 * WhitelistConfirmDialog Component
 * Reusable confirmation dialog for destructive whitelist operations
 */

import { computed, ref } from 'vue';
import { NModal, NCard, NButton, NAlert, NSpace } from 'naive-ui';

// Props
interface Props {
  show: boolean;
  title?: string;
  message?: string;
  type?: 'delete' | 'bulkDelete' | 'clearAll';
  domainName?: string;
  count?: number;
  showUndo?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Confirm Action',
  message: 'Are you sure you want to proceed?',
  type: 'delete',
  domainName: '',
  count: 0,
  showUndo: true
});

// Emits
interface Emits {
  'update:show': [value: boolean];
  'confirm': []
  'cancel': []
  'undo': []
}

const emit = defineEmits<Emits>();

// Local state
const isProcessing = ref(false);

// Computed
const dialogTitle = computed(() => {
  switch (props.type) {
    case 'delete':
      return 'Remove Domain';
    case 'bulkDelete':
      return `Remove ${props.count} Domain${props.count !== 1 ? 's' : ''}`;
    case 'clearAll':
      return 'Clear All Whitelist';
    default:
      return props.title;
  }
});

const dialogMessage = computed(() => {
  switch (props.type) {
    case 'delete':
      return `Remove "${props.domainName}" from your whitelist? This site will be subject to automatic freezing.`;
    case 'bulkDelete':
      return `Remove ${props.count} selected domain${props.count !== 1 ? 's' : ''} from your whitelist? These sites will be subject to automatic freezing.`;
    case 'clearAll':
      return 'This will remove ALL domains from your whitelist. All websites will be subject to automatic freezing. This action cannot be undone.';
    default:
      return props.message;
  }
});

const alertType = computed(() => {
  return props.type === 'clearAll' ? 'error' : 'warning';
});

const confirmButtonText = computed(() => {
  return props.type === 'clearAll' ? 'Clear All' : 'Remove';
});

const isDangerous = computed(() => {
  return props.type === 'clearAll';
});

// Actions
async function handleConfirm(): Promise<void> {
  isProcessing.value = true;
  emit('confirm');
  // Wait a bit for parent to process
  setTimeout(() => {
    isProcessing.value = false;
  }, 500);
}

function handleCancel(): void {
  emit('update:show', false);
  emit('cancel');
}
</script>

<template>
  <n-modal
    :show="show"
    @update:show="(value: boolean) => $emit('update:show', value)"
    :mask-closable="!isProcessing"
    :closable="!isProcessing"
  >
    <n-card
      :title="dialogTitle"
      :bordered="false"
      size="medium"
      class="whitelist-confirm-dialog"
    >
      <template #header-extra>
        <n-button
          size="small"
          circle
          text
          :disabled="isProcessing"
          @click="handleCancel"
        >
          <template #icon>
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </template>
        </n-button>
      </template>

      <n-space vertical :size="16">
        <!-- Alert message -->
        <n-alert
          :type="alertType"
          :bordered="false"
          class="message-alert"
        >
          {{ dialogMessage }}
        </n-alert>

        <!-- Additional info for bulk delete -->
        <div v-if="type === 'bulkDelete'" class="text-sm text-gray-600">
          <p>Selected domains will be permanently removed from your whitelist.</p>
        </div>

        <!-- Warning for clear all -->
        <div v-if="type === 'clearAll'" class="text-sm text-gray-600">
          <p><strong>Warning:</strong> This is a destructive action that cannot be undone. All websites will be subject to automatic tab freezing.</p>
        </div>
      </n-space>

      <template #footer>
        <div class="flex justify-end gap-3">
          <!-- Cancel button -->
          <n-button
            :disabled="isProcessing"
            @click="handleCancel"
          >
            Cancel
          </n-button>

          <!-- Confirm button -->
          <n-button
            :type="isDangerous ? 'error' : 'default'"
            :loading="isProcessing"
            :disabled="isProcessing"
            @click="handleConfirm"
            :class="isDangerous
              ? 'bg-gradient-to-r from-rose-400 to-red-500 text-white border-none'
              : 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white border-none'"
          >
            {{ confirmButtonText }}
          </n-button>
        </div>
      </template>

      <!-- Undo hint for single delete -->
      <div v-if="showUndo && type === 'delete'" class="mt-3 pt-3 border-t border-gray-200">
        <p class="text-xs text-gray-500 flex items-center gap-1">
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          You can undo this action from the notification toast
        </p>
      </div>
    </n-card>
  </n-modal>
</template>

<style scoped>
.whitelist-confirm-dialog :deep(.n-card) {
  border-radius: 16px;
  max-width: 480px;
}

.message-alert {
  border-radius: 8px;
}
</style>
