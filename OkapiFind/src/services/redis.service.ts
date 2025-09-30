/**
 * Redis Caching Service
 * High-performance caching layer for database queries
 * CRITICAL for scaling to 1M+ users
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

interface CacheItem {
  data: any;
  expiresAt: number;
}

class RedisService {
  private readonly DEFAULT_TTL = 300; // 5 minutes
  private readonly PREFIX = 'okapifind_cache:';
  private memoryCache: Map<string, CacheItem> = new Map();

  /**
   * Get cached data by key
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const cacheKey = this.buildKey(key, options.prefix);

    // Check memory cache first (fastest)
    const memoryCached = this.memoryCache.get(cacheKey);
    if (memoryCached && memoryCached.expiresAt > Date.now()) {
      return memoryCached.data as T;
    }

    // Check AsyncStorage (persistent)
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (!cached) return null;

      const item: CacheItem = JSON.parse(cached);

      // Check if expired
      if (item.expiresAt <= Date.now()) {
        await this.delete(key, options);
        return null;
      }

      // Restore to memory cache
      this.memoryCache.set(cacheKey, item);

      return item.data as T;
    } catch (error) {
      console.error('Redis cache get error:', error);
      return null;
    }
  }

  /**
   * Set cache data
   */
  async set(key: string, data: any, options: CacheOptions = {}): Promise<void> {
    const cacheKey = this.buildKey(key, options.prefix);
    const ttl = options.ttl || this.DEFAULT_TTL;
    const expiresAt = Date.now() + (ttl * 1000);

    const item: CacheItem = {
      data,
      expiresAt,
    };

    // Set in memory cache
    this.memoryCache.set(cacheKey, item);

    // Set in AsyncStorage
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(item));
    } catch (error) {
      console.error('Redis cache set error:', error);
    }
  }

  /**
   * Delete cached data
   */
  async delete(key: string, options: CacheOptions = {}): Promise<void> {
    const cacheKey = this.buildKey(key, options.prefix);

    // Remove from memory
    this.memoryCache.delete(cacheKey);

    // Remove from AsyncStorage
    try {
      await AsyncStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('Redis cache delete error:', error);
    }
  }

  /**
   * Clear all cache with optional prefix
   */
  async clear(prefix?: string): Promise<void> {
    const searchPrefix = prefix ? this.buildKey('', prefix) : this.PREFIX;

    // Clear memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(searchPrefix)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear AsyncStorage
    try {
      const keys = await AsyncStorage.getAllKeys();
      const keysToDelete = keys.filter(key => key.startsWith(searchPrefix));
      await AsyncStorage.multiRemove(keysToDelete);
    } catch (error) {
      console.error('Redis cache clear error:', error);
    }
  }

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Fetch from source
    const data = await fetchFn();

    // Store in cache
    await this.set(key, data, options);

    return data;
  }

  /**
   * Invalidate pattern - delete all keys matching pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);

    // Clear from memory
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear from AsyncStorage
    try {
      const keys = await AsyncStorage.getAllKeys();
      const keysToDelete = keys.filter(key => regex.test(key));
      await AsyncStorage.multiRemove(keysToDelete);
    } catch (error) {
      console.error('Redis invalidate pattern error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    memoryKeys: number;
    storageKeys: number;
    memorySize: number;
  }> {
    const memoryKeys = this.memoryCache.size;

    let storageKeys = 0;
    try {
      const keys = await AsyncStorage.getAllKeys();
      storageKeys = keys.filter(key => key.startsWith(this.PREFIX)).length;
    } catch (error) {
      console.error('Redis stats error:', error);
    }

    // Estimate memory size
    let memorySize = 0;
    for (const item of this.memoryCache.values()) {
      memorySize += JSON.stringify(item.data).length;
    }

    return {
      memoryKeys,
      storageKeys,
      memorySize,
    };
  }

  /**
   * Clean up expired items
   */
  async cleanup(): Promise<number> {
    let cleaned = 0;
    const now = Date.now();

    // Clean memory cache
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.expiresAt <= now) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    // Clean AsyncStorage
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.PREFIX));

      for (const key of cacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const item: CacheItem = JSON.parse(cached);
          if (item.expiresAt <= now) {
            await AsyncStorage.removeItem(key);
            cleaned++;
          }
        }
      }
    } catch (error) {
      console.error('Redis cleanup error:', error);
    }

    return cleaned;
  }

  /**
   * Build cache key with prefix
   */
  private buildKey(key: string, prefix?: string): string {
    return `${this.PREFIX}${prefix ? prefix + ':' : ''}${key}`;
  }

  /**
   * Batch get multiple keys
   */
  async mget<T>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    return Promise.all(keys.map(key => this.get<T>(key, options)));
  }

  /**
   * Batch set multiple keys
   */
  async mset(items: Array<{ key: string; data: any }>, options: CacheOptions = {}): Promise<void> {
    await Promise.all(items.map(item => this.set(item.key, item.data, options)));
  }

  /**
   * Increment counter (useful for rate limiting)
   */
  async increment(key: string, options: CacheOptions = {}): Promise<number> {
    const current = await this.get<number>(key, options) || 0;
    const incremented = current + 1;
    await this.set(key, incremented, options);
    return incremented;
  }

  /**
   * Set if not exists (SETNX)
   */
  async setIfNotExists(key: string, data: any, options: CacheOptions = {}): Promise<boolean> {
    const exists = await this.get(key, options);
    if (exists !== null) {
      return false;
    }

    await this.set(key, data, options);
    return true;
  }
}

// Export singleton instance
export const redisService = new RedisService();

// Export cache prefixes for organization
export const CachePrefixes = {
  USER: 'user',
  SESSION: 'session',
  PARKING: 'parking',
  LOCATION: 'location',
  ANALYTICS: 'analytics',
  SUBSCRIPTION: 'subscription',
  NOTIFICATIONS: 'notifications',
} as const;

// Export common TTL values
export const CacheTTL = {
  ONE_MINUTE: 60,
  FIVE_MINUTES: 300,
  FIFTEEN_MINUTES: 900,
  ONE_HOUR: 3600,
  ONE_DAY: 86400,
  ONE_WEEK: 604800,
} as const;

export default redisService;