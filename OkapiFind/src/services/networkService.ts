import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface NetworkState {
  isConnected: boolean;
  connectionType: string;
  isInternetReachable: boolean | null;
  lastChecked: number;
}

export interface OfflineQueueItem {
  id: string;
  timestamp: number;
  endpoint: string;
  method: string;
  data: any;
  headers?: Record<string, string>;
  priority: 'high' | 'medium' | 'low';
  maxRetries: number;
  currentRetries: number;
}

type NetworkChangeListener = (state: NetworkState) => void;
type ConnectivityChangeListener = (isConnected: boolean) => void;

class NetworkService {
  private static instance: NetworkService;
  private currentState: NetworkState;
  private listeners: NetworkChangeListener[] = [];
  private connectivityListeners: ConnectivityChangeListener[] = [];
  private offlineQueue: OfflineQueueItem[] = [];
  private isProcessingQueue = false;
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  private readonly STORAGE_KEYS = {
    OFFLINE_QUEUE: '@Network:offlineQueue',
    NETWORK_HISTORY: '@Network:history',
    LAST_CONNECTIVITY_CHECK: '@Network:lastCheck',
  };

  private constructor() {
    this.currentState = {
      isConnected: false,
      connectionType: 'unknown',
      isInternetReachable: null,
      lastChecked: 0,
    };
  }

  public static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  /**
   * Initialize the network service
   */
  public async initialize(): Promise<void> {
    try {
      // Load offline queue from storage
      await this.loadOfflineQueue();

      // Get initial network state
      await this.checkConnectivity();

      // Start periodic connectivity checks
      this.startPeriodicChecks();

      console.log('NetworkService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize NetworkService:', error);
    }
  }

  /**
   * Get current network state
   */
  public getCurrentState(): NetworkState {
    return { ...this.currentState };
  }

  /**
   * Check if device is connected to internet
   */
  public isConnected(): boolean {
    return this.currentState.isConnected && this.currentState.isInternetReachable !== false;
  }

  /**
   * Check network connectivity manually
   */
  public async checkConnectivity(updateListeners: boolean = true): Promise<boolean> {
    try {
      const previousState = { ...this.currentState };

      // Test connectivity by making a simple request
      const isConnected = await this.testConnectivity();

      this.currentState = {
        isConnected,
        connectionType: isConnected ? 'wifi' : 'none', // Simplified detection
        isInternetReachable: isConnected,
        lastChecked: Date.now(),
      };

      // Save connectivity status
      await this.saveConnectivityCheck();

      // Notify listeners if state changed
      if (updateListeners && (
        previousState.isConnected !== this.currentState.isConnected ||
        previousState.isInternetReachable !== this.currentState.isInternetReachable
      )) {
        this.notifyListeners(previousState.isConnected);
      }

      // Process offline queue when coming back online
      if (!previousState.isConnected && this.isConnected()) {
        console.log('Network connection restored, processing offline queue...');
        this.processOfflineQueue();
      }

      return isConnected;
    } catch (error) {
      console.error('Error checking connectivity:', error);
      return false;
    }
  }

  /**
   * Get connection quality (simplified)
   */
  public getConnectionQuality(): 'excellent' | 'good' | 'fair' | 'poor' | 'offline' {
    if (!this.isConnected()) return 'offline';

    // Simplified quality assessment based on connectivity test response time
    const timeSinceLastCheck = Date.now() - this.currentState.lastChecked;

    if (timeSinceLastCheck < 2000) return 'excellent';
    if (timeSinceLastCheck < 5000) return 'good';
    if (timeSinceLastCheck < 10000) return 'fair';

    return 'poor';
  }

  /**
   * Add network state change listener
   */
  public addNetworkListener(listener: NetworkChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Add connectivity change listener
   */
  public addConnectivityListener(listener: ConnectivityChangeListener): () => void {
    this.connectivityListeners.push(listener);
    return () => {
      const index = this.connectivityListeners.indexOf(listener);
      if (index > -1) {
        this.connectivityListeners.splice(index, 1);
      }
    };
  }

  /**
   * Add request to offline queue
   */
  public async queueOfflineRequest(
    endpoint: string,
    method: string,
    data: any,
    options: {
      headers?: Record<string, string>;
      priority?: 'high' | 'medium' | 'low';
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    const item: OfflineQueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      endpoint,
      method,
      data,
      headers: options.headers,
      priority: options.priority || 'medium',
      maxRetries: options.maxRetries || 3,
      currentRetries: 0,
    };

    this.offlineQueue.push(item);
    await this.saveOfflineQueue();

    // Sort queue by priority
    this.sortOfflineQueue();

    // Try to process queue if online
    if (this.isConnected()) {
      this.processOfflineQueue();
    }

    return item.id;
  }

  /**
   * Remove item from offline queue
   */
  public async removeFromOfflineQueue(id: string): Promise<void> {
    this.offlineQueue = this.offlineQueue.filter(item => item.id !== id);
    await this.saveOfflineQueue();

    // Clear any pending retry timeout
    const timeout = this.retryTimeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(id);
    }
  }

