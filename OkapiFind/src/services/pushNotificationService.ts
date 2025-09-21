/**
 * Push Notification Service
 * Handles timer notifications and other push alerts
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase-client';
import { analytics } from './analytics';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface NotificationConfig {
  title: string;
  body: string;
  data?: any;
  trigger?: Notifications.NotificationTriggerInput;
  categoryId?: string;
}

class PushNotificationService {
  private pushToken: string | null = null;
  private notificationListener: any = null;
  private responseListener: any = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize push notifications
   */
  async initialize(): Promise<void> {
    try {
      // Check if we're on a physical device
      if (!Device.isDevice) {
        console.warn('Push notifications work only on physical devices');
        return;
      }

      // Register for push notifications
      const token = await this.registerForPushNotifications();
      if (token) {
        this.pushToken = token;
        await this.saveTokenToDatabase(token);
      }

      // Set up notification categories for iOS
      if (Platform.OS === 'ios') {
        await this.setupNotificationCategories();
      }

      // Listen for notifications
      this.setupNotificationListeners();

      analytics.logEvent('push_notifications_initialized', {
        has_token: !!token,
        platform: Platform.OS,
      });
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      analytics.logEvent('push_notifications_error', {
        error: error.message,
        step: 'initialization',
      });
    }
  }

  /**
   * Register for push notifications
   */
  async registerForPushNotifications(): Promise<string | null> {
    try {
      // Get existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permission not granted');
        return null;
      }

      // Get Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });

      console.log('Push token obtained:', tokenData.data);

      // Configure Android-specific settings
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FFD700', // Gold color
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('timers', {
          name: 'Parking Timers',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 500, 500, 500],
          lightColor: '#FF0000',
          sound: 'default',
        });
      }

      return tokenData.data;
    } catch (error) {
      console.error('Failed to register for push notifications:', error);
      return null;
    }
  }

  /**
   * Save push token to database
   */
  async saveTokenToDatabase(token: string): Promise<void> {
    try {
      // Save to local storage
      await AsyncStorage.setItem('@push_token', token);

      // Save to Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('devices').upsert({
          user_id: user.id,
          platform: Platform.OS,
          expo_push_token: token,
          device_info: {
            os: Platform.OS,
            version: Platform.Version,
            model: Device.modelName,
            brand: Device.brand,
          },
          last_seen_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,expo_push_token',
        });

        analytics.logEvent('push_token_saved', {
          platform: Platform.OS,
        });
      }
    } catch (error) {
      console.error('Failed to save push token:', error);
    }
  }

  /**
   * Setup notification categories for iOS
   */
  async setupNotificationCategories(): Promise<void> {
    await Notifications.setNotificationCategoryAsync('parking_timer', [
      {
        identifier: 'snooze',
        buttonTitle: 'Snooze 10 min',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'navigate',
        buttonTitle: 'Navigate to Car',
        options: {
          opensAppToForeground: true,
        },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('safety_share', [
      {
        identifier: 'view',
        buttonTitle: 'View Location',
        options: {
          opensAppToForeground: true,
        },
      },
    ]);
  }

  /**
   * Setup notification listeners
   */
  setupNotificationListeners(): void {
    // Handle notifications when app is in foreground
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);

        analytics.logEvent('notification_received', {
          type: notification.request.content.categoryIdentifier,
          in_foreground: true,
        });
      }
    );

    // Handle notification responses (taps)
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification response:', response);

        const { notification, actionIdentifier } = response;
        const data = notification.request.content.data;

        // Handle different action types
        switch (actionIdentifier) {
          case 'snooze':
            this.handleSnoozeTimer(data);
            break;

          case 'navigate':
            this.handleNavigateToCar(data);
            break;

          case Notifications.DEFAULT_ACTION_IDENTIFIER:
            this.handleNotificationTap(data);
            break;
        }

        analytics.logEvent('notification_response', {
          action: actionIdentifier,
          type: notification.request.content.categoryIdentifier,
        });
      }
    );
  }

  /**
   * Schedule a parking timer notification
   */
  async scheduleParkingTimer(
    sessionId: string,
    expiresAt: Date,
    bufferMinutes: number = 10
  ): Promise<string | null> {
    try {
      const notifyAt = new Date(expiresAt.getTime() - bufferMinutes * 60 * 1000);
      const secondsUntilNotification = Math.floor((notifyAt.getTime() - Date.now()) / 1000);

      if (secondsUntilNotification <= 0) {
        console.warn('Notification time is in the past');
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Parking Timer Alert',
          body: `Your parking expires in ${bufferMinutes} minutes!`,
          data: {
            type: 'timer',
            sessionId,
            expiresAt: expiresAt.toISOString(),
          },
          categoryIdentifier: 'parking_timer',
          sound: 'default',
          badge: 1,
        },
        trigger: {
          seconds: secondsUntilNotification,
        },
      });

      // Save notification ID for cancellation
      await AsyncStorage.setItem(
        `@notification_${sessionId}`,
        notificationId
      );

      analytics.logEvent('timer_notification_scheduled', {
        session_id: sessionId,
        minutes_until: secondsUntilNotification / 60,
        buffer_minutes: bufferMinutes,
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to schedule timer notification:', error);
      return null;
    }
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(sessionId: string): Promise<void> {
    try {
      const notificationId = await AsyncStorage.getItem(
        `@notification_${sessionId}`
      );

      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        await AsyncStorage.removeItem(`@notification_${sessionId}`);

        analytics.logEvent('notification_cancelled', {
          session_id: sessionId,
        });
      }
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
  }

  /**
   * Send immediate notification
   */
  async sendImmediateNotification(config: NotificationConfig): Promise<void> {
    try {
      await Notifications.presentNotificationAsync({
        title: config.title,
        body: config.body,
        data: config.data,
        categoryIdentifier: config.categoryId,
      });

      analytics.logEvent('immediate_notification_sent', {
        category: config.categoryId,
      });
    } catch (error) {
      console.error('Failed to send immediate notification:', error);
    }
  }

  /**
   * Handle snooze timer action
   */
  private async handleSnoozeTimer(data: any): Promise<void> {
    if (!data.sessionId) return;

    try {
      // Cancel current notification
      await this.cancelNotification(data.sessionId);

      // Schedule new notification in 10 minutes
      const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await this.scheduleParkingTimer(data.sessionId, newExpiresAt, 5);

      // Send confirmation
      await this.sendImmediateNotification({
        title: '⏰ Timer Snoozed',
        body: 'Your timer has been snoozed for 10 minutes',
        categoryId: 'default',
      });

      analytics.logEvent('timer_snoozed', {
        session_id: data.sessionId,
      });
    } catch (error) {
      console.error('Failed to snooze timer:', error);
    }
  }

  /**
   * Handle navigate to car action
   */
  private handleNavigateToCar(data: any): void {
    // This would open the app to the guidance screen
    // Implementation depends on navigation setup
    analytics.logEvent('navigate_from_notification', {
      session_id: data.sessionId,
    });
  }

  /**
   * Handle general notification tap
   */
  private handleNotificationTap(data: any): void {
    switch (data.type) {
      case 'timer':
        // Navigate to timer management
        break;

      case 'safety_share':
        // Navigate to safety share screen
        break;

      case 'promotion':
        // Navigate to paywall
        break;

      default:
        // Navigate to home
        break;
    }

    analytics.logEvent('notification_tap', {
      type: data.type,
    });
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Get notification permissions status
   */
  async getPermissionStatus(): Promise<string> {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  }

  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    if (Platform.OS === 'ios') {
      return await Notifications.getBadgeCountAsync();
    }
    return 0;
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    if (Platform.OS === 'ios') {
      await Notifications.setBadgeCountAsync(count);
    }
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
    await this.setBadgeCount(0);
  }

  /**
   * Cleanup listeners
   */
  cleanup(): void {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  /**
   * Get push token
   */
  getPushToken(): string | null {
    return this.pushToken;
  }

  /**
   * Test notification
   */
  async testNotification(): Promise<void> {
    await this.sendImmediateNotification({
      title: '🚗 Test Notification',
      body: 'Push notifications are working!',
      data: { type: 'test' },
      categoryId: 'default',
    });
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;