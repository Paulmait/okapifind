// @ts-nocheck
/**
 * Redis Cache Service
 * High-performance caching layer for OkapiFind
 * Reduces database load and improves response times
 */

import Redis from 'ioredis';
import { logger } from './loggerService';

interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  enableOfflineQueue?: boolean;
  maxRetriesPerRequest?: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for cache invalidation
  compress?: boolean; // Compress large values
}

class CacheService {
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  // Cache key patterns
  private readonly patterns = {
    user: 'user:*',
    parking: 'parking:*',
    location: 'location:*',
    route: 'route:*',
    analytics: 'analytics:*',
    session: 'session:*',
    subscription: 'subscription:*',
  };

  // Default TTL values (in seconds)
  private readonly ttls = {
    user: 3600, // 1 hour
    parking: 1800, // 30 minutes
    location: 7200, // 2 hours
    route: 3600, // 1 hour
    analytics: 300, // 5 minutes
    session: 86400, // 24 hours
    subscription: 3600, // 1 hour
    default: 600, // 10 minutes
  };

  /**
   * Initialize Redis connection
   */
  async connect(config?: CacheConfig): Promise<void> {
    try {
      const redisConfig: CacheConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        keyPrefix: 'okapifind:',
        enableOfflineQueue: true,
        maxRetriesPerRequest: 3,
        ...config,
      };

      // Create main client
      this.client = new Redis(redisConfig);

      // Create pub/sub clients
      this.subscriber = new Redis(redisConfig);
      this.publisher = new Redis(redisConfig);

      // Set up event handlers
      this.setupEventHandlers();

      // Wait for connection
      await this.client.ping();
      this.isConnected = true;

      logger.info('Redis cache connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      // Fall back to in-memory cache if Redis is unavailable
      this.setupInMemoryCache();
    }
  }

  /**
   * Set up event handlers for Redis connection
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.client.on('error', (err) => {
      logger.error('Redis client error:', err);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      this.reconnectAttempts++;
      logger.info(`Reconnecting to Redis (attempt ${this.reconnectAttempts})`);
    });
  }

  /**
   * Fallback to in-memory cache when Redis is unavailable
   */
  private inMemoryCache = new Map<string, { value: any; expires: number }>();

