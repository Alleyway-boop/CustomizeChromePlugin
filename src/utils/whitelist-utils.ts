/**
 * Whitelist Utility Functions
 * Provides domain validation, normalization, and import/export functionality
 */

import {
  WhitelistItem,
  WhitelistImportResult,
  WhitelistExportData,
  DomainValidationResult,
  WHITELIST_EXPORT_VERSION
} from '../types/whitelist';
import { isValidDomain, normalizeDomain } from './error-handler';

/**
 * Validates a domain name with enhanced wildcard support
 * Checks format, length, and optionally validates as a wildcard pattern
 *
 * @param domain - Domain string to validate
 * @param allowWildcard - Whether to allow wildcard patterns (*.example.com)
 * @returns Validation result with normalized domain and any errors/warnings
 *
 * @example
 * const result = validateWhitelistItem('example.com');
 * if (result.isValid) {
 *   console.log('Valid domain:', result.normalizedDomain);
 * }
 */
export function validateWhitelistItem(
  domain: string,
  allowWildcard: boolean = false
): DomainValidationResult {
  const warnings: string[] = [];

  // Check for empty input
  if (!domain || typeof domain !== 'string') {
    return {
      isValid: false,
      error: 'Domain cannot be empty',
      warnings
    };
  }

  const trimmed = domain.trim();

  if (!trimmed) {
    return {
      isValid: false,
      error: 'Domain cannot be empty or whitespace only',
      warnings
    };
  }

  // Check for wildcard pattern
  const isWildcard = trimmed.startsWith('*.');

  if (isWildcard) {
    if (!allowWildcard) {
      return {
        isValid: false,
        error: 'Wildcard patterns are not allowed',
        warnings
      };
    }

    const wildcardPart = trimmed.substring(2);
    if (!wildcardPart) {
      return {
        isValid: false,
        error: 'Wildcard pattern must include a domain (e.g., *.example.com)',
        warnings
      };
    }

    // Validate the domain part after the wildcard
    const domainValidation = validateWhitelistItem(wildcardPart, false);
    if (!domainValidation.isValid) {
      return {
        isValid: false,
        error: `Invalid domain in wildcard pattern: ${domainValidation.error}`,
        warnings
      };
    }

    return {
      isValid: true,
      normalizedDomain: trimmed.toLowerCase(),
      warnings: isWildcard ? ['Wildcard pattern will match all subdomains'] : []
    };
  }

  // Remove protocol and www prefix for validation
  const cleaned = trimmed
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '');

  // Remove path and query parameters
  const domainOnly = cleaned.split('/')[0];

  // Check length限制
  if (domainOnly.length > 253) {
    return {
      isValid: false,
      error: 'Domain name exceeds maximum length of 253 characters',
      warnings
    };
  }

  // Use existing validation from error-handler
  const normalized = normalizeDomain(domainOnly);
  if (!normalized || !isValidDomain(normalized)) {
    return {
      isValid: false,
      error: 'Invalid domain format. Expected format: example.com',
      warnings
    };
  }

  // Check for potential issues
  if (trimmed !== normalized) {
    warnings.push(`Domain was normalized from "${trimmed}" to "${normalized}"`);
  }

  return {
    isValid: true,
    normalizedDomain: normalized,
    warnings
  };
}

/**
 * Normalizes a domain name for consistent storage
 * Removes protocol, www prefix, and converts to lowercase
 *
 * @param domain - Domain string to normalize
 * @returns Normalized domain string, or empty string if invalid
 *
 * @example
 * normalizeWhitelistDomain('https://WWW.Example.Com/path')
 * // Returns: 'example.com'
 */
export function normalizeWhitelistDomain(domain: string): string {
  const validation = validateWhitelistItem(domain, true);
  return validation.normalizedDomain || '';
}

