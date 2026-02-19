<script setup lang="ts">
/**
 * WhitelistManagerEnhanced Component
 * Production-grade whitelist management UI with search, bulk operations, and import/export
 */

import { ref, computed, onMounted, watch } from 'vue';
import {
  NButton,
  NIcon,
  NTooltip,
  NEmpty,
  NAvatar,
  NSpin,
  useMessage
} from 'naive-ui';
import WhitelistSearchBar from './whitelist/WhitelistSearchBar.vue';
import WhitelistBulkActions from './whitelist/WhitelistBulkActions.vue';
import WhitelistConfirmDialog from './whitelist/WhitelistConfirmDialog.vue';
import WhitelistImportExportModal from './whitelist/WhitelistImportExportModal.vue';
import { useWhitelistOperations } from '../composables/useWhitelistOperations';
import { useWhitelistSearch } from '../composables/useWhitelistSearch';
import type { WhitelistItem } from '../types/whitelist';
import { normalizeWhitelistDomain, validateWhitelistItem } from '../utils/whitelist-utils';

// Simple date formatting utility (replaces date-fns dependency)
function formatDistanceToNow(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  return `${years}y ago`;
}

// Props
interface Props {
  currentDomain?: string;
}

const props = withDefaults(defineProps<Props>(), {
  currentDomain: ''
});

// Emits
interface Emits {
  'add': [domain: string]
  'remove': [domain: string]
  'add-current': []
}

const emit = defineEmits<Emits>();

// Composables
const { items, isLoading, error, loadWhitelist, addDomain, addDomains, removeDomain, removeDomains, clearAll, exportWhitelist, importWhitelist } = useWhitelistOperations();
const { searchQuery, sortBy, sortOrder, filteredItems, filteredCount, hasActiveFilter, resetFilters, toggleSort } = useWhitelistSearch(items);

// Message API
const message = useMessage();

// Local state
const selectedDomains = ref<Set<string>>(new Set());
const isAllSelected = ref(false);
const isIndeterminate = ref(false);

// Dialog states
const showDeleteConfirm = ref(false);
const showBulkDeleteConfirm = ref(false);
const showClearAllConfirm = ref(false);
const showImportExport = ref(false);
const pendingDeleteDomain = ref('');
const importExportMode = ref<'import' | 'export'>('import');

// Add modal state
const isAddModalOpen = ref(false);
const manualDomain = ref('');
const domainInputError = ref('');
const isDomainValid = ref(false);

// Debounce for domain validation
let validationTimeout: number | null = null;

// Computed
const isCurrentDomainWhitelisted = computed<boolean>(() => {
  return !!(props.currentDomain && items.value.some(item => item.domain === props.currentDomain));
});

const hasItems = computed(() => {
  return items.value.length > 0;
});

const hasSelection = computed(() => {
  return selectedDomains.value.size > 0;
});

const selectionCount = computed(() => {
  return selectedDomains.value.size;
});

// Selection state
const canSelectAll = computed(() => {
  return filteredItems.value.length > 0;
});

// Load data on mount
onMounted(async () => {
  await loadWhitelist();
});

// Watch for selection changes to update indeterminate state
watch(selectedDomains, (newSet) => {
  const totalFiltered = filteredItems.value.length;
  const selected = newSet.size;

  isIndeterminate.value = selected > 0 && selected < totalFiltered;
  isAllSelected.value = selected > 0 && selected === totalFiltered;
});

// Watch filtered items to clear invalid selections
watch(filteredItems, () => {
  const validDomains = new Set(filteredItems.value.map(item => item.domain));
  const toRemove: string[] = [];

  selectedDomains.value.forEach(domain => {
    if (!validDomains.has(domain)) {
      toRemove.push(domain);
    }
  });

  toRemove.forEach(domain => {
    selectedDomains.value.delete(domain);
  });
});

// Clear filters
function handleClearFilters(): void {
  resetFilters();
}

