/**
 * Whitelist Operations Composable
 * Provides reactive CRUD operations for whitelist management
 */

import { ref, readonly, type Ref } from 'vue';
import type { WhitelistItem, BulkOperationResult } from '../types/whitelist';
import { configManager } from '../utils/config';
import {
  domainsToWhitelistItems,
  whitelistItemsToDomains,
  validateWhitelistItem,
  exportWhitelistToJson,
  importWhitelistFromJson
} from '../utils/whitelist-utils';

/**
 * Composable for whitelist CRUD operations
 * Manages whitelist state and provides methods for modifying it
 *
 * @example
 * const { items, isLoading, addDomain, removeDomain } = useWhitelistOperations();
 * await addDomain('example.com');
 */
export function useWhitelistOperations() {
  // Reactive state
  const items = ref<WhitelistItem[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<number>(Date.now());

  /**
   * Loads whitelist from storage
   * Converts stored domain array to WhitelistItem objects
   */
  async function loadWhitelist(): Promise<void> {
    try {
      isLoading.value = true;
      error.value = null;

      const config = configManager.getConfig();
      const domains = config.whitelist || [];

      // Convert domains to WhitelistItem objects
      items.value = domainsToWhitelistItems(domains);
      lastUpdated.value = Date.now();

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load whitelist';
      error.value = message;
      console.error('Error loading whitelist:', err);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Adds a single domain to the whitelist
   * Validates and checks for duplicates before adding
   *
   * @param domain - Domain name to add
   * @returns True if added successfully, false otherwise
   */
  async function addDomain(domain: string): Promise<boolean> {
    try {
      isLoading.value = true;
      error.value = null;

      // Validate domain
      const validation = validateWhitelistItem(domain, true);
      if (!validation.isValid) {
        error.value = validation.error || 'Invalid domain';
        return false;
      }

      const normalizedDomain = validation.normalizedDomain!;

      // Check for duplicates
      if (items.value.some(item => item.domain === normalizedDomain)) {
        error.value = `Domain already in whitelist: ${normalizedDomain}`;
        return false;
      }

      // Add to config manager
      await configManager.addToWhitelist(normalizedDomain);

      // Update local state
      items.value.push({
        domain: normalizedDomain,
        addedAt: Date.now(),
        isWildcard: normalizedDomain.startsWith('*.')
      });

      lastUpdated.value = Date.now();
      return true;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add domain';
      error.value = message;
      console.error('Error adding domain:', err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Adds multiple domains to the whitelist
   * Batch operation with validation and duplicate checking
   *
   * @param domains - Array of domain names to add
   * @returns Bulk operation result with statistics
   */
  async function addDomains(domains: string[]): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: false,
      processed: 0,
      failed: 0,
      errors: [],
      message: ''
    };

    try {
      isLoading.value = true;
      error.value = null;

      const domainsToAdd: string[] = [];
      const existingDomains = items.value.map(item => item.domain);

      for (const domain of domains) {
        // Validate domain
        const validation = validateWhitelistItem(domain, true);
        if (!validation.isValid) {
          result.failed++;
          result.errors.push(`${domain}: ${validation.error}`);
          continue;
        }

        const normalizedDomain = validation.normalizedDomain!;

        // Check for duplicates
        if (existingDomains.includes(normalizedDomain)) {
          result.failed++;
          result.errors.push(`${domain}: Already in whitelist`);
          continue;
        }

        domainsToAdd.push(normalizedDomain);
        result.processed++;
      }

      if (domainsToAdd.length === 0) {
        result.message = result.failed > 0
          ? 'No valid domains to add'
          : 'No domains provided';
        return result;
      }

      // Add all at once to config manager
      await configManager.addMultipleToWhitelist(domainsToAdd);

      // Update local state
      const now = Date.now();
      const newItems = domainsToAdd.map(domain => ({
        domain,
        addedAt: now,
        isWildcard: domain.startsWith('*.')
      }));

      items.value.push(...newItems);
      lastUpdated.value = Date.now();

      result.success = result.failed === 0 || result.processed > 0;
      result.message = `Added ${result.processed} domain${result.processed !== 1 ? 's' : ''}`;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add domains';
      error.value = message;
      result.success = false;
      result.errors.push(message);
      result.message = 'Failed to add domains';
      console.error('Error adding domains:', err);
    } finally {
      isLoading.value = false;
    }

    return result;
  }

  /**
   * Removes a single domain from the whitelist
   *
   * @param domain - Domain name to remove
   * @returns True if removed successfully, false otherwise
   */
  async function removeDomain(domain: string): Promise<boolean> {
    try {
      isLoading.value = true;
      error.value = null;

      const normalizedDomain = domain.toLowerCase().trim();

      // Check if exists
      const index = items.value.findIndex(item => item.domain === normalizedDomain);
      if (index === -1) {
        error.value = `Domain not found: ${normalizedDomain}`;
        return false;
      }

      // Remove from config manager
      await configManager.removeFromWhitelist(normalizedDomain);

      // Update local state
      items.value.splice(index, 1);
      lastUpdated.value = Date.now();

      return true;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove domain';
      error.value = message;
      console.error('Error removing domain:', err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Removes multiple domains from the whitelist
   * Batch operation for efficient bulk deletion
   *
   * @param domains - Array of domain names to remove
   * @returns Bulk operation result with statistics
   */
  async function removeDomains(domains: string[]): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: false,
      processed: 0,
      failed: 0,
      errors: [],
      message: ''
    };

    try {
      isLoading.value = true;
      error.value = null;

      const domainsToRemove: string[] = [];
      const domainSet = new Set(domains.map(d => d.toLowerCase().trim()));

      for (const domain of domains) {
        const normalizedDomain = domain.toLowerCase().trim();

        // Check if exists
        if (!items.value.some(item => item.domain === normalizedDomain)) {
          result.failed++;
          result.errors.push(`${domain}: Not found in whitelist`);
          continue;
        }

        domainsToRemove.push(normalizedDomain);
        result.processed++;
      }

      if (domainsToRemove.length === 0) {
        result.message = result.failed > 0
          ? 'No valid domains to remove'
          : 'No domains provided';
        return result;
      }

      // Remove all at once from config manager
      await configManager.removeMultipleFromWhitelist(domainsToRemove);

      // Update local state
      items.value = items.value.filter(item => !domainSet.has(item.domain));
      lastUpdated.value = Date.now();

      result.success = result.failed === 0 || result.processed > 0;
      result.message = `Removed ${result.processed} domain${result.processed !== 1 ? 's' : ''}`;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove domains';
      error.value = message;
      result.success = false;
      result.errors.push(message);
      result.message = 'Failed to remove domains';
      console.error('Error removing domains:', err);
    } finally {
      isLoading.value = false;
    }

    return result;
  }

  /**
   * Clears all domains from the whitelist
   * Destructive operation with no undo
   *
   * @returns True if cleared successfully, false otherwise
   */
  async function clearAll(): Promise<boolean> {
    try {
      isLoading.value = true;
      error.value = null;

      // Clear from config manager
      await configManager.clearWhitelist();

      // Update local state
      items.value = [];
      lastUpdated.value = Date.now();

      return true;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clear whitelist';
      error.value = message;
      console.error('Error clearing whitelist:', err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Exports current whitelist to JSON string
   *
   * @returns JSON string containing export data
   */
  function exportWhitelist(): string {
    return exportWhitelistToJson(items.value);
  }

  /**
   * Imports whitelist from JSON string
   *
   * @param json - JSON string containing export data
   * @param onConflict - Strategy for handling duplicates: 'skip' | 'overwrite' | 'keep'
   * @returns Import result with statistics
   */
  async function importWhitelist(
    json: string,
    onConflict: 'skip' | 'overwrite' | 'keep' = 'skip'
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: false,
      processed: 0,
      failed: 0,
      errors: [],
      message: ''
    };

    try {
      isLoading.value = true;
      error.value = null;

      const existingDomains = items.value.map(item => item.domain);
      const importResult = importWhitelistFromJson(json, existingDomains, onConflict);

      if (!importResult.success && importResult.imported === 0) {
        result.errors = importResult.errors;
        result.failed = importResult.failed;
        result.message = 'Import failed';
        return result;
      }

      // Add imported domains to config
      if (importResult.imported > 0) {
        const importedItems = domainsToWhitelistItems(
          importResult.errors.length > 0
            ? [] // Parse JSON again to get successful items
            : JSON.parse(json).items
        );

        await configManager.addMultipleToWhitelist(
          importedItems.map(item => item.domain)
        );

        items.value.push(...importedItems);
        lastUpdated.value = Date.now();
      }

      result.success = true;
      result.processed = importResult.imported;
      result.failed = importResult.failed;
      result.errors = importResult.errors;
      result.message = `Imported ${importResult.imported} domain${importResult.imported !== 1 ? 's' : ''}`;

      if (importResult.duplicates > 0) {
        result.message += `, ${importResult.duplicates} duplicate${importResult.duplicates !== 1 ? 's' : ''} skipped`;
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import whitelist';
      error.value = message;
      result.success = false;
      result.errors.push(message);
      result.message = 'Import failed';
      console.error('Error importing whitelist:', err);
    } finally {
      isLoading.value = false;
    }

    return result;
  }

  // Load initial data
  loadWhitelist();

  return {
    // State
    items,
    isLoading,
    error,
    lastUpdated,

    // Methods
    loadWhitelist,
    addDomain,
    addDomains,
    removeDomain,
    removeDomains,
    clearAll,
    exportWhitelist,
    importWhitelist
  };
}
