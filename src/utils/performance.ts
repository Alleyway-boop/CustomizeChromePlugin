/**
 * Performance optimization utility module
 * Provides debounce, throttle, caching, and scheduling utilities
 */

import browser from 'webextension-polyfill';
import { safeAsync } from './error-handler';

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked
 *
 * @template T - Function type to debounce
 * @param func - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @returns A new debounced function
 *
 * @example
 * const debouncedSearch = debounce((query: string) => {
 *   performSearch(query);
 * }, 300);
 *
 * debouncedSearch('test'); // Only executes after 300ms of no calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds
 *
 * @template T - Function type to throttle
 * @param func - The function to throttle
 * @param limit - The number of milliseconds to throttle invocations to
 * @returns A new throttled function
 *
 * @example
 * const throttledScroll = throttle(() => {
 *   updateScrollPosition();
 * }, 100);
 *
 * window.addEventListener('scroll', throttledScroll);
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Monitors browser memory usage and notifies subscribers of changes
 * Only works in browsers that support the system.memory API
 *
 * @example
 * const monitor = MemoryMonitor.getInstance();
 * monitor.onMemoryUpdate((usage) => {
 *   console.log('Memory usage:', usage);
 * });
 * monitor.startMonitoring(30000); // Check every 30 seconds
 */
export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private callbacks: ((usage: any) => void)[] = [];
  private intervalId?: ReturnType<typeof setInterval>;

    /**
     * Gets the singleton MemoryMonitor instance
     * Creates a new instance if one doesn't exist
     *
     * @returns The MemoryMonitor singleton instance
     */
    static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

    /**
     * Starts monitoring memory usage at the specified interval
     *
     * @param interval - Monitoring interval in milliseconds (default: 30000)
     */
    startMonitoring(interval: number = 30000): void {
    if (this.intervalId) {
      this.stopMonitoring();
    }

    this.intervalId = setInterval(async () => {
      const memoryInfo = await safeAsync(() => 
        (browser as any).system.memory.getInfo()
      );
      
      if (memoryInfo) {
        this.callbacks.forEach(callback => callback(memoryInfo));
      }
    }, interval);
  }

    /** Stops monitoring memory usage */
    stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

    /**
     * Adds a callback to be invoked when memory usage is updated
     *
     * @param callback - Function to call with memory usage data
     */
    onMemoryUpdate(callback: (usage: any) => void): void {
    this.callbacks.push(callback);
  }

    /**
     * Removes a previously added callback
     *
     * @param callback - The callback function to remove
     */
    removeCallback(callback: (usage: any) => void): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }
}

/**
 * Collects and analyzes performance metrics for operations
 * Tracks timing data and provides statistics (average, min, max)
 *
 * @example
 * const collector = new PerformanceCollector();
 *
 * collector.startTimer('operation');
 * // ... do work ...
 * const duration = collector.endTimer('operation');
 *
 * console.log('Average:', collector.getAverage('operation'));
 * console.log('Max:', collector.getMax('operation'));
 */
export class PerformanceCollector {
  private metrics: Map<string, number[]> = new Map();
  private timestamps: Map<string, number> = new Map();

  /**
   * Starts timing an operation with the given key
   *
   * @param key - Unique identifier for the timed operation
   */
  startTimer(key: string): void {
    this.timestamps.set(key, Date.now());
  }

  /**
   * Ends timing an operation and records the duration
   *
   * @param key - The identifier used when starting the timer
   * @returns The duration in milliseconds, or null if timer wasn't started
   */
  endTimer(key: string): number | null {
    const startTime = this.timestamps.get(key);
    if (!startTime) return null;

    const duration = Date.now() - startTime;
    this.timestamps.delete(key);

    const metrics = this.metrics.get(key) || [];
    metrics.push(duration);
    this.metrics.set(key, metrics);

    return duration;
  }

  /**
   * Calculates the average duration for an operation
   *
   * @param key - The operation identifier
   * @returns Average duration in milliseconds, or null if no data
   */
  getAverage(key: string): number | null {
    const metrics = this.metrics.get(key);
    if (!metrics || metrics.length === 0) return null;

    const sum = metrics.reduce((acc, val) => acc + val, 0);
    return sum / metrics.length;
  }

  /**
   * Gets the maximum duration recorded for an operation
   *
   * @param key - The operation identifier
   * @returns Maximum duration in milliseconds, or null if no data
   */
  getMax(key: string): number | null {
    const metrics = this.metrics.get(key);
    if (!metrics || metrics.length === 0) return null;

    return Math.max(...metrics);
  }

  /**
   * Gets the minimum duration recorded for an operation
   *
   * @param key - The operation identifier
   * @returns Minimum duration in milliseconds, or null if no data
   */
  getMin(key: string): number | null {
    const metrics = this.metrics.get(key);
    if (!metrics || metrics.length === 0) return null;

    return Math.min(...metrics);
  }

