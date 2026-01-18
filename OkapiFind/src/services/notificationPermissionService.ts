// @ts-nocheck
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { analytics } from './analytics';

export interface NotificationPermissionConfig {
  daysToWait: number;
  maxAttempts: number;
  daysBetweenAttempts: number;
  requireParkingSaves: number;
}

export interface NotificationPermissionState {
  hasAskedPermission: boolean;
  permissionGranted: boolean;
  permissionDenied: boolean;
  firstUseDate: string | null;
  lastAttemptDate: string | null;
  attemptCount: number;
  parkingSaveCount: number;
  userExplicitlyDeclined: boolean;
  hasShownPrePrompt: boolean;
}

export interface NotificationPermissionStatus {
  canAsk: boolean;
  shouldShowPrePrompt: boolean;
  reason: string;
}

/**
 * Smart notification permission service
 * Waits for optimal timing (day 3 + value demonstration) before asking for permissions
 * Following mobile UX best practices for permission requests
 */
class NotificationPermissionService {
  private static readonly STORAGE_KEY = 'notificationPermissionState';
  private static readonly DEFAULT_CONFIG: NotificationPermissionConfig = {
    daysToWait: 3, // Wait 3 days before first attempt
    maxAttempts: 3, // Maximum 3 attempts total
    daysBetweenAttempts: 14, // 2 weeks between attempts
    requireParkingSaves: 2, // User should have saved parking at least twice
  };

  private config: NotificationPermissionConfig;
  private state: NotificationPermissionState;

  constructor(config: Partial<NotificationPermissionConfig> = {}) {
    this.config = { ...NotificationPermissionService.DEFAULT_CONFIG, ...config };
    this.state = {
      hasAskedPermission: false,
      permissionGranted: false,
      permissionDenied: false,
      firstUseDate: null,
      lastAttemptDate: null,
      attemptCount: 0,
      parkingSaveCount: 0,
      userExplicitlyDeclined: false,
      hasShownPrePrompt: false,
    };
  }

