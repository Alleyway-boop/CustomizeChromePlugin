/**
 * Performance Utilities Unit Tests
 * Tests for performance optimization utilities including:
 * - debounce function
 * - throttle function
 * - MemoryMonitor class
 * - PerformanceCollector class
 * - SmartScheduler class
 * - CacheManager class
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Setup browser mock before importing performance
const mockBrowserSystem = {
  memory: {
    getInfo: vi.fn(() => Promise.resolve({
      capacity: 8000000000,
      capacityBias: 0.5,
      availableCapacity: 4000000000
    }))
  }
}

globalThis.browser = {
  system: mockBrowserSystem
} as any

// Now import after browser is mocked
import {
  debounce,
  throttle,
  MemoryMonitor,
  PerformanceCollector,
  SmartScheduler,
  CacheManager
} from '@/utils/performance'

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should delay function execution', () => {
    const mockFn = vi.fn()
    const debouncedFn = debounce(mockFn, 300)

    debouncedFn()

    expect(mockFn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300)

    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should reset timer on subsequent calls', () => {
    const mockFn = vi.fn()
    const debouncedFn = debounce(mockFn, 300)

    debouncedFn()
    vi.advanceTimersByTime(200)

    debouncedFn()
    vi.advanceTimersByTime(200)

    expect(mockFn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)

    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should pass arguments to debounced function', () => {
    const mockFn = vi.fn()
    const debouncedFn = debounce(mockFn, 100)

    debouncedFn('arg1', 'arg2', 42)

    vi.advanceTimersByTime(100)

    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 42)
  })

  it('should handle multiple rapid calls', () => {
    const mockFn = vi.fn()
    const debouncedFn = debounce(mockFn, 200)

    for (let i = 0; i < 10; i++) {
      debouncedFn(i)
    }

    vi.advanceTimersByTime(200)

    expect(mockFn).toHaveBeenCalledTimes(1)
    expect(mockFn).toHaveBeenCalledWith(9)
  })

  it('should execute with last call arguments', () => {
    const mockFn = vi.fn()
    const debouncedFn = debounce(mockFn, 100)

    debouncedFn('first')
    debouncedFn('second')
    debouncedFn('third')

    vi.advanceTimersByTime(100)

    expect(mockFn).toHaveBeenCalledTimes(1)
    expect(mockFn).toHaveBeenCalledWith('third')
  })

  it('should work with zero wait time', () => {
    const mockFn = vi.fn()
    const debouncedFn = debounce(mockFn, 0)

    debouncedFn()

    vi.advanceTimersByTime(0)

    expect(mockFn).toHaveBeenCalledTimes(1)
  })
})

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should execute function immediately on first call', () => {
    const mockFn = vi.fn()
    const throttledFn = throttle(mockFn, 100)

    throttledFn()

    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should not execute again within limit period', () => {
    const mockFn = vi.fn()
    const throttledFn = throttle(mockFn, 100)

    throttledFn()
    throttledFn()
    throttledFn()

    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should execute again after limit period', () => {
    const mockFn = vi.fn()
    const throttledFn = throttle(mockFn, 100)

    throttledFn()
    expect(mockFn).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(100)

    throttledFn()
    expect(mockFn).toHaveBeenCalledTimes(2)
  })

  it('should pass arguments to throttled function', () => {
    const mockFn = vi.fn()
    const throttledFn = throttle(mockFn, 100)

    throttledFn('arg1', 'arg2')

    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2')
  })

  it('should reset throttle state after limit', () => {
    const mockFn = vi.fn()
    const throttledFn = throttle(mockFn, 100)

    throttledFn('first')
    vi.advanceTimersByTime(100)
    throttledFn('second')

    expect(mockFn).toHaveBeenCalledTimes(2)
  })

  it('should execute periodically when called repeatedly', () => {
    const mockFn = vi.fn()
    const throttledFn = throttle(mockFn, 100)

    for (let i = 0; i < 5; i++) {
      throttledFn(i)
      vi.advanceTimersByTime(50)
    }

    // Should execute at 0, 100, 200 (3 times)
    expect(mockFn.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})

describe('MemoryMonitor', () => {
  let monitor: MemoryMonitor

  beforeEach(() => {
    monitor = MemoryMonitor.getInstance()
    monitor.stopMonitoring()
    // Clear callbacks
    ;(monitor as any).callbacks = []
  })

  afterEach(() => {
    monitor.stopMonitoring()
    vi.restoreAllMocks()
  })

  it('should return singleton instance', () => {
    const instance1 = MemoryMonitor.getInstance()
    const instance2 = MemoryMonitor.getInstance()

    expect(instance1).toBe(instance2)
  })

  it('should remove callback', () => {
    const callback = vi.fn()

    monitor.onMemoryUpdate(callback)
    monitor.removeCallback(callback)

    expect((monitor as any).callbacks.length).toBe(0)
  })
})

describe('PerformanceCollector', () => {
  let collector: PerformanceCollector

  beforeEach(() => {
    collector = new PerformanceCollector()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should start timer for operation', () => {
    collector.startTimer('operation')

    expect(collector['timestamps'].has('operation')).toBe(true)
  })

  it('should end timer and return duration', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    collector.startTimer('operation')
    vi.setSystemTime(1500)

    const duration = collector.endTimer('operation')

    expect(duration).toBe(500)
    expect(collector['timestamps'].has('operation')).toBe(false)
    vi.useRealTimers()
  })

  it('should return null when ending non-existent timer', () => {
    const duration = collector.endTimer('non-existent')

    expect(duration).toBeNull()
  })

  it('should return null for average when no metrics exist', () => {
    expect(collector.getAverage('non-existent')).toBeNull()
  })

  it('should return null for max when no metrics exist', () => {
    expect(collector.getMax('non-existent')).toBeNull()
  })

  it('should return null for min when no metrics exist', () => {
    expect(collector.getMin('non-existent')).toBeNull()
  })

  it('should return empty array for non-existent metrics', () => {
    expect(collector.getMetrics('non-existent')).toEqual([])
  })

  it('should clear specific metrics', () => {
    // Manually add metrics for testing
    collector['metrics'].set('op1', [100, 200])
    collector['metrics'].set('op2', [300])

    collector.clearMetrics('op1')

    expect(collector.getMetrics('op1')).toEqual([])
    expect(collector.getMetrics('op2')).toEqual([300])
  })

  it('should clear all metrics when no key specified', () => {
    collector['metrics'].set('op1', [100])
    collector['metrics'].set('op2', [200])

    collector.clearMetrics()

    expect(collector.getMetrics('op1')).toEqual([])
    expect(collector.getMetrics('op2')).toEqual([])
  })
})

describe('SmartScheduler', () => {
  let scheduler: SmartScheduler

  beforeEach(() => {
    scheduler = new SmartScheduler()
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    scheduler.stop()
    vi.useRealTimers()
  })

  it('should add task', () => {
    const mockFn = vi.fn().mockResolvedValue(undefined)

    scheduler.addTask('task1', mockFn, 1000)

    expect(scheduler['tasks'].has('task1')).toBe(true)
  })

  it('should add task with enabled flag', () => {
    const mockFn = vi.fn().mockResolvedValue(undefined)

    scheduler.addTask('task1', mockFn, 1000, false)

    const task = scheduler['tasks'].get('task1')
    expect(task?.enabled).toBe(false)
  })

  it('should start scheduler and execute tasks', () => {
    const mockFn = vi.fn().mockResolvedValue(undefined)

    scheduler.addTask('task1', mockFn, 1000)
    scheduler.start(100)

    vi.advanceTimersByTime(1000)

    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should execute multiple tasks', () => {
    const mockFn1 = vi.fn().mockResolvedValue(undefined)
    const mockFn2 = vi.fn().mockResolvedValue(undefined)

    scheduler.addTask('task1', mockFn1, 1000)
    scheduler.addTask('task2', mockFn2, 1000)

    scheduler.start(100)

    vi.advanceTimersByTime(1000)

    expect(mockFn1).toHaveBeenCalled()
    expect(mockFn2).toHaveBeenCalled()
  })

  it('should respect task intervals', () => {
    const mockFn = vi.fn().mockResolvedValue(undefined)

    scheduler.addTask('task1', mockFn, 2000)

    scheduler.start(100)

    vi.advanceTimersByTime(1000)
    expect(mockFn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should not execute disabled tasks', () => {
    const mockFn = vi.fn().mockResolvedValue(undefined)

    scheduler.addTask('task1', mockFn, 1000, false)

    scheduler.start(100)

    vi.advanceTimersByTime(2000)

    expect(mockFn).not.toHaveBeenCalled()
  })

  it('should enable task', () => {
    const mockFn = vi.fn().mockResolvedValue(undefined)

    scheduler.addTask('task1', mockFn, 1000, false)
    scheduler.enableTask('task1')

    const task = scheduler['tasks'].get('task1')
    expect(task?.enabled).toBe(true)
  })

  it('should disable task', () => {
    const mockFn = vi.fn().mockResolvedValue(undefined)

    scheduler.addTask('task1', mockFn, 1000)
    scheduler.disableTask('task1')

    const task = scheduler['tasks'].get('task1')
    expect(task?.enabled).toBe(false)
  })

  it('should remove task', () => {
    const mockFn = vi.fn().mockResolvedValue(undefined)

    scheduler.addTask('task1', mockFn, 1000)
    scheduler.removeTask('task1')

    expect(scheduler['tasks'].has('task1')).toBe(false)
  })

  it('should stop scheduler', () => {
    const mockFn = vi.fn().mockResolvedValue(undefined)

    scheduler.addTask('task1', mockFn, 1000)

    scheduler.start(100)
    scheduler.stop()

    vi.advanceTimersByTime(2000)

    expect(mockFn).not.toHaveBeenCalled()
  })

  it('should restart scheduler when start is called again', () => {
    const mockFn = vi.fn().mockResolvedValue(undefined)

    scheduler.addTask('task1', mockFn, 1000)

    scheduler.start(100)
    vi.advanceTimersByTime(1000)
    expect(mockFn).toHaveBeenCalledTimes(1)

    scheduler.start(100)
    vi.advanceTimersByTime(1000)
    expect(mockFn).toHaveBeenCalledTimes(2)
  })

  it('should use default check interval', () => {
    const mockFn = vi.fn().mockResolvedValue(undefined)

    scheduler.addTask('task1', mockFn, 1000)

    scheduler.start()

    vi.advanceTimersByTime(1000)

    expect(mockFn).toHaveBeenCalled()
  })

  it('should handle task errors gracefully', () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Task error'))

    scheduler.addTask('task1', mockFn, 1000)

    scheduler.start(100)

    vi.advanceTimersByTime(1000)

    expect(mockFn).toHaveBeenCalled()
  })
})

describe('CacheManager', () => {
  let cache: CacheManager<string>

  beforeEach(() => {
    cache = new CacheManager<string>(1000)
  })

  it('should set and get cached value', () => {
    cache.set('key1', 'value1')

    expect(cache.get('key1')).toBe('value1')
  })

  it('should return null for non-existent key', () => {
    expect(cache.get('non-existent')).toBeNull()
  })

  it('should check if key exists', () => {
    cache.set('key1', 'value1')

    expect(cache.has('key1')).toBe(true)
    expect(cache.has('non-existent')).toBe(false)
  })

  it('should delete specific key', () => {
    cache.set('key1', 'value1')
    cache.set('key2', 'value2')

    cache.delete('key1')

    expect(cache.get('key1')).toBeNull()
    expect(cache.get('key2')).toBe('value2')
  })

  it('should clear all entries', () => {
    cache.set('key1', 'value1')
    cache.set('key2', 'value2')
    cache.set('key3', 'value3')

    cache.clear()

    expect(cache.get('key1')).toBeNull()
    expect(cache.get('key2')).toBeNull()
    expect(cache.get('key3')).toBeNull()
  })

  it('should handle generic types', () => {
    interface UserData {
      name: string
      age: number
    }

    const userCache = new CacheManager<UserData>(1000)

    const userData: UserData = { name: 'John', age: 30 }
    userCache.set('user1', userData)

    expect(userCache.get('user1')).toEqual(userData)
  })

  it('should update existing key', () => {
    cache.set('key1', 'value1')
    cache.set('key1', 'value2')

    expect(cache.get('key1')).toBe('value2')
  })

  it('should expire entries after TTL', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)

    cache.set('key1', 'value1', 1000)

    vi.setSystemTime(999)
    expect(cache.get('key1')).toBe('value1')

    vi.setSystemTime(1001)
    expect(cache.get('key1')).toBeNull()

    vi.useRealTimers()
  })

  it('should start and stop cleanup', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)

    cache.set('key1', 'value1', 500)
    cache.startCleanup(200)

    vi.setSystemTime(700)

    expect(cache.has('key1')).toBe(false)

    cache.stopCleanup()
    vi.useRealTimers()
  })
})
