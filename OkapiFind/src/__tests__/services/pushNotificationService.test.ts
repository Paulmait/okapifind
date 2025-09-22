/**
 * Push Notification Service Tests
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import pushNotificationService from '../../services/pushNotificationService';
import { supabase } from '../../lib/supabase-client';

// Mock analytics
jest.mock('../../services/analytics', () => ({
  analytics: {
    logEvent: jest.fn(),
  },
}));

// Mock supabase client
jest.mock('../../lib/supabase-client', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      upsert: jest.fn(),
    })),
  },
}));

describe('PushNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Device.isDevice
    Object.defineProperty(Device, 'isDevice', { value: true });

    // Mock expo-notifications
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'undetermined',
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: 'ExponentPushToken[mock-token]',
    });
    (Notifications.setNotificationChannelAsync as jest.Mock).mockResolvedValue(undefined);
    (Notifications.setNotificationCategoryAsync as jest.Mock).mockResolvedValue(undefined);
    (Notifications.addNotificationReceivedListener as jest.Mock).mockReturnValue({
      remove: jest.fn(),
    });
    (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({
      remove: jest.fn(),
    });
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(
      'notification-id-123'
    );
    (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockResolvedValue(undefined);
    (Notifications.presentNotificationAsync as jest.Mock).mockResolvedValue(undefined);
    (Notifications.dismissAllNotificationsAsync as jest.Mock).mockResolvedValue(undefined);
    (Notifications.getBadgeCountAsync as jest.Mock).mockResolvedValue(0);
    (Notifications.setBadgeCountAsync as jest.Mock).mockResolvedValue(undefined);

    // Mock Constants
    Object.defineProperty(Constants, 'expoConfig', {
      value: {
        extra: {
          eas: {
            projectId: 'mock-project-id',
          },
        },
      },
    });

    // Mock AsyncStorage
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

    // Mock supabase
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });
    (supabase.from as jest.Mock).mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully on physical device', async () => {
      const { analytics } = require('../../services/analytics');

      await pushNotificationService.initialize();

      expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
      expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
        projectId: 'mock-project-id',
      });
      expect(analytics.logEvent).toHaveBeenCalledWith('push_notifications_initialized', {
        has_token: true,
        platform: Platform.OS,
      });
    });

    it('should skip initialization on simulator/emulator', async () => {
      Object.defineProperty(Device, 'isDevice', { value: false });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await pushNotificationService.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Push notifications work only on physical devices'
      );
      expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle permission denial', async () => {
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await pushNotificationService.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Push notification permission not granted'
      );
      expect(pushNotificationService.getPushToken()).toBeNull();

      consoleSpy.mockRestore();
    });

    it('should setup iOS notification categories', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios' });

      await pushNotificationService.initialize();

      expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith(
        'parking_timer',
        expect.arrayContaining([
          expect.objectContaining({
            identifier: 'snooze',
            buttonTitle: 'Snooze 10 min',
          }),
          expect.objectContaining({
            identifier: 'navigate',
            buttonTitle: 'Navigate to Car',
          }),
        ])
      );
    });

    it('should setup Android notification channels', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'android' });

      await pushNotificationService.initialize();

      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'default',
        expect.objectContaining({
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FFD700',
          sound: 'default',
        })
      );

      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'timers',
        expect.objectContaining({
          name: 'Parking Timers',
          importance: Notifications.AndroidImportance.HIGH,
        })
      );
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Token generation failed');
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValue(error);

      const { analytics } = require('../../services/analytics');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await pushNotificationService.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to initialize push notifications:',
        error
      );
      expect(analytics.logEvent).toHaveBeenCalledWith('push_notifications_error', {
        error: error.message,
        step: 'initialization',
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Token Management', () => {
    it('should save token to database successfully', async () => {
      await pushNotificationService['saveTokenToDatabase']('test-token');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@push_token', 'test-token');
      expect(supabase.from).toHaveBeenCalledWith('devices');
      expect(supabase.from().upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          platform: Platform.OS,
          expo_push_token: 'test-token',
          device_info: expect.objectContaining({
            os: Platform.OS,
            version: Platform.Version,
          }),
        }),
        { onConflict: 'user_id,expo_push_token' }
      );
    });

    it('should handle token save error', async () => {
      const error = new Error('Database error');
      (supabase.from as jest.Mock).mockReturnValue({
        upsert: jest.fn().mockRejectedValue(error),
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await pushNotificationService['saveTokenToDatabase']('test-token');

      expect(consoleSpy).toHaveBeenCalledWith('Failed to save push token:', error);

      consoleSpy.mockRestore();
    });

    it('should skip database save when user not authenticated', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
      });

      await pushNotificationService['saveTokenToDatabase']('test-token');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@push_token', 'test-token');
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('Parking Timer Notifications', () => {
    it('should schedule parking timer notification', async () => {
      const sessionId = 'session-123';
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      const bufferMinutes = 10;

      const notificationId = await pushNotificationService.scheduleParkingTimer(
        sessionId,
        expiresAt,
        bufferMinutes
      );

      expect(notificationId).toBe('notification-id-123');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
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
          seconds: expect.any(Number),
        },
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        `@notification_${sessionId}`,
        'notification-id-123'
      );
    });

    it('should not schedule notification for past time', async () => {
      const sessionId = 'session-123';
      const expiresAt = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      const bufferMinutes = 5;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const notificationId = await pushNotificationService.scheduleParkingTimer(
        sessionId,
        expiresAt,
        bufferMinutes
      );

      expect(notificationId).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Notification time is in the past');
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle scheduling errors', async () => {
      const error = new Error('Scheduling failed');
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const sessionId = 'session-123';
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      const notificationId = await pushNotificationService.scheduleParkingTimer(
        sessionId,
        expiresAt
      );

      expect(notificationId).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to schedule timer notification:',
        error
      );

      consoleSpy.mockRestore();
    });

    it('should cancel scheduled notification', async () => {
      const sessionId = 'session-123';
      const notificationId = 'notification-id-123';

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(notificationId);

      await pushNotificationService.cancelNotification(sessionId);

      expect(AsyncStorage.getItem).toHaveBeenCalledWith(`@notification_${sessionId}`);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        notificationId
      );
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`@notification_${sessionId}`);
    });

    it('should handle cancellation when no notification exists', async () => {
      const sessionId = 'session-123';

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await pushNotificationService.cancelNotification(sessionId);

      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('Immediate Notifications', () => {
    it('should send immediate notification', async () => {
      const config = {
        title: 'Test Title',
        body: 'Test Body',
        data: { type: 'test' },
        categoryId: 'default',
      };

      await pushNotificationService.sendImmediateNotification(config);

      expect(Notifications.presentNotificationAsync).toHaveBeenCalledWith({
        title: config.title,
        body: config.body,
        data: config.data,
        categoryIdentifier: config.categoryId,
      });
    });

    it('should handle immediate notification errors', async () => {
      const error = new Error('Notification failed');
      (Notifications.presentNotificationAsync as jest.Mock).mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await pushNotificationService.sendImmediateNotification({
        title: 'Test',
        body: 'Test',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to send immediate notification:',
        error
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Notification Listeners', () => {
    it('should setup notification listeners', () => {
      pushNotificationService.setupNotificationListeners();

      expect(Notifications.addNotificationReceivedListener).toHaveBeenCalled();
      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled();
    });

    it('should handle notification received', () => {
      const { analytics } = require('../../services/analytics');

      pushNotificationService.setupNotificationListeners();

      // Get the listener callback
      const listener = (Notifications.addNotificationReceivedListener as jest.Mock)
        .mock.calls[0][0];

      const mockNotification = {
        request: {
          content: {
            categoryIdentifier: 'parking_timer',
          },
        },
      };

      listener(mockNotification);

      expect(analytics.logEvent).toHaveBeenCalledWith('notification_received', {
        type: 'parking_timer',
        in_foreground: true,
      });
    });

    it('should handle notification response', () => {
      const { analytics } = require('../../services/analytics');

      pushNotificationService.setupNotificationListeners();

      // Get the response listener callback
      const listener = (Notifications.addNotificationResponseReceivedListener as jest.Mock)
        .mock.calls[0][0];

      const mockResponse = {
        notification: {
          request: {
            content: {
              data: { sessionId: 'session-123' },
              categoryIdentifier: 'parking_timer',
            },
          },
        },
        actionIdentifier: 'snooze',
      };

      // Mock the private method
      const snoozeTimerSpy = jest.spyOn(
        pushNotificationService as any,
        'handleSnoozeTimer'
      ).mockResolvedValue(undefined);

      listener(mockResponse);

      expect(snoozeTimerSpy).toHaveBeenCalledWith({ sessionId: 'session-123' });
      expect(analytics.logEvent).toHaveBeenCalledWith('notification_response', {
        action: 'snooze',
        type: 'parking_timer',
      });

      snoozeTimerSpy.mockRestore();
    });
  });

  describe('Action Handlers', () => {
    it('should handle snooze timer action', async () => {
      const data = { sessionId: 'session-123' };

      // Mock the private methods
      const cancelNotificationSpy = jest.spyOn(
        pushNotificationService,
        'cancelNotification'
      ).mockResolvedValue(undefined);

      const scheduleParkingTimerSpy = jest.spyOn(
        pushNotificationService,
        'scheduleParkingTimer'
      ).mockResolvedValue('new-notification-id');

      const sendImmediateSpy = jest.spyOn(
        pushNotificationService,
        'sendImmediateNotification'
      ).mockResolvedValue(undefined);

      await pushNotificationService['handleSnoozeTimer'](data);

      expect(cancelNotificationSpy).toHaveBeenCalledWith('session-123');
      expect(scheduleParkingTimerSpy).toHaveBeenCalledWith(
        'session-123',
        expect.any(Date),
        5
      );
      expect(sendImmediateSpy).toHaveBeenCalledWith({
        title: '⏰ Timer Snoozed',
        body: 'Your timer has been snoozed for 10 minutes',
        categoryId: 'default',
      });

      cancelNotificationSpy.mockRestore();
      scheduleParkingTimerSpy.mockRestore();
      sendImmediateSpy.mockRestore();
    });

    it('should handle navigate to car action', () => {
      const { analytics } = require('../../services/analytics');
      const data = { sessionId: 'session-123' };

      pushNotificationService['handleNavigateToCar'](data);

      expect(analytics.logEvent).toHaveBeenCalledWith('navigate_from_notification', {
        session_id: 'session-123',
      });
    });

    it('should handle notification tap', () => {
      const { analytics } = require('../../services/analytics');
      const data = { type: 'timer' };

      pushNotificationService['handleNotificationTap'](data);

      expect(analytics.logEvent).toHaveBeenCalledWith('notification_tap', {
        type: 'timer',
      });
    });
  });

  describe('Permission Management', () => {
    it('should request permissions', async () => {
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await pushNotificationService.requestPermissions();

      expect(result).toBe(true);
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    it('should return false when permissions denied', async () => {
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const result = await pushNotificationService.requestPermissions();

      expect(result).toBe(false);
    });

    it('should get permission status', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const status = await pushNotificationService.getPermissionStatus();

      expect(status).toBe('granted');
    });
  });

  describe('Badge Management', () => {
    it('should get badge count on iOS', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios' });
      (Notifications.getBadgeCountAsync as jest.Mock).mockResolvedValue(5);

      const count = await pushNotificationService.getBadgeCount();

      expect(count).toBe(5);
      expect(Notifications.getBadgeCountAsync).toHaveBeenCalled();
    });

    it('should return 0 badge count on Android', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'android' });

      const count = await pushNotificationService.getBadgeCount();

      expect(count).toBe(0);
      expect(Notifications.getBadgeCountAsync).not.toHaveBeenCalled();
    });

    it('should set badge count on iOS', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios' });

      await pushNotificationService.setBadgeCount(3);

      expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(3);
    });

    it('should not set badge count on Android', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'android' });

      await pushNotificationService.setBadgeCount(3);

      expect(Notifications.setBadgeCountAsync).not.toHaveBeenCalled();
    });
  });

  describe('Utility Methods', () => {
    it('should clear all notifications', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios' });

      await pushNotificationService.clearAllNotifications();

      expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalled();
      expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(0);
    });

    it('should test notification', async () => {
      const sendImmediateSpy = jest.spyOn(
        pushNotificationService,
        'sendImmediateNotification'
      ).mockResolvedValue(undefined);

      await pushNotificationService.testNotification();

      expect(sendImmediateSpy).toHaveBeenCalledWith({
        title: '🚗 Test Notification',
        body: 'Push notifications are working!',
        data: { type: 'test' },
        categoryId: 'default',
      });

      sendImmediateSpy.mockRestore();
    });

    it('should get push token', () => {
      // Set a token first
      pushNotificationService['pushToken'] = 'test-token';

      const token = pushNotificationService.getPushToken();

      expect(token).toBe('test-token');
    });

    it('should cleanup listeners', () => {
      const mockListener = { remove: jest.fn() };
      const mockResponseListener = { remove: jest.fn() };

      pushNotificationService['notificationListener'] = mockListener;
      pushNotificationService['responseListener'] = mockResponseListener;

      pushNotificationService.cleanup();

      expect(Notifications.removeNotificationSubscription).toHaveBeenCalledWith(
        mockListener
      );
      expect(Notifications.removeNotificationSubscription).toHaveBeenCalledWith(
        mockResponseListener
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing session ID in snooze action', async () => {
      const data = {}; // No sessionId

      await pushNotificationService['handleSnoozeTimer'](data);

      expect(pushNotificationService.cancelNotification).not.toHaveBeenCalled();
    });

    it('should handle snooze timer errors', async () => {
      const data = { sessionId: 'session-123' };
      const error = new Error('Snooze failed');

      const cancelNotificationSpy = jest.spyOn(
        pushNotificationService,
        'cancelNotification'
      ).mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await pushNotificationService['handleSnoozeTimer'](data);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to snooze timer:', error);

      cancelNotificationSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });
});