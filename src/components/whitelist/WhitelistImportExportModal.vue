<script setup lang="ts">
/**
 * WhitelistImportExportModal Component
 * Provides import/export functionality for whitelist management
 */

import { ref, computed, watch } from 'vue';
import {
  NModal,
  NCard,
  NButton,
  NTabs,
  NTabPane,
  NInput,
  NRadioGroup,
  NRadio,
  NAlert,
  NSpace,
  NIcon,
  NTooltip
} from 'naive-ui';
import { validateWhitelistItem, normalizeWhitelistDomain } from '../../utils/whitelist-utils';

// Props
interface Props {
  show: boolean;
  mode?: 'import' | 'export';
  exportData?: string;
  itemCount?: number;
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  mode: 'import',
  exportData: '',
  itemCount: 0
});

// Emits
interface Emits {
  'update:show': [value: boolean];
  'update:mode': [value: 'import' | 'export'];
  'import': [json: string, onConflict: 'skip' | 'overwrite' | 'keep'];
  'export': [format: 'json' | 'clipboard'];
  'download': []
}

const emit = defineEmits<Emits>();

// Local state
const importJson = ref('');
const conflictResolution = ref<'skip' | 'overwrite' | 'keep'>('skip');
const isProcessing = ref(false);
const importPreview = ref<{ domain: string; status: 'valid' | 'duplicate' | 'invalid'; message?: string }[]>([]);

// Computed
const activeTab = ref(props.mode);

// Watch for prop changes
watch(() => props.show, (newValue) => {
  if (newValue) {
    activeTab.value = props.mode;
    importJson.value = '';
    importPreview.value = [];
  }
});

watch(() => props.mode, (newValue) => {
  activeTab.value = newValue;
});

// Validate import JSON
function validateImport(): boolean {
  try {
    const data = JSON.parse(importJson.value);

    if (!data.items || !Array.isArray(data.items)) {
      return false;
    }

    // Generate preview
    const existingDomains: string[] = []; // Would be passed from parent
    const preview: typeof importPreview.value = [];

    for (const item of data.items) {
      if (!item.domain) {
        preview.push({
          domain: '(invalid)',
          status: 'invalid',
          message: 'Missing domain'
        });
        continue;
      }

      const validation = validateWhitelistItem(item.domain, true);
      if (!validation.isValid) {
        preview.push({
          domain: item.domain,
          status: 'invalid',
          message: validation.error || 'Invalid domain'
        });
        continue;
      }

      const normalized = validation.normalizedDomain!;
      const isDuplicate = existingDomains.includes(normalized);

      preview.push({
        domain: normalized,
        status: isDuplicate ? 'duplicate' : 'valid',
        message: isDuplicate ? 'Already in whitelist' : undefined
      });
    }

    importPreview.value = preview.slice(0, 10); // Show first 10
    return true;

  } catch (e) {
    return false;
  }
}

// Get import summary
const importSummary = computed(() => {
  const valid = importPreview.value.filter(p => p.status === 'valid').length;
  const duplicate = importPreview.value.filter(p => p.status === 'duplicate').length;
  const invalid = importPreview.value.filter(p => p.status === 'invalid').length;
  const total = importPreview.value.length;

  if (total === 0) {
    return null;
  }

  return { valid, duplicate, invalid, total, hasMore: false };
});

// Handle import
async function handleImport(): Promise<void> {
  if (!validateImport()) {
    return;
  }

  isProcessing.value = true;
  try {
    emit('import', importJson.value, conflictResolution.value);
  } finally {
    isProcessing.value = false;
  }
}

// Handle export
function handleExport(format: 'json' | 'clipboard'): void {
  emit('export', format);
}

// Handle download
function handleDownload(): void {
  emit('download');
}

// Copy to clipboard
async function copyToClipboard(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.exportData);
    // Could show a success toast here
  } catch (e) {
    console.error('Failed to copy to clipboard:', e);
  }
}

// File input for import
const fileInput = ref<HTMLInputElement | null>(null);

function triggerFileInput(): void {
  fileInput.value?.click();
}

async function handleFileChange(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;

  try {
    const text = await file.text();
    importJson.value = text;
    validateImport();
  } catch (e) {
    console.error('Failed to read file:', e);
  }

  // Reset input
  target.value = '';
}

// Format export data for display
const formattedExportData = computed(() => {
  if (!props.exportData) return '';
  try {
    return JSON.stringify(JSON.parse(props.exportData), null, 2);
  } catch {
    return props.exportData;
  }
});
</script>

