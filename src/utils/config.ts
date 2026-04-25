/**
 * Configuration management module
 * Provides centralized configuration management with storage synchronization
 */

import browser from 'webextension-polyfill';
import { safeStorage, ExtensionError, ErrorCodes } from './error-handler';
import {
  type WhitelistItem,
  type WhitelistExportData,
  type WhitelistImportResult,
  type BulkOperationResult,
  WHITELIST_EXPORT_VERSION
} from '../types/whitelist';
import {
  domainsToWhitelistItems,
  whitelistItemsToDomains,
  exportWhitelistToJson,
  importWhitelistFromJson,
  validateWhitelistItem,
  normalizeWhitelistDomain,
} from './whitelist-utils';

/**
 * Application configuration interface
 * Defines all configurable settings for the extension
 */
export interface AppConfig {
  freezeTimeout: number;
  freezePinned: boolean;
  whitelist: string[];
  enabled: boolean;
  cleanupInterval: number;
  maxTabs: number;
  snapshotQuality: number;
  autoRecovery: boolean;
  notifications: boolean;
  debugMode: boolean;
}

/**
 * Default configuration values
 * Used when no stored configuration is available
 */
export const DEFAULT_CONFIG: AppConfig = {
  freezeTimeout: 20, // 分钟
  freezePinned: true,
  whitelist: [],
  enabled: true,
  cleanupInterval: 60, // 分钟
  maxTabs: 50,
  snapshotQuality: 50, // JPEG 质量
  autoRecovery: false,
  notifications: true,
  debugMode: false
};

