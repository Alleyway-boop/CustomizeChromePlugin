/**
 * 性能优化工具模块
 */

import { safeAsync } from './error-handler';

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;

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
 * 节流函数
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
 * 内存使用监控
 */
export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private callbacks: ((usage: any) => void)[] = [];
  private intervalId?: number;

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

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

  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  onMemoryUpdate(callback: (usage: any) => void): void {
    this.callbacks.push(callback);
  }

  removeCallback(callback: (usage: any) => void): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }
}

/**
 * 性能指标收集器
 */
export class PerformanceCollector {
  private metrics: Map<string, number[]> = new Map();
  private timestamps: Map<string, number> = new Map();

  startTimer(key: string): void {
    this.timestamps.set(key, Date.now());
  }

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

  getAverage(key: string): number | null {
    const metrics = this.metrics.get(key);
    if (!metrics || metrics.length === 0) return null;

    const sum = metrics.reduce((acc, val) => acc + val, 0);
    return sum / metrics.length;
  }

  getMax(key: string): number | null {
    const metrics = this.metrics.get(key);
    if (!metrics || metrics.length === 0) return null;

    return Math.max(...metrics);
  }

  getMin(key: string): number | null {
    const metrics = this.metrics.get(key);
    if (!metrics || metrics.length === 0) return null;

    return Math.min(...metrics);
  }

  getMetrics(key: string): number[] {
    return this.metrics.get(key) || [];
  }

  clearMetrics(key?: string): void {
    if (key) {
      this.metrics.delete(key);
    } else {
      this.metrics.clear();
    }
  }
}

/**
 * 智能调度器
 */
export class SmartScheduler {
  private tasks: Map<string, { 
    fn: () => Promise<void>; 
    interval: number; 
    lastRun: number;
    enabled: boolean;
  }> = new Map();
  private intervalId?: number;

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

  removeTask(id: string): void {
    this.tasks.delete(id);
  }

  enableTask(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.enabled = true;
    }
  }

  disableTask(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.enabled = false;
    }
  }

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

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }
}

/**
 * 缓存管理器
 */
export class CacheManager<T> {
  private cache: Map<string, { data: T; timestamp: number; ttl: number }> = new Map();
  private cleanupInterval?: number;

  constructor(private defaultTTL: number = 300000) { // 5分钟默认TTL

  }

  set(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

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

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
}