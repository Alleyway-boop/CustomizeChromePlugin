/**
 * Whitelist Type Definitions
 * Core type definitions for the enhanced whitelist management system
 */

/**
 * Represents a single whitelist item with metadata
 * Extends basic domain string with additional information
 */
export interface WhitelistItem {
  /** The domain name (normalized, lowercase) */
  domain: string;
  /** Timestamp when the domain was added (milliseconds since epoch) */
  addedAt: number;
  /** Timestamp when the domain was last accessed/used (optional) */
  lastUsed?: number;
  /** User-defined category for organizing domains (optional) */
  category?: string;
  /** User notes about this domain entry (optional) */
  notes?: string;
  /** Whether this is a wildcard entry (*.example.com) */
  isWildcard?: boolean;
}

/**
 * Filter and sort options for the whitelist display
 * Controls how the whitelist items are filtered and sorted in the UI
 */
export interface WhitelistFilterOptions {
  /** Search query string for filtering domains */
  searchQuery: string;
  /** Property to sort items by */
  sortBy: 'name' | 'dateAdded' | 'lastUsed';
  /** Sort order direction */
  sortOrder: 'asc' | 'desc';
}

/**
 * Result of a whitelist import operation
 * Provides detailed statistics about the import process
 */
export interface WhitelistImportResult {
  /** Whether the import operation completed successfully */
  success: boolean;
  /** Number of items successfully imported */
  imported: number;
  /** Number of items that failed to import */
  failed: number;
  /** Number of items skipped due to being duplicates */
  duplicates: number;
  /** Array of error messages for failed imports */
  errors: string[];
}

/**
 * Data structure for whitelist export
 * Encapsulates whitelist data with metadata for import/export operations
 */
export interface WhitelistExportData {
  /** Version of the export format (for future compatibility) */
  version: string;
  /** Timestamp when the export was created (milliseconds since epoch) */
  exportedAt: number;
  /** Array of whitelist items to export */
  items: WhitelistItem[];
}

/** Current export format version */
export const WHITELIST_EXPORT_VERSION = '1.0.0';

/**
 * Selection state for bulk operations
 * Tracks which items are currently selected in the UI
 */
export interface WhitelistSelectionState {
  /** Set of selected domain names */
  selectedDomains: Set<string>;
  /** Whether all items are currently selected */
  isAllSelected: boolean;
  /** Whether some (but not all) items are selected */
  isIndeterminate: boolean;
}

/**
 * Validation result for a domain input
 * Provides detailed feedback about domain validation
 */
export interface DomainValidationResult {
  /** Whether the domain is valid */
  isValid: boolean;
  /** Normalized domain name (if valid) */
  normalizedDomain?: string;
  /** Error message (if invalid) */
  error?: string;
  /** Warning messages (non-blocking issues) */
  warnings: string[];
}

/**
 * Bulk operation result
 * Result of performing operations on multiple whitelist items
 */
export interface BulkOperationResult {
  /** Whether the operation completed successfully */
  success: boolean;
  /** Number of items successfully processed */
  processed: number;
  /** Number of items that failed */
  failed: number;
  /** Array of error messages for failed operations */
  errors: string[];
  /** Human-readable result message */
  message: string;
}