  /**
   * Gets all recorded durations for an operation
   *
   * @param key - The operation identifier
   * @returns Array of durations in milliseconds
   */
  getMetrics(key: string): number[] {
    return this.metrics.get(key) || [];
  }

  /**
   * Clears recorded metrics for a specific operation or all operations
   *
   * @param key - Optional operation identifier to clear, clears all if omitted
   */
  clearMetrics(key?: string): void {
    if (key) {
      this.metrics.delete(key);
    } else {
      this.metrics.clear();
    }
  }
}

/**
 * Intelligent task scheduler for managing periodic operations
 * Optimizes by checking multiple tasks on a single interval
 *
 * @example
 * const scheduler = new SmartScheduler();
 *
 * scheduler.addTask('checkTabs', async () => {
 *   await checkAndFreezeTabs();
 * }, 60000); // Run every 60 seconds
 *
 * scheduler.start(1000); // Check every second if tasks need to run
 */
export class SmartScheduler {
  private tasks: Map<string, { 
    fn: () => Promise<void>; 
    interval: number; 
    lastRun: number;
    enabled: boolean;
  }> = new Map();
  private intervalId?: ReturnType<typeof setInterval>;

  /**
   * Adds a task to the scheduler
   *
   * @param id - Unique identifier for the task
   * @param fn - Async function to execute
   * @param interval - Minimum time between executions in milliseconds
   * @param enabled - Whether the task is initially enabled (default: true)
   */
  addTask(
    id: string,
    fn: () => Promise<void>,
    interval: number,
    enabled: boolean = true
  ): void {
    this.tasks.set(id, {
      fn,
      interval,
      lastRun: 0,
      enabled
    });
  }

  /**
   * Removes a task from the scheduler
   *
   * @param id - The task identifier to remove
   */
  removeTask(id: string): void {
    this.tasks.delete(id);
  }

  /**
   * Enables a previously disabled task
   *
   * @param id - The task identifier to enable
   */
  enableTask(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.enabled = true;
    }
  }

  /**
   * Disables a task without removing it
   *
   * @param id - The task identifier to disable
   */
  disableTask(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.enabled = false;
    }
  }

  /**
   * Starts the scheduler
   *
   * @param checkInterval - How often to check for tasks to run (default: 1000ms)
   */
  start(checkInterval: number = 1000): void {
    if (this.intervalId) {
      this.stop();
    }

    this.intervalId = setInterval(() => {
      const now = Date.now();
      
      this.tasks.forEach((task, id) => {
        if (task.enabled && now - task.lastRun >= task.interval) {
          task.lastRun = now;
          safeAsync(() => task.fn());
        }
      });
    }, checkInterval);
  }

  /** Stops the scheduler */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }
}

/**
 * Generic cache manager with TTL (Time To Live) support
 * Automatically expires entries after their TTL expires
 *
 * @template T - The type of data to cache
 *
 * @example
 * const cache = new CacheManager<UserData>(300000); // 5 minute TTL
 *
 * cache.set('user123', userData);
 * const cached = cache.get('user123');
 * if (cached) {
 *   console.log('Hit!', cached);
 * } else {
 *   console.log('Miss or expired');
 * }
 */
export class CacheManager<T> {
  private cache: Map<string, { data: T; timestamp: number; ttl: number }> = new Map();
  private cleanupInterval?: ReturnType<typeof setInterval>;

  /**
   * Creates a new cache manager
   *
   * @param defaultTTL - Default time-to-live for cached items (default: 300000ms = 5 minutes)
   */
  constructor(private defaultTTL: number = 300000) { }

  /**
   * Stores data in the cache with a TTL
   *
   * @param key - Unique identifier for the cached data
   * @param data - The data to cache
   * @param ttl - Time-to-live in milliseconds (uses default if not specified)
   */
  set(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Retrieves data from the cache
   * Returns null if the key doesn't exist or the entry has expired
   *
   * @param key - The cache key to retrieve
   * @returns The cached data, or null if not found or expired
   */
  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * Checks if a key exists in the cache and hasn't expired
   *
   * @param key - The cache key to check
   * @returns true if the key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Removes a specific entry from the cache
   *
   * @param key - The cache key to delete
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /** Clears all entries from the cache */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Starts automatic cleanup of expired entries
   *
   * @param interval - Cleanup interval in milliseconds (default: 60000)
   */
  startCleanup(interval: number = 60000): void {
    if (this.cleanupInterval) {
      this.stopCleanup();
    }

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      this.cache.forEach((item, key) => {
        if (now - item.timestamp > item.ttl) {
          this.cache.delete(key);
        }
      });
    }, interval);
  }

  /** Stops automatic cleanup */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
}