  /**
   * Initialize the service and load existing state
   */
  async initialize(): Promise<void> {
    try {
      const savedState = await AsyncStorage.getItem(NotificationPermissionService.STORAGE_KEY);
      if (savedState) {
        this.state = { ...this.state, ...JSON.parse(savedState) };
      } else {
        // First time user - set first use date
        this.state.firstUseDate = new Date().toISOString();
        await this.saveState();
      }

      // Check current permission status
      await this.updateCurrentPermissionStatus();

      analytics.logEvent('notification_permission_service_initialized', {
        has_asked_permission: this.state.hasAskedPermission,
        permission_granted: this.state.permissionGranted,
        attempt_count: this.state.attemptCount,
        parking_save_count: this.state.parkingSaveCount,
      });
    } catch (error) {
      console.error('[NotificationPermissionService] Failed to initialize:', error);
      analytics.logEvent('notification_permission_service_init_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Call this when user saves a parking spot
   */
  async onParkingSaved(): Promise<void> {
    try {
      this.state.parkingSaveCount++;
      await this.saveState();

      analytics.logEvent('parking_saved_for_notifications', {
        total_saves: this.state.parkingSaveCount,
        required_saves: this.config.requireParkingSaves,
      });

      // Check if we should show pre-prompt or permission request
      const status = await this.getPermissionStatus();
      if (status.shouldShowPrePrompt && !this.state.hasShownPrePrompt) {
        // Could trigger pre-prompt UI here
        analytics.logEvent('notification_pre_prompt_eligible', {
          parking_saves: this.state.parkingSaveCount,
          days_since_first_use: this.getDaysSinceFirstUse(),
        });
      }
    } catch (error) {
      console.error('[NotificationPermissionService] Error handling parking save:', error);
    }
  }

  /**
   * Get current permission status and whether we can/should ask
   */
  async getPermissionStatus(): Promise<NotificationPermissionStatus> {
    try {
      // If already granted, no need to ask
      if (this.state.permissionGranted) {
        return {
          canAsk: false,
          shouldShowPrePrompt: false,
          reason: 'Permission already granted',
        };
      }

      // If user explicitly declined, don't ask again
      if (this.state.userExplicitlyDeclined) {
        return {
          canAsk: false,
          shouldShowPrePrompt: false,
          reason: 'User explicitly declined',
        };
      }

      // If reached max attempts, stop asking
      if (this.state.attemptCount >= this.config.maxAttempts) {
        return {
          canAsk: false,
          shouldShowPrePrompt: false,
          reason: 'Maximum attempts reached',
        };
      }

      // Check if enough time has passed since first use
      const daysSinceFirstUse = this.getDaysSinceFirstUse();
      if (daysSinceFirstUse < this.config.daysToWait) {
        return {
          canAsk: false,
          shouldShowPrePrompt: false,
          reason: `Waiting ${this.config.daysToWait - daysSinceFirstUse} more days`,
        };
      }

      // Check if user has demonstrated value (parking saves)
      if (this.state.parkingSaveCount < this.config.requireParkingSaves) {
        return {
          canAsk: false,
          shouldShowPrePrompt: false,
          reason: `Need ${this.config.requireParkingSaves - this.state.parkingSaveCount} more parking saves`,
        };
      }

      // Check if enough time has passed since last attempt
      if (this.state.lastAttemptDate) {
        const daysSinceLastAttempt = this.getDaysBetweenDates(
          new Date(this.state.lastAttemptDate),
          new Date()
        );
        if (daysSinceLastAttempt < this.config.daysBetweenAttempts) {
          return {
            canAsk: false,
            shouldShowPrePrompt: false,
            reason: `Wait ${this.config.daysBetweenAttempts - daysSinceLastAttempt} more days`,
          };
        }
      }

      // All conditions met
      return {
        canAsk: true,
        shouldShowPrePrompt: !this.state.hasShownPrePrompt,
        reason: 'Ready to request permission',
      };
    } catch (error) {
      console.error('[NotificationPermissionService] Error checking permission status:', error);
      return {
        canAsk: false,
        shouldShowPrePrompt: false,
        reason: 'Error checking status',
      };
    }
  }

  /**
   * Show pre-prompt explaining why notifications are valuable
   * Call this before requesting actual permission
   */
  async showPrePrompt(): Promise<void> {
    try {
      this.state.hasShownPrePrompt = true;
      await this.saveState();

      analytics.logEvent('notification_pre_prompt_shown', {
        parking_saves: this.state.parkingSaveCount,
        days_since_first_use: this.getDaysSinceFirstUse(),
        attempt_count: this.state.attemptCount,
      });
    } catch (error) {
      console.error('[NotificationPermissionService] Error showing pre-prompt:', error);
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermission(): Promise<boolean> {
    try {
      const status = await this.getPermissionStatus();
      if (!status.canAsk) {
        analytics.logEvent('notification_permission_request_blocked', {
          reason: status.reason,
        });
        return false;
      }

      // Track attempt
      this.state.attemptCount++;
      this.state.lastAttemptDate = new Date().toISOString();
      this.state.hasAskedPermission = true;

      analytics.logEvent('notification_permission_requested', {
        attempt_count: this.state.attemptCount,
        parking_saves: this.state.parkingSaveCount,
        days_since_first_use: this.getDaysSinceFirstUse(),
        platform: Platform.OS,
      });

      // Request permission
      const { status: permissionStatus } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: false,
        },
      });

      // Update state based on result
      this.state.permissionGranted = permissionStatus === 'granted';
      this.state.permissionDenied = permissionStatus === 'denied';
      await this.saveState();

      analytics.logEvent('notification_permission_result', {
        granted: this.state.permissionGranted,
        status: permissionStatus,
        attempt_count: this.state.attemptCount,
        parking_saves: this.state.parkingSaveCount,
      });

      return this.state.permissionGranted;
    } catch (error) {
      console.error('[NotificationPermissionService] Error requesting permission:', error);
      analytics.logEvent('notification_permission_request_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        attempt_count: this.state.attemptCount,
      });
      return false;
    }
  }

  /**
   * Mark that user explicitly declined notifications
   * Call this when user clicks "Don't Allow" in your pre-prompt
   */
  async markAsExplicitlyDeclined(): Promise<void> {
    try {
      this.state.userExplicitlyDeclined = true;
      await this.saveState();

      analytics.logEvent('notification_permission_explicitly_declined', {
        attempt_count: this.state.attemptCount,
        parking_saves: this.state.parkingSaveCount,
        days_since_first_use: this.getDaysSinceFirstUse(),
      });
    } catch (error) {
      console.error('[NotificationPermissionService] Error marking as declined:', error);
    }
  }

  /**
   * Check current notification permission status from system
   */
  async updateCurrentPermissionStatus(): Promise<void> {
    try {
      const { status } = await Notifications.getPermissionsAsync();

      // Update our state to match system state
      const wasGranted = this.state.permissionGranted;
      this.state.permissionGranted = status === 'granted';
      this.state.permissionDenied = status === 'denied';

      // If permission was revoked, track it
      if (wasGranted && !this.state.permissionGranted) {
        analytics.logEvent('notification_permission_revoked', {
          previous_status: 'granted',
          current_status: status,
        });
      }

      await this.saveState();
    } catch (error) {
      console.error('[NotificationPermissionService] Error updating permission status:', error);
    }
  }

  /**
   * Reset permission state (for testing or user data reset)
   */
  async resetState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(NotificationPermissionService.STORAGE_KEY);
      this.state = {
        hasAskedPermission: false,
        permissionGranted: false,
        permissionDenied: false,
        firstUseDate: new Date().toISOString(),
        lastAttemptDate: null,
        attemptCount: 0,
        parkingSaveCount: 0,
        userExplicitlyDeclined: false,
        hasShownPrePrompt: false,
      };

      analytics.logEvent('notification_permission_state_reset');
    } catch (error) {
      console.error('[NotificationPermissionService] Error resetting state:', error);
    }
  }

  /**
   * Get current state for debugging/analytics
   */
  getState(): NotificationPermissionState {
    return { ...this.state };
  }

  /**
   * Get current configuration
   */
  getConfig(): NotificationPermissionConfig {
    return { ...this.config };
  }

  /**
   * Schedule a parking reminder notification
   */
  async scheduleParkingReminder(
    title: string,
    body: string,
    triggerDate: Date
  ): Promise<string | null> {
    try {
      if (!this.state.permissionGranted) {
        analytics.logEvent('notification_schedule_blocked_no_permission');
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
          badge: 1,
        },
        trigger: {
          date: triggerDate,
        },
      });

      analytics.logEvent('notification_scheduled', {
        type: 'parking_reminder',
        trigger_date: triggerDate.toISOString(),
      });

      return notificationId;
    } catch (error) {
      console.error('[NotificationPermissionService] Error scheduling notification:', error);
      analytics.logEvent('notification_schedule_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      analytics.logEvent('notification_cancelled', {
        notification_id: notificationId,
      });
    } catch (error) {
      console.error('[NotificationPermissionService] Error cancelling notification:', error);
    }
  }

  /**
   * Save current state to AsyncStorage
   */
  private async saveState(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        NotificationPermissionService.STORAGE_KEY,
        JSON.stringify(this.state)
      );
    } catch (error) {
      console.error('[NotificationPermissionService] Failed to save state:', error);
      throw error;
    }
  }

  /**
   * Get days since first use
   */
  private getDaysSinceFirstUse(): number {
    if (!this.state.firstUseDate) return 0;
    return this.getDaysBetweenDates(new Date(this.state.firstUseDate), new Date());
  }

  /**
   * Calculate days between two dates
   */
  private getDaysBetweenDates(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

// Export singleton instance
export const notificationPermissionService = new NotificationPermissionService();

// Export class for custom configurations
export { NotificationPermissionService };