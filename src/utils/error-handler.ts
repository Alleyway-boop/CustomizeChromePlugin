/**
 * 错误处理工具模块
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

export enum ErrorCodes {
  STORAGE_ERROR = 'STORAGE_ERROR',
  TAB_ERROR = 'TAB_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR'
}

/**
 * 安全的错误处理包装器
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
 * 带重试的异步操作
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
 * 验证URL格式
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
 * 验证标签页ID
 */
export function isValidTabId(tabId: number): boolean {
  return Number.isInteger(tabId) && tabId > 0;
}

/**
 * 验证域名格式
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
 * 标准化域名格式
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
 * 安全的存储操作
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
 * 安全的标签页操作
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