/**
 * Configuration manager singleton
 * Manages application configuration with automatic storage synchronization
 * Provides reactive updates through listener pattern
 *
 * @example
 * const config = configManager.getConfig();
 * await configManager.updateConfig({ freezeTimeout: 30 });
 *
 * const unsubscribe = configManager.subscribe((newConfig) => {
 *   console.log('Config changed:', newConfig);
 * });
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig = { ...DEFAULT_CONFIG };
  private listeners: Set<(config: AppConfig) => void> = new Set();

  /**
   * Gets the singleton ConfigManager instance
   * Creates a new instance if one doesn't exist
   *
   * @returns The ConfigManager singleton instance
   *
   * @example
   * const manager = ConfigManager.getInstance();
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Initializes the configuration manager by loading stored values
   * Should be called once when the extension starts
   *
   * @throws ExtensionError if storage initialization fails
   *
   * @example
   * await configManager.initialize();
   */
  async initialize(): Promise<void> {
    try {
      const stored = await safeStorage.get([
        'freezeTimeout',
        'freezePinned',
        'whitelist',
        'enabled',
        'cleanupInterval',
        'maxTabs',
        'snapshotQuality',
        'autoRecovery',
        'notifications',
        'debugMode'
      ]) as {
        freezeTimeout?: number;
        freezePinned?: boolean;
        whitelist?: string[];
        enabled?: boolean;
        cleanupInterval?: number;
        maxTabs?: number;
        snapshotQuality?: number;
        autoRecovery?: boolean;
        notifications?: boolean;
        debugMode?: boolean;
      };

      this.config = {
        freezeTimeout: stored.freezeTimeout ?? DEFAULT_CONFIG.freezeTimeout,
        freezePinned: stored.freezePinned ?? DEFAULT_CONFIG.freezePinned,
        whitelist: stored.whitelist ?? DEFAULT_CONFIG.whitelist,
        enabled: stored.enabled ?? DEFAULT_CONFIG.enabled,
        cleanupInterval: stored.cleanupInterval ?? DEFAULT_CONFIG.cleanupInterval,
        maxTabs: stored.maxTabs ?? DEFAULT_CONFIG.maxTabs,
        snapshotQuality: stored.snapshotQuality ?? DEFAULT_CONFIG.snapshotQuality,
        autoRecovery: stored.autoRecovery ?? DEFAULT_CONFIG.autoRecovery,
        notifications: stored.notifications ?? DEFAULT_CONFIG.notifications,
        debugMode: stored.debugMode ?? DEFAULT_CONFIG.debugMode
      };

      this.setupStorageListener();
    } catch (error) {
      console.error('Failed to initialize config:', error);
      throw new ExtensionError(
        'Failed to initialize configuration',
        ErrorCodes.STORAGE_ERROR,
        error
      );
    }
  }

  /**
   * Gets a copy of the current configuration
   *
   * @returns A copy of the current AppConfig
   *
   * @example
   * const config = configManager.getConfig();
   * console.log(config.freezeTimeout);
   */
  getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * Updates configuration with new values
   * Validates the configuration before saving
   *
   * @param updates - Partial configuration object with values to update
   * @throws ExtensionError if validation fails or storage operation fails
   *
   * @example
   * await configManager.updateConfig({
   *   freezeTimeout: 30,
   *   freezePinned: true
   * });
   */
  async updateConfig(updates: Partial<AppConfig>): Promise<void> {
    try {
      const newConfig = { ...this.config, ...updates };
      
      // 验证配置
      this.validateConfig(newConfig);
      
      // 保存到存储
      await safeStorage.set(updates);
      
      // 更新本地配置
      this.config = newConfig;
      
      // 通知监听器
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to update config:', error);
      throw error;
    }
  }

  /**
   * Resets all configuration values to defaults
   *
   * @example
   * await configManager.resetToDefaults();
   */
  async resetToDefaults(): Promise<void> {
    await this.updateConfig(DEFAULT_CONFIG);
  }

  /**
   * Adds a domain to the whitelist if not already present
   *
   * @param domain - Domain name to add to whitelist
   *
   * @example
   * await configManager.addToWhitelist('example.com');
   */
  async addToWhitelist(domain: string): Promise<void> {
    if (!this.config.whitelist.includes(domain)) {
      await this.updateConfig({
        whitelist: [...this.config.whitelist, domain]
      });
    }
  }

  /**
   * Removes a domain from the whitelist
   *
   * @param domain - Domain name to remove from whitelist
   *
   * @example
   * await configManager.removeFromWhitelist('example.com');
   */
  async removeFromWhitelist(domain: string): Promise<void> {
    await this.updateConfig({
      whitelist: this.config.whitelist.filter(d => d !== domain)
    });
  }

  /**
   * Checks if a domain is in the whitelist
   *
   * @param domain - Domain name to check
   * @returns true if domain is whitelisted, false otherwise
   *
   * @example
   * if (configManager.isWhitelisted('example.com')) {
   *   console.log('Domain is protected');
   * }
   */
  isWhitelisted(domain: string): boolean {
    return this.config.whitelist.includes(domain);
  }

  /**
   * Adds multiple domains to the whitelist in a single operation
   * Validates all domains before adding and skips duplicates
   *
   * @param domains - Array of domain names to add
   * @throws ExtensionError if validation fails or storage operation fails
   *
   * @example
   * await configManager.addMultipleToWhitelist(['example.com', 'github.com']);
   */
  async addMultipleToWhitelist(domains: string[]): Promise<void> {
    try {
      if (!Array.isArray(domains) || domains.length === 0) {
        throw new ExtensionError(
          'Domains must be a non-empty array',
          ErrorCodes.VALIDATION_ERROR
        );
      }

      const { validateWhitelistItem } = await import('./whitelist-utils');
      const existingDomains = new Set(this.config.whitelist);
      const domainsToAdd: string[] = [];

      for (const domain of domains) {
        if (!domain || typeof domain !== 'string') {
          console.warn('Skipping invalid domain:', domain);
          continue;
        }

        const validation = validateWhitelistItem(domain.trim(), true);
        if (!validation.isValid) {
          console.warn(`Skipping invalid domain: ${domain} - ${validation.error}`);
          continue;
        }

        const normalized = validation.normalizedDomain!;
        if (!existingDomains.has(normalized)) {
          domainsToAdd.push(normalized);
          existingDomains.add(normalized);
        }
      }

      if (domainsToAdd.length > 0) {
        await this.updateConfig({
          whitelist: [...this.config.whitelist, ...domainsToAdd]
        });
      }
    } catch (error) {
      console.error('Failed to add multiple domains:', error);
      throw error;
    }
  }

  /**
   * Removes multiple domains from the whitelist in a single operation
   *
   * @param domains - Array of domain names to remove
   * @throws ExtensionError if storage operation fails
   *
   * @example
   * await configManager.removeMultipleFromWhitelist(['example.com', 'github.com']);
   */
  async removeMultipleFromWhitelist(domains: string[]): Promise<void> {
    try {
      if (!Array.isArray(domains) || domains.length === 0) {
        throw new ExtensionError(
          'Domains must be a non-empty array',
          ErrorCodes.VALIDATION_ERROR
        );
      }

      const { normalizeWhitelistDomain } = await import('./whitelist-utils');
      const domainsToRemove = new Set(
        domains
          .filter(d => d && typeof d === 'string')
          .map(d => normalizeWhitelistDomain(d.trim()))
          .filter(d => d)
      );

      if (domainsToRemove.size === 0) {
        return; // Nothing to remove
      }

      await this.updateConfig({
        whitelist: this.config.whitelist.filter(d => !domainsToRemove.has(d))
      });
    } catch (error) {
      console.error('Failed to remove multiple domains:', error);
      throw error;
    }
  }

  /**
   * Clears all domains from the whitelist
   * Destructive operation with no undo
   *
   * @throws ExtensionError if storage operation fails
   *
   * @example
   * await configManager.clearWhitelist();
   */
  async clearWhitelist(): Promise<void> {
    try {
      await this.updateConfig({ whitelist: [] });
    } catch (error) {
      console.error('Failed to clear whitelist:', error);
      throw error;
    }
  }

  /**
   * Exports the current whitelist as a structured export object
   * Includes metadata and version information for import
   *
   * @returns Export data object with items and metadata
   *
   * @example
   * const exportData = configManager.exportWhitelist();
   * console.log(`Exported ${exportData.items.length} domains`);
   */
  exportWhitelist(): WhitelistExportData {
    const items = domainsToWhitelistItems(this.config.whitelist);

    return {
      version: WHITELIST_EXPORT_VERSION,
      exportedAt: Date.now(),
      items
    };
  }

  /**
   * Imports whitelist data from an export object
   * Validates and merges with existing whitelist
   *
   * @param data - Export data object to import
   * @param onConflict - Strategy for handling duplicates: 'skip' | 'overwrite' | 'keep'
   * @returns Import result with statistics
   *
   * @example
   * const result = await configManager.importWhitelist(exportData, 'skip');
   * console.log(`Imported ${result.imported} domains`);
   */
  async importWhitelist(
    data: WhitelistExportData,
    onConflict: 'skip' | 'overwrite' | 'keep' = 'skip'
  ): Promise<WhitelistImportResult> {
    try {
      // Validate structure
      if (!data || !data.items || !Array.isArray(data.items)) {
        return {
          success: false,
          imported: 0,
          failed: 0,
          duplicates: 0,
          errors: ['Invalid import data structure']
        };
      }

      // Convert to JSON for importWhitelistFromJson
      const json = JSON.stringify(data);

      // Get existing domains
      const existingDomains = this.config.whitelist;

      // Import with validation
      const importResult = importWhitelistFromJson(json, existingDomains, onConflict);

      if (!importResult.success && importResult.imported === 0) {
        return importResult;
      }

      // Add successful imports to config
      if (importResult.imported > 0) {
        // Parse imported items from the result
        const importedItems: string[] = [];
        const existingSet = new Set(existingDomains.map(d => d.toLowerCase()));

        for (const item of data.items) {
          if (!item || !item.domain) continue;

          const validation = validateWhitelistItem(item.domain, true);

          if (!validation.isValid) continue;

          const normalized = validation.normalizedDomain!;

          // Skip if already exists (and we're in skip/keep mode)
          if (existingSet.has(normalized) && onConflict !== 'overwrite') {
            continue;
          }

          importedItems.push(normalized);
          existingSet.add(normalized);
        }

        if (importedItems.length > 0) {
          // If overwriting, remove existing items first
          if (onConflict === 'overwrite') {
            const toRemove = importedItems.filter(d => existingDomains.includes(d));
            if (toRemove.length > 0) {
              await this.removeMultipleFromWhitelist(toRemove);
            }
          }

          await this.addMultipleToWhitelist(importedItems);
        }
      }

      return importResult;

    } catch (error) {
      console.error('Failed to import whitelist:', error);
      return {
        success: false,
        imported: 0,
        failed: 0,
        duplicates: 0,
        errors: [error instanceof Error ? error.message : 'Unknown import error']
      };
    }
  }

  /**
   * Gets whitelist items as structured objects with metadata
   * Converts simple domain array to WhitelistItem objects
   *
   * @returns Array of WhitelistItem objects
   *
   * @example
   * const items = configManager.getWhitelistItems();
   * items.forEach(item => {
   *   console.log(`${item.domain} added at ${new Date(item.addedAt).toISOString()}`);
   * });
   */
  getWhitelistItems(): WhitelistItem[] {
    return domainsToWhitelistItems(this.config.whitelist);
  }

  /**
   * Gets the raw whitelist domain array
   * Returns the simple string array format
   *
   * @returns Array of domain names
   *
   * @example
   * const domains = configManager.getWhitelistDomains();
   * console.log('Protected domains:', domains.join(', '));
   */
  getWhitelistDomains(): string[] {
    return [...this.config.whitelist];
  }

  /**
   * Subscribes to configuration changes
   *
   * @param listener - Callback function invoked when configuration changes
   * @returns Unsubscribe function to remove the listener
   *
   * @example
   * const unsubscribe = configManager.subscribe((config) => {
   *   console.log('New config:', config);
   * });
   * // Later: unsubscribe();
   */
  subscribe(listener: (config: AppConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private validateConfig(config: AppConfig): void {
    if (config.freezeTimeout < 1 || config.freezeTimeout > 360) {
      throw new ExtensionError(
        'Freeze timeout must be between 1 and 360 minutes',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (config.maxTabs < 1 || config.maxTabs > 1000) {
      throw new ExtensionError(
        'Max tabs must be between 1 and 1000',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (config.snapshotQuality < 10 || config.snapshotQuality > 100) {
      throw new ExtensionError(
        'Snapshot quality must be between 10 and 100',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (config.cleanupInterval < 1 || config.cleanupInterval > 1440) {
      throw new ExtensionError(
        'Cleanup interval must be between 1 and 1440 minutes',
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private setupStorageListener(): void {
    // @ts-ignore - webextension-polyfill types are incomplete for storage.onChanged callback
    browser.storage.sync.onChanged.addListener((changes: any, area: any) => {
      if (area === 'sync') {
        let needsUpdate = false;
        const updates: Partial<AppConfig> = {};

        Object.entries(changes).forEach(([key, change]: [string, any]) => {
          if (key in this.config) {
            (updates as Record<string, unknown>)[key] = change.newValue;
            needsUpdate = true;
          }
        });

        if (needsUpdate) {
          this.config = { ...this.config, ...updates };
          this.notifyListeners();
        }
      }
    });
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getConfig());
      } catch (error) {
        console.error('Config listener error:', error);
      }
    });
  }
}

/**
 * Singleton instance of ConfigManager
 * Use this exported instance for all configuration operations
 *
 * @example
 * import { configManager } from './utils/config';
 * const config = configManager.getConfig();
 */
export const configManager = ConfigManager.getInstance();