/**
 * Converts a simple domain array to WhitelistItem objects
 * Adds metadata for domains that don't have it
 *
 * @param domains - Array of domain strings
 * @returns Array of WhitelistItem objects with metadata
 *
 * @example
 * const items = domainsToWhitelistItems(['example.com', 'github.com']);
 * // Returns: [{ domain: 'example.com', addedAt: 1234567890, ... }, ...]
 */
export function domainsToWhitelistItems(domains: string[]): WhitelistItem[] {
  const now = Date.now();

  return domains
    .map(domain => {
      const normalized = normalizeWhitelistDomain(domain);
      if (!normalized) return null;

      // Check if it's already a WhitelistItem (for backward compatibility)
      if (typeof domain === 'object' && 'domain' in domain) {
        return domain as WhitelistItem;
      }

      return {
        domain: normalized,
        addedAt: now,
        isWildcard: normalized.startsWith('*.')
      };
    })
    .filter((item): item is WhitelistItem => item !== null);
}

/**
 * Converts WhitelistItem array to simple domain array
 * Extracts just the domain names for storage
 *
 * @param items - Array of WhitelistItem objects
 * @returns Array of domain strings
 *
 * @example
 * const domains = whitelistItemsToDomains([
 *   { domain: 'example.com', addedAt: 1234567890 }
 * ]);
 * // Returns: ['example.com']
 */
export function whitelistItemsToDomains(items: WhitelistItem[]): string[] {
  return items.map(item => item.domain);
}

/**
 * Exports whitelist data to JSON string
 * Creates a serialized export with metadata
 *
 * @param items - Array of WhitelistItem objects to export
 * @returns JSON string containing export data
 *
 * @example
 * const json = exportWhitelistToJson(whitelistItems);
 * console.log(json); // {"version":"1.0.0","exportedAt":1234567890,"items":[...]}
 */
