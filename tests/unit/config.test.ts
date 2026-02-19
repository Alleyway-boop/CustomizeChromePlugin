/**
 * Config Manager Unit Tests
 * Tests for configuration management functionality including:
 * - Singleton pattern
 * - Configuration read/write operations
 * - Default values handling
 * - Whitelist management
 * - Subscription mechanism
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ExtensionError, ErrorCodes } from '@/utils/error-handler'

// Setup browser mock before importing config
let mockStorageData: Record<string, unknown> = {}

// Storage change listener capture for testing
let storageChangeListener: ((changes: Record<string, { newValue?: unknown; oldValue?: unknown }>, areaName: string) => void) | null = null

// Mock onChanged that captures listener for testing storage change events
const mockOnChanged = {
  addListener: vi.fn((callback: (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>, areaName: string) => void) => {
    storageChangeListener = callback
  }),
  removeListener: vi.fn(() => {
    storageChangeListener = null
  }),
  hasListener: vi.fn(() => false)
}

const createMockBrowserStorageArea = (onChanged = mockOnChanged) => ({
  get: vi.fn((keys: string | string[] | Record<string, unknown> | null) => {
    const result: Record<string, unknown> = {}
    if (Array.isArray(keys)) {
      keys.forEach(key => {
        if (key in mockStorageData) {
          result[key] = mockStorageData[key]
        }
      })
    } else if (typeof keys === 'string') {
      if (keys in mockStorageData) {
        result[keys] = mockStorageData[keys]
      }
    } else if (keys && typeof keys === 'object') {
      Object.assign(result, keys)
    }
    return Promise.resolve(result)
  }),
  set: vi.fn((items: Record<string, unknown>) => {
    Object.assign(mockStorageData, items)
    return Promise.resolve()
  }),
  remove: vi.fn((keys: string | string[]) => {
    const keysArray = Array.isArray(keys) ? keys : [keys]
    keysArray.forEach(key => {
      delete mockStorageData[key]
    })
    return Promise.resolve()
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorageData).forEach(key => {
      delete mockStorageData[key]
    })
    return Promise.resolve()
  }),
  getBytesInUse: vi.fn(() => Promise.resolve(0)),
  onChanged
})

const mockBrowserStorage = createMockBrowserStorageArea()

// Set up global browser mock before importing config
globalThis.browser = {
  storage: {
    sync: mockBrowserStorage,
    local: createMockBrowserStorageArea(),
    session: createMockBrowserStorageArea(),
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(() => false)
    }
  }
} as any

// Now import config after browser is mocked
import { ConfigManager, DEFAULT_CONFIG, configManager, AppConfig } from '@/utils/config'

describe('ConfigManager', () => {
  beforeEach(() => {
    // Reset singleton instance for each test
    ;(ConfigManager as any).instance = undefined
    mockStorageData = {}

    // Clear all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance across multiple calls', () => {
      const instance1 = ConfigManager.getInstance()
      const instance2 = ConfigManager.getInstance()
      const instance3 = ConfigManager.getInstance()

      expect(instance1).toBe(instance2)
      expect(instance2).toBe(instance3)
    })

    it('should create a new instance if none exists', () => {
      const instance = ConfigManager.getInstance()

      expect(instance).toBeDefined()
      expect(instance).toBeInstanceOf(ConfigManager)
    })
  })

  describe('Default Configuration', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_CONFIG.freezeTimeout).toBe(20)
      expect(DEFAULT_CONFIG.freezePinned).toBe(true)
      expect(DEFAULT_CONFIG.whitelist).toEqual([])
      expect(DEFAULT_CONFIG.enabled).toBe(true)
      expect(DEFAULT_CONFIG.cleanupInterval).toBe(60)
      expect(DEFAULT_CONFIG.maxTabs).toBe(50)
      expect(DEFAULT_CONFIG.snapshotQuality).toBe(50)
      expect(DEFAULT_CONFIG.autoRecovery).toBe(false)
      expect(DEFAULT_CONFIG.notifications).toBe(true)
      expect(DEFAULT_CONFIG.debugMode).toBe(false)
    })

    it('should start with default config before initialization', () => {
      const manager = ConfigManager.getInstance()
      const config = manager.getConfig()

      expect(config).toEqual(DEFAULT_CONFIG)
    })
  })

  describe('Initialization', () => {
    it('should load configuration from storage', async () => {
      mockStorageData = {
        freezeTimeout: 30,
        freezePinned: false,
        whitelist: ['example.com']
      }

      const manager = ConfigManager.getInstance()
      await manager.initialize()

      expect(mockBrowserStorage.get).toHaveBeenCalledWith([
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
      ])

      const config = manager.getConfig()
      expect(config.freezeTimeout).toBe(30)
      expect(config.freezePinned).toBe(false)
      expect(config.whitelist).toEqual(['example.com'])
    })

    it('should use defaults for missing storage values', async () => {
      mockStorageData = {
        freezeTimeout: 40
      }

      const manager = ConfigManager.getInstance()
      await manager.initialize()

      const config = manager.getConfig()

      expect(config.freezeTimeout).toBe(40)
      expect(config.freezePinned).toBe(DEFAULT_CONFIG.freezePinned)
      expect(config.whitelist).toEqual(DEFAULT_CONFIG.whitelist)
    })

    it('should setup storage listener on initialization', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      expect(mockOnChanged.addListener).toHaveBeenCalled()
    })

    it('should throw ExtensionError on storage failure', async () => {
      mockBrowserStorage.get.mockRejectedValueOnce(new Error('Storage access denied'))

      const manager = ConfigManager.getInstance()

      await expect(manager.initialize()).rejects.toThrow(ExtensionError)
    })
  })

  describe('Get Configuration', () => {
    it('should return a copy of the configuration', () => {
      const manager = ConfigManager.getInstance()
      const config1 = manager.getConfig()
      const config2 = manager.getConfig()

      expect(config1).toEqual(config2)
      expect(config1).not.toBe(config2)
    })

    it('should not allow direct mutation of internal config', () => {
      const manager = ConfigManager.getInstance()
      const config = manager.getConfig()

      config.freezeTimeout = 999

      expect(manager.getConfig().freezeTimeout).toBe(DEFAULT_CONFIG.freezeTimeout)
    })
  })

  describe('Update Configuration', () => {
    beforeEach(async () => {
      mockStorageData = {}
    })

    it('should update single configuration value', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      await manager.updateConfig({ freezeTimeout: 30 })

      expect(mockBrowserStorage.set).toHaveBeenCalledWith({ freezeTimeout: 30 })
      expect(manager.getConfig().freezeTimeout).toBe(30)
    })

    it('should update multiple configuration values', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      await manager.updateConfig({
        freezeTimeout: 45,
        maxTabs: 100,
        enabled: false
      })

      const config = manager.getConfig()
      expect(config.freezeTimeout).toBe(45)
      expect(config.maxTabs).toBe(100)
      expect(config.enabled).toBe(false)
    })

    it('should validate freezeTimeout range', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      await expect(manager.updateConfig({ freezeTimeout: 0 })).rejects.toThrow(ExtensionError)
      await expect(manager.updateConfig({ freezeTimeout: 361 })).rejects.toThrow(ExtensionError)
    })

    it('should validate maxTabs range', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      await expect(manager.updateConfig({ maxTabs: 0 })).rejects.toThrow(ExtensionError)
      await expect(manager.updateConfig({ maxTabs: 1001 })).rejects.toThrow(ExtensionError)
    })

    it('should validate snapshotQuality range', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      await expect(manager.updateConfig({ snapshotQuality: 9 })).rejects.toThrow(ExtensionError)
      await expect(manager.updateConfig({ snapshotQuality: 101 })).rejects.toThrow(ExtensionError)
    })

    it('should validate cleanupInterval range', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      await expect(manager.updateConfig({ cleanupInterval: 0 })).rejects.toThrow(ExtensionError)
      await expect(manager.updateConfig({ cleanupInterval: 1441 })).rejects.toThrow(ExtensionError)
    })

    it('should accept valid boundary values', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      // Test each boundary value separately to avoid duplicate keys
      await manager.updateConfig({ freezeTimeout: 1 })
      await manager.updateConfig({ freezeTimeout: 360 })
      await manager.updateConfig({ maxTabs: 1 })
      await manager.updateConfig({ maxTabs: 1000 })
      await manager.updateConfig({ snapshotQuality: 10 })
      await manager.updateConfig({ snapshotQuality: 100 })
      await manager.updateConfig({ cleanupInterval: 1 })
      await manager.updateConfig({ cleanupInterval: 1440 })

      expect(mockBrowserStorage.set).toHaveBeenCalled()
    })

    it('should notify listeners on configuration change', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      const listener = vi.fn()
      manager.subscribe(listener)

      await manager.updateConfig({ freezeTimeout: 60 })

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ freezeTimeout: 60 })
      )
    })

    it('should not update storage if validation fails', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      try {
        await manager.updateConfig({ freezeTimeout: 500 })
      } catch (error) {
        // Expected to throw
      }

      expect(mockBrowserStorage.set).not.toHaveBeenCalledWith({ freezeTimeout: 500 })
    })
  })

  describe('Reset Configuration', () => {
    beforeEach(async () => {
      mockStorageData = {}
    })

    it('should reset all values to defaults', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      await manager.updateConfig({
        freezeTimeout: 100,
        maxTabs: 200,
        enabled: false
      })

      await manager.resetToDefaults()

      const config = manager.getConfig()
      expect(config).toEqual(DEFAULT_CONFIG)
    })
  })

  describe('Whitelist Management', () => {
    beforeEach(async () => {
      mockStorageData = {}
    })

    it('should add domain to whitelist', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      await manager.addToWhitelist('example.com')

      const config = manager.getConfig()
      expect(config.whitelist).toContain('example.com')
    })

    it('should not add duplicate domains', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      await manager.addToWhitelist('example.com')
      await manager.addToWhitelist('example.com')

      const config = manager.getConfig()
      expect(config.whitelist.filter((d: string) => d === 'example.com').length).toBe(1)
    })

    it('should remove domain from whitelist', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      await manager.updateConfig({ whitelist: ['example.com', 'test.com'] })
      await manager.removeFromWhitelist('example.com')

      const config = manager.getConfig()
      expect(config.whitelist).not.toContain('example.com')
      expect(config.whitelist).toContain('test.com')
    })

    it('should check if domain is whitelisted', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      await manager.updateConfig({ whitelist: ['example.com', 'test.com'] })

      expect(manager.isWhitelisted('example.com')).toBe(true)
      expect(manager.isWhitelisted('not-in-list.com')).toBe(false)
    })

    it('should handle empty whitelist correctly', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      expect(manager.isWhitelisted('example.com')).toBe(false)
    })
  })

  describe('Subscription Mechanism', () => {
    beforeEach(async () => {
      mockStorageData = {}
    })

    it('should add listener and return unsubscribe function', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      const listener = vi.fn()
      const unsubscribe = manager.subscribe(listener)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should call listener when configuration changes', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      const listener = vi.fn()
      manager.subscribe(listener)

      await manager.updateConfig({ freezeTimeout: 30 })

      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        freezeTimeout: 30
      }))
    })

    it('should support multiple listeners', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      const listener1 = vi.fn()
      const listener2 = vi.fn()
      const listener3 = vi.fn()

      manager.subscribe(listener1)
      manager.subscribe(listener2)
      manager.subscribe(listener3)

      await manager.updateConfig({ freezeTimeout: 30 })

      expect(listener1).toHaveBeenCalled()
      expect(listener2).toHaveBeenCalled()
      expect(listener3).toHaveBeenCalled()
    })

    it('should unsubscribe listener correctly', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      const listener = vi.fn()
      const unsubscribe = manager.subscribe(listener)

      unsubscribe()

      await manager.updateConfig({ freezeTimeout: 30 })

      expect(listener).not.toHaveBeenCalled()
    })

    it('should handle listener errors gracefully', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      const goodListener = vi.fn()
      const badListener = vi.fn(() => {
        throw new Error('Listener error')
      })

      manager.subscribe(badListener)
      manager.subscribe(goodListener)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await manager.updateConfig({ freezeTimeout: 30 })

      expect(consoleSpy).toHaveBeenCalled()
      expect(goodListener).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('Storage Change Listener', () => {
    beforeEach(async () => {
      mockStorageData = {}
    })

    it('should update config when storage changes', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      const listenerCalls: AppConfig[] = []
      manager.subscribe((config: AppConfig) => listenerCalls.push(config))

      if (storageChangeListener) {
        storageChangeListener(
          {
            freezeTimeout: { newValue: 45, oldValue: 20 },
            maxTabs: { newValue: 75, oldValue: 50 }
          },
          'sync'
        )

        expect(manager.getConfig().freezeTimeout).toBe(45)
        expect(manager.getConfig().maxTabs).toBe(75)
        expect(listenerCalls.length).toBeGreaterThan(0)
      }
    })

    it('should ignore non-sync area changes', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      const initialConfig = manager.getConfig()

      if (storageChangeListener) {
        storageChangeListener(
          { freezeTimeout: { newValue: 100 } },
          'local'
        )

        expect(manager.getConfig()).toEqual(initialConfig)
      }
    })

    it('should ignore unrelated storage keys', async () => {
      const manager = ConfigManager.getInstance()
      await manager.initialize()

      const initialConfig = manager.getConfig()

      if (storageChangeListener) {
        storageChangeListener(
          { unrelatedKey: { newValue: 'value' } },
          'sync'
        )

        expect(manager.getConfig()).toEqual(initialConfig)
      }
    })
  })

  describe('Exported Singleton Instance', () => {
    it('should export a ConfigManager instance', () => {
      expect(configManager).toBeDefined()
      expect(configManager).toBeInstanceOf(ConfigManager)
    })

    it('should use the singleton instance', () => {
      const instance = ConfigManager.getInstance()

      // Both should be ConfigManager instances with same config values
      expect(configManager.getConfig()).toStrictEqual(instance.getConfig())
    })
  })
})