<template>
  <n-modal
    :show="show"
    @update:show="(value: boolean) => $emit('update:show', value)"
    :mask-closable="!isProcessing"
  >
    <n-card
      title="Import / Export Whitelist"
      :bordered="false"
      size="medium"
      class="whitelist-import-export-modal"
    >
      <template #header-extra>
        <n-button
          size="small"
          circle
          text
          :disabled="isProcessing"
          @click="$emit('update:show', false)"
        >
          <template #icon>
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </template>
        </n-button>
      </template>

      <n-tabs v-model:value="activeTab" type="segment" animated>
        <!-- Import Tab -->
        <n-tab-pane name="import" tab="Import">
          <n-space vertical :size="16">
            <!-- Input methods -->
            <div class="space-y-3">
              <label class="block text-sm font-medium text-gray-700">Import Method</label>
              <div class="flex gap-2">
                <n-button
                  size="small"
                  @click="triggerFileInput"
                  class="flex-1"
                >
                  <template #icon>
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </template>
                  Upload File
                </n-button>
                <input
                  ref="fileInput"
                  type="file"
                  accept=".json"
                  class="hidden"
                  @change="handleFileChange"
                />
                <n-button
                  size="small"
                  @click="() => { importJson = ''; importPreview = []; }"
                  class="flex-1"
                >
                  <template #icon>
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </template>
                  Paste JSON
                </n-button>
              </div>
            </div>

            <!-- JSON Input -->
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700">Whitelist JSON</label>
              <n-input
                v-model:value="importJson"
                type="textarea"
                placeholder='{"version":"1.0.0","exportedAt":1234567890,"items":[{"domain":"example.com","addedAt":1234567890}]}'
                :rows="6"
                @blur="validateImport"
              />
            </div>

            <!-- Conflict Resolution -->
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700">If domain already exists:</label>
              <n-radio-group v-model:value="conflictResolution">
                <n-space vertical>
                  <n-radio value="skip">Skip - Keep existing, don't add new</n-radio>
                  <n-radio value="keep">Keep - Add new, keep existing</n-radio>
                  <n-radio value="overwrite">Overwrite - Replace existing with new</n-radio>
                </n-space>
              </n-radio-group>
            </div>

            <!-- Import Preview -->
            <div v-if="importPreview.length > 0" class="space-y-2">
              <label class="block text-sm font-medium text-gray-700">Preview (first 10 items)</label>
              <div class="space-y-1 max-h-40 overflow-y-auto">
                <div
                  v-for="(item, index) in importPreview"
                  :key="index"
                  class="flex items-center justify-between text-sm py-1 px-2 rounded"
                  :class="{
                    'bg-green-50 text-green-700': item.status === 'valid',
                    'bg-yellow-50 text-yellow-700': item.status === 'duplicate',
                    'bg-red-50 text-red-700': item.status === 'invalid'
                  }"
                >
                  <span class="font-medium truncate">{{ item.domain }}</span>
                  <span class="text-xs">{{ item.message || item.status }}</span>
                </div>
              </div>

              <!-- Import summary -->
              <div v-if="importSummary" class="text-xs text-gray-600 pt-1">
                {{ importSummary.valid }} valid, {{ importSummary.duplicate }} duplicates, {{ importSummary.invalid }} invalid
              </div>
            </div>
          </n-space>
        </n-tab-pane>

        <!-- Export Tab -->
        <n-tab-pane name="export" tab="Export">
          <n-space vertical :size="16">
            <!-- Export info -->
            <n-alert type="info" :bordered="false">
              Your whitelist contains {{ itemCount }} domain{{ itemCount !== 1 ? 's' : '' }}.
            </n-alert>

            <!-- Export actions -->
            <div class="space-y-3">
              <label class="block text-sm font-medium text-gray-700">Export Method</label>
              <div class="grid grid-cols-2 gap-2">
                <n-button
                  size="medium"
                  @click="copyToClipboard"
                  class="export-action-btn"
                >
                  <template #icon>
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  </template>
                  Copy to Clipboard
                </n-button>
                <n-button
                  size="medium"
                  @click="handleDownload"
                  class="export-action-btn"
                >
                  <template #icon>
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </template>
                  Download JSON
                </n-button>
              </div>
            </div>

            <!-- Export preview -->
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700">Export Preview</label>
              <div class="bg-gray-50 rounded-lg p-3 max-h-60 overflow-auto">
                <pre class="text-xs text-gray-700 whitespace-pre-wrap">{{ formattedExportData }}</pre>
              </div>
            </div>
          </n-space>
        </n-tab-pane>
      </n-tabs>

      <template #footer>
        <div class="flex justify-end gap-3">
          <n-button @click="$emit('update:show', false)" :disabled="isProcessing">
            Close
          </n-button>
          <n-button
            v-if="activeTab === 'import'"
            type="primary"
            :loading="isProcessing"
            :disabled="!importJson || importPreview.length === 0"
            @click="handleImport"
            class="bg-gradient-to-r from-cyan-400 to-blue-500"
          >
            Import Whitelist
          </n-button>
        </div>
      </template>
    </n-card>
  </n-modal>
</template>

<style scoped>
.whitelist-import-export-modal :deep(.n-card) {
  border-radius: 16px;
  max-width: 560px;
  width: 90vw;
}

.export-action-btn {
  border-radius: 8px;
  height: auto;
  padding: 12px 16px;
}

.space-y-1 > * + * {
  margin-top: 4px;
}

.space-y-2 > * + * {
  margin-top: 8px;
}

.space-y-3 > * + * {
  margin-top: 12px;
}

:deep(.n-radio) {
  align-items: flex-start;
}

:deep(.n-radio__label) {
  padding-top: 2px;
}
</style>