// Sort toggle
function handleSortToggle(field: 'name' | 'dateAdded' | 'lastUsed'): void {
  toggleSort(field);
}

// Selection management
function toggleSelectDomain(domain: string): void {
  if (selectedDomains.value.has(domain)) {
    selectedDomains.value.delete(domain);
  } else {
    selectedDomains.value.add(domain);
  }
  selectedDomains.value = new Set(selectedDomains.value); // Trigger reactivity
}

function toggleSelectAll(): void {
  if (isAllSelected.value) {
    // Deselect all
    selectedDomains.value.clear();
  } else {
    // Select all filtered
    filteredItems.value.forEach(item => {
      selectedDomains.value.add(item.domain);
    });
  }
  selectedDomains.value = new Set(selectedDomains.value); // Trigger reactivity
}

function clearSelection(): void {
  selectedDomains.value.clear();
  selectedDomains.value = new Set(selectedDomains.value);
}

// Add domain
async function handleAddDomain(domain: string): Promise<void> {
  const success = await addDomain(domain);

  if (success) {
    message.success(`Added "${domain}" to whitelist`);
    emit('add', domain);
  } else {
    message.error(error.value || `Failed to add "${domain}"`);
  }
}

async function handleAddCurrentDomain(): Promise<void> {
  if (!props.currentDomain) return;

  const normalized = normalizeWhitelistDomain(props.currentDomain);

  if (!normalized) {
    message.error('Invalid current domain');
    return;
  }

  await handleAddDomain(normalized);
}

async function handleAddManualDomain(): Promise<void> {
  if (!manualDomain.value.trim()) {
    return;
  }

  const normalized = normalizeWhitelistDomain(manualDomain.value);

  if (!normalized) {
    domainInputError.value = 'Invalid domain format';
    return;
  }

  const success = await addDomain(normalized);

  if (success) {
    message.success(`Added "${normalized}" to whitelist`);
    emit('add', normalized);
    manualDomain.value = '';
    domainInputError.value = '';
    isDomainValid.value = false;
    isAddModalOpen.value = false;
  } else {
    domainInputError.value = error.value || 'Failed to add domain';
  }
}

// Validate domain input
function validateDomainInput(domain: string): void {
  if (validationTimeout) {
    clearTimeout(validationTimeout);
  }

  validationTimeout = window.setTimeout(() => {
    if (!domain || !domain.trim()) {
      domainInputError.value = 'Domain cannot be empty';
      isDomainValid.value = false;
      return;
    }

    const validation = validateWhitelistItem(domain, true);

    if (!validation.isValid) {
      domainInputError.value = validation.error || 'Invalid domain';
      isDomainValid.value = false;
      return;
    }

    const normalized = validation.normalizedDomain!;
    const exists = items.value.some(item => item.domain === normalized);

    if (exists) {
      domainInputError.value = 'Domain already in whitelist';
      isDomainValid.value = false;
      return;
    }

    domainInputError.value = '';
    isDomainValid.value = true;
  }, 300);
}

// Delete operations
function handleDeleteClick(domain: string): void {
  pendingDeleteDomain.value = domain;
  showDeleteConfirm.value = true;
}

async function handleConfirmDelete(): Promise<void> {
  const domain = pendingDeleteDomain.value;
  showDeleteConfirm.value = false;

  const success = await removeDomain(domain);

  if (success) {
    message.success(`Removed "${domain}" from whitelist`);
    emit('remove', domain);

    // Show undo toast
    message.info(`Undo: Add "${domain}" back to whitelist`, {
      duration: 5000,
      onClose: () => {
        // Undo action - could implement here
      }
    });
  } else {
    message.error(error.value || `Failed to remove "${domain}"`);
  }

  pendingDeleteDomain.value = '';
}

function handleBulkDeleteClick(): void {
  showBulkDeleteConfirm.value = true;
}

