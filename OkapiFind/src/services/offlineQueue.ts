/**
 * Offline Queue Service
 * Implements offline-first architecture for OkapiFind
 * Queues operations when offline and syncs when connection returns
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase-client';
import { analytics } from './analytics';

const QUEUE_STORAGE_KEY = '@OkapiFind:offlineQueue';
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

export interface QueuedOperation {
  id: string;
  type: 'save_parking' | 'update_parking' | 'save_photo' | 'save_location';
  data: any;
  timestamp: number;
  retries: number;
  lastError?: string;
}

class OfflineQueueService {
  private queue: QueuedOperation[] = [];
  private isSyncing = false;
  private unsubscribeNetInfo: (() => void) | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the service
   */
  private async initialize() {
    // Load queue from storage
    await this.loadQueue();

    // Listen for network changes
    this.unsubscribeNetInfo = NetInfo.addEventListener(state => {
      if (state.isConnected && !this.isSyncing) {
        this.syncQueue();
      }
    });

    // Try initial sync if online
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected && this.queue.length > 0) {
      this.syncQueue();
    }
  }

  /**
   * Add operation to queue
   */
  async addToQueue(operation: Omit<QueuedOperation, 'id' | 'retries'>) {
    const queuedOp: QueuedOperation = {
      ...operation,
      id: `${operation.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      retries: 0,
    };

    this.queue.push(queuedOp);
    await this.saveQueue();

    if (process.env.NODE_ENV === 'development') {
      console.log(`[OfflineQueue] Added to queue: ${queuedOp.type}`, queuedOp.id);
    }

    // Try to sync immediately if online
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected && !this.isSyncing) {
      this.syncQueue();
    }

    return queuedOp.id;
  }

  /**
   * Sync queue with server
   */
  async syncQueue() {
    if (this.isSyncing || this.queue.length === 0) return;

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[OfflineQueue] No connection, skipping sync');
      }
      return;
    }

    this.isSyncing = true;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[OfflineQueue] Syncing ${this.queue.length} operations...`);
    }

    const failedOperations: QueuedOperation[] = [];

    for (const operation of this.queue) {
      try {
        await this.executeOperation(operation);

        if (process.env.NODE_ENV === 'development') {
          console.log(`[OfflineQueue] Synced: ${operation.type}`, operation.id);
        }

        // Log successful sync
        analytics.logEvent('offline_sync_success', {
          operation_type: operation.type,
          operation_id: operation.id,
          retries: operation.retries,
        });

      } catch (error) {
        operation.retries++;
        operation.lastError = (error as Error).message;

        if (operation.retries < MAX_RETRIES) {
          // Retry later
          failedOperations.push(operation);

          if (process.env.NODE_ENV === 'development') {
            console.log(`[OfflineQueue] Failed, will retry: ${operation.type} (${operation.retries}/${MAX_RETRIES})`);
          }
        } else {
          // Give up after max retries
          if (process.env.NODE_ENV === 'development') {
            console.error(`[OfflineQueue] Max retries reached: ${operation.type}`, error);
          }

          analytics.logEvent('offline_sync_failed', {
            operation_type: operation.type,
            operation_id: operation.id,
            error: (error as Error).message,
            retries: operation.retries,
          });
        }

        // Wait before next retry
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    // Update queue with failed operations
    this.queue = failedOperations;
    await this.saveQueue();

    this.isSyncing = false;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[OfflineQueue] Sync complete. ${failedOperations.length} operations remaining`);
    }
  }

  /**
   * Execute a queued operation
   */
  private async executeOperation(operation: QueuedOperation) {
    switch (operation.type) {
      case 'save_parking':
        return await this.executeSaveParking(operation.data);

      case 'update_parking':
        return await this.executeUpdateParking(operation.data);

      case 'save_photo':
        return await this.executeSavePhoto(operation.data);

      case 'save_location':
        return await this.executeSaveLocation(operation.data);

      default:
        throw new Error(`Unknown operation type: ${(operation as any).type}`);
    }
  }

  /**
   * Execute save parking operation
   */
  private async executeSaveParking(data: any) {
    const { error } = await supabase
      .from('parking_sessions')
      .insert(data);

    if (error) throw error;
  }

  /**
   * Execute update parking operation
   */
  private async executeUpdateParking(data: any) {
    const { id, ...updates } = data;

    const { error } = await supabase
      .from('parking_sessions')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Execute save photo operation
   */
  private async executeSavePhoto(data: any) {
    // Implementation for photo upload
    // This would use the signed-upload Edge Function
    const { error } = await supabase
      .from('meter_photos')
      .insert(data);

    if (error) throw error;
  }

  /**
   * Execute save location operation (for safety shares)
   */
  private async executeSaveLocation(data: any) {
    const { error } = await supabase
      .from('share_locations')
      .insert(data);

    if (error) throw error;
  }

  /**
   * Load queue from storage
   */
  private async loadQueue() {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);

        if (process.env.NODE_ENV === 'development') {
          console.log(`[OfflineQueue] Loaded ${this.queue.length} operations from storage`);
        }
      }
    } catch (error) {
      console.error('[OfflineQueue] Error loading queue:', error);
      this.queue = [];
    }
  }

  /**
   * Save queue to storage
   */
  private async saveQueue() {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('[OfflineQueue] Error saving queue:', error);
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      isSyncing: this.isSyncing,
      operations: this.queue.map(op => ({
        id: op.id,
        type: op.type,
        retries: op.retries,
        timestamp: op.timestamp,
      })),
    };
  }

  /**
   * Clear queue (for testing)
   */
  async clearQueue() {
    this.queue = [];
    await this.saveQueue();

    if (process.env.NODE_ENV === 'development') {
      console.log('[OfflineQueue] Queue cleared');
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
  }
}

// Export singleton instance
export const offlineQueue = new OfflineQueueService();
export default offlineQueue;
