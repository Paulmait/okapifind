/**
 * Offline Mode Hook
 * Implements UI/UX best practice #7: Offline Mode
 * Ensures core features work without internet connection
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from 'eventemitter3';

interface OfflineQueue {
  id: string;
  type: 'api' | 'sync' | 'upload';
  action: string;
  data: any;
  timestamp: number;
  retryCount: number;
  priority: 'low' | 'medium' | 'high';
}

interface OfflineCache {
  key: string;
  data: any;
  timestamp: number;
  expiresAt: number;
}

interface UseOfflineModeReturn {
  isOnline: boolean;
  isSlowConnection: boolean;
  connectionType: string | null;
  queueAction: (action: Omit<OfflineQueue, 'id' | 'timestamp' | 'retryCount'>) => void;
  getCachedData: <T>(key: string) => Promise<T | null>;
  setCachedData: <T>(key: string, data: T, ttl?: number) => Promise<void>;
  syncQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
  queueSize: number;
  cacheSize: number;
  offlineCapabilities: {
    parkingSave: boolean;
    navigationBasic: boolean;
    historyAccess: boolean;
    photoStorage: boolean;
    voiceCommands: boolean;
  };
}

const OFFLINE_QUEUE_KEY = '@offline_queue';
const OFFLINE_CACHE_PREFIX = '@offline_cache_';
const MAX_RETRY_COUNT = 3;
const SLOW_CONNECTION_THRESHOLD = 150; // kbps
const DEFAULT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

class OfflineManager extends EventEmitter {
  private static instance: OfflineManager;
  private queue: OfflineQueue[] = [];
  private cache: Map<string, OfflineCache> = new Map();
  private syncInProgress = false;

  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  async loadQueue(): Promise<void> {
    try {
      const savedQueue = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (savedQueue) {
        this.queue = JSON.parse(savedQueue);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  }

  async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  addToQueue(item: OfflineQueue): void {
    this.queue.push(item);
    this.queue.sort((a, b) => {
      // Sort by priority then timestamp
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.timestamp - b.timestamp;
    });
    this.saveQueue();
    this.emit('queueUpdated', this.queue.length);
  }

  getQueue(): OfflineQueue[] {
    return this.queue;
  }

  clearQueue(): void {
    this.queue = [];
    this.saveQueue();
    this.emit('queueUpdated', 0);
  }

  async processQueue(isOnline: boolean): Promise<void> {
    if (!isOnline || this.syncInProgress || this.queue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    const processedItems: string[] = [];

    for (const item of this.queue) {
      if (item.retryCount >= MAX_RETRY_COUNT) {
        processedItems.push(item.id);
        continue;
      }

      try {
        // Process based on type
        switch (item.type) {
          case 'api':
            await this.processApiCall(item);
            break;
          case 'sync':
            await this.processSyncAction(item);
            break;
          case 'upload':
            await this.processUpload(item);
            break;
        }

        processedItems.push(item.id);
        this.emit('itemProcessed', item);
      } catch (error) {
        console.error(`Failed to process offline item ${item.id}:`, error);
        item.retryCount++;

        if (item.retryCount >= MAX_RETRY_COUNT) {
          this.emit('itemFailed', item);
          processedItems.push(item.id);
        }
      }
    }

    // Remove processed items
    this.queue = this.queue.filter(item => !processedItems.includes(item.id));
    await this.saveQueue();
    this.syncInProgress = false;
    this.emit('queueUpdated', this.queue.length);
  }

  private async processApiCall(item: OfflineQueue): Promise<void> {
    // Implement API call processing
    const response = await fetch(item.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item.data),
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }
  }

  private async processSyncAction(item: OfflineQueue): Promise<void> {
    // Implement sync action processing
    // This would sync with your backend
  }

  private async processUpload(item: OfflineQueue): Promise<void> {
    // Implement file upload processing
    // This would upload files to cloud storage
  }
}

export const useOfflineMode = (): UseOfflineModeReturn => {
  const [isOnline, setIsOnline] = useState(true);
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [connectionType, setConnectionType] = useState<string | null>(null);
  const [queueSize, setQueueSize] = useState(0);
  const [cacheSize, setCacheSize] = useState(0);

  const manager = useRef(OfflineManager.getInstance());
  const unsubscribe = useRef<(() => void) | null>(null);

  // Initialize offline manager
  useEffect(() => {
    manager.current.loadQueue();

    // Listen to queue updates
    const handleQueueUpdate = (size: number) => setQueueSize(size);
    manager.current.on('queueUpdated', handleQueueUpdate);

    // Monitor network status
    unsubscribe.current = NetInfo.addEventListener((state: NetInfoState) => {
      handleConnectionChange(state);
    });

    // Initial check
    NetInfo.fetch().then(handleConnectionChange);

    return () => {
      manager.current.off('queueUpdated', handleQueueUpdate);
      unsubscribe.current?.();
    };
  }, []);

  const handleConnectionChange = useCallback((state: NetInfoState) => {
    const online = Boolean(state.isConnected && state.isInternetReachable !== false);
    setIsOnline(online);
    setConnectionType(state.type);

    // Check connection speed
    if (state.details && typeof state.details === 'object' && 'linkSpeed' in state.details) {
      const linkSpeed = (state.details as any).linkSpeed;
      setIsSlowConnection(linkSpeed < SLOW_CONNECTION_THRESHOLD);
    } else {
      // Estimate based on connection type
      const slowTypes = ['cellular', '2g', '3g'];
      setIsSlowConnection(slowTypes.includes(state.type));
    }

    // Process queue when back online
    if (online && !isOnline) {
      manager.current.processQueue(true);
    }
  }, [isOnline]);

  /**
   * Queue an action for later processing
   */
  const queueAction = useCallback((action: Omit<OfflineQueue, 'id' | 'timestamp' | 'retryCount'>) => {
    const queueItem: OfflineQueue = {
      ...action,
      id: `${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      retryCount: 0,
    };

    manager.current.addToQueue(queueItem);
  }, []);

  /**
   * Get cached data
   */
  const getCachedData = useCallback(async <T,>(key: string): Promise<T | null> => {
    try {
      const cacheKey = `${OFFLINE_CACHE_PREFIX}${key}`;
      const cachedString = await AsyncStorage.getItem(cacheKey);

      if (!cachedString) return null;

      const cached: OfflineCache = JSON.parse(cachedString);

      // Check if expired
      if (cached.expiresAt < Date.now()) {
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }

      return cached.data as T;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }, []);

  /**
   * Set cached data
   */
  const setCachedData = useCallback(async <T,>(
    key: string,
    data: T,
    ttl: number = DEFAULT_CACHE_TTL
  ): Promise<void> => {
    try {
      const cacheKey = `${OFFLINE_CACHE_PREFIX}${key}`;
      const cache: OfflineCache = {
        key,
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttl,
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(cache));

      // Update cache size
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(OFFLINE_CACHE_PREFIX));
      setCacheSize(cacheKeys.length);
    } catch (error) {
      console.error('Failed to set cached data:', error);
    }
  }, []);

  /**
   * Manually sync offline queue
   */
  const syncQueue = useCallback(async () => {
    if (isOnline) {
      await manager.current.processQueue(true);
    }
  }, [isOnline]);

  /**
   * Clear offline queue
   */
  const clearQueue = useCallback(async () => {
    manager.current.clearQueue();
    setQueueSize(0);
  }, []);

  /**
   * Offline capabilities based on current state
   */
  const offlineCapabilities = {
    parkingSave: true, // Always available - saves locally
    navigationBasic: true, // Basic navigation with cached maps
    historyAccess: true, // Access to local history
    photoStorage: true, // Local photo storage
    voiceCommands: !isSlowConnection, // Disable on slow connections
  };

  return {
    isOnline,
    isSlowConnection,
    connectionType,
    queueAction,
    getCachedData,
    setCachedData,
    syncQueue,
    clearQueue,
    queueSize,
    cacheSize,
    offlineCapabilities,
  };
};

/**
 * Offline-first data fetcher
 */
export const offlineFetch = async <T>(
  url: string,
  options?: RequestInit,
  cacheKey?: string,
  cacheTTL?: number
): Promise<T> => {
  const { isOnline, getCachedData, setCachedData, queueAction } = useOfflineMode();

  // Try to get from cache first
  if (cacheKey) {
    const cached = await getCachedData<T>(cacheKey);
    if (cached) return cached;
  }

  // If online, fetch fresh data
  if (isOnline) {
    try {
      const response = await fetch(url, options);
      const data = await response.json();

      // Cache the result
      if (cacheKey) {
        await setCachedData(cacheKey, data, cacheTTL);
      }

      return data;
    } catch (error) {
      // Fall back to cache on error
      if (cacheKey) {
        const cached = await getCachedData<T>(cacheKey);
        if (cached) return cached;
      }
      throw error;
    }
  }

  // If offline, queue the request
  if (options?.method && options.method !== 'GET') {
    queueAction({
      type: 'api',
      action: url,
      data: options.body ? JSON.parse(options.body as string) : {},
      priority: 'medium',
    });
  }

  // Return cached data or throw
  if (cacheKey) {
    const cached = await getCachedData<T>(cacheKey);
    if (cached) return cached;
  }

  throw new Error('No network connection and no cached data available');
};

export default useOfflineMode;