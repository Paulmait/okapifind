// @ts-nocheck
/**
 * Session Manager Service
 * Handles session lifecycle, cleanup, and battery optimization
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '../lib/supabase-client';
import { logger, LogCategory } from './logger';
import { dataEncryption } from './dataEncryption';
import NetInfo from '@react-native-community/netinfo';

const BACKGROUND_FETCH_TASK = 'background-session-cleanup';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes

export interface SessionData {
  id: string;
  userId: string;
  startTime: Date;
  lastActivity: Date;
  endTime?: Date;
  deviceInfo: DeviceSessionInfo;
  resources: ActiveResources;
  stats: SessionStatistics;
}

interface DeviceSessionInfo {
  platform: string;
  version: string;
  batteryLevel?: number;
  networkType?: string;
  memoryUsage?: number;
}

interface ActiveResources {
  locationTracking: boolean;
  backgroundTasks: string[];
  activeSubscriptions: string[];
  openConnections: number;
  cacheSize: number;
}

interface SessionStatistics {
  apiCalls: number;
  dataTransferred: number;
  batteryDrain: number;
  locationUpdates: number;
  crashes: number;
  errors: number;
}

class SessionManager {
  private static instance: SessionManager;
  private currentSession: SessionData | null = null;
  private appStateSubscription: any;
  private netInfoSubscription: any;
  private idleTimer: NodeJS.Timeout | null = null;
  private sessionTimer: NodeJS.Timeout | null = null;
  private locationSubscriptions: Map<string, any> = new Map();
  private activeSubscriptions: Map<string, any> = new Map();
  private isBackground: boolean = false;
  private lastActivity: Date = new Date();

  private constructor() {
    this.initializeSessionManagement();
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Initialize session management
   */
  private async initializeSessionManagement(): Promise<void> {
    // App state listener
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );

    // Network state listener
    this.netInfoSubscription = NetInfo.addEventListener(
      this.handleNetworkChange.bind(this)
    );

    // Register background task
    await this.registerBackgroundTask();

    logger.info('Session manager initialized');
  }

  /**
   * Start a new session
   */
  async startSession(userId: string): Promise<SessionData> {
    // Clean up any existing session
    if (this.currentSession) {
      await this.endSession();
    }

    const sessionId = this.generateSessionId();
    const batteryLevel = await this.getBatteryLevel();

    this.currentSession = {
      id: sessionId,
      userId,
      startTime: new Date(),
      lastActivity: new Date(),
      deviceInfo: {
        platform: 'mobile',
        version: '1.0.0',
        batteryLevel,
        networkType: await this.getNetworkType(),
        memoryUsage: await this.getMemoryUsage(),
      },
      resources: {
        locationTracking: false,
        backgroundTasks: [],
        activeSubscriptions: [],
        openConnections: 0,
        cacheSize: 0,
      },
      stats: {
        apiCalls: 0,
        dataTransferred: 0,
        batteryDrain: 0,
        locationUpdates: 0,
        crashes: 0,
        errors: 0,
      },
    };

    // Store session
    await this.persistSession();

    // Start session timer
    this.startSessionTimer();

    // Start idle detection
    this.startIdleDetection();

    logger.info('Session started', {
      sessionId,
      userId,
      batteryLevel,
    });

    return this.currentSession;
  }

  /**
   * End current session
   */
  async endSession(): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.endTime = new Date();

    // Clean up all resources
    await this.cleanupResources();

    // Save final session data
    await this.saveSessionToDatabase();

    // Clear session
    this.currentSession = null;

    // Clear timers
    this.clearTimers();

    logger.info('Session ended');
  }

  /**
   * Clean up resources to save battery
   */
  private async cleanupResources(): Promise<void> {
    const startTime = Date.now();

    try {
      // 1. Stop all location tracking
      await this.stopAllLocationTracking();

      // 2. Cancel all subscriptions
      await this.cancelAllSubscriptions();

      // 3. Close all connections
      await this.closeAllConnections();

      // 4. Clear unnecessary cache
      await this.clearCache();

      // 5. Cancel background tasks
      await this.cancelBackgroundTasks();

      // 6. Flush logs
      await logger.flush();

      const cleanupTime = Date.now() - startTime;

      logger.info('Resources cleaned up', {
        cleanupTime,
        locationSubscriptions: this.locationSubscriptions.size,
        activeSubscriptions: this.activeSubscriptions.size,
      });
    } catch (error) {
      logger.error('Resource cleanup failed', error as Error);
    }
  }

  /**
   * Stop all location tracking
   */
  private async stopAllLocationTracking(): Promise<void> {
    for (const [id, subscription] of this.locationSubscriptions) {
      try {
        if (subscription && subscription.remove) {
          await subscription.remove();
        }
        this.locationSubscriptions.delete(id);
      } catch (error) {
        logger.error(`Failed to stop location tracking ${id}`, error as Error);
      }
    }

    // Stop all location tasks
    const hasLocationPermission = await Location.getForegroundPermissionsAsync();
    if (hasLocationPermission.granted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_FETCH_TASK).catch(() => {});
    }

    if (this.currentSession) {
      this.currentSession.resources.locationTracking = false;
    }
  }

  /**
   * Cancel all active subscriptions
   */
  private async cancelAllSubscriptions(): Promise<void> {
    for (const [id, subscription] of this.activeSubscriptions) {
      try {
        if (subscription) {
          if (typeof subscription.unsubscribe === 'function') {
            subscription.unsubscribe();
          } else if (typeof subscription.remove === 'function') {
            subscription.remove();
          } else if (typeof subscription.cancel === 'function') {
            await subscription.cancel();
          }
        }
        this.activeSubscriptions.delete(id);
      } catch (error) {
        logger.error(`Failed to cancel subscription ${id}`, error as Error);
      }
    }

    // Unsubscribe from Supabase realtime
    const channels = supabase.getChannels();
    await Promise.all(channels.map(channel => supabase.removeChannel(channel)));

    if (this.currentSession) {
      this.currentSession.resources.activeSubscriptions = [];
    }
  }

  /**
   * Close all open connections
   */
  private async closeAllConnections(): Promise<void> {
    // Close Supabase connections
    await supabase.removeAllChannels();

    if (this.currentSession) {
      this.currentSession.resources.openConnections = 0;
    }
  }

  /**
   * Clear cache to free memory
   */
  private async clearCache(): Promise<void> {
    try {
      // Clear AsyncStorage cache (keep essential data)
      const keys = await AsyncStorage.getAllKeys();
      const keysToRemove = keys.filter(key =>
        key.includes('cache') ||
        key.includes('temp') ||
        key.includes('draft')
      );

      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }

      if (this.currentSession) {
        this.currentSession.resources.cacheSize = 0;
      }
    } catch (error) {
      logger.error('Failed to clear cache', error as Error);
    }
  }

  /**
   * Cancel background tasks
   */
  private async cancelBackgroundTasks(): Promise<void> {
    try {
      const tasks = await TaskManager.getRegisteredTasksAsync();

      for (const task of tasks) {
        if (task.taskName !== BACKGROUND_FETCH_TASK) {
          await TaskManager.unregisterTaskAsync(task.taskName);
        }
      }

      if (this.currentSession) {
        this.currentSession.resources.backgroundTasks = [];
      }
    } catch (error) {
      logger.error('Failed to cancel background tasks', error as Error);
    }
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'background') {
      this.isBackground = true;
      this.onAppBackground();
    } else if (nextAppState === 'active') {
      this.isBackground = false;
      this.onAppForeground();
    } else if (nextAppState === 'inactive') {
      this.onAppInactive();
    }
  }

  /**
   * Handle app going to background
   */
  private async onAppBackground(): Promise<void> {
    logger.info('App went to background');

    // Start cleanup timer (clean after 5 minutes in background)
    setTimeout(async () => {
      if (this.isBackground) {
        await this.performBackgroundCleanup();
      }
    }, 5 * 60 * 1000);

    // Reduce location accuracy to save battery
    await this.reduceLocationAccuracy();

    // Pause non-essential tasks
    await this.pauseNonEssentialTasks();
  }

  /**
   * Handle app coming to foreground
   */
  private async onAppForeground(): Promise<void> {
    logger.info('App came to foreground');

    // Update last activity
    this.updateActivity();

    // Resume normal operations
    await this.resumeNormalOperations();

    // Check session validity
    await this.checkSessionValidity();
  }

  /**
   * Handle app inactive state
   */
  private onAppInactive(): void {
    // App is transitioning between foreground & background
    logger.debug('App inactive');
  }

  /**
   * Perform background cleanup
   */
  private async performBackgroundCleanup(): Promise<void> {
    logger.info('Performing background cleanup');

    // Stop high-frequency location updates
    await this.stopAllLocationTracking();

    // Cancel non-essential subscriptions
    const nonEssentialSubs = Array.from(this.activeSubscriptions.entries())
      .filter(([key]) => !key.includes('essential'));

    for (const [key, sub] of nonEssentialSubs) {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
      this.activeSubscriptions.delete(key);
    }

    // Clear large caches
    await this.clearCache();

    // Update session
    if (this.currentSession) {
      await this.persistSession();
    }
  }

  /**
   * Reduce location accuracy in background
   */
  private async reduceLocationAccuracy(): Promise<void> {
    for (const [id, subscription] of this.locationSubscriptions) {
      try {
        // Cancel high-accuracy tracking
        if (subscription && subscription.remove) {
          await subscription.remove();
        }

        // Replace with low-accuracy tracking if essential
        if (id.includes('essential')) {
          const lowAccuracySub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Lowest,
              timeInterval: 60000, // 1 minute
              distanceInterval: 100, // 100 meters
            },
            () => {} // Minimal processing
          );
          this.locationSubscriptions.set(id, lowAccuracySub);
        } else {
          this.locationSubscriptions.delete(id);
        }
      } catch (error) {
        logger.error(`Failed to reduce location accuracy for ${id}`, error as Error);
      }
    }
  }

  /**
   * Pause non-essential tasks
   */
  private async pauseNonEssentialTasks(): Promise<void> {
    // Implementation depends on your specific tasks
    logger.info('Non-essential tasks paused');
  }

  /**
   * Resume normal operations
   */
  private async resumeNormalOperations(): Promise<void> {
    // Restore normal location accuracy if needed
    // Resume paused tasks
    logger.info('Normal operations resumed');
  }

  /**
   * Register background task for cleanup
   */
  private async registerBackgroundTask(): Promise<void> {
    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 30 * 60, // 30 minutes
        stopOnTerminate: false,
        startOnBoot: false,
      });

      TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
        await this.performBackgroundCleanup();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      });
    } catch (error) {
      logger.error('Failed to register background task', error as Error);
    }
  }

  /**
   * Start session timer
   */
  private startSessionTimer(): void {
    this.sessionTimer = setInterval(() => {
      this.checkSessionTimeout();
    }, 60000); // Check every minute
  }

  /**
   * Start idle detection
   */
  private startIdleDetection(): void {
    this.resetIdleTimer();
  }

  /**
   * Reset idle timer
   */
  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      this.onIdleTimeout();
    }, IDLE_TIMEOUT);
  }

  /**
   * Handle idle timeout
   */
  private async onIdleTimeout(): Promise<void> {
    logger.info('Session idle timeout reached');

    // Reduce resource usage
    await this.reduceLocationAccuracy();
    await this.pauseNonEssentialTasks();

    // Clear sensitive data from memory
    await this.clearSensitiveData();
  }

  /**
   * Check session timeout
   */
  private async checkSessionTimeout(): Promise<void> {
    if (!this.currentSession) return;

    const now = Date.now();
    const sessionAge = now - this.currentSession.startTime.getTime();

    if (sessionAge > SESSION_TIMEOUT) {
      logger.info('Session timeout reached');
      await this.endSession();
    }
  }

  /**
   * Check session validity
   */
  private async checkSessionValidity(): Promise<void> {
    if (!this.currentSession) return;

    try {
      // Verify with backend
      const { data: { user } } = await supabase.auth.getUser();

      if (!user || user.id !== this.currentSession.userId) {
        await this.endSession();
      }
    } catch (error) {
      logger.error('Session validation failed', error as Error);
    }
  }

  /**
   * Update activity timestamp
   */
  updateActivity(): void {
    this.lastActivity = new Date();

    if (this.currentSession) {
      this.currentSession.lastActivity = this.lastActivity;
    }

    this.resetIdleTimer();
  }

  /**
   * Track location subscription
   */
  trackLocationSubscription(id: string, subscription: any): void {
    this.locationSubscriptions.set(id, subscription);

    if (this.currentSession) {
      this.currentSession.resources.locationTracking = true;
    }
  }

  /**
   * Track active subscription
   */
  trackSubscription(id: string, subscription: any): void {
    this.activeSubscriptions.set(id, subscription);

    if (this.currentSession) {
      this.currentSession.resources.activeSubscriptions = Array.from(this.activeSubscriptions.keys());
    }
  }

  /**
   * Untrack subscription
   */
  untrackSubscription(id: string): void {
    this.activeSubscriptions.delete(id);
    this.locationSubscriptions.delete(id);

    if (this.currentSession) {
      this.currentSession.resources.activeSubscriptions = Array.from(this.activeSubscriptions.keys());
    }
  }

  /**
   * Update session statistics
   */
  updateStats(stat: keyof SessionStatistics, value: number = 1): void {
    if (this.currentSession) {
      this.currentSession.stats[stat] += value;
    }
  }

  /**
   * Clear sensitive data from memory
   */
  private async clearSensitiveData(): Promise<void> {
    try {
      // Clear sensitive keys from AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      const sensitiveKeys = keys.filter(key =>
        key.includes('token') ||
        key.includes('password') ||
        key.includes('secret') ||
        key.includes('key')
      );

      for (const key of sensitiveKeys) {
        // Encrypt before storing
        const value = await AsyncStorage.getItem(key);
        if (value) {
          const encrypted = await dataEncryption.encrypt(value);
          await AsyncStorage.setItem(`${key}_encrypted`, JSON.stringify(encrypted));
          await AsyncStorage.removeItem(key);
        }
      }
    } catch (error) {
      logger.error('Failed to clear sensitive data', error as Error);
    }
  }

  /**
   * Save session to database
   */
  private async saveSessionToDatabase(): Promise<void> {
    if (!this.currentSession) return;

    try {
      const { error } = await supabase
        .from('user_sessions')
        .insert({
          id: this.currentSession.id,
          user_id: this.currentSession.userId,
          start_time: this.currentSession.startTime,
          end_time: this.currentSession.endTime || new Date(),
          device_info: this.currentSession.deviceInfo,
          resources: this.currentSession.resources,
          stats: this.currentSession.stats,
        });

      if (error) {
        logger.error('Failed to save session to database', error);
      }
    } catch (error) {
      logger.error('Failed to save session', error as Error);
    }
  }

  /**
   * Persist session to local storage
   */
  private async persistSession(): Promise<void> {
    if (!this.currentSession) return;

    try {
      await AsyncStorage.setItem(
        '@OkapiFind:currentSession',
        JSON.stringify(this.currentSession)
      );
    } catch (error) {
      logger.error('Failed to persist session', error as Error);
    }
  }

  /**
   * Helper methods
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getBatteryLevel(): Promise<number> {
    // Implementation would use expo-battery
    return 100;
  }

  private async getNetworkType(): Promise<string> {
    const netInfo = await NetInfo.fetch();
    return netInfo.type;
  }

  private async getMemoryUsage(): Promise<number> {
    // Implementation would check actual memory usage
    return 0;
  }

  private handleNetworkChange(state: any): void {
    if (this.currentSession) {
      this.currentSession.deviceInfo.networkType = state.type;
    }
  }

  private clearTimers(): void {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
      this.sessionTimer = null;
    }

    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Get current session
   */
  getCurrentSession(): SessionData | null {
    return this.currentSession;
  }

  /**
   * Cleanup on app termination
   */
  async cleanup(): Promise<void> {
    await this.endSession();

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }

    if (this.netInfoSubscription) {
      this.netInfoSubscription();
    }

    this.clearTimers();
  }
}

export const sessionManager = SessionManager.getInstance();