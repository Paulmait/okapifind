// @ts-nocheck
/**
 * Advanced Database Caching Service with LRU Implementation
 * Optimizes database queries and reduces latency
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { errorService, ErrorSeverity, ErrorCategory } from './errorService';
import NetInfo from '@react-native-community/netinfo';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
  size: number;
  key: string;
  expires: number;
  tags: string[];
}

interface CacheStatistics {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  entryCount: number;
  hitRate: number;
}

interface CacheOptions {
  maxSize: number; // Maximum cache size in bytes
  maxEntries: number; // Maximum number of entries
  defaultTTL: number; // Default time-to-live in milliseconds
  enableCompression: boolean;
  enablePersistence: boolean;
  compressionThreshold: number; // Minimum size for compression
}

class LRUCache<T = any> {
  private cache: Map<string, CacheEntry<T>>;
  private accessOrder: string[];
  private totalSize: number;
  private statistics: CacheStatistics;
  private readonly options: CacheOptions;

  constructor(options: Partial<CacheOptions> = {}) {
    this.cache = new Map();
    this.accessOrder = [];
    this.totalSize = 0;
    this.statistics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0,
      entryCount: 0,
      hitRate: 0,
    };

    this.options = {
      maxSize: options.maxSize || 10 * 1024 * 1024, // 10MB default
      maxEntries: options.maxEntries || 1000,
      defaultTTL: options.defaultTTL || 5 * 60 * 1000, // 5 minutes
      enableCompression: options.enableCompression !== false,
      enablePersistence: options.enablePersistence !== false,
      compressionThreshold: options.compressionThreshold || 1024, // 1KB
    };

    if (this.options.enablePersistence) {
      this.loadFromPersistence();
    }
  }

  /**
   * Get item from cache
   */
  async get(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.statistics.misses++;
      this.updateHitRate();
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.delete(key);
      this.statistics.misses++;
      this.updateHitRate();
      return null;
    }

    // Update access order (LRU)
    this.updateAccessOrder(key);
    entry.hits++;
    this.statistics.hits++;
    this.updateHitRate();

    // Decompress if needed
    if (this.options.enableCompression && this.isCompressed(entry.data)) {
      return this.decompress(entry.data);
    }

    return entry.data;
  }

  /**
   * Set item in cache
   */
  async set(
    key: string,
    data: T,
    options: {
      ttl?: number;
      tags?: string[];
      priority?: 'low' | 'normal' | 'high';
    } = {}
  ): Promise<void> {
    const ttl = options.ttl || this.options.defaultTTL;
    const expires = Date.now() + ttl;

    // Calculate data size
    const dataSize = this.calculateSize(data);

    // Compress if needed
    let storedData = data;
    if (this.options.enableCompression && dataSize > this.options.compressionThreshold) {
      storedData = await this.compress(data);
    }

    // Check if we need to evict entries
    await this.ensureSpace(dataSize, options.priority);

    const entry: CacheEntry<T> = {
      data: storedData,
      timestamp: Date.now(),
      hits: 0,
      size: dataSize,
      key,
      expires,
      tags: options.tags || [],
    };

    // Remove old entry if exists
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key)!;
      this.totalSize -= oldEntry.size;
    }

    this.cache.set(key, entry);
    this.totalSize += dataSize;
    this.updateAccessOrder(key);
    this.updateStatistics();

    if (this.options.enablePersistence) {
      await this.persistEntry(key, entry);
    }
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.totalSize -= entry.size;
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.updateStatistics();

    if (this.options.enablePersistence) {
      this.removeFromPersistence(key);
    }

    return true;
  }

  /**
   * Clear cache by tags
   */
  clearByTags(tags: string[]): number {
    let cleared = 0;
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (tags.some(tag => entry.tags.includes(tag))) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      if (this.delete(key)) cleared++;
    });

    return cleared;
  }

  /**
   * Clear expired entries
   */
  clearExpired(): number {
    let cleared = 0;
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expires) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      if (this.delete(key)) cleared++;
    });

    return cleared;
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder = [];
    this.totalSize = 0;
    this.statistics.evictions += this.cache.size;
    this.updateStatistics();

    if (this.options.enablePersistence) {
      await AsyncStorage.removeItem('@OkapiFind:cacheIndex');
    }
  }

  /**
   * Ensure space for new entry
   */
  private async ensureSpace(requiredSize: number, priority?: string): Promise<void> {
    // Check entry count limit
    while (this.cache.size >= this.options.maxEntries) {
      await this.evictLRU();
    }

    // Check size limit
    while (this.totalSize + requiredSize > this.options.maxSize) {
      const evicted = await this.evictLRU(priority);
      if (!evicted) break; // No more items to evict
    }
  }

  /**
   * Evict least recently used item
   */
  private async evictLRU(protectedPriority?: string): Promise<boolean> {
    if (this.accessOrder.length === 0) return false;

    // Find item to evict (skip high priority if specified)
    for (let i = 0; i < this.accessOrder.length; i++) {
      const key = this.accessOrder[i];
      const entry = this.cache.get(key);

      if (entry && protectedPriority !== 'high') {
        this.delete(key);
        this.statistics.evictions++;
        return true;
      }
    }

    return false;
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: string): void {
    // Remove from current position
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Calculate size of data
   */
  private calculateSize(data: any): number {
    try {
      const str = JSON.stringify(data);
      return new Blob([str]).size;
    } catch {
      return 1024; // Default 1KB if calculation fails
    }
  }

  /**
   * Compress data
   */
  private async compress(data: T): Promise<any> {
    // Simplified compression - in production, use a proper compression library
    const jsonStr = JSON.stringify(data);
    return {
      _compressed: true,
      data: jsonStr,
    };
  }

  /**
   * Decompress data
   */
  private async decompress(data: any): Promise<T> {
    if (data._compressed) {
      return JSON.parse(data.data);
    }
    return data;
  }

  /**
   * Check if data is compressed
   */
  private isCompressed(data: any): boolean {
    return data && typeof data === 'object' && data._compressed === true;
  }

  /**
   * Update statistics
   */
  private updateStatistics(): void {
    this.statistics.totalSize = this.totalSize;
    this.statistics.entryCount = this.cache.size;
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.statistics.hits + this.statistics.misses;
    this.statistics.hitRate = total > 0 ? this.statistics.hits / total : 0;
  }

  /**
   * Persist entry to storage
   */
  private async persistEntry(key: string, entry: CacheEntry<T>): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `@OkapiFind:cache:${key}`,
        JSON.stringify(entry)
      );

      // Update index
      const index = await this.getPersistenceIndex();
      if (!index.includes(key)) {
        index.push(key);
        await AsyncStorage.setItem('@OkapiFind:cacheIndex', JSON.stringify(index));
      }
    } catch (error) {
      errorService.logError(error, ErrorSeverity.LOW, ErrorCategory.STORAGE);
    }
  }

  /**
   * Remove from persistence
   */
  private async removeFromPersistence(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`@OkapiFind:cache:${key}`);

      const index = await this.getPersistenceIndex();
      const filtered = index.filter(k => k !== key);
      await AsyncStorage.setItem('@OkapiFind:cacheIndex', JSON.stringify(filtered));
    } catch (error) {
      errorService.logError(error, ErrorSeverity.LOW, ErrorCategory.STORAGE);
    }
  }

  /**
   * Load from persistence
   */
  private async loadFromPersistence(): Promise<void> {
    try {
      const index = await this.getPersistenceIndex();
      const now = Date.now();

      for (const key of index) {
        const stored = await AsyncStorage.getItem(`@OkapiFind:cache:${key}`);
        if (stored) {
          const entry: CacheEntry<T> = JSON.parse(stored);

          // Skip expired entries
          if (entry.expires > now) {
            this.cache.set(key, entry);
            this.totalSize += entry.size;
            this.accessOrder.push(key);
          }
        }
      }

      this.updateStatistics();
    } catch (error) {
      errorService.logError(error, ErrorSeverity.LOW, ErrorCategory.STORAGE);
    }
  }

  /**
   * Get persistence index
   */
  private async getPersistenceIndex(): Promise<string[]> {
    try {
      const index = await AsyncStorage.getItem('@OkapiFind:cacheIndex');
      return index ? JSON.parse(index) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    return { ...this.statistics };
  }

  /**
   * Get cache size
   */
  getSize(): { entries: number; bytes: number } {
    return {
      entries: this.cache.size,
      bytes: this.totalSize,
    };
  }
}

