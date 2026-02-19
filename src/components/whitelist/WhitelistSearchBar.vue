<script setup lang="ts">
/**
 * WhitelistSearchBar Component
 * Provides search input and sort controls for filtering whitelist items
 */

import { ref, watch, type Ref } from 'vue';
import { NInput, NSelect, NButton } from 'naive-ui';

// Props
interface Props {
  modelValue?: string;
  sortBy?: 'name' | 'dateAdded' | 'lastUsed';
  sortOrder?: 'asc' | 'desc';
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  sortBy: 'name',
  sortOrder: 'asc'
});

// Emits
interface Emits {
  'update:modelValue': [value: string];
  'update:sortBy': [value: 'name' | 'dateAdded' | 'lastUsed'];
  'update:sortOrder': [value: 'asc' | 'desc'];
  'clear': []
}

const emit = defineEmits<Emits>();

// Local state
const searchInput = ref(props.modelValue);
const selectedSort = ref(props.sortBy);
const selectedOrder = ref(props.sortOrder);

// Sort options for dropdown
const sortOptions = [
  { label: 'Domain Name (A-Z)', value: 'name' },
  { label: 'Date Added', value: 'dateAdded' },
  { label: 'Last Used', value: 'lastUsed' }
];

// Order options for dropdown
const orderOptions = [
  { label: 'Ascending', value: 'asc' },
  { label: 'Descending', value: 'desc' }
];

// Watch for changes and emit
watch(searchInput, (newValue) => {
  emit('update:modelValue', newValue);
});

watch(selectedSort, (newValue) => {
  emit('update:sortBy', newValue);
});

watch(selectedOrder, (newValue) => {
  emit('update:sortOrder', newValue);
});

// Watch for prop changes
watch(() => props.modelValue, (newValue) => {
  searchInput.value = newValue;
});

watch(() => props.sortBy, (newValue) => {
  selectedSort.value = newValue;
});

watch(() => props.sortOrder, (newValue) => {
  selectedOrder.value = newValue;
});

// Clear search
function clearSearch(): void {
  searchInput.value = '';
  emit('clear');
}

// Has search content
const hasSearch: Ref<boolean> = ref(false);
watch(searchInput, (value) => {
  hasSearch.value = value.trim().length > 0;
});
</script>

<template>
  <div class="whitelist-search-bar">
    <div class="flex items-center gap-3">
      <!-- Search input -->
      <div class="flex-1 relative">
        <n-input
          v-model:value="searchInput"
          placeholder="Search domains..."
          clearable
          size="small"
          class="search-input"
        >
          <template #prefix>
            <svg class="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </template>
        </n-input>
      </div>

      <!-- Sort by dropdown -->
      <n-select
        v-model:value="selectedSort"
        :options="sortOptions"
        size="small"
        class="sort-select"
        style="width: 140px"
      />

      <!-- Order dropdown -->
      <n-select
        v-model:value="selectedOrder"
        :options="orderOptions"
        size="small"
        class="order-select"
        style="width: 100px"
      />

      <!-- Clear button (shown when has active search) -->
      <transition name="fade">
        <n-button
          v-if="hasSearch"
          size="small"
          @click="clearSearch"
          class="clear-btn"
        >
          <template #icon>
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </template>
          Clear
        </n-button>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.whitelist-search-bar {
  padding: 0;
  margin-bottom: 12px;
}

.search-input :deep(.n-input__input-el) {
  background: transparent;
}

.sort-select :deep(.n-base-selection),
.order-select :deep(.n-base-selection) {
  border-radius: 8px;
}

.clear-btn {
  border-radius: 8px;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
