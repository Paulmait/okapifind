// @ts-nocheck
/**
 * Offline-First Sync Queue Service
 * Manages offline operations and syncs when connectivity is restored
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { errorService, ErrorSeverity, ErrorCategory } from './errorService';
import { tokenManager } from './tokenManager';
import { securityService } from './security';

export enum OperationType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  SYNC = 'SYNC',
}

export enum OperationPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

export interface SyncOperation {
  id: string;
  type: OperationType;
  entity: string;
  data: any;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  priority: OperationPriority;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  lastAttemptAt?: number;
  error?: string;
  headers?: Record<string, string>;
  requiresAuth: boolean;
  conflictResolution?: 'local_wins' | 'remote_wins' | 'merge';
}

interface SyncResult {
  success: boolean;
  operationId: string;
  error?: string;
  data?: any;
}

interface ConflictResolutionStrategy {
  strategy: 'local_wins' | 'remote_wins' | 'merge' | 'manual';
  resolver?: (local: any, remote: any) => any;
}

class OfflineSyncQueue {
  private static instance: OfflineSyncQueue;
  private queue: SyncOperation[] = [];
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private networkListener: any = null;
  private maxQueueSize: number = 1000;
  private syncInterval: number = 30000; // 30 seconds
  private batchSize: number = 10;

  private readonly QUEUE_STORAGE_KEY = '@OkapiFind:syncQueue';
  private readonly LAST_SYNC_KEY = '@OkapiFind:lastSync';
  private readonly CONFLICT_STORAGE_KEY = '@OkapiFind:conflicts';

  private constructor() {}

  static getInstance(): OfflineSyncQueue {
    if (!OfflineSyncQueue.instance) {
      OfflineSyncQueue.instance = new OfflineSyncQueue();
    }
    return OfflineSyncQueue.instance;
  }

  /**
   * Initialize offline sync queue
   */
  async initialize(): Promise<void> {
    try {
      // Load queued operations
      await this.loadQueue();

      // Check initial network state
      const netState = await NetInfo.fetch();
      this.isOnline = netState.isConnected || false;

      // Set up network listener
      this.networkListener = NetInfo.addEventListener(state => {
        this.handleNetworkChange(state.isConnected || false);
      });

      // Start sync timer if online
      if (this.isOnline) {
        this.startSyncTimer();
        // Try to sync immediately
        this.processQueue();
      }

      errorService.logInfo('Offline sync queue initialized', {
        queueSize: this.queue.length,
        isOnline: this.isOnline,
      });
    } catch (error) {
      errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.GENERAL, {
        action: 'offline_sync_initialization',
      });
    }
  }

  /**
   * Add operation to sync queue
   */
  async addToQueue(operation: Omit<SyncOperation, 'id' | 'createdAt' | 'retryCount'>): Promise<string> {
    try {
      // Check queue size limit
      if (this.queue.length >= this.maxQueueSize) {
        // Remove old low-priority operations
        this.pruneQueue();
      }

      const syncOp: SyncOperation = {
        ...operation,
        id: this.generateOperationId(),
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: operation.maxRetries || 3,
      };

      // Add to queue
      this.queue.push(syncOp);

      // Sort by priority
      this.sortQueue();

      // Save queue
      await this.saveQueue();

      errorService.logInfo('Operation added to sync queue', {
        operationId: syncOp.id,
        type: syncOp.type,
        entity: syncOp.entity,
        priority: syncOp.priority,
      });

      // Try to sync immediately if online and high priority
      if (this.isOnline && syncOp.priority >= OperationPriority.HIGH) {
        this.processQueue();
      }

      return syncOp.id;
    } catch (error) {
      errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.GENERAL, {
        action: 'add_to_sync_queue',
      });
      throw error;
    }
  }

  /**
   * Process sync queue
   */
  async processQueue(): Promise<void> {
    if (this.isSyncing || !this.isOnline || this.queue.length === 0) {
      return;
    }

    this.isSyncing = true;

    try {
      // Process operations in batches
      const batch = this.queue.slice(0, this.batchSize);
      const results: SyncResult[] = [];

      for (const operation of batch) {
        try {
          const result = await this.syncOperation(operation);
          results.push(result);

          if (result.success) {
            // Remove from queue
            this.removeFromQueue(operation.id);
          } else {
            // Update retry count
            operation.retryCount++;
            operation.lastAttemptAt = Date.now();
            operation.error = result.error;

            // Remove if max retries exceeded
            if (operation.retryCount >= operation.maxRetries) {
              await this.handleFailedOperation(operation);
              this.removeFromQueue(operation.id);
            }
          }
        } catch (error) {
          errorService.logError(error, ErrorSeverity.MEDIUM, ErrorCategory.NETWORK, {
            operationId: operation.id,
          });
        }
      }

      // Save updated queue
      await this.saveQueue();

      // Update last sync time
      await this.updateLastSyncTime();

      // Continue processing if more operations exist
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 1000);
      }

      errorService.logInfo('Sync queue processed', {
        processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        remaining: this.queue.length,
      });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync single operation
   */
  private async syncOperation(operation: SyncOperation): Promise<SyncResult> {
    try {
      // Check rate limiting
      const canProceed = await securityService.checkRateLimit('sync_queue');
      if (!canProceed) {
        return {
          success: false,
          operationId: operation.id,
          error: 'Rate limit exceeded',
        };
      }

      // Get auth token if required
      let headers = { ...operation.headers };
      if (operation.requiresAuth) {
        const token = await tokenManager.getAccessToken();
        if (!token) {
          return {
            success: false,
            operationId: operation.id,
            error: 'Authentication required',
          };
        }
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Make the request with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, operation.retryCount), 30000);
      if (operation.retryCount > 0) {
        await this.delay(delay);
      }

      const response = await fetch(operation.endpoint, {
        method: operation.method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: operation.data ? JSON.stringify(operation.data) : undefined,
      });

      if (!response.ok) {
        // Handle conflict (409)
        if (response.status === 409) {
          const resolved = await this.handleConflict(operation, response);
          if (resolved) {
            return {
              success: true,
              operationId: operation.id,
              data: resolved,
            };
          }
        }

        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        operationId: operation.id,
        data,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        operationId: operation.id,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle conflict resolution
   */
  private async handleConflict(operation: SyncOperation, response: Response): Promise<any> {
    try {
      const remoteData = await response.json();
      const localData = operation.data;

      const strategy = operation.conflictResolution || 'remote_wins';

      switch (strategy) {
        case 'local_wins':
          // Retry with force flag
          operation.data = { ...localData, _force: true };
          const retryResult = await this.syncOperation(operation);
          return retryResult.success ? retryResult.data : null;

        case 'remote_wins':
          // Accept remote version
          return remoteData;

        case 'merge':
          // Merge local and remote
          const merged = this.mergeData(localData, remoteData);
          operation.data = merged;
          const mergeResult = await this.syncOperation(operation);
          return mergeResult.success ? mergeResult.data : null;

        default:
          // Save conflict for manual resolution
          await this.saveConflict(operation, localData, remoteData);
          return null;
      }
    } catch (error) {
      errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.GENERAL, {
        action: 'handle_conflict',
        operationId: operation.id,
      });
      return null;
    }
  }

  /**
   * Merge data for conflict resolution
   */
  private mergeData(local: any, remote: any): any {
    // Simple merge strategy - can be customized per entity type
    const merged = { ...remote };

    // Prefer local changes for specific fields
    const preferLocalFields = ['notes', 'customFields', 'preferences'];
    for (const field of preferLocalFields) {
      if (field in local) {
        merged[field] = local[field];
      }
    }

    // Use latest timestamp
    if (local.updatedAt && remote.updatedAt) {
      if (new Date(local.updatedAt) > new Date(remote.updatedAt)) {
        return local;
      }
    }

    return merged;
  }

  /**
   * Handle network change
   */
  private handleNetworkChange(isConnected: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = isConnected;

    errorService.logInfo('Network state changed', { isOnline: isConnected });

    if (isConnected && wasOffline) {
      // Coming back online - process queue
      this.processQueue();
      this.startSyncTimer();
    } else if (!isConnected) {
      // Going offline - stop sync timer
      this.stopSyncTimer();
    }
  }

  /**
   * Start sync timer
   */
  private startSyncTimer(): void {
    if (this.syncTimer) {
      return;
    }

    this.syncTimer = setInterval(() => {
      if (this.isOnline && !this.isSyncing && this.queue.length > 0) {
        this.processQueue();
      }
    }, this.syncInterval);
  }

  /**
   * Stop sync timer
   */
  private stopSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Remove operation from queue
   */
  private removeFromQueue(operationId: string): void {
    this.queue = this.queue.filter(op => op.id !== operationId);
  }

  /**
   * Sort queue by priority
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // Sort by priority (higher first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Then by creation time (older first)
      return a.createdAt - b.createdAt;
    });
  }

  /**
   * Prune old operations from queue
   */
  private pruneQueue(): void {
    // Remove old low-priority operations
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    this.queue = this.queue.filter(op => {
      if (op.priority === OperationPriority.LOW && op.createdAt < cutoff) {
        return false;
      }
      return true;
    });
  }

  /**
   * Handle failed operation
   */
  private async handleFailedOperation(operation: SyncOperation): Promise<void> {
    errorService.logError(
      new Error(`Sync operation failed after ${operation.maxRetries} retries`),
      ErrorSeverity.HIGH,
      ErrorCategory.NETWORK,
      {
        operationId: operation.id,
        type: operation.type,
        entity: operation.entity,
        error: operation.error,
      }
    );

    // Save to failed operations for manual retry
    const failedOps = await this.getFailedOperations();
    failedOps.push(operation);
    await AsyncStorage.setItem('@OkapiFind:failedSyncOps', JSON.stringify(failedOps));
  }

  /**
   * Save conflict for manual resolution
   */
  private async saveConflict(operation: SyncOperation, local: any, remote: any): Promise<void> {
    const conflicts = await this.getConflicts();
    conflicts.push({
      id: operation.id,
      entity: operation.entity,
      local,
      remote,
      timestamp: Date.now(),
    });
    await AsyncStorage.setItem(this.CONFLICT_STORAGE_KEY, JSON.stringify(conflicts));
  }

  /**
   * Storage methods
   */

  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.STORAGE, {
        action: 'save_sync_queue',
      });
    }
  }

  private async loadQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.QUEUE_STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.STORAGE, {
        action: 'load_sync_queue',
      });
    }
  }

  private async updateLastSyncTime(): Promise<void> {
    await AsyncStorage.setItem(this.LAST_SYNC_KEY, Date.now().toString());
  }

  private async getFailedOperations(): Promise<SyncOperation[]> {
    try {
      const stored = await AsyncStorage.getItem('@OkapiFind:failedSyncOps');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private async getConflicts(): Promise<any[]> {
    try {
      const stored = await AsyncStorage.getItem(this.CONFLICT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Utility methods
   */

  private generateOperationId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Public API
   */

  getQueueSize(): number {
    return this.queue.length;
  }

  getQueueStatus(): {
    size: number;
    isOnline: boolean;
    isSyncing: boolean;
    oldestOperation?: Date;
  } {
    return {
      size: this.queue.length,
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      oldestOperation: this.queue.length > 0
        ? new Date(Math.min(...this.queue.map(op => op.createdAt)))
        : undefined,
    };
  }

  async clearQueue(): Promise<void> {
    this.queue = [];
    await this.saveQueue();
  }

  async retryFailedOperations(): Promise<void> {
    const failed = await this.getFailedOperations();
    for (const op of failed) {
      op.retryCount = 0;
      await this.addToQueue(op);
    }
    await AsyncStorage.removeItem('@OkapiFind:failedSyncOps');
  }

  /**
   * Cleanup on app termination
   */
  async cleanup(): Promise<void> {
    this.stopSyncTimer();
    if (this.networkListener) {
      this.networkListener();
    }
    await this.saveQueue();
  }
}

export const offlineSyncQueue = OfflineSyncQueue.getInstance();