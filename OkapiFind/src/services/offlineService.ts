/**
 * Offline Service
 * Handles offline mode with sync queue for OkapiFind
 * Ensures parking spots are never lost due to connectivity issues
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase-client';
import { analytics } from './analytics';

// Queue item structure
interface QueueItem {
  id: string;
  type: 'parking_save' | 'timer_set' | 'photo_upload' | 'session_end';
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

// Offline storage keys
const STORAGE_KEYS = {
  QUEUE: '@offline_queue',
  CACHED_SESSIONS: '@cached_sessions',
  CACHED_SETTINGS: '@cached_settings',
  LAST_SYNC: '@last_sync',
  CONFLICT_RESOLUTION: '@conflict_resolution',
};

class OfflineService {
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private queue: QueueItem[] = [];
  private syncInterval: NodeJS.Timeout | null = null;
  private netInfoUnsubscribe: (() => void) | null = null;

  constructor() {
    this.initializeNetworkListener();
    this.loadQueue();
    this.startSyncInterval();
  }

  /**
   * Initialize network state listener
   */
  private initializeNetworkListener() {
    // Subscribe to network state changes
    this.netInfoUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable !== false;

      if (wasOffline && this.isOnline) {
        console.log('Network restored - syncing offline data');
        this.processQueue();
        analytics.logEvent('offline_mode_reconnected', {
          offline_duration: this.getOfflineDuration(),
        });
      } else if (!wasOffline && !this.isOnline) {
        console.log('Network lost - entering offline mode');
        analytics.logEvent('offline_mode_activated');
      }
    });
  }

  /**
   * Load queue from AsyncStorage
   */
  private async loadQueue() {
    try {
      const queueData = await AsyncStorage.getItem(STORAGE_KEYS.QUEUE);
      if (queueData) {
        this.queue = JSON.parse(queueData);
        console.log(`Loaded ${this.queue.length} items from offline queue`);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  }

  /**
   * Save queue to AsyncStorage
   */
  private async saveQueue() {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  /**
   * Add item to offline queue
   */
  async addToQueue(
    type: QueueItem['type'],
    data: any,
    maxRetries: number = 3
  ): Promise<string> {
    const item: QueueItem = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries,
    };

    this.queue.push(item);
    await this.saveQueue();

    // Try to process immediately if online
    if (this.isOnline) {
      this.processQueue();
    }

    analytics.logEvent('offline_queue_item_added', {
      type,
      queue_length: this.queue.length,
    });

    return item.id;
  }

  /**
   * Process offline queue
   */
  async processQueue() {
    if (!this.isOnline || this.syncInProgress || this.queue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    console.log(`Processing ${this.queue.length} queued items`);

    const processedItems: string[] = [];
    const failedItems: QueueItem[] = [];

    for (const item of this.queue) {
      try {
        await this.processQueueItem(item);
        processedItems.push(item.id);
      } catch (error) {
        console.error(`Failed to process queue item ${item.id}:`, error);
        item.retryCount++;

        if (item.retryCount < item.maxRetries) {
          failedItems.push(item);
        } else {
          // Max retries reached, log and discard
          analytics.logEvent('offline_queue_item_failed', {
            type: item.type,
            retry_count: item.retryCount,
          });
        }
      }
    }

    // Update queue with only failed items that haven't exceeded retries
    this.queue = failedItems;
    await this.saveQueue();

    // Update last sync time
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());

    this.syncInProgress = false;

    analytics.logEvent('offline_queue_processed', {
      processed: processedItems.length,
      failed: failedItems.length,
      remaining: this.queue.length,
    });
  }

  /**
   * Process individual queue item
   */
  private async processQueueItem(item: QueueItem) {
    switch (item.type) {
      case 'parking_save':
        await this.syncParkingSession(item.data);
        break;

      case 'timer_set':
        await this.syncTimer(item.data);
        break;

      case 'photo_upload':
        await this.syncPhoto(item.data);
        break;

      case 'session_end':
        await this.syncSessionEnd(item.data);
        break;

      default:
        console.warn(`Unknown queue item type: ${item.type}`);
    }
  }

  /**
   * Sync parking session
   */
  private async syncParkingSession(data: any) {
    const { data: sessionId, error } = await supabase.rpc('create_parking_session', {
      p_lat: data.latitude,
      p_lng: data.longitude,
      p_vehicle_id: data.vehicle_id,
      p_source: data.source || 'manual',
      p_floor: data.floor,
      p_notes: data.notes,
      p_address: data.address,
      p_venue_name: data.venue_name,
    });

    if (error) throw error;

    // Update local cache
    await this.updateCachedSession(sessionId, data);
  }

  /**
   * Sync timer
   */
  private async syncTimer(data: any) {
    const { error } = await supabase.rpc('upsert_timer', {
      p_session_id: data.session_id,
      p_notify_at: data.notify_at,
      p_buffer_seconds: data.buffer_seconds,
    });

    if (error) throw error;
  }

  /**
   * Sync photo upload
   */
  private async syncPhoto(data: any) {
    // Photo data should be stored as base64 or file path
    const { data: uploadData, error: uploadError } = await supabase.functions.invoke(
      'signed-upload',
      {
        body: {
          session_id: data.session_id,
          content_type: data.content_type,
        },
      }
    );

    if (uploadError) throw uploadError;

    // Upload the cached image
    const imageBlob = await this.loadCachedImage(data.local_path);
    const uploadResponse = await fetch(uploadData.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': data.content_type },
      body: imageBlob,
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload cached image');
    }

    // Create meter_photos record
    const { error } = await supabase.from('meter_photos').insert({
      session_id: data.session_id,
      image_path: uploadData.file_path,
      ocr_text: data.ocr_text,
      rules_json: data.rules_json,
      expires_at: data.expires_at,
    });

    if (error) throw error;
  }

  /**
   * Sync session end
   */
  private async syncSessionEnd(data: any) {
    const { error } = await supabase.rpc('end_parking_session', {
      p_session_id: data.session_id,
    });

    if (error) throw error;
  }

  /**
   * Cache parking session locally
   */
  async cacheParkingSession(session: any) {
    try {
      const cachedSessions = await this.getCachedSessions();
      cachedSessions.unshift(session); // Add to beginning

      // Keep only last 10 sessions
      const trimmedSessions = cachedSessions.slice(0, 10);

      await AsyncStorage.setItem(
        STORAGE_KEYS.CACHED_SESSIONS,
        JSON.stringify(trimmedSessions)
      );
    } catch (error) {
      console.error('Failed to cache parking session:', error);
    }
  }

  /**
   * Get cached sessions
   */
  async getCachedSessions(): Promise<any[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_SESSIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get cached sessions:', error);
      return [];
    }
  }

  /**
   * Update cached session
   */
  private async updateCachedSession(sessionId: string, data: any) {
    const sessions = await this.getCachedSessions();
    const index = sessions.findIndex(s => s.temp_id === data.temp_id);

    if (index >= 0) {
      sessions[index] = { ...sessions[index], id: sessionId, synced: true };
      await AsyncStorage.setItem(
        STORAGE_KEYS.CACHED_SESSIONS,
        JSON.stringify(sessions)
      );
    }
  }

  /**
   * Save parking location (online or offline)
   */
  async saveParkingLocation(
    location: Location.LocationObject,
    options?: {
      vehicle_id?: string;
      source?: 'auto' | 'manual' | 'photo';
      floor?: string;
      notes?: string;
      address?: string;
      venue_name?: string;
    }
  ): Promise<{ id?: string; temp_id?: string; queued: boolean }> {
    const sessionData = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      ...options,
      saved_at: new Date().toISOString(),
    };

    if (this.isOnline) {
      try {
        // Try to save online
        const { data: sessionId, error } = await supabase.rpc('create_parking_session', {
          p_lat: sessionData.latitude,
          p_lng: sessionData.longitude,
          p_vehicle_id: options?.vehicle_id,
          p_source: options?.source || 'manual',
          p_floor: options?.floor,
          p_notes: options?.notes,
          p_address: options?.address,
          p_venue_name: options?.venue_name,
        });

        if (error) throw error;

        // Cache locally as backup
        await this.cacheParkingSession({ ...sessionData, id: sessionId });

        return { id: sessionId, queued: false };
      } catch (error) {
        console.error('Online save failed, queuing:', error);
        // Fall through to offline save
      }
    }

    // Save offline
    const tempId = `temp_${Date.now()}`;
    const queueData = { ...sessionData, temp_id: tempId };

    // Add to queue
    await this.addToQueue('parking_save', queueData);

    // Cache locally
    await this.cacheParkingSession({ ...queueData, synced: false });

    analytics.logEvent('parking_saved_offline', {
      has_connection: this.isOnline,
    });

    return { temp_id: tempId, queued: true };
  }

  /**
   * Load cached image
   */
  private async loadCachedImage(localPath: string): Promise<Blob> {
    // Implementation depends on how images are cached
    // Could be base64 in AsyncStorage or file system
    const response = await fetch(localPath);
    return response.blob();
  }

  /**
   * Get offline duration
   */
  private async getOfflineDuration(): Promise<number> {
    try {
      const lastSync = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      if (lastSync) {
        return Date.now() - new Date(lastSync).getTime();
      }
    } catch (error) {
      console.error('Failed to get offline duration:', error);
    }
    return 0;
  }

  /**
   * Start periodic sync
   */
  private startSyncInterval() {
    // Try to sync every 30 seconds when online
    this.syncInterval = setInterval(() => {
      if (this.isOnline && this.queue.length > 0) {
        this.processQueue();
      }
    }, 30000);
  }

  /**
   * Clear all cached data
   */
  async clearCache() {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.QUEUE,
        STORAGE_KEYS.CACHED_SESSIONS,
        STORAGE_KEYS.CACHED_SETTINGS,
        STORAGE_KEYS.LAST_SYNC,
      ]);
      this.queue = [];
      console.log('Offline cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus(): {
    isOnline: boolean;
    queueLength: number;
    syncInProgress: boolean;
  } {
    return {
      isOnline: this.isOnline,
      queueLength: this.queue.length,
      syncInProgress: this.syncInProgress,
    };
  }

  /**
   * Clean up service
   */
  dispose() {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

export const offlineService = new OfflineService();
export default offlineService;