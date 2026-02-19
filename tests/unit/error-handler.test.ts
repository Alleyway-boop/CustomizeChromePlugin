/**
 * Error Handler Unit Tests
 * Tests for error handling utilities including:
 * - ExtensionError class
 * - safeAsync wrapper
 * - withRetry function
 * - Validation functions (isValidUrl, isValidTabId, isValidDomain, normalizeDomain)
 * - Safe storage operations
 * - Safe tab operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Setup browser mock before importing error-handler
const mockBrowserStorage = {
  get: vi.fn((keys: string | string[] | Record<string, unknown> | null) => {
    const result: Record<string, unknown> = {}
    if (Array.isArray(keys)) {
      keys.forEach(key => {
        result[key] = undefined
      })
    } else if (typeof keys === 'string') {
      result[keys] = undefined
    } else if (keys && typeof keys === 'object') {
      Object.assign(result, keys)
    }
    return Promise.resolve(result)
  }),
  set: vi.fn((items: Record<string, unknown>) => {
    return Promise.resolve()
  }),
  remove: vi.fn((keys: string | string[]) => {
    return Promise.resolve()
  }),
  clear: vi.fn(() => {
    return Promise.resolve()
  }),
  getBytesInUse: vi.fn(() => Promise.resolve(0))
}

const mockBrowserTabs = {
  get: vi.fn((tabId: number) => {
    return Promise.resolve({
      id: tabId,
      url: 'https://example.com',
      title: 'Example',
      active: true,
      pinned: false,
      windowId: 1,
      index: 0,
      status: 'complete' as const
    })
  }),
  query: vi.fn((queryInfo: any) => {
    return Promise.resolve([])
  }),
  update: vi.fn((tabId: number, updateProperties: any) => {
    return Promise.resolve({
      id: tabId,
      url: updateProperties.url ?? 'https://example.com',
      title: 'Updated Tab',
      active: true,
      pinned: false,
      windowId: 1,
      index: 0,
      status: 'complete' as const
    })
  })
}

const mockOnChanged = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
  hasListener: vi.fn(() => false)
}

globalThis.browser = {
  storage: {
    sync: mockBrowserStorage,
    local: mockBrowserStorage,
    session: mockBrowserStorage,
    onChanged: mockOnChanged
  },
  tabs: mockBrowserTabs
} as any

// Now import after browser is mocked
import {
  ExtensionError,
  ErrorCodes,
  safeAsync,
  withRetry,
  isValidUrl,
  isValidTabId,
  isValidDomain,
  normalizeDomain,
  safeStorage,
  safeTabs
} from '@/utils/error-handler'

describe('ExtensionError', () => {
  it('should create error with message and code', () => {
    const error = new ExtensionError('Test error', ErrorCodes.STORAGE_ERROR)

    expect(error.message).toBe('Test error')
    expect(error.code).toBe('STORAGE_ERROR')
    expect(error.name).toBe('ExtensionError')
  })

  it('should include details when provided', () => {
    const details = { tabId: 123, url: 'https://example.com' }
    const error = new ExtensionError('Test error', ErrorCodes.TAB_ERROR, details)

    expect(error.details).toEqual(details)
  })

  it('should have undefined details when not provided', () => {
    const error = new ExtensionError('Test error', ErrorCodes.NETWORK_ERROR)

    expect(error.details).toBeUndefined()
  })

  it('should be instanceof Error', () => {
    const error = new ExtensionError('Test error', ErrorCodes.VALIDATION_ERROR)

    expect(error instanceof Error).toBe(true)
  })

  it('should have stack trace', () => {
    const error = new ExtensionError('Test error', ErrorCodes.PERMISSION_ERROR)

    expect(error.stack).toBeDefined()
  })
})

describe('ErrorCodes', () => {
  it('should have all required error codes', () => {
    expect(ErrorCodes.STORAGE_ERROR).toBe('STORAGE_ERROR')
    expect(ErrorCodes.TAB_ERROR).toBe('TAB_ERROR')
    expect(ErrorCodes.NETWORK_ERROR).toBe('NETWORK_ERROR')
    expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
    expect(ErrorCodes.PERMISSION_ERROR).toBe('PERMISSION_ERROR')
  })
})

describe('safeAsync', () => {
  it('should return result when function succeeds', async () => {
    const mockFn = vi.fn().mockResolvedValue('success')

    const result = await safeAsync(mockFn)

    expect(result).toBe('success')
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should return null when function throws', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Test error'))

    const result = await safeAsync(mockFn)

    expect(result).toBeNull()
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should return null when function returns null', async () => {
    const mockFn = vi.fn().mockResolvedValue(null)

    const result = await safeAsync(mockFn)

    expect(result).toBeNull()
  })

  it('should call error handler when provided', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Test error'))
    const errorHandler = vi.fn()

    await safeAsync(mockFn, errorHandler)

    expect(errorHandler).toHaveBeenCalledWith(expect.any(Error))
  })

  it('should not call error handler on success', async () => {
    const mockFn = vi.fn().mockResolvedValue('success')
    const errorHandler = vi.fn()

    await safeAsync(mockFn, errorHandler)

    expect(errorHandler).not.toHaveBeenCalled()
  })

  it('should handle functions that return various types', async () => {
    const stringFn = vi.fn().mockResolvedValue('string')
    const numberFn = vi.fn().mockResolvedValue(42)
    const objectFn = vi.fn().mockResolvedValue({ key: 'value' })
    const arrayFn = vi.fn().mockResolvedValue([1, 2, 3])

    expect(await safeAsync(stringFn)).toBe('string')
    expect(await safeAsync(numberFn)).toBe(42)
    expect(await safeAsync(objectFn)).toEqual({ key: 'value' })
    expect(await safeAsync(arrayFn)).toEqual([1, 2, 3])
  })

  it('should log errors to console', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Test error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await safeAsync(mockFn)

    expect(consoleSpy).toHaveBeenCalledWith(
      'Async operation failed:',
      expect.any(Error)
    )

    consoleSpy.mockRestore()
  })
})

describe('isValidUrl', () => {
  it('should return true for valid HTTP URLs', () => {
    expect(isValidUrl('http://example.com')).toBe(true)
    expect(isValidUrl('http://www.example.com')).toBe(true)
    expect(isValidUrl('http://subdomain.example.com')).toBe(true)
  })

  it('should return true for valid HTTPS URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true)
    expect(isValidUrl('https://www.example.com')).toBe(true)
    expect(isValidUrl('https://subdomain.example.com')).toBe(true)
  })

  it('should return true for URLs with paths and query parameters', () => {
    expect(isValidUrl('https://example.com/path')).toBe(true)
    expect(isValidUrl('https://example.com/path/to/resource')).toBe(true)
    expect(isValidUrl('https://example.com?query=value')).toBe(true)
    expect(isValidUrl('https://example.com/path?query=value&other=123')).toBe(true)
  })

  it('should return true for URLs with ports', () => {
    expect(isValidUrl('https://example.com:8080')).toBe(true)
    expect(isValidUrl('https://example.com:443/path')).toBe(true)
  })

  it('should return false for FTP URLs', () => {
    expect(isValidUrl('ftp://example.com')).toBe(false)
  })

  it('should return false for invalid URLs', () => {
    expect(isValidUrl('not-a-url')).toBe(false)
    expect(isValidUrl('example.com')).toBe(false)
    expect(isValidUrl('')).toBe(false)
    expect(isValidUrl('javascript:alert(1)')).toBe(false)
    expect(isValidUrl('data:text/html,<script>')).toBe(false)
  })

  it('should return false for malformed URLs', () => {
    expect(isValidUrl('https://')).toBe(false)
    expect(isValidUrl('http://')).toBe(false)
    expect(isValidUrl('https://example com')).toBe(false)
  })
})

describe('isValidTabId', () => {
  it('should return true for positive integers', () => {
    expect(isValidTabId(1)).toBe(true)
    expect(isValidTabId(100)).toBe(true)
    expect(isValidTabId(999999)).toBe(true)
  })

  it('should return false for zero', () => {
    expect(isValidTabId(0)).toBe(false)
  })

  it('should return false for negative numbers', () => {
    expect(isValidTabId(-1)).toBe(false)
    expect(isValidTabId(-100)).toBe(false)
  })

  it('should return false for decimal numbers', () => {
    expect(isValidTabId(1.5)).toBe(false)
    expect(isValidTabId(10.99)).toBe(false)
  })

  it('should return false for non-numbers', () => {
    expect(isValidTabId(NaN)).toBe(false)
    expect(isValidTabId(Infinity)).toBe(false)
  })
})

describe('isValidDomain', () => {
  it('should return true for valid domains', () => {
    expect(isValidDomain('example.com')).toBe(true)
    expect(isValidDomain('www.example.com')).toBe(true)
    expect(isValidDomain('subdomain.example.com')).toBe(true)
    expect(isValidDomain('deep.subdomain.example.com')).toBe(true)
  })

  it('should return true for domains with hyphens', () => {
    expect(isValidDomain('my-domain.com')).toBe(true)
    expect(isValidDomain('sub-domain.example.com')).toBe(true)
  })

  it('should return true for numeric domains', () => {
    expect(isValidDomain('123.com')).toBe(true)
    expect(isValidDomain('sub123.example456.com')).toBe(true)
  })

  it('should return false for domains starting with hyphen', () => {
    expect(isValidDomain('-example.com')).toBe(false)
    expect(isValidDomain('sub.-example.com')).toBe(false)
  })

  it('should return false for domains ending with hyphen', () => {
    expect(isValidDomain('example-.com')).toBe(false)
    expect(isValidDomain('sub.example-.com')).toBe(false)
  })

  it('should return false for domains with consecutive dots', () => {
    expect(isValidDomain('example..com')).toBe(false)
    expect(isValidDomain('sub..example.com')).toBe(false)
  })

  it('should return false for domains starting with dot', () => {
    expect(isValidDomain('.example.com')).toBe(false)
  })

  it('should return false for domains ending with dot', () => {
    expect(isValidDomain('example.com.')).toBe(false)
  })

  it('should return false for domains exceeding 253 characters', () => {
    const longDomain = 'a'.repeat(254) + '.com'
    expect(isValidDomain(longDomain)).toBe(false)
  })

  it('should return false for labels exceeding 63 characters', () => {
    const longLabel = 'a'.repeat(64)
    expect(isValidDomain(`${longLabel}.com`)).toBe(false)
  })

  it('should return false for empty or invalid input', () => {
    expect(isValidDomain('')).toBe(false)
    expect(isValidDomain(' ')).toBe(false)
    expect(isValidDomain(undefined as any)).toBe(false)
    expect(isValidDomain(null as any)).toBe(false)
    expect(isValidDomain(123 as any)).toBe(false)
  })

  it('should handle URLs and extract domain', () => {
    expect(isValidDomain('https://example.com')).toBe(true)
    expect(isValidDomain('https://subdomain.example.com/path')).toBe(true)
  })
})

describe('normalizeDomain', () => {
  it('should return normalized domain for full URLs', () => {
    expect(normalizeDomain('https://example.com')).toBe('example.com')
    expect(normalizeDomain('http://example.com')).toBe('example.com')
  })

  it('should remove paths from URLs', () => {
    expect(normalizeDomain('https://example.com/path')).toBe('example.com')
    expect(normalizeDomain('https://example.com/path/to/resource')).toBe('example.com')
  })

  it('should remove ports', () => {
    expect(normalizeDomain('https://example.com:8080')).toBe('example.com')
    expect(normalizeDomain('https://subdomain.example.com:443/path')).toBe('subdomain.example.com')
  })

  it('should convert to lowercase', () => {
    expect(normalizeDomain('EXAMPLE.COM')).toBe('example.com')
    expect(normalizeDomain('SuBdOmAiN.ExAmPlE.cOm')).toBe('subdomain.example.com')
  })

  it('should trim whitespace', () => {
    expect(normalizeDomain('  example.com  ')).toBe('example.com')
    expect(normalizeDomain('\texample.com\n')).toBe('example.com')
  })

  it('should handle already normalized domains', () => {
    expect(normalizeDomain('example.com')).toBe('example.com')
    expect(normalizeDomain('subdomain.example.com')).toBe('subdomain.example.com')
  })

  it('should return empty string for invalid input', () => {
    expect(normalizeDomain('')).toBe('')
    expect(normalizeDomain(undefined as any)).toBe('')
    expect(normalizeDomain(null as any)).toBe('')
  })
})

describe('safeStorage', () => {
  beforeEach(() => {
    globalThis.browser = {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ key: 'value' }),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined)
        }
      }
    } as any
  })

  it('should get data from storage', async () => {
    const mockData = { key1: 'value1', key2: 'value2' }
    ;(browser.storage.sync.get as any).mockResolvedValue(mockData)

    const result = await safeStorage.get<string>(['key1', 'key2'])

    expect(result).toEqual(mockData)
    expect(browser.storage.sync.get).toHaveBeenCalledWith(['key1', 'key2'])
  })

  it('should throw ExtensionError on get failure', async () => {
    const testError = new Error('Storage error')
    ;(browser.storage.sync.get as any).mockRejectedValue(testError)

    await expect(safeStorage.get(['key'])).rejects.toThrow(ExtensionError)

    try {
      await safeStorage.get(['key'])
    } catch (error) {
      expect((error as ExtensionError).code).toBe(ErrorCodes.STORAGE_ERROR)
      expect((error as ExtensionError).details).toBe(testError)
    }
  })

  it('should set data in storage', async () => {
    const data = { key: 'value' }

    await safeStorage.set(data)

    expect(browser.storage.sync.set).toHaveBeenCalledWith(data)
  })

  it('should throw ExtensionError on set failure', async () => {
    const testError = new Error('Storage error')
    ;(browser.storage.sync.set as any).mockRejectedValue(testError)

    await expect(safeStorage.set({ key: 'value' })).rejects.toThrow(ExtensionError)

    try {
      await safeStorage.set({ key: 'value' })
    } catch (error) {
      expect((error as ExtensionError).code).toBe(ErrorCodes.STORAGE_ERROR)
    }
  })

  it('should remove data from storage', async () => {
    const keys = ['key1', 'key2']

    await safeStorage.remove(keys)

    expect(browser.storage.sync.remove).toHaveBeenCalledWith(keys)
  })

  it('should throw ExtensionError on remove failure', async () => {
    const testError = new Error('Storage error')
    ;(browser.storage.sync.remove as any).mockRejectedValue(testError)

    await expect(safeStorage.remove(['key'])).rejects.toThrow(ExtensionError)

    try {
      await safeStorage.remove(['key'])
    } catch (error) {
      expect((error as ExtensionError).code).toBe(ErrorCodes.STORAGE_ERROR)
    }
  })
})

describe('safeTabs', () => {
  beforeEach(() => {
    globalThis.browser = {
      tabs: {
        get: vi.fn().mockResolvedValue({ id: 1, url: 'https://example.com' }),
        query: vi.fn().mockResolvedValue([{ id: 1, url: 'https://example.com' }]),
        update: vi.fn().mockResolvedValue({ id: 1, url: 'https://updated.com' })
      }
    } as any
  })

  it('should get tab by ID', async () => {
    const tab = { id: 1, url: 'https://example.com' }
    ;(browser.tabs.get as any).mockResolvedValue(tab)

    const result = await safeTabs.get(1)

    expect(result).toEqual(tab)
    expect(browser.tabs.get).toHaveBeenCalledWith(1)
  })

  it('should throw ExtensionError for invalid tab ID', async () => {
    await expect(safeTabs.get(0)).rejects.toThrow(ExtensionError)
    await expect(safeTabs.get(-1)).rejects.toThrow(ExtensionError)

    try {
      await safeTabs.get(0)
    } catch (error) {
      expect((error as ExtensionError).code).toBe(ErrorCodes.VALIDATION_ERROR)
    }
  })

  it('should throw ExtensionError on get failure', async () => {
    const testError = new Error('Tab not found')
    ;(browser.tabs.get as any).mockRejectedValue(testError)

    await expect(safeTabs.get(1)).rejects.toThrow(ExtensionError)

    try {
      await safeTabs.get(1)
    } catch (error) {
      expect((error as ExtensionError).code).toBe(ErrorCodes.TAB_ERROR)
    }
  })

  it('should query tabs', async () => {
    const tabs = [
      { id: 1, url: 'https://example.com' },
      { id: 2, url: 'https://test.com' }
    ]
    ;(browser.tabs.query as any).mockResolvedValue(tabs)

    const queryInfo = { active: true }
    const result = await safeTabs.query(queryInfo)

    expect(result).toEqual(tabs)
    expect(browser.tabs.query).toHaveBeenCalledWith(queryInfo)
  })

  it('should throw ExtensionError on query failure', async () => {
    const testError = new Error('Query failed')
    ;(browser.tabs.query as any).mockRejectedValue(testError)

    await expect(safeTabs.query({ active: true })).rejects.toThrow(ExtensionError)

    try {
      await safeTabs.query({ active: true })
    } catch (error) {
      expect((error as ExtensionError).code).toBe(ErrorCodes.TAB_ERROR)
    }
  })

  it('should update tab', async () => {
    const updateProperties = { url: 'https://updated.com' }
    const updatedTab = { id: 1, url: 'https://updated.com' }
    ;(browser.tabs.update as any).mockResolvedValue(updatedTab)

    const result = await safeTabs.update(1, updateProperties)

    expect(result).toEqual(updatedTab)
    expect(browser.tabs.update).toHaveBeenCalledWith(1, updateProperties)
  })

  it('should throw ExtensionError for invalid tab ID on update', async () => {
    await expect(safeTabs.update(0, { url: 'https://example.com' }))
      .rejects.toThrow(ExtensionError)

    try {
      await safeTabs.update(0, { url: 'https://example.com' })
    } catch (error) {
      expect((error as ExtensionError).code).toBe(ErrorCodes.VALIDATION_ERROR)
    }
  })

  it('should throw ExtensionError on update failure', async () => {
    const testError = new Error('Update failed')
    ;(browser.tabs.update as any).mockRejectedValue(testError)

    await expect(safeTabs.update(1, { url: 'https://example.com' }))
      .rejects.toThrow(ExtensionError)

    try {
      await safeTabs.update(1, { url: 'https://example.com' })
    } catch (error) {
      expect((error as ExtensionError).code).toBe(ErrorCodes.TAB_ERROR)
    }
  })
})
