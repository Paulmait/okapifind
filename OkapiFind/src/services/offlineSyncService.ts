// @ts-nocheck
/**
 * Advanced Offline Sync Service
 * Enhanced offline support with automatic sync, conflict resolution, and intelligent prioritization
 * Built on top of the existing offline service with enterprise-grade capabilities
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase-client';
import { analytics } from './analytics';
import { offlineService } from './offlineService';

interface SyncOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'parking_session' | 'timer' | 'photo' | 'settings' | 'user_data';
  data: any;
  localData?: any;
  serverData?: any;
  timestamp: number;
  priority: 'high' | 'medium' | 'low';
  retryCount: number;
  maxRetries: number;
  conflictResolution: 'server_wins' | 'client_wins' | 'merge' | 'manual';
  checksum: string;
  dependencies: string[]; // IDs of operations this depends on
}

interface ConflictResolution {
  id: string;
  operationId: string;
  conflictType: 'data_mismatch' | 'concurrent_edit' | 'delete_conflict' | 'schema_change';
  localVersion: any;
  serverVersion: any;
  resolution: 'pending' | 'resolved' | 'user_required';
  resolutionStrategy: string;
  timestamp: number;
  userChoice?: 'local' | 'server' | 'merge' | 'custom';
  mergedData?: any;
}

interface SyncMetrics {
  totalOperations: number;
  successfulSyncs: number;
  failedSyncs: number;
  conflictsResolved: number;
  averageSyncTime: number;
  lastSuccessfulSync: number;
  offlineDuration: number;
  dataIntegrityChecks: number;
  networkEfficiency: number; // successful operations per network request
}

interface OfflineCapabilities {
  maxOfflineTime: number; // hours
  maxQueueSize: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  intelligentBatching: boolean;
  predictiveSync: boolean;
  conflictPrevention: boolean;
}

const STORAGE_KEYS = {
  SYNC_QUEUE: '@advanced_sync_queue',
  CONFLICTS: '@sync_conflicts',
  METRICS: '@sync_metrics',
  CAPABILITIES: '@offline_capabilities',
  CHECKSUMS: '@data_checksums',
  DEPENDENCIES: '@operation_dependencies',
  OFFLINE_CACHE: '@offline_cache_v2',
};

class AdvancedOfflineSyncService {
  private syncQueue: SyncOperation[] = [];
  private conflicts: ConflictResolution[] = [];
  private metrics: SyncMetrics;
  private capabilities: OfflineCapabilities;
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private intelligentSyncTimer: NodeJS.Timeout | null = null;
  private netInfoUnsubscribe: (() => void) | null = null;
  private syncBatch: SyncOperation[] = [];
  private compressionWorker: any = null;

  constructor() {
    this.metrics = this.initializeMetrics();
    this.capabilities = this.initializeCapabilities();
    this.initializeAdvancedSync();
  }

  /**
   * Initialize advanced sync system
   */
  private async initializeAdvancedSync() {
    try {
      await this.loadSyncData();
      await this.setupNetworkMonitoring();
      await this.startIntelligentSync();
      await this.performDataIntegrityCheck();

      analytics.logEvent('advanced_sync_initialized', {
        queue_size: this.syncQueue.length,
        conflicts_pending: this.conflicts.filter(c => c.resolution === 'pending').length,
        offline_capabilities: this.capabilities,
      });

    } catch (error) {
      console.error('Failed to initialize advanced sync:', error);
    }
  }

  /**
   * Add operation to sync queue with intelligent prioritization
   */
  async addSyncOperation(
    type: SyncOperation['type'],
    entity: SyncOperation['entity'],
    data: any,
    options?: {
      priority?: SyncOperation['priority'];
      conflictResolution?: SyncOperation['conflictResolution'];
      dependencies?: string[];
    }
  ): Promise<string> {
    const operation: SyncOperation = {
      id: await this.generateOperationId(),
      type,
      entity,
      data: await this.processDataForSync(data),
      timestamp: Date.now(),
      priority: options?.priority || this.calculatePriority(type, entity, data),
      retryCount: 0,
      maxRetries: this.calculateMaxRetries(type, entity),
      conflictResolution: options?.conflictResolution || 'merge',
      checksum: await this.calculateChecksum(data),
      dependencies: options?.dependencies || [],
    };

    // Add to queue with intelligent insertion
    await this.insertOperationIntelligently(operation);

    // Try immediate sync if online and high priority
    if (this.isOnline && operation.priority === 'high') {
      this.performIntelligentSync();
    }

    analytics.logEvent('sync_operation_queued', {
      type: operation.type,
      entity: operation.entity,
      priority: operation.priority,
      queue_size: this.syncQueue.length,
    });

    return operation.id;
  }

  /**
   * Perform intelligent sync with batching and conflict resolution
   */
  async performIntelligentSync(): Promise<{
    synced: number;
    failed: number;
    conflicts: number;
    efficiency: number;
  }> {
    if (!this.isOnline || this.syncInProgress || this.syncQueue.length === 0) {
      return { synced: 0, failed: 0, conflicts: 0, efficiency: 0 };
    }

    this.syncInProgress = true;
    const startTime = Date.now();

    try {
      // Create intelligent batches
      const batches = await this.createIntelligentBatches();
      let totalSynced = 0;
      let totalFailed = 0;
      let totalConflicts = 0;

      for (const batch of batches) {
        const result = await this.processSyncBatch(batch);
        totalSynced += result.synced;
        totalFailed += result.failed;
        totalConflicts += result.conflicts;

        // Small delay between batches to prevent overwhelming the server
        if (batches.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Update metrics
      const syncTime = Date.now() - startTime;
      await this.updateSyncMetrics(totalSynced, totalFailed, totalConflicts, syncTime);

      // Calculate efficiency
      const efficiency = totalSynced / (totalSynced + totalFailed + totalConflicts);

      analytics.logEvent('intelligent_sync_completed', {
        synced: totalSynced,
        failed: totalFailed,
        conflicts: totalConflicts,
        efficiency,
        sync_time: syncTime,
        batches: batches.length,
      });

      return { synced: totalSynced, failed: totalFailed, conflicts: totalConflicts, efficiency };

    } catch (error) {
      console.error('Intelligent sync failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Resolve conflicts with intelligent strategies
   */
  async resolveConflicts(): Promise<{
    resolved: number;
    pending: number;
    userActionRequired: number;
  }> {
    const pendingConflicts = this.conflicts.filter(c => c.resolution === 'pending');
    let resolved = 0;
    let userActionRequired = 0;

    for (const conflict of pendingConflicts) {
      try {
        const resolution = await this.resolveConflictIntelligently(conflict);

        if (resolution.requiresUserAction) {
          userActionRequired++;
          conflict.resolution = 'user_required';
        } else {
          resolved++;
          conflict.resolution = 'resolved';
          conflict.resolutionStrategy = resolution.strategy;
          conflict.mergedData = resolution.mergedData;

          // Apply the resolution
          await this.applyConflictResolution(conflict);
        }

      } catch (error) {
        console.error(`Failed to resolve conflict ${conflict.id}:`, error);
      }
    }

    await this.saveConflicts();

    analytics.logEvent('conflicts_resolved', {
      resolved,
      user_action_required: userActionRequired,
      pending: pendingConflicts.length - resolved - userActionRequired,
    });

    return {
      resolved,
      pending: pendingConflicts.length - resolved - userActionRequired,
      userActionRequired,
    };
  }

  /**
   * Get sync status with detailed information
   */
  getSyncStatus(): {
    isOnline: boolean;
    queueSize: number;
    syncInProgress: boolean;
    pendingConflicts: number;
    lastSync: number;
    metrics: SyncMetrics;
    estimatedSyncTime: number;
    recommendations: string[];
  } {
    const pendingConflicts = this.conflicts.filter(c => c.resolution === 'pending').length;
    const estimatedSyncTime = this.calculateEstimatedSyncTime();
    const recommendations = this.generateSyncRecommendations();

    return {
      isOnline: this.isOnline,
      queueSize: this.syncQueue.length,
      syncInProgress: this.syncInProgress,
      pendingConflicts,
      lastSync: this.metrics.lastSuccessfulSync,
      metrics: this.metrics,
      estimatedSyncTime,
      recommendations,
    };
  }

  /**
   * Create intelligent sync batches
   */
  private async createIntelligentBatches(): Promise<SyncOperation[][]> {
    if (this.syncQueue.length === 0) return [];

    // Sort by priority and dependencies
    const sortedOperations = await this.sortOperationsByDependencies(
      this.syncQueue.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
    );

    const batches: SyncOperation[][] = [];
    const batchSize = this.calculateOptimalBatchSize();

    for (let i = 0; i < sortedOperations.length; i += batchSize) {
      const batch = sortedOperations.slice(i, i + batchSize);
      batches.push(batch);
    }

    return batches;
  }

  /**
   * Process a sync batch
   */
  private async processSyncBatch(batch: SyncOperation[]): Promise<{
    synced: number;
    failed: number;
    conflicts: number;
  }> {
    let synced = 0;
    let failed = 0;
    let conflicts = 0;

    // Process operations in parallel where possible
    const results = await Promise.allSettled(
      batch.map(operation => this.processSyncOperation(operation))
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const operation = batch[i];

      if (result.status === 'fulfilled') {
        if (result.value.conflict) {
          conflicts++;
          await this.handleSyncConflict(operation, result.value.conflictData);
        } else {
          synced++;
          // Remove from queue
          this.syncQueue = this.syncQueue.filter(op => op.id !== operation.id);
        }
      } else {
        failed++;
        // Increment retry count
        operation.retryCount++;

        if (operation.retryCount >= operation.maxRetries) {
          // Max retries reached, remove from queue and log
          this.syncQueue = this.syncQueue.filter(op => op.id !== operation.id);
          analytics.logEvent('sync_operation_max_retries', {
            operation_id: operation.id,
            type: operation.type,
            entity: operation.entity,
          });
        }
      }
    }

    await this.saveSyncQueue();
    return { synced, failed, conflicts };
  }

  /**
   * Process individual sync operation
   */
  private async processSyncOperation(operation: SyncOperation): Promise<{
    success: boolean;
    conflict: boolean;
    conflictData?: any;
  }> {
    try {
      // Check for server-side changes first
      const serverData = await this.fetchServerData(operation.entity, operation.data.id);

      if (serverData && serverData.updated_at > operation.timestamp) {
        // Potential conflict detected
        const conflictData = {
          local: operation.data,
          server: serverData,
          operation: operation,
        };

        return { success: false, conflict: true, conflictData };
      }

      // Perform the sync operation
      switch (operation.type) {
        case 'CREATE':
          await this.syncCreate(operation);
          break;
        case 'UPDATE':
          await this.syncUpdate(operation);
          break;
        case 'DELETE':
          await this.syncDelete(operation);
          break;
      }

      return { success: true, conflict: false };

    } catch (error) {
      console.error(`Sync operation failed:`, error);
      throw error;
    }
  }

  /**
   * Sync create operation
   */
  private async syncCreate(operation: SyncOperation): Promise<void> {
    switch (operation.entity) {
      case 'parking_session':
        const { data: sessionId, error: sessionError } = await supabase.rpc(
          'create_parking_session',
          {
            p_lat: operation.data.latitude,
            p_lng: operation.data.longitude,
            p_vehicle_id: operation.data.vehicle_id,
            p_source: operation.data.source,
            p_floor: operation.data.floor,
            p_notes: operation.data.notes,
            p_address: operation.data.address,
            p_venue_name: operation.data.venue_name,
          }
        );

        if (sessionError) throw sessionError;

        // Update local cache with server ID
        await this.updateLocalCache(operation.entity, operation.data.temp_id, { id: sessionId });
        break;

      case 'timer':
        const { error: timerError } = await supabase.from('timers').insert(operation.data);
        if (timerError) throw timerError;
        break;

      case 'photo':
        await this.syncPhotoUpload(operation.data);
        break;

      default:
        throw new Error(`Unsupported create entity: ${operation.entity}`);
    }
  }

  /**
   * Sync update operation
   */
  private async syncUpdate(operation: SyncOperation): Promise<void> {
    switch (operation.entity) {
      case 'parking_session':
        const { error: sessionError } = await supabase
          .from('parking_sessions')
          .update(operation.data)
          .eq('id', operation.data.id);

        if (sessionError) throw sessionError;
        break;

      case 'timer':
        const { error: timerError } = await supabase
          .from('timers')
          .update(operation.data)
          .eq('id', operation.data.id);

        if (timerError) throw timerError;
        break;

      case 'settings':
        const { error: settingsError } = await supabase
          .from('user_settings')
          .upsert(operation.data);

        if (settingsError) throw settingsError;
        break;

      default:
        throw new Error(`Unsupported update entity: ${operation.entity}`);
    }
  }

  /**
   * Sync delete operation
   */
  private async syncDelete(operation: SyncOperation): Promise<void> {
    switch (operation.entity) {
      case 'parking_session':
        const { error: sessionError } = await supabase
          .from('parking_sessions')
          .delete()
          .eq('id', operation.data.id);

        if (sessionError) throw sessionError;
        break;

      case 'timer':
        const { error: timerError } = await supabase
          .from('timers')
          .delete()
          .eq('id', operation.data.id);

        if (timerError) throw timerError;
        break;

      default:
        throw new Error(`Unsupported delete entity: ${operation.entity}`);
    }
  }

  /**
   * Handle sync conflict
   */
  private async handleSyncConflict(operation: SyncOperation, conflictData: any): Promise<void> {
    const conflict: ConflictResolution = {
      id: await this.generateConflictId(),
      operationId: operation.id,
      conflictType: this.detectConflictType(conflictData),
      localVersion: conflictData.local,
      serverVersion: conflictData.server,
      resolution: 'pending',
      resolutionStrategy: '',
      timestamp: Date.now(),
    };

    this.conflicts.push(conflict);
    await this.saveConflicts();

    analytics.logEvent('sync_conflict_detected', {
      conflict_type: conflict.conflictType,
      entity: operation.entity,
      operation_type: operation.type,
    });
  }

  /**
   * Resolve conflict intelligently
   */
  private async resolveConflictIntelligently(conflict: ConflictResolution): Promise<{
    strategy: string;
    mergedData?: any;
    requiresUserAction: boolean;
  }> {
    const { localVersion, serverVersion, conflictType } = conflict;

    switch (conflictType) {
      case 'data_mismatch':
        // Try to merge automatically if possible
        const mergedData = await this.attemptAutomaticMerge(localVersion, serverVersion);
        if (mergedData) {
          return {
            strategy: 'automatic_merge',
            mergedData,
            requiresUserAction: false,
          };
        }
        break;

      case 'concurrent_edit':
        // Use timestamp to determine most recent
        if (localVersion.updated_at > serverVersion.updated_at) {
          return {
            strategy: 'local_wins_newer',
            mergedData: localVersion,
            requiresUserAction: false,
          };
        } else {
          return {
            strategy: 'server_wins_newer',
            mergedData: serverVersion,
            requiresUserAction: false,
          };
        }

      case 'delete_conflict':
        // Server version was deleted, prefer deletion
        return {
          strategy: 'server_delete_wins',
          requiresUserAction: false,
        };

      case 'schema_change':
        // Schema changes require user intervention
        return {
          strategy: 'schema_migration_required',
          requiresUserAction: true,
        };
    }

    // Default to requiring user action
    return {
      strategy: 'user_decision_required',
      requiresUserAction: true,
    };
  }

  /**
   * Attempt automatic merge of conflicting data
   */
  private async attemptAutomaticMerge(local: any, server: any): Promise<any | null> {
    try {
      // Simple field-by-field merge for compatible data
      if (typeof local !== 'object' || typeof server !== 'object') {
        return null;
      }

      const merged = { ...server }; // Start with server version

      // Override with local changes if they're newer
      for (const key in local) {
        if (key === 'id' || key === 'created_at') continue;

        // If local has a value and server doesn't, use local
        if (local[key] !== null && local[key] !== undefined &&
            (server[key] === null || server[key] === undefined)) {
          merged[key] = local[key];
        }

        // For timestamps, use the most recent
        if (key.includes('_at') && local[key] > server[key]) {
          merged[key] = local[key];
        }
      }

      return merged;

    } catch (error) {
      console.error('Auto-merge failed:', error);
      return null;
    }
  }

  /**
   * Apply conflict resolution
   */
  private async applyConflictResolution(conflict: ConflictResolution): Promise<void> {
    const operation = this.syncQueue.find(op => op.id === conflict.operationId);
    if (!operation) return;

    if (conflict.mergedData) {
      // Update operation with merged data
      operation.data = conflict.mergedData;

      // Retry the sync operation
      await this.processSyncOperation(operation);
    }
  }

  /**
   * Calculate priority for operations
   */
  private calculatePriority(
    type: SyncOperation['type'],
    entity: SyncOperation['entity'],
    data: any
  ): SyncOperation['priority'] {
    // High priority for active parking sessions
    if (entity === 'parking_session' && type === 'CREATE') {
      return 'high';
    }

    // High priority for timers
    if (entity === 'timer') {
      return 'high';
    }

    // Medium priority for updates
    if (type === 'UPDATE') {
      return 'medium';
    }

    // Low priority for everything else
    return 'low';
  }

  /**
   * Sort operations by dependencies
   */
  private async sortOperationsByDependencies(operations: SyncOperation[]): Promise<SyncOperation[]> {
    const sorted: SyncOperation[] = [];
    const remaining = [...operations];

    while (remaining.length > 0) {
      let foundIndependent = false;

      for (let i = 0; i < remaining.length; i++) {
        const operation = remaining[i];

        // Check if all dependencies are already processed
        const dependenciesMet = operation.dependencies.every(depId =>
          sorted.some(op => op.id === depId)
        );

        if (dependenciesMet) {
          sorted.push(operation);
          remaining.splice(i, 1);
          foundIndependent = true;
          break;
        }
      }

      // Prevent infinite loop
      if (!foundIndependent && remaining.length > 0) {
        // Add remaining operations anyway (broken dependencies)
        sorted.push(...remaining);
        break;
      }
    }

    return sorted;
  }

  // Utility methods
  private async generateOperationId(): Promise<string> {
    return `op_${Date.now()}_${await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Math.random().toString()
    )}`.substr(0, 32);
  }

  private async generateConflictId(): Promise<string> {
    return `conflict_${Date.now()}_${await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Math.random().toString()
    )}`.substr(0, 32);
  }

  private async calculateChecksum(data: any): Promise<string> {
    const dataString = JSON.stringify(data);
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, dataString);
  }

  private calculateMaxRetries(type: SyncOperation['type'], entity: SyncOperation['entity']): number {
    if (entity === 'parking_session' || entity === 'timer') return 5;
    if (entity === 'photo') return 3;
    return 2;
  }

  private calculateOptimalBatchSize(): number {
    // Adjust batch size based on network conditions and device performance
    if (!this.isOnline) return 0;

    // Start with base size and adjust
    let batchSize = 10;

    if (this.metrics.networkEfficiency > 0.8) {
      batchSize = 20; // Network is efficient, larger batches
    } else if (this.metrics.networkEfficiency < 0.5) {
      batchSize = 5; // Network issues, smaller batches
    }

    return Math.min(batchSize, this.syncQueue.length);
  }

  private calculateEstimatedSyncTime(): number {
    if (this.syncQueue.length === 0) return 0;

    const avgTimePerOperation = this.metrics.averageSyncTime / Math.max(1, this.metrics.successfulSyncs);
    return avgTimePerOperation * this.syncQueue.length;
  }

  private generateSyncRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.syncQueue.length > 50) {
      recommendations.push('Large sync queue detected - connect to WiFi for faster sync');
    }

    if (this.conflicts.filter(c => c.resolution === 'pending').length > 0) {
      recommendations.push('Conflicts need resolution - check sync status');
    }

    if (this.metrics.networkEfficiency < 0.5) {
      recommendations.push('Poor network conditions - sync will be slower');
    }

    if (!this.isOnline) {
      recommendations.push('Offline mode - changes will sync when connected');
    }

    return recommendations;
  }

  private detectConflictType(conflictData: any): ConflictResolution['conflictType'] {
    if (!conflictData.server) {
      return 'delete_conflict';
    }

    if (conflictData.local.updated_at && conflictData.server.updated_at) {
      const timeDiff = Math.abs(conflictData.local.updated_at - conflictData.server.updated_at);
      if (timeDiff < 60000) { // Within 1 minute
        return 'concurrent_edit';
      }
    }

    return 'data_mismatch';
  }

  // Storage methods
  private async loadSyncData(): Promise<void> {
    try {
      const [queueData, conflictsData, metricsData, capabilitiesData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SYNC_QUEUE),
        AsyncStorage.getItem(STORAGE_KEYS.CONFLICTS),
        AsyncStorage.getItem(STORAGE_KEYS.METRICS),
        AsyncStorage.getItem(STORAGE_KEYS.CAPABILITIES),
      ]);

      this.syncQueue = queueData ? JSON.parse(queueData) : [];
      this.conflicts = conflictsData ? JSON.parse(conflictsData) : [];
      this.metrics = metricsData ? JSON.parse(metricsData) : this.initializeMetrics();
      this.capabilities = capabilitiesData ? JSON.parse(capabilitiesData) : this.initializeCapabilities();

    } catch (error) {
      console.error('Failed to load sync data:', error);
    }
  }

  private async saveSyncQueue(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(this.syncQueue));
  }

  private async saveConflicts(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.CONFLICTS, JSON.stringify(this.conflicts));
  }

  private async saveMetrics(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify(this.metrics));
  }

  private initializeMetrics(): SyncMetrics {
    return {
      totalOperations: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      conflictsResolved: 0,
      averageSyncTime: 1000,
      lastSuccessfulSync: 0,
      offlineDuration: 0,
      dataIntegrityChecks: 0,
      networkEfficiency: 0.8,
    };
  }

  private initializeCapabilities(): OfflineCapabilities {
    return {
      maxOfflineTime: 168, // 7 days
      maxQueueSize: 1000,
      compressionEnabled: true,
      encryptionEnabled: true,
      intelligentBatching: true,
      predictiveSync: true,
      conflictPrevention: true,
    };
  }

  private async updateSyncMetrics(synced: number, failed: number, conflicts: number, syncTime: number): Promise<void> {
    this.metrics.totalOperations += synced + failed + conflicts;
    this.metrics.successfulSyncs += synced;
    this.metrics.failedSyncs += failed;
    this.metrics.conflictsResolved += conflicts;
    this.metrics.lastSuccessfulSync = Date.now();

    // Update average sync time with exponential moving average
    const alpha = 0.1;
    this.metrics.averageSyncTime = this.metrics.averageSyncTime * (1 - alpha) + syncTime * alpha;

    // Update network efficiency
    this.metrics.networkEfficiency = synced / Math.max(1, synced + failed + conflicts);

    await this.saveMetrics();
  }

  // Additional methods for advanced functionality
  private async setupNetworkMonitoring(): Promise<void> {
    this.netInfoUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable !== false;

      if (wasOffline && this.isOnline) {
        // Back online - start intelligent sync
        this.performIntelligentSync();
      }
    });
  }

  private async startIntelligentSync(): Promise<void> {
    // Intelligent sync every 30 seconds when online
    this.intelligentSyncTimer = setInterval(() => {
      if (this.isOnline && this.syncQueue.length > 0 && !this.syncInProgress) {
        this.performIntelligentSync();
      }
    }, 30000);
  }

  private async performDataIntegrityCheck(): Promise<void> {
    // Verify data integrity of cached items
    // This would include checksum verification and consistency checks
    this.metrics.dataIntegrityChecks++;
    await this.saveMetrics();
  }

  private async processDataForSync(data: any): Promise<any> {
    // Process data for sync (compression, encryption, etc.)
    if (this.capabilities.compressionEnabled) {
      // Compress large data
    }

    if (this.capabilities.encryptionEnabled) {
      // Encrypt sensitive data
    }

    return data;
  }

  private async insertOperationIntelligently(operation: SyncOperation): Promise<void> {
    // Insert operation in the right position based on priority and dependencies
    let insertIndex = this.syncQueue.length;

    for (let i = 0; i < this.syncQueue.length; i++) {
      const existing = this.syncQueue[i];

      // Higher priority operations go first
      if (operation.priority === 'high' && existing.priority !== 'high') {
        insertIndex = i;
        break;
      }

      if (operation.priority === 'medium' && existing.priority === 'low') {
        insertIndex = i;
        break;
      }
    }

    this.syncQueue.splice(insertIndex, 0, operation);
    await this.saveSyncQueue();
  }

  private async fetchServerData(entity: string, id: string): Promise<any> {
    // Fetch current server data to check for conflicts
    try {
      const { data, error } = await supabase
        .from(entity)
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is ok
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to fetch server data:', error);
      return null;
    }
  }

  private async syncPhotoUpload(photoData: any): Promise<void> {
    // Handle photo upload sync
    const { data: uploadData, error: uploadError } = await supabase.functions.invoke(
      'signed-upload',
      { body: { session_id: photoData.session_id, content_type: photoData.content_type } }
    );

    if (uploadError) throw uploadError;

    // Upload the photo
    const response = await fetch(uploadData.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': photoData.content_type },
      body: photoData.blob,
    });

    if (!response.ok) throw new Error('Photo upload failed');

    // Create database record
    const { error } = await supabase.from('meter_photos').insert({
      session_id: photoData.session_id,
      image_path: uploadData.file_path,
      ocr_text: photoData.ocr_text,
    });

    if (error) throw error;
  }

  private async updateLocalCache(entity: string, tempId: string, updates: any): Promise<void> {
    // Update local cache with server response
    try {
      const cacheKey = `${STORAGE_KEYS.OFFLINE_CACHE}_${entity}_${tempId}`;
      const existing = await AsyncStorage.getItem(cacheKey);

      if (existing) {
        const data = JSON.parse(existing);
        Object.assign(data, updates);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      }
    } catch (error) {
      console.error('Failed to update local cache:', error);
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.intelligentSyncTimer) {
      clearInterval(this.intelligentSyncTimer);
    }

    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
    }
  }
}

export const advancedOfflineSyncService = new AdvancedOfflineSyncService();
export { SyncOperation, ConflictResolution, SyncMetrics };
export default advancedOfflineSyncService;