async function handleConfirmBulkDelete(): Promise<void> {
  const domains = Array.from(selectedDomains.value);
  showBulkDeleteConfirm.value = false;

  const result = await removeDomains(domains);

  if (result.success) {
    message.success(result.message || `Removed ${result.processed} domains`);
    clearSelection();
  } else {
    message.error(result.message || 'Failed to remove domains');
  }
}

// Clear all
function handleClearAllClick(): void {
  showClearAllConfirm.value = true;
}

async function handleConfirmClearAll(): Promise<void> {
  showClearAllConfirm.value = false;

  const success = await clearAll();

  if (success) {
    message.success('Cleared all domains from whitelist');
    clearSelection();
  } else {
    message.error(error.value || 'Failed to clear whitelist');
  }
}

// Import/Export
function handleImportExportClick(mode: 'import' | 'export'): void {
  importExportMode.value = mode;
  showImportExport.value = true;
}

async function handleImport(json: string, onConflict: 'skip' | 'overwrite' | 'keep'): Promise<void> {
  const result = await importWhitelist(json, onConflict);

  if (result.success) {
    message.success(result.message || 'Import completed successfully');
  } else {
    message.error(result.message || 'Import failed');
  }

  showImportExport.value = false;
}

function handleExport(format: 'json' | 'clipboard'): void {
  const json = exportWhitelist();

  if (format === 'clipboard') {
    navigator.clipboard.writeText(json).then(() => {
      message.success('Whitelist copied to clipboard');
    }).catch(() => {
      message.error('Failed to copy to clipboard');
    });
  }
}