export function exportWhitelistToJson(items: WhitelistItem[]): string {
  const exportData: WhitelistExportData = {
    version: WHITELIST_EXPORT_VERSION,
    exportedAt: Date.now(),
    items: items.map(item => ({
      domain: item.domain,
      addedAt: item.addedAt,
      lastUsed: item.lastUsed,
      category: item.category,
      notes: item.notes,
      isWildcard: item.isWildcard
    }))
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Imports whitelist data from JSON string
 * Validates and processes import data with conflict resolution
 *
 * @param json - JSON string containing export data
 * @param existingDomains - Array of existing domain names for conflict detection
 * @param onConflict - Strategy for handling conflicts: 'skip' | 'overwrite' | 'keep'
 * @returns Import result with statistics and errors
 *
 * @example
 * const result = importWhitelistFromJson(jsonString, existingDomains, 'skip');
 * console.log(`Imported ${result.imported} domains, ${result.duplicates} skipped`);
 */
export function importWhitelistFromJson(
  json: string,
  existingDomains: string[] = [],
  onConflict: 'skip' | 'overwrite' | 'keep' = 'skip'
): WhitelistImportResult {
  const result: WhitelistImportResult = {
    success: false,
    imported: 0,
    failed: 0,
    duplicates: 0,
    errors: []
  };

  try {
    // Parse JSON
    let importData: WhitelistExportData;
    try {
      importData = JSON.parse(json);
    } catch (parseError) {
      result.errors.push('Invalid JSON format');
      return result;
    }

    // Validate structure
    if (!importData.items || !Array.isArray(importData.items)) {
      result.errors.push('Invalid export format: missing or invalid items array');
      return result;
    }

    // Check version compatibility
    if (importData.version && importData.version !== WHITELIST_EXPORT_VERSION) {
      result.errors.push(
        `Version mismatch: export is ${importData.version}, current is ${WHITELIST_EXPORT_VERSION}`
      );
      // Continue anyway for minor version differences
    }

    // Process each item
    const existingDomainSet = new Set(existingDomains.map(d => d.toLowerCase()));

    for (const item of importData.items) {
      if (!item || !item.domain) {
        result.failed++;
        result.errors.push('Invalid item: missing domain');
        continue;
      }

      // Validate domain
      const validation = validateWhitelistItem(item.domain, true);
      if (!validation.isValid) {
        result.failed++;
        result.errors.push(`Invalid domain "${item.domain}": ${validation.error}`);
        continue;
      }

      const normalizedDomain = validation.normalizedDomain!;

      // Check for conflicts
      if (existingDomainSet.has(normalizedDomain)) {
        result.duplicates++;

        if (onConflict === 'skip') {
          continue;
        } else if (onConflict === 'overwrite') {
          // Remove existing and add new (handled by caller)
        } else if (onConflict === 'keep') {
          // Keep existing, don't add new
          continue;
        }
      }

      // Create whitelist item
      const whitelistItem: WhitelistItem = {
        domain: normalizedDomain,
        addedAt: item.addedAt || Date.now(),
        lastUsed: item.lastUsed,
        category: item.category,
        notes: item.notes,
        isWildcard: normalizedDomain.startsWith('*.')
      };

      // Add to result (caller will handle actual storage)
      result.imported++;
      existingDomainSet.add(normalizedDomain);
    }

    result.success = result.failed === 0 || result.imported > 0;

  } catch (error) {
    result.success = false;
    result.errors.push(
      `Import error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return result;
}

/**
 * Sorts whitelist items by specified criteria
 *
 * @param items - Array of WhitelistItem objects to sort
 * @param sortBy - Property to sort by
 * @param order - Sort order ('asc' or 'desc')
 * @returns New sorted array (does not modify original)
 *
 * @example
 * const sorted = sortWhitelistItems(items, 'name', 'asc');
 */
export function sortWhitelistItems(
  items: WhitelistItem[],
  sortBy: 'name' | 'dateAdded' | 'lastUsed',
  order: 'asc' | 'desc'
): WhitelistItem[] {
  const sorted = [...items];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'name':
        comparison = a.domain.localeCompare(b.domain);
        break;
      case 'dateAdded':
        comparison = a.addedAt - b.addedAt;
        break;
      case 'lastUsed':
        // Handle items without lastUsed - treat them as oldest
        const aTime = a.lastUsed ?? 0;
        const bTime = b.lastUsed ?? 0;
        comparison = aTime - bTime;
        break;
    }

    return order === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Filters whitelist items by search query
 * Searches domain names, categories, and notes
 *
 * @param items - Array of WhitelistItem objects to filter
 * @param query - Search query string
 * @returns New filtered array (does not modify original)
 *
 * @example
 * const filtered = filterWhitelistItems(items, 'github');
 */
export function filterWhitelistItems(
  items: WhitelistItem[],
  query: string
): WhitelistItem[] {
  if (!query || query.trim() === '') {
    return [...items];
  }

  const searchLower = query.toLowerCase().trim();

  return items.filter(item => {
    // Search domain name
    if (item.domain.toLowerCase().includes(searchLower)) {
      return true;
    }

    // Search category
    if (item.category && item.category.toLowerCase().includes(searchLower)) {
      return true;
    }

    // Search notes
    if (item.notes && item.notes.toLowerCase().includes(searchLower)) {
      return true;
    }

    return false;
  });
}

/**
 * Checks if a domain matches a whitelist entry
 * Handles wildcard patterns (*.example.com)
 *
 * @param domain - Domain to check
 * @param whitelistItem - WhitelistItem to match against
 * @returns True if the domain matches the whitelist entry
 *
 * @example
 * const isMatch = isDomainMatch('sub.example.com', { domain: '*.example.com', ... });
 */
export function isDomainMatch(domain: string, whitelistItem: WhitelistItem): boolean {
  const normalized = normalizeWhitelistDomain(domain);
  if (!normalized) return false;

  // Exact match
  if (normalized === whitelistItem.domain) {
    return true;
  }

  // Wildcard match
  if (whitelistItem.isWildcard && whitelistItem.domain.startsWith('*.')) {
    const pattern = whitelistItem.domain.substring(2); // Remove *.
    return normalized === pattern || normalized.endsWith('.' + pattern);
  }

  return false;
}