/**
 * Database Cache Manager
 */
class DatabaseCacheManager {
  private static instance: DatabaseCacheManager;
  private caches: Map<string, LRUCache>;
  private networkState: boolean = true;

  private constructor() {
    this.caches = new Map();
    this.initializeNetworkListener();
    this.startMaintenanceTask();
  }

  static getInstance(): DatabaseCacheManager {
    if (!DatabaseCacheManager.instance) {
      DatabaseCacheManager.instance = new DatabaseCacheManager();
    }
    return DatabaseCacheManager.instance;
  }

  /**
   * Get or create cache for specific domain
   */
  getCache(domain: string, options?: Partial<CacheOptions>): LRUCache {
    if (!this.caches.has(domain)) {
      this.caches.set(domain, new LRUCache(options));
    }
    return this.caches.get(domain)!;
  }

  /**
   * Cache database query result
   */
  async cacheQuery<T>(
    query: string,
    params: any[],
    fetcher: () => Promise<T>,
    options: {
      domain?: string;
      ttl?: number;
      tags?: string[];
      forceRefresh?: boolean;
    } = {}
  ): Promise<T> {
    const domain = options.domain || 'default';
    const cache = this.getCache(domain);

    // Generate cache key
    const key = this.generateCacheKey(query, params);

    // Check if force refresh
    if (!options.forceRefresh && this.networkState) {
      const cached = await cache.get(key);
      if (cached) return cached;
    }

    // Fetch fresh data
    try {
      const data = await fetcher();
      await cache.set(key, data, {
        ttl: options.ttl,
        tags: options.tags,
      });
      return data;
    } catch (error) {
      // Try to return stale cache if fetch fails
      const stale = await cache.get(key);
      if (stale) {
        errorService.logWarning('Returning stale cache due to fetch error', { key });
        return stale;
      }
      throw error;
    }
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(query: string, params: any[]): string {
    const queryHash = this.hashString(query);
    const paramsHash = this.hashString(JSON.stringify(params));
    return `${queryHash}:${paramsHash}`;
  }

  /**
   * Simple hash function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Initialize network state listener
   */
  private initializeNetworkListener(): void {
    NetInfo.addEventListener(state => {
      this.networkState = state.isConnected || false;
    });
  }

  /**
   * Start maintenance task
   */
  private startMaintenanceTask(): void {
    // Run maintenance every 5 minutes
    setInterval(() => {
      this.performMaintenance();
    }, 5 * 60 * 1000);
  }

  /**
   * Perform cache maintenance
   */
  private performMaintenance(): void {
    let totalCleared = 0;

    this.caches.forEach((cache, domain) => {
      const cleared = cache.clearExpired();
      totalCleared += cleared;

      // Log statistics
      const stats = cache.getStatistics();
      if (stats.entryCount > 0) {
        errorService.logInfo(`Cache statistics for ${domain}`, {
          hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
          entries: stats.entryCount,
          size: `${(stats.totalSize / 1024).toFixed(2)}KB`,
          evictions: stats.evictions,
        });
      }
    });

    if (totalCleared > 0) {
      errorService.logInfo(`Cache maintenance cleared ${totalCleared} expired entries`);
    }
  }

  /**
   * Invalidate cache by pattern
   */
  invalidatePattern(pattern: RegExp, domain?: string): number {
    let invalidated = 0;
    const targetCaches = domain
      ? [this.caches.get(domain)].filter(Boolean)
      : Array.from(this.caches.values());

    targetCaches.forEach(cache => {
      if (cache) {
        // This would need access to cache keys, simplified for now
        invalidated += cache.clearByTags(['invalidated']);
      }
    });

    return invalidated;
  }

  /**
   * Get global statistics
   */
  getGlobalStatistics(): Record<string, CacheStatistics> {
    const stats: Record<string, CacheStatistics> = {};

    this.caches.forEach((cache, domain) => {
      stats[domain] = cache.getStatistics();
    });

    return stats;
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    const promises: Promise<void>[] = [];

    this.caches.forEach(cache => {
      promises.push(cache.clear());
    });

    await Promise.all(promises);
    errorService.logInfo('All caches cleared');
  }

  /**
   * Warm up cache with common queries
   */
  async warmUp(queries: Array<{
    query: string;
    params: any[];
    fetcher: () => Promise<any>;
    domain?: string;
    ttl?: number;
  }>): Promise<void> {
    const promises = queries.map(q =>
      this.cacheQuery(q.query, q.params, q.fetcher, {
        domain: q.domain,
        ttl: q.ttl,
        forceRefresh: true,
      }).catch(error => {
        errorService.logWarning('Cache warmup failed for query', {
          query: q.query,
          error: error.message,
        });
      })
    );

    await Promise.all(promises);
    errorService.logInfo(`Cache warmed up with ${queries.length} queries`);
  }
}

export const databaseCache = DatabaseCacheManager.getInstance();
export { LRUCache };