function handleDownload(): void {
  const json = exportWhitelist();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `whitelist-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  message.success('Whitelist downloaded');
}

// Format date
function formatAddedDate(timestamp: number): string {
  try {
    return formatDistanceToNow(timestamp);
  } catch {
    return 'Unknown';
  }
}

// Get favicon
function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

// Get export data
const exportData = computed(() => {
  return exportWhitelist();
});

const itemCount = computed(() => {
  return items.value.length;
});
</script>

<template>
  <div class="whitelist-manager-enhanced">
    <!-- Main container -->
    <div class="bg-white/40 backdrop-blur-sm rounded-lg border border-white/20 p-4">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center shadow-sm">
            <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
            </svg>
          </div>
          <h2 class="text-sm font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
            Whitelist Manager
          </h2>
          <span class="text-xs text-gray-500">({{ itemCount }})</span>
        </div>

        <div class="flex items-center gap-2">
          <!-- Import/Export buttons -->
          <n-tooltip>
            <template #trigger>
              <n-button
                size="tiny"
                @click="handleImportExportClick('import')"
                class="bg-white/80 hover:bg-white border border-gray-200"
              >
                <template #icon>
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </template>
                Import
              </n-button>
            </template>
            Import whitelist from JSON
          </n-tooltip>

          <n-tooltip>
            <template #trigger>
              <n-button
                size="tiny"
                @click="handleImportExportClick('export')"
                class="bg-white/80 hover:bg-white border border-gray-200"
              >
                <template #icon>
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </template>
                Export
              </n-button>
            </template>
            Export whitelist to JSON or copy to clipboard
          </n-tooltip>

          <!-- Clear All button -->
          <n-tooltip v-if="hasItems">
            <template #trigger>
              <n-button
                size="tiny"
                type="error"
                @click="handleClearAllClick"
                class="bg-white/80 hover:bg-rose-50 border border-gray-200 text-rose-600"
              >
                <template #icon>
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </template>
                Clear All
              </n-button>
            </template>
            Remove all domains from whitelist
          </n-tooltip>

          <!-- Manual Add button -->
          <n-button
            size="tiny"
            class="bg-gradient-to-r from-cyan-400 to-blue-500 text-white border-none"
            @click="isAddModalOpen = true"
          >
            <template #icon>
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </template>
            Add Domain
          </n-button>
        </div>
      </div>

      <!-- Search Bar -->
      <WhitelistSearchBar
        v-model="searchQuery"
        :sort-by="sortBy"
        :sort-order="sortOrder"
        @update:sort-by="handleSortToggle"
        @update:sort-order="(value) => { sortOrder = value }"
        @clear="handleClearFilters"
      />

      <!-- Bulk Actions Toolbar -->
      <WhitelistBulkActions
        :selected-count="selectionCount"
        @delete-selected="handleBulkDeleteClick"
        @export-selected="() => handleExport('json')"
        @clear-selection="clearSelection"
      />

      <!-- Loading state -->
      <div v-if="isLoading && items.length === 0" class="py-12 flex justify-center">
        <n-spin size="large" />
      </div>

      <!-- Whitelist items -->
      <div v-else-if="hasItems" class="space-y-2 max-h-96 overflow-y-auto">
        <!-- Header with select all checkbox -->
        <div v-if="!hasActiveFilter" class="flex items-center gap-2 pb-2 border-b border-gray-200/50">
          <input
            type="checkbox"
            :checked="isAllSelected"
            :indeterminate="isIndeterminate"
            :disabled="!canSelectAll"
            @change="toggleSelectAll"
            class="w-4 h-4 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          />
          <span class="text-xs text-gray-500">Select All ({{ filteredCount }})</span>
        </div>

        <TransitionGroup name="whitelist-item" tag="div" class="space-y-2">
          <div
            v-for="item in filteredItems"
            :key="item.domain"
            class="group relative bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200/50 p-3 hover:border-cyan-300/50 hover:shadow-md transition-all duration-300"
            :class="{ 'ring-2 ring-cyan-400': selectedDomains.has(item.domain) }"
          >
            <div class="flex items-center gap-3">
              <!-- Checkbox -->
              <input
                type="checkbox"
                :checked="selectedDomains.has(item.domain)"
                @change="toggleSelectDomain(item.domain)"
                class="w-4 h-4 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
              />

              <!-- Favicon -->
              <div class="relative flex-shrink-0">
                <div class="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-blue-400/20 rounded-lg blur-sm"></div>
                <div class="relative w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm border border-gray-200">
                  <img
                    :src="getFaviconUrl(item.domain)"
                    :alt="item.domain"
                    class="w-6 h-6 rounded"
                    @error="(e: Event) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const nextElement = target.nextElementSibling as HTMLElement;
                      if (nextElement) nextElement.style.display = 'flex';
                    }"
                  />
                  <div class="hidden w-6 h-6 flex items-center justify-center text-gray-400">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                    </svg>
                  </div>
                </div>
              </div>

              <!-- Domain info -->
              <div class="flex-1 min-w-0">
                <h3 class="font-medium text-gray-900 truncate" :title="item.domain">
                  {{ item.domain }}
                  <span v-if="item.isWildcard" class="ml-1 text-xs text-cyan-500 font-normal">
                    (wildcard)
                  </span>
                </h3>
                <p class="text-xs text-gray-500">
                  Added {{ formatAddedDate(item.addedAt) }}
                </p>
              </div>

              <!-- Delete button -->
              <n-button
                size="tiny"
                type="error"
                @click.stop="handleDeleteClick(item.domain)"
                class="bg-white/80 hover:bg-rose-50 border border-gray-200 text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <template #icon>
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </template>
              </n-button>
            </div>
          </div>
        </TransitionGroup>

        <!-- No results message -->
        <div v-if="filteredItems.length === 0 && hasActiveFilter" class="py-8 text-center">
          <p class="text-sm text-gray-500">No domains match your search</p>
          <n-button size="small" class="mt-2" @click="handleClearFilters">
            Clear filters
          </n-button>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="py-8 text-center">
        <div class="w-16 h-16 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-cyan-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.42-3.02 8.34-7 9.5V3.18z" />
          </svg>
        </div>
        <h3 class="text-sm font-semibold text-gray-900 mb-2">No whitelist items</h3>
        <p class="text-xs text-gray-600 mb-6 max-w-xs mx-auto">
          Add domains to your whitelist to prevent them from being frozen.
        </p>

        <div class="flex justify-center gap-3">
          <n-button
            v-if="currentDomain"
            size="small"
            :disabled="isCurrentDomainWhitelisted"
            class="bg-gradient-to-r from-cyan-400 to-blue-500 text-white border-none"
            @click="handleAddCurrentDomain"
          >
            <template #icon>
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </template>
            Add Current Site
          </n-button>
          <n-button
            size="small"
            class="bg-gradient-to-r from-cyan-400 to-blue-500 text-white border-none"
            @click="isAddModalOpen = true"
          >
            <template #icon>
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </template>
            Add Domain
          </n-button>
        </div>
      </div>
    </div>

    <!-- Add Domain Modal -->
    <n-modal v-model:show="isAddModalOpen" class="max-w-md">
      <div class="bg-gradient-to-br from-slate-700 to-slate-800 backdrop-blur-xl border border-slate-600/60 rounded-2xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-white">Add Domain to Whitelist</h3>
          <n-button size="small" circle text class="text-slate-300 hover:text-white" @click="isAddModalOpen = false">
            <template #icon>
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </template>
          </n-button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-200 mb-2">Domain</label>
            <n-input
              v-model:value="manualDomain"
              placeholder="example.com"
              :status="domainInputError ? 'error' : (isDomainValid ? 'success' : undefined)"
              @keyup.enter="handleAddManualDomain"
              @input="validateDomainInput($event as string)"
            />
            <p v-if="domainInputError" class="mt-2 text-xs text-rose-400">
              {{ domainInputError }}
            </p>
            <p v-else class="mt-2 text-xs text-slate-400">
              Enter a domain name (e.g., example.com or *.example.com for wildcards)
            </p>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <n-button @click="isAddModalOpen = false">Cancel</n-button>
            <n-button
              type="primary"
              :disabled="!isDomainValid"
              :loading="isLoading"
              @click="handleAddManualDomain"
              class="bg-gradient-to-r from-cyan-400 to-blue-500"
            >
              Add Domain
            </n-button>
          </div>
        </div>
      </div>
    </n-modal>

    <!-- Delete Confirmation Dialog -->
    <WhitelistConfirmDialog
      v-model:show="showDeleteConfirm"
      type="delete"
      :domain-name="pendingDeleteDomain"
      @confirm="handleConfirmDelete"
      @cancel="showDeleteConfirm = false"
    />

    <!-- Bulk Delete Confirmation Dialog -->
    <WhitelistConfirmDialog
      v-model:show="showBulkDeleteConfirm"
      type="bulkDelete"
      :count="selectionCount"
      @confirm="handleConfirmBulkDelete"
      @cancel="showBulkDeleteConfirm = false"
    />

    <!-- Clear All Confirmation Dialog -->
    <WhitelistConfirmDialog
      v-model:show="showClearAllConfirm"
      type="clearAll"
      @confirm="handleConfirmClearAll"
      @cancel="showClearAllConfirm = false"
    />

    <!-- Import/Export Modal -->
    <WhitelistImportExportModal
      v-model:show="showImportExport"
      :mode="importExportMode"
      :export-data="exportData"
      :item-count="itemCount"
      @import="handleImport"
      @export="handleExport"
      @download="handleDownload"
    />
  </div>
</template>

<style scoped>
.whitelist-manager-enhanced {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* Transitions */
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

/* Checkbox styling */
input[type="checkbox"]:indeterminate {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 16 16'%3e%3cpath stroke='white' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 8h8'/%3e%3c/svg%3e");
  background-color: #06b6d4;
  border-color: #06b6d4;
}

/* Scrollbar styling */
.max-h-96::-webkit-scrollbar {
  width: 6px;
}

.max-h-96::-webkit-scrollbar-track {
  background: transparent;
}

.max-h-96::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.5);
  border-radius: 3px;
}

.max-h-96::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.7);
}

/* Modal styling */
:deep(.n-modal-mask) {
  backdrop-filter: blur(8px);
}
</style>
