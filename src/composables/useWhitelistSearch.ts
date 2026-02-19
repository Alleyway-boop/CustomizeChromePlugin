/**
 * Whitelist Search Composable
 * Provides search, filter, and sort functionality for whitelist items
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import type { WhitelistItem, WhitelistFilterOptions } from '../types/whitelist';
import { sortWhitelistItems, filterWhitelistItems } from '../utils/whitelist-utils';

/**
 * Composable for whitelist search and filter operations
 * Provides reactive filtering and sorting of whitelist items
 *
 * @example
 * const { searchQuery, sortBy, sortOrder, filteredItems } = useWhitelistSearch(items);
 * searchQuery.value = 'github';
 */
export function useWhitelistSearch(sourceItems: Ref<WhitelistItem[]>) {
  // Filter options
  const searchQuery = ref<string>('');
  const sortBy = ref<WhitelistFilterOptions['sortBy']>('name');
  const sortOrder = ref<WhitelistFilterOptions['sortOrder']>('asc');

  /**
   * Filtered and sorted items based on current search and sort options
   * Computed property that automatically updates when dependencies change
   */
  const filteredItems: ComputedRef<WhitelistItem[]> = computed(() => {
    let result = [...sourceItems.value];

    // Apply search filter
    if (searchQuery.value.trim()) {
      result = filterWhitelistItems(result, searchQuery.value);
    }

    // Apply sorting
    result = sortWhitelistItems(result, sortBy.value, sortOrder.value);

    return result;
  });

  /**
   * Number of items matching the current filter
   */
  const filteredCount: ComputedRef<number> = computed(() => {
    return filteredItems.value.length;
  });

  /**
   * Whether any filter is currently active
   */
  const hasActiveFilter: ComputedRef<boolean> = computed(() => {
    return searchQuery.value.trim().length > 0;
  });

  /**
   * Resets all filter options to defaults
   */
  function resetFilters(): void {
    searchQuery.value = '';
    sortBy.value = 'name';
    sortOrder.value = 'asc';
  }

  /**
   * Sets sort option and toggles order if clicking the same field
   *
   * @param field - Sort field to set
   */
  function toggleSort(field: WhitelistFilterOptions['sortBy']): void {
    if (sortBy.value === field) {
      // Toggle order if clicking same field
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
      // Set new field and default to ascending
      sortBy.value = field;
      sortOrder.value = 'asc';
    }
  }

  /**
   * Gets current filter options as an object
   */
  function getFilterOptions(): WhitelistFilterOptions {
    return {
      searchQuery: searchQuery.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value
    };
  }

  /**
   * Sets filter options from an object
   *
   * @param options - Filter options to set
   */
  function setFilterOptions(options: Partial<WhitelistFilterOptions>): void {
    if (options.searchQuery !== undefined) {
      searchQuery.value = options.searchQuery;
    }
    if (options.sortBy !== undefined) {
      sortBy.value = options.sortBy;
    }
    if (options.sortOrder !== undefined) {
      sortOrder.value = options.sortOrder;
    }
  }

  return {
    // State
    searchQuery,
    sortBy,
    sortOrder,

    // Computed
    filteredItems,
    filteredCount,
    hasActiveFilter,

    // Methods
    resetFilters,
    toggleSort,
    getFilterOptions,
    setFilterOptions
  };
}