  private setupInMemoryCache(): void {
    logger.warn('Using in-memory cache fallback');

    // Clean up expired entries every minute
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.inMemoryCache.entries()) {
        if (data.expires < now) {
          this.inMemoryCache.delete(key);
        }
      }
    }, 60000);
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.isConnected) {
        return this.getFromMemory(key);
      }

      const value = await this.client!.get(key);
      if (!value) return null;

      // Record cache hit
      await this.recordCacheMetric('hit', key);

      return JSON.parse(value);
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return this.getFromMemory(key);
    }
  }

  /**
   * Get from in-memory cache
   */
  private getFromMemory<T>(key: string): T | null {
    const data = this.inMemoryCache.get(key);
    if (!data) return null;

    if (data.expires < Date.now()) {
      this.inMemoryCache.delete(key);
      return null;
    }

    return data.value;
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    try {
      const ttl = options?.ttl || this.getDefaultTTL(key);
      const serialized = JSON.stringify(value);

      if (!this.isConnected) {
        return this.setInMemory(key, value, ttl);
      }

      // Set value with TTL
      await this.client!.setex(key, ttl, serialized);

      // Add tags if provided
      if (options?.tags) {
        await this.addTags(key, options.tags);
      }

      // Record cache write
      await this.recordCacheMetric('set', key);

      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return this.setInMemory(key, value, options?.ttl || this.getDefaultTTL(key));
    }
  }

  /**
   * Set in in-memory cache
   */
  private setInMemory<T>(key: string, value: T, ttl: number): boolean {
    this.inMemoryCache.set(key, {
      value,
      expires: Date.now() + (ttl * 1000),
    });
    return true;
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return this.inMemoryCache.delete(key);
      }

      const result = await this.client!.del(key);
      return result > 0;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return this.inMemoryCache.delete(key);
    }
  }

  /**
   * Clear cache by pattern
   */
  async clearPattern(pattern: string): Promise<number> {
    try {
      if (!this.isConnected) {
        return this.clearMemoryPattern(pattern);
      }

      const keys = await this.client!.keys(pattern);
      if (keys.length === 0) return 0;

      const pipeline = this.client!.pipeline();
      keys.forEach(key => pipeline.del(key));
      await pipeline.exec();

      return keys.length;
    } catch (error) {
      logger.error(`Cache clear pattern error for ${pattern}:`, error);
      return this.clearMemoryPattern(pattern);
    }
  }

  /**
   * Clear in-memory cache by pattern
   */
  private clearMemoryPattern(pattern: string): number {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let count = 0;

    for (const key of this.inMemoryCache.keys()) {
      if (regex.test(key)) {
        this.inMemoryCache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      if (!this.isConnected) return;

      for (const tag of tags) {
        const keys = await this.client!.smembers(`tag:${tag}`);

        if (keys.length > 0) {
          const pipeline = this.client!.pipeline();
          keys.forEach(key => pipeline.del(key));
          pipeline.del(`tag:${tag}`);
          await pipeline.exec();
        }
      }
    } catch (error) {
      logger.error('Cache invalidate by tags error:', error);
    }
  }

  /**
   * Add tags to a cache key
   */
  private async addTags(key: string, tags: string[]): Promise<void> {
    if (!this.isConnected) return;

    const pipeline = this.client!.pipeline();
    for (const tag of tags) {
      pipeline.sadd(`tag:${tag}`, key);
    }
    await pipeline.exec();
  }

  /**
   * Get default TTL based on key pattern
   */
  private getDefaultTTL(key: string): number {
    for (const [pattern, ttl] of Object.entries(this.ttls)) {
      if (key.startsWith(pattern + ':')) {
        return ttl;
      }
    }
    return this.ttls.default;
  }

  /**
   * Cache-aside pattern: Get or set
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Record cache miss
    await this.recordCacheMetric('miss', key);

    // Fetch from source
    const value = await fetcher();

    // Store in cache
    await this.set(key, value, options);

    return value;
  }

  /**
   * Batch get multiple keys
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (!this.isConnected) {
        return keys.map(key => this.getFromMemory<T>(key));
      }

      const values = await this.client!.mget(keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      logger.error('Cache mget error:', error);
      return keys.map(key => this.getFromMemory<T>(key));
    }
  }

  /**
   * Batch set multiple keys
   */
  async mset(items: Array<{ key: string; value: any; ttl?: number }>): Promise<boolean> {
    try {
      if (!this.isConnected) {
        items.forEach(item => {
          this.setInMemory(item.key, item.value, item.ttl || this.getDefaultTTL(item.key));
        });
        return true;
      }

      const pipeline = this.client!.pipeline();

      items.forEach(item => {
        const ttl = item.ttl || this.getDefaultTTL(item.key);
        pipeline.setex(item.key, ttl, JSON.stringify(item.value));
      });

      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error('Cache mset error:', error);
      items.forEach(item => {
        this.setInMemory(item.key, item.value, item.ttl || this.getDefaultTTL(item.key));
      });
      return false;
    }
  }

  /**
   * Increment counter
   */
  async incr(key: string, by: number = 1): Promise<number> {
    try {
      if (!this.isConnected) {
        const current = this.getFromMemory<number>(key) || 0;
        const newValue = current + by;
        this.setInMemory(key, newValue, this.ttls.default);
        return newValue;
      }

      return await this.client!.incrby(key, by);
    } catch (error) {
      logger.error(`Cache incr error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Record cache metrics
   */
  private async recordCacheMetric(type: 'hit' | 'miss' | 'set', key: string): Promise<void> {
    try {
      if (!this.isConnected) return;

      const date = new Date().toISOString().split('T')[0];
      const metric = `metrics:cache:${type}:${date}`;

      await this.client!.incr(metric);
      await this.client!.expire(metric, 86400 * 7); // Keep for 7 days
    } catch (error) {
      // Silent fail for metrics
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    hits: number;
    misses: number;
    sets: number;
    hitRate: number;
    memoryUsage?: string;
  }> {
    try {
      const date = new Date().toISOString().split('T')[0];

      const [hits, misses, sets] = await Promise.all([
        this.get<number>(`metrics:cache:hit:${date}`) || 0,
        this.get<number>(`metrics:cache:miss:${date}`) || 0,
        this.get<number>(`metrics:cache:set:${date}`) || 0,
      ]);

      const total = hits + misses;
      const hitRate = total > 0 ? (hits / total) * 100 : 0;

      let memoryUsage;
      if (this.isConnected && this.client) {
        const info = await this.client.info('memory');
        const match = info.match(/used_memory_human:(.+)/);
        memoryUsage = match ? match[1].trim() : undefined;
      }

      return {
        hits,
        misses,
        sets,
        hitRate,
        memoryUsage,
      };
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      return {
        hits: 0,
        misses: 0,
        sets: 0,
        hitRate: 0,
      };
    }
  }

  /**
   * Flush all cache
   */
  async flush(): Promise<void> {
    try {
      if (this.isConnected && this.client) {
        await this.client.flushdb();
      }
      this.inMemoryCache.clear();
      logger.info('Cache flushed successfully');
    } catch (error) {
      logger.error('Failed to flush cache:', error);
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.quit();
      }
      if (this.subscriber) {
        await this.subscriber.quit();
      }
      if (this.publisher) {
        await this.publisher.quit();
      }

      this.isConnected = false;
      this.inMemoryCache.clear();

      logger.info('Redis cache disconnected');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected || !this.client) {
        return false;
      }

      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }
}

export const cacheService = new CacheService();

// Helper decorators for method caching
export function Cacheable(options?: CacheOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;

      return await cacheService.getOrSet(
        cacheKey,
        () => originalMethod.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}

export function CacheInvalidate(patterns: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);

      // Invalidate cache patterns after method execution
      for (const pattern of patterns) {
        await cacheService.clearPattern(pattern);
      }

      return result;
    };

    return descriptor;
  };
}