  /**
   * Get offline queue status
   */
  public getOfflineQueueStatus(): {
    totalItems: number;
    pendingItems: number;
    failedItems: number;
  } {
    const totalItems = this.offlineQueue.length;
    const failedItems = this.offlineQueue.filter(
      item => item.currentRetries >= item.maxRetries
    ).length;
    const pendingItems = totalItems - failedItems;

    return { totalItems, pendingItems, failedItems };
  }

  /**
   * Clear offline queue
   */
  public async clearOfflineQueue(): Promise<void> {
    // Clear all retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();

    this.offlineQueue = [];
    await this.saveOfflineQueue();
  }

  /**
   * Ping server to test connectivity
   */
  public async testConnectivity(url: string = 'https://www.google.com', timeout: number = 8000): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.log('Connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Start periodic connectivity checks
   */
  private startPeriodicChecks(): void {
    // Check connectivity every 30 seconds
    this.checkInterval = setInterval(() => {
      this.checkConnectivity();
    }, 30000);
  }

  /**
   * Stop periodic connectivity checks
   */
  public stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Notify all listeners of network state change
   */
  private notifyListeners(previouslyConnected: boolean): void {
    // Notify network state listeners
    this.listeners.forEach(listener => {
      try {
        listener(this.currentState);
      } catch (error) {
        console.error('Error in network listener:', error);
      }
    });

    // Notify connectivity listeners
    this.connectivityListeners.forEach(listener => {
      try {
        listener(this.currentState.isConnected);
      } catch (error) {
        console.error('Error in connectivity listener:', error);
      }
    });

    // Save network history
    this.saveNetworkHistory();
  }

  /**
   * Process offline queue
   */
  private async processOfflineQueue(): Promise<void> {
    if (this.isProcessingQueue || !this.isConnected()) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      const itemsToProcess = [...this.offlineQueue].filter(
        item => item.currentRetries < item.maxRetries
      );

      for (const item of itemsToProcess) {
        try {
          await this.processQueueItem(item);
          await this.removeFromOfflineQueue(item.id);
          console.log(`Successfully processed offline queue item: ${item.id}`);
        } catch (error) {
          console.error(`Failed to process queue item ${item.id}:`, error);
          await this.retryQueueItem(item);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Process a single queue item
   */
  private async processQueueItem(item: OfflineQueueItem): Promise<void> {
    const response = await fetch(item.endpoint, {
      method: item.method,
      headers: {
        'Content-Type': 'application/json',
        ...item.headers,
      },
      body: item.method !== 'GET' ? JSON.stringify(item.data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  /**
   * Retry a failed queue item
   */
  private async retryQueueItem(item: OfflineQueueItem): Promise<void> {
    item.currentRetries++;

    if (item.currentRetries >= item.maxRetries) {
      console.warn(`Queue item ${item.id} exceeded max retries`);
      return;
    }

    // Exponential backoff (2^retry * 1000ms, max 30 seconds)
    const delay = Math.min(1000 * Math.pow(2, item.currentRetries), 30000);

    const timeout = setTimeout(() => {
      this.processOfflineQueue();
      this.retryTimeouts.delete(item.id);
    }, delay);

    this.retryTimeouts.set(item.id, timeout);
    await this.saveOfflineQueue();
  }

  /**
   * Sort offline queue by priority
   */
  private sortOfflineQueue(): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    this.offlineQueue.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp; // FIFO for same priority
    });
  }

  /**
   * Storage helpers
   */
  private async loadOfflineQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.OFFLINE_QUEUE);
      if (stored) {
        this.offlineQueue = JSON.parse(stored);
        this.sortOfflineQueue();
      }
    } catch (error) {
      console.error('Error loading offline queue:', error);
      this.offlineQueue = [];
    }
  }

  private async saveOfflineQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.OFFLINE_QUEUE,
        JSON.stringify(this.offlineQueue)
      );
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }

  private async saveConnectivityCheck(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.LAST_CONNECTIVITY_CHECK,
        JSON.stringify({
          timestamp: Date.now(),
          isConnected: this.currentState.isConnected,
        })
      );
    } catch (error) {
      console.error('Error saving connectivity check:', error);
    }
  }

  private async saveNetworkHistory(): Promise<void> {
    try {
      const history = {
        timestamp: Date.now(),
        state: this.currentState,
      };

      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.NETWORK_HISTORY);
      const existingHistory = stored ? JSON.parse(stored) : [];

      // Keep only last 50 entries to save storage
      const updatedHistory = [history, ...existingHistory].slice(0, 50);

      await AsyncStorage.setItem(
        this.STORAGE_KEYS.NETWORK_HISTORY,
        JSON.stringify(updatedHistory)
      );
    } catch (error) {
      console.error('Error saving network history:', error);
    }
  }

  /**
   * Get network history for debugging
   */
  public async getNetworkHistory(): Promise<Array<{ timestamp: number; state: NetworkState }>> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.NETWORK_HISTORY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting network history:', error);
      return [];
    }
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.stopPeriodicChecks();

    // Clear all retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();

    // Clear listeners
    this.listeners = [];
    this.connectivityListeners = [];
  }
}

export const networkService = NetworkService.getInstance();
export default networkService;