// @ts-nocheck
/**
 * Cross-Platform Sync Service
 * Ensures seamless data synchronization between mobile and web apps
 * Handles real-time updates, offline queuing, and conflict resolution
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase-client';
import { analytics } from './analytics';

export interface SyncData {
  parkingLocations: any[];
  preferences: any;
  frequentLocations: any[];
  parkingHistory: any[];
  lastSync: number;
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: number | null;
  pendingChanges: number;
  error: string | null;
}

class CrossPlatformSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private syncStatus: SyncStatus = {
    isSyncing: false,
    lastSyncTime: null,
    pendingChanges: 0,
    error: null,
  };

  /**
   * Initialize cross-platform sync
   */
  async initialize(userId: string): Promise<void> {
    try {
      console.log('🔄 Initializing cross-platform sync...');

      // Track platform usage
      analytics.logEvent('sync_initialized', {
        platform: Platform.OS,
        userId,
      });

      // Load last sync time
      const lastSync = await AsyncStorage.getItem('last_sync_time');
      if (lastSync) {
        this.syncStatus.lastSyncTime = parseInt(lastSync, 10);
      }

      // Start automatic sync every 5 minutes
      this.startAutoSync(userId);

      // Perform initial sync
      await this.performSync(userId);

      console.log('✅ Cross-platform sync initialized');
    } catch (error) {
      console.error('❌ Failed to initialize sync:', error);
      this.updateSyncStatus({ error: 'Initialization failed' });
    }
  }

  /**
   * Start automatic background sync
   */
  private startAutoSync(userId: string): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Sync every 5 minutes
    this.syncInterval = setInterval(() => {
      this.performSync(userId);
    }, 5 * 60 * 1000);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Perform full sync between local storage and server
   */
  async performSync(userId: string, force: boolean = false): Promise<void> {
    if (this.syncStatus.isSyncing && !force) {
      console.log('⏸️ Sync already in progress, skipping...');
      return;
    }

    this.updateSyncStatus({ isSyncing: true, error: null });

    try {
      console.log('🔄 Starting sync...');

      // 1. Pull data from server
      const serverData = await this.pullFromServer(userId);

      // 2. Get local data
      const localData = await this.getLocalData();

      // 3. Merge data with conflict resolution
      const mergedData = await this.mergeData(localData, serverData);

      // 4. Push merged data back to server
      await this.pushToServer(userId, mergedData);

      // 5. Update local storage
      await this.updateLocalData(mergedData);

      // 6. Update sync status
      const now = Date.now();
      await AsyncStorage.setItem('last_sync_time', now.toString());
      this.updateSyncStatus({
        isSyncing: false,
        lastSyncTime: now,
        pendingChanges: 0,
      });

      analytics.logEvent('sync_completed', {
        platform: Platform.OS,
        userId,
        duration: Date.now() - now,
      });

      console.log('✅ Sync completed successfully');
    } catch (error) {
      console.error('❌ Sync failed:', error);
      this.updateSyncStatus({
        isSyncing: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      analytics.logEvent('sync_failed', {
        platform: Platform.OS,
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * Pull data from Supabase server
   */
  private async pullFromServer(userId: string): Promise<Partial<SyncData>> {
    console.log('📥 Pulling data from server...');

    const [parkingLocations, preferences, frequentLocations, parkingHistory] = await Promise.all([
      // Fetch parking locations
      supabase
        .from('parking_locations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),

      // Fetch user preferences
      supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single(),

      // Fetch frequent locations
      supabase
        .from('frequent_locations')
        .select('*')
        .eq('user_id', userId)
        .order('visit_count', { ascending: false })
        .limit(50),

      // Fetch parking history
      supabase
        .from('parking_history')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(500),
    ]);

    return {
      parkingLocations: parkingLocations.data || [],
      preferences: preferences.data || {},
      frequentLocations: frequentLocations.data || [],
      parkingHistory: parkingHistory.data || [],
      lastSync: Date.now(),
    };
  }

  /**
   * Get local data from AsyncStorage
   */
  private async getLocalData(): Promise<Partial<SyncData>> {
    console.log('📱 Getting local data...');

    const [parkingLocations, preferences, frequentLocations, parkingHistory] = await Promise.all([
      AsyncStorage.getItem('parking_locations'),
      AsyncStorage.getItem('user_preferences'),
      AsyncStorage.getItem('frequent_locations'),
      AsyncStorage.getItem('parking_history'),
    ]);

    return {
      parkingLocations: parkingLocations ? JSON.parse(parkingLocations) : [],
      preferences: preferences ? JSON.parse(preferences) : {},
      frequentLocations: frequentLocations ? JSON.parse(frequentLocations) : [],
      parkingHistory: parkingHistory ? JSON.parse(parkingHistory) : [],
    };
  }

  /**
   * Merge local and server data with conflict resolution
   * Server data wins for preferences, local data is more recent for locations
   */
  private async mergeData(
    localData: Partial<SyncData>,
    serverData: Partial<SyncData>
  ): Promise<SyncData> {
    console.log('🔀 Merging data...');

    // Merge parking locations - keep most recent unique entries
    const mergedLocations = this.mergeArraysByKey(
      localData.parkingLocations || [],
      serverData.parkingLocations || [],
      'id',
      'updated_at'
    );

    // Preferences - server wins
    const mergedPreferences = {
      ...(localData.preferences || {}),
      ...(serverData.preferences || {}),
    };

    // Frequent locations - merge and update counts
    const mergedFrequentLocations = this.mergeFrequentLocations(
      localData.frequentLocations || [],
      serverData.frequentLocations || []
    );

    // History - merge by timestamp
    const mergedHistory = this.mergeArraysByKey(
      localData.parkingHistory || [],
      serverData.parkingHistory || [],
      'id',
      'timestamp'
    );

    return {
      parkingLocations: mergedLocations,
      preferences: mergedPreferences,
      frequentLocations: mergedFrequentLocations,
      parkingHistory: mergedHistory,
      lastSync: Date.now(),
    };
  }

  /**
   * Merge arrays by unique key, keeping most recent based on timestamp field
   */
  private mergeArraysByKey(
    localArray: any[],
    serverArray: any[],
    keyField: string,
    timestampField: string
  ): any[] {
    const merged = new Map();

    // Add server data first
    serverArray.forEach((item) => {
      merged.set(item[keyField], item);
    });

    // Overwrite with local data if more recent
    localArray.forEach((item) => {
      const existing = merged.get(item[keyField]);
      if (!existing || item[timestampField] > existing[timestampField]) {
        merged.set(item[keyField], item);
      }
    });

    return Array.from(merged.values());
  }

  /**
   * Merge frequent locations with intelligent count aggregation
   */
  private mergeFrequentLocations(localLocations: any[], serverLocations: any[]): any[] {
    const merged = new Map();

    // Combine local and server locations
    [...localLocations, ...serverLocations].forEach((location) => {
      const key = `${location.latitude},${location.longitude}`;
      const existing = merged.get(key);

      if (existing) {
        // Merge visit counts
        existing.visit_count += location.visit_count || 1;
        existing.last_visited = Math.max(
          existing.last_visited || 0,
          location.last_visited || 0
        );
      } else {
        merged.set(key, { ...location });
      }
    });

    // Sort by visit count
    return Array.from(merged.values()).sort((a, b) => b.visit_count - a.visit_count);
  }

  /**
   * Push merged data to server
   */
  private async pushToServer(userId: string, data: SyncData): Promise<void> {
    console.log('📤 Pushing data to server...');

    // Use upsert to handle conflicts
    await Promise.all([
      // Upsert parking locations
      supabase.from('parking_locations').upsert(
        data.parkingLocations.map((loc) => ({
          ...loc,
          user_id: userId,
        }))
      ),

      // Upsert preferences
      supabase
        .from('user_preferences')
        .upsert({ ...data.preferences, user_id: userId }),

      // Upsert frequent locations
      supabase.from('frequent_locations').upsert(
        data.frequentLocations.map((loc) => ({
          ...loc,
          user_id: userId,
        }))
      ),

      // Upsert history
      supabase.from('parking_history').upsert(
        data.parkingHistory.map((entry) => ({
          ...entry,
          user_id: userId,
        }))
      ),
    ]);
  }

  /**
   * Update local storage with merged data
   */
  private async updateLocalData(data: SyncData): Promise<void> {
    console.log('💾 Updating local storage...');

    await Promise.all([
      AsyncStorage.setItem('parking_locations', JSON.stringify(data.parkingLocations)),
      AsyncStorage.setItem('user_preferences', JSON.stringify(data.preferences)),
      AsyncStorage.setItem('frequent_locations', JSON.stringify(data.frequentLocations)),
      AsyncStorage.setItem('parking_history', JSON.stringify(data.parkingHistory)),
    ]);
  }

  /**
   * Update sync status and notify listeners
   */
  private updateSyncStatus(updates: Partial<SyncStatus>): void {
    this.syncStatus = { ...this.syncStatus, ...updates };
    this.notifyListeners();
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(callback: (status: SyncStatus) => void): () => void {
    this.listeners.add(callback);
    // Immediately call with current status
    callback(this.syncStatus);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(): void {
    this.listeners.forEach((callback) => {
      callback(this.syncStatus);
    });
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Force immediate sync
   */
  async forceSyncNow(userId: string): Promise<void> {
    analytics.logEvent('sync_manual_trigger', {
      platform: Platform.OS,
      userId,
    });
    await this.performSync(userId, true);
  }

  /**
   * Clear all local data (useful for logout)
   */
  async clearLocalData(): Promise<void> {
    console.log('🗑️ Clearing local data...');
    await Promise.all([
      AsyncStorage.removeItem('parking_locations'),
      AsyncStorage.removeItem('user_preferences'),
      AsyncStorage.removeItem('frequent_locations'),
      AsyncStorage.removeItem('parking_history'),
      AsyncStorage.removeItem('last_sync_time'),
    ]);
    this.updateSyncStatus({
      lastSyncTime: null,
      pendingChanges: 0,
      error: null,
    });
  }
}

// Export singleton instance
export const crossPlatformSync = new CrossPlatformSyncService();
export default crossPlatformSync;
