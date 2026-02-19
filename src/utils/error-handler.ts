/**
 * Error handling utility module
 * Provides safe wrappers for browser APIs with error handling
 */

/**
 * Custom error class for extension-specific errors
 * Includes error code and additional details for debugging
 *
 * @example
 * throw new ExtensionError('Tab not found', ErrorCodes.TAB_ERROR, { tabId: 123 });
 */
export class ExtensionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ExtensionError';
  }
}

/**
 * Enumeration of error codes used throughout the extension
 * Provides consistent error identification and handling
 */
export enum ErrorCodes {
  STORAGE_ERROR = 'STORAGE_ERROR',
  TAB_ERROR = 'TAB_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR'
}

/**
 * Safe async wrapper that catches errors and returns null on failure
 * Prevents unhandled promise rejections in extension code
 *
 * @template T - The type of value the promise resolves to
 * @param fn - Async function to execute
 * @param errorHandler - Optional callback for error handling
 * @returns Promise resolving to the function result or null on error
 *
 * @example
 * const tab = await safeAsync(() => browser.tabs.get(123));
 * if (tab) {
 *   console.log(tab.url);
 * } else {
 *   console.log('Tab not found or error occurred');
 * }
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: unknown) => void
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.error('Async operation failed:', error);
    errorHandler?.(error);
    return null;
  }
}

/**
 * Async function wrapper with retry logic and exponential backoff
 * Useful for operations that may fail transiently
 *
 * @template T - The type of value the promise resolves to
 * @param fn - Async function to execute
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param delay - Delay between retries in milliseconds (default: 1000)
 * @returns Promise resolving to the function result
 * @throws ExtensionError if all retries fail
 *
 * @example
 * const data = await withRetry(
 *   () => fetchFromAPI(url),
 *   5,    // max 5 retries
 *   2000  // 2 second delay
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${i + 1} failed:`, error);
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new ExtensionError(
    `Operation failed after ${maxRetries} attempts`,
    ErrorCodes.NETWORK_ERROR,
    lastError
  );
}

/**
 * Validates if a string is a valid HTTP or HTTPS URL
 *
 * @param url - The URL string to validate
 * @returns true if the URL is valid HTTP(S), false otherwise
 *
 * @example
 * isValidUrl('https://example.com');  // true
 * isValidUrl('ftp://example.com');    // false
 * isValidUrl('not-a-url');            // false
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
}

/**
 * Validates if a number is a valid tab ID (positive integer)
 *
 * @param tabId - The tab ID to validate
 * @returns true if the tab ID is valid, false otherwise
 *
 * @example
 * isValidTabId(123);    // true
 * isValidTabId(-1);     // false
 * isValidTabId(0);      // false
 * isValidTabId(1.5);    // false
 */
export function isValidTabId(tabId: number): boolean {
  return Number.isInteger(tabId) && tabId > 0;
}

/**
 * Validates if a string is a valid domain name
 * Checks format, length, and label constraints
 *
 * @param domain - The domain string to validate
 * @returns true if the domain is valid, false otherwise
 *
 * @example
 * isValidDomain('example.com');           // true
 * isValidDomain('sub.example.com');       // true
 * isValidDomain('invalid..domain');       // false
 * isValidDomain('a'.repeat(254));         // false (too long)
 */
export function isValidDomain(domain: string): boolean {
  if (!domain || typeof domain !== 'string') {
    return false;
  }

  // 移除可能的协议和路径
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];

  // 基本域名格式验证
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!domainRegex.test(cleanDomain)) {
    return false;
  }

  // 长度检查
  if (cleanDomain.length > 253) {
    return false;
  }

  // 每个标签长度检查
  const labels = cleanDomain.split('.');
  return labels.every(label => label.length <= 63);
}

/**
 * Normalizes a domain string by removing protocol, port, and path
 * Converts to lowercase and trims whitespace
 *
 * @param domain - The domain string to normalize (can be full URL)
 * @returns Normalized domain name or empty string if input is invalid
 *
 * @example
 * normalizeDomain('https://sub.example.com:8080/path');
 * // Returns: 'sub.example.com'
 *
 * normalizeDomain('Example.Com');
 * // Returns: 'example.com'
 */
export function normalizeDomain(domain: string): string {
  if (!domain) return '';

  // 移除协议、端口和路径，只保留域名
  let normalized = domain.replace(/^https?:\/\//, '').split('/')[0];
  normalized = normalized.split(':')[0]; // 移除端口
  normalized = normalized.toLowerCase().trim();

  return normalized;
}

/**
 * Safe storage operations wrapper with error handling
 * Provides type-safe get/set/remove operations for browser.storage.sync
 */
export const safeStorage = {
  async get<T>(keys: string[]): Promise<Record<string, T>> {
    try {
      return await browser.storage.sync.get(keys) as Record<string, T>;
    } catch (error) {
      throw new ExtensionError(
        'Failed to get storage data',
        ErrorCodes.STORAGE_ERROR,
        error
      );
    }
  },

  async set(data: Record<string, unknown>): Promise<void> {
    try {
      await browser.storage.sync.set(data);
    } catch (error) {
      throw new ExtensionError(
        'Failed to set storage data',
        ErrorCodes.STORAGE_ERROR,
        error
      );
    }
  },

  async remove(keys: string[]): Promise<void> {
    try {
      await browser.storage.sync.remove(keys);
    } catch (error) {
      throw new ExtensionError(
        'Failed to remove storage data',
        ErrorCodes.STORAGE_ERROR,
        error
      );
    }
  }
};

/**
 * Safe tab operations wrapper with validation and error handling
 * Provides type-safe get/query/update operations for browser.tabs API
 */
export const safeTabs = {
  async get(tabId: number): Promise<browser.tabs.Tab> {
    if (!isValidTabId(tabId)) {
      throw new ExtensionError(
        `Invalid tab ID: ${tabId}`,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    try {
      const tab = await browser.tabs.get(tabId);
      if (!tab) {
        throw new ExtensionError(
          `Tab not found: ${tabId}`,
          ErrorCodes.TAB_ERROR
        );
      }
      return tab;
    } catch (error) {
      throw new ExtensionError(
        `Failed to get tab: ${tabId}`,
        ErrorCodes.TAB_ERROR,
        error
      );
    }
  },

  async query(queryInfo: browser.tabs.QueryInfo): Promise<browser.tabs.Tab[]> {
    try {
      return await browser.tabs.query(queryInfo);
    } catch (error) {
      throw new ExtensionError(
        'Failed to query tabs',
        ErrorCodes.TAB_ERROR,
        error
      );
    }
  },

  async update(tabId: number, updateProperties: browser.tabs.UpdateUpdatePropertiesType): Promise<browser.tabs.Tab> {
    if (!isValidTabId(tabId)) {
      throw new ExtensionError(
        `Invalid tab ID: ${tabId}`,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    try {
      return await browser.tabs.update(tabId, updateProperties);
    } catch (error) {
      throw new ExtensionError(
        `Failed to update tab: ${tabId}`,
        ErrorCodes.TAB_ERROR,
        error
      );
    }
  }
};