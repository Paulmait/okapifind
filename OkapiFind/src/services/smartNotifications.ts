/**
 * Smart Notifications Service
 * Context-aware and intelligent notification system
 */

import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as Calendar from 'expo-calendar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase-client';
import { errorService, ErrorSeverity, ErrorCategory } from './errorService';
import { mlParkingPrediction } from './mlParkingPrediction';

export enum NotificationType {
  METER_EXPIRY = 'meter_expiry',
  STREET_CLEANING = 'street_cleaning',
  MOVE_CAR = 'move_car',
  PARKING_PREDICTION = 'parking_prediction',
  WEATHER_ALERT = 'weather_alert',
  EVENT_PARKING = 'event_parking',
  TRAFFIC_ALERT = 'traffic_alert',
  REMINDER = 'reminder',
  SMART_SUGGESTION = 'smart_suggestion',
}

export interface SmartNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: any;
  triggerAt: Date;
  location?: {
    latitude: number;
    longitude: number;
    radius: number;
  };
  conditions?: NotificationCondition[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  actions?: NotificationAction[];
  sound?: string;
  badge?: number;
  categoryId?: string;
}

interface NotificationCondition {
  type: 'time' | 'location' | 'weather' | 'traffic' | 'calendar' | 'behavior';
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'near' | 'between';
  value: any;
  metadata?: any;
}

interface NotificationAction {
  id: string;
  title: string;
  icon?: string;
  destructive?: boolean;
  authenticationRequired?: boolean;
  opensApp?: boolean;
}

interface UserContext {
  location?: Location.LocationObject;
  weather?: WeatherData;
  calendar?: CalendarEvent[];
  parkingHistory?: ParkingPattern[];
  preferences?: UserPreferences;
  currentActivity?: string;
  timeZone?: string;
}

interface WeatherData {
  temperature: number;
  condition: string;
  precipitation: number;
  windSpeed: number;
  visibility: number;
}

interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  alarms?: Date[];
}

interface ParkingPattern {
  dayOfWeek: number;
  hour: number;
  location: { lat: number; lng: number };
  duration: number;
  frequency: number;
}

interface UserPreferences {
  quietHoursStart?: string;
  quietHoursEnd?: string;
  notificationLeadTime: number;
  smartSuggestions: boolean;
  weatherAlerts: boolean;
  trafficAlerts: boolean;
  eventReminders: boolean;
}

class SmartNotificationsService {
  private static instance: SmartNotificationsService;
  private userContext: UserContext = {};
  private scheduledNotifications: Map<string, string> = new Map();
  private learningData: Map<string, any> = new Map();
  private preferences: UserPreferences = {
    notificationLeadTime: 15,
    smartSuggestions: true,
    weatherAlerts: true,
    trafficAlerts: true,
    eventReminders: true,
  };

  private readonly STORAGE_KEY = '@OkapiFind:smartNotifications';
  private readonly LEARNING_KEY = '@OkapiFind:notificationLearning';
  private readonly PREFERENCES_KEY = '@OkapiFind:notificationPreferences';

  private constructor() {}

  static getInstance(): SmartNotificationsService {
    if (!SmartNotificationsService.instance) {
      SmartNotificationsService.instance = new SmartNotificationsService();
    }
    return SmartNotificationsService.instance;
  }

  /**
   * Initialize smart notifications
   */
  async initialize(): Promise<void> {
    try {
      // Request permissions
      await this.requestPermissions();

      // Load preferences and learning data
      await this.loadPreferences();
      await this.loadLearningData();

      // Set notification handler
      this.setupNotificationHandlers();

      // Start context monitoring
      await this.startContextMonitoring();

      // Schedule smart notifications based on patterns
      await this.scheduleSmartNotifications();

      errorService.logInfo('Smart notifications initialized');
    } catch (error) {
      errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.GENERAL, {
        action: 'smart_notifications_init',
      });
    }
  }

  /**
   * Schedule context-aware notification
   */
  async scheduleContextual(context: {
    parkingLocation?: { lat: number; lng: number };
    meterExpiryTime?: Date;
    parkingDuration?: number;
    venue?: string;
  }): Promise<string[]> {
    const notifications: SmartNotification[] = [];

    try {
      // Update user context
      await this.updateUserContext();

      // 1. Meter expiry notification
      if (context.meterExpiryTime) {
        notifications.push(
          await this.createMeterExpiryNotification(context.meterExpiryTime)
        );
      }

      // 2. Weather-based notification
      if (this.userContext.weather && context.parkingLocation) {
        const weatherNotif = await this.createWeatherNotification(
          context.parkingLocation,
          this.userContext.weather
        );
        if (weatherNotif) notifications.push(weatherNotif);
      }

      // 3. Calendar-based notification
      if (this.userContext.calendar && context.parkingLocation) {
        const calendarNotifs = await this.createCalendarNotifications(
          context.parkingLocation,
          this.userContext.calendar
        );
        notifications.push(...calendarNotifs);
      }

      // 4. Smart suggestions based on patterns
      if (this.preferences.smartSuggestions) {
        const suggestions = await this.generateSmartSuggestions(context);
        notifications.push(...suggestions);
      }

      // 5. Street cleaning notification
      const streetCleaning = await this.checkStreetCleaning(context.parkingLocation);
      if (streetCleaning) {
        notifications.push(streetCleaning);
      }

      // Schedule all notifications
      const notificationIds: string[] = [];
      for (const notification of notifications) {
        const id = await this.scheduleNotification(notification);
        if (id) notificationIds.push(id);
      }

      // Learn from this scheduling
      await this.recordLearning('schedule', context, notifications);

      return notificationIds;
    } catch (error) {
      errorService.logError(error, ErrorSeverity.MEDIUM, ErrorCategory.GENERAL, {
        action: 'schedule_contextual',
        context,
      });
      return [];
    }
  }

  /**
   * Create meter expiry notification with smart timing
   */
  private async createMeterExpiryNotification(expiryTime: Date): Promise<SmartNotification> {
    const now = new Date();
    const timeUntilExpiry = expiryTime.getTime() - now.getTime();
    const leadTime = this.preferences.notificationLeadTime * 60 * 1000;

    // Smart timing based on user patterns
    const optimalTiming = await this.calculateOptimalNotificationTime(
      expiryTime,
      'meter_expiry'
    );

    return {
      id: `meter_${Date.now()}`,
      type: NotificationType.METER_EXPIRY,
      title: '⏰ Parking Meter Expiring Soon',
      body: this.generateSmartMessage('meter_expiry', {
        expiryTime,
        timeRemaining: Math.floor(leadTime / 60000),
      }),
      triggerAt: optimalTiming,
      priority: 'high',
      actions: [
        {
          id: 'extend',
          title: 'Extend Time',
          icon: 'clock',
        },
        {
          id: 'navigate',
          title: 'Navigate to Car',
          icon: 'car',
        },
        {
          id: 'snooze',
          title: 'Remind in 5 min',
          icon: 'bell',
        },
      ],
      sound: 'default',
    };
  }

  /**
   * Create weather-based notification
   */
  private async createWeatherNotification(
    location: { lat: number; lng: number },
    weather: WeatherData
  ): Promise<SmartNotification | null> {
    // Check for adverse weather conditions
    const needsAlert =
      weather.condition.includes('storm') ||
      weather.condition.includes('hail') ||
      weather.precipitation > 10 ||
      weather.windSpeed > 50;

    if (!needsAlert) return null;

    return {
      id: `weather_${Date.now()}`,
      type: NotificationType.WEATHER_ALERT,
      title: '🌧️ Weather Alert for Your Car',
      body: `${weather.condition} expected. Consider moving your car to covered parking.`,
      triggerAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min from now
      priority: 'high',
      location: {
        latitude: location.lat,
        longitude: location.lng,
        radius: 1000,
      },
    };
  }

  /**
   * Create calendar-based notifications
   */
  private async createCalendarNotifications(
    parkingLocation: { lat: number; lng: number },
    events: CalendarEvent[]
  ): Promise<SmartNotification[]> {
    const notifications: SmartNotification[] = [];

    for (const event of events) {
      // Check if event is within next 2 hours
      const timeUntilEvent = event.startDate.getTime() - Date.now();
      if (timeUntilEvent > 0 && timeUntilEvent < 2 * 60 * 60 * 1000) {
        // Calculate travel time from parking to event
        const travelTime = await this.estimateTravelTime(parkingLocation, event.location);

        const notification: SmartNotification = {
          id: `event_${event.id}`,
          type: NotificationType.EVENT_PARKING,
          title: `📅 Upcoming: ${event.title}`,
          body: `Leave in ${Math.ceil(travelTime / 60)} minutes to arrive on time`,
          triggerAt: new Date(event.startDate.getTime() - travelTime * 1000 - 10 * 60 * 1000),
          priority: 'high',
          data: { eventId: event.id },
        };

        notifications.push(notification);
      }
    }

    return notifications;
  }

  /**
   * Generate smart suggestions based on patterns
   */
  private async generateSmartSuggestions(context: any): Promise<SmartNotification[]> {
    const suggestions: SmartNotification[] = [];

    try {
      // Analyze parking patterns
      const patterns = await this.analyzeParkingPatterns();

      // Check if current parking deviates from pattern
      if (patterns.regularSpots) {
        const isRegularSpot = patterns.regularSpots.some(
          spot => this.isNearLocation(context.parkingLocation, spot, 100)
        );

        if (!isRegularSpot) {
          suggestions.push({
            id: `suggestion_${Date.now()}`,
            type: NotificationType.SMART_SUGGESTION,
            title: '💡 New Parking Spot',
            body: 'Save this location for quick access next time?',
            triggerAt: new Date(Date.now() + 5 * 60 * 1000),
            priority: 'low',
            actions: [
              { id: 'save', title: 'Save Location' },
              { id: 'dismiss', title: 'Dismiss' },
            ],
          });
        }
      }

      // Suggest optimal parking times based on ML predictions
      const predictions = await mlParkingPrediction.predictAvailability(
        context.parkingLocation,
        new Date()
      );

      if (predictions.confidence > 0.7 && predictions.suggestion) {
        suggestions.push({
          id: `prediction_${Date.now()}`,
          type: NotificationType.PARKING_PREDICTION,
          title: '🤖 Parking Tip',
          body: predictions.suggestion,
          triggerAt: new Date(Date.now() + 60 * 1000),
          priority: 'normal',
        });
      }

      return suggestions;
    } catch (error) {
      errorService.logError(error, ErrorSeverity.LOW, ErrorCategory.GENERAL, {
        action: 'generate_suggestions',
      });
      return [];
    }
  }

  /**
   * Check for street cleaning schedules
   */
  private async checkStreetCleaning(
    location?: { lat: number; lng: number }
  ): Promise<SmartNotification | null> {
    if (!location) return null;

    try {
      // Query street cleaning database/API
      const { data, error } = await supabase
        .from('street_cleaning_schedules')
        .select('*')
        .eq('active', true);

      if (error || !data) return null;

      // Check if location matches any cleaning schedule
      for (const schedule of data) {
        if (this.isLocationAffected(location, schedule)) {
          const nextCleaning = this.getNextCleaningTime(schedule);

          return {
            id: `cleaning_${Date.now()}`,
            type: NotificationType.STREET_CLEANING,
            title: '🧹 Street Cleaning Alert',
            body: `Street cleaning scheduled for ${nextCleaning.toLocaleString()}`,
            triggerAt: new Date(nextCleaning.getTime() - 2 * 60 * 60 * 1000), // 2 hours before
            priority: 'critical',
            location: {
              latitude: location.lat,
              longitude: location.lng,
              radius: 50,
            },
          };
        }
      }
    } catch (error) {
      errorService.logError(error, ErrorSeverity.LOW, ErrorCategory.GENERAL, {
        action: 'check_street_cleaning',
      });
    }

    return null;
  }

  /**
   * Schedule a notification
   */
  private async scheduleNotification(notification: SmartNotification): Promise<string | null> {
    try {
      // Check if within quiet hours
      if (this.isQuietHours(notification.triggerAt)) {
        // Reschedule for after quiet hours
        notification.triggerAt = this.getNextAvailableTime(notification.triggerAt);
      }

      const trigger = notification.location
        ? {
            type: 'location' as const,
            region: {
              identifier: notification.id,
              latitude: notification.location.latitude,
              longitude: notification.location.longitude,
              radius: notification.location.radius,
              notifyOnEnter: true,
              notifyOnExit: false,
            },
          }
        : { date: notification.triggerAt };

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data,
          sound: notification.sound || 'default',
          badge: notification.badge,
          categoryIdentifier: notification.categoryId,
          priority: notification.priority === 'critical' ?
            Notifications.AndroidNotificationPriority.HIGH :
            Notifications.AndroidNotificationPriority.DEFAULT,
        },
        trigger,
      });

      // Store scheduled notification
      this.scheduledNotifications.set(notification.id, id);
      await this.saveScheduledNotifications();

      return id;
    } catch (error) {
      errorService.logError(error, ErrorSeverity.MEDIUM, ErrorCategory.GENERAL, {
        action: 'schedule_notification',
        notification,
      });
      return null;
    }
  }

  /**
   * Calculate optimal notification timing using ML
   */
  private async calculateOptimalNotificationTime(
    targetTime: Date,
    type: string
  ): Promise<Date> {
    // Use learning data to optimize timing
    const userPatterns = this.learningData.get(`timing_${type}`) || {};

    // Default lead time
    let optimalLeadTime = this.preferences.notificationLeadTime * 60 * 1000;

    // Adjust based on user interaction patterns
    if (userPatterns.averageResponseTime) {
      optimalLeadTime = Math.max(
        userPatterns.averageResponseTime,
        5 * 60 * 1000 // Minimum 5 minutes
      );
    }

    // Consider day of week and time patterns
    const dayOfWeek = targetTime.getDay();
    const hour = targetTime.getHours();

    if (userPatterns.dayPatterns?.[dayOfWeek]) {
      const dayPattern = userPatterns.dayPatterns[dayOfWeek];
      if (dayPattern[hour]) {
        optimalLeadTime *= dayPattern[hour].multiplier || 1;
      }
    }

    return new Date(targetTime.getTime() - optimalLeadTime);
  }

  /**
   * Generate smart notification message
   */
  private generateSmartMessage(type: string, context: any): string {
    const templates = {
      meter_expiry: [
        `Your parking expires in ${context.timeRemaining} minutes`,
        `⏰ ${context.timeRemaining} min left on your meter`,
        `Time to head back! Meter expires in ${context.timeRemaining} min`,
      ],
      weather_alert: [
        `${context.condition} approaching your parking location`,
        `Weather alert: ${context.condition} expected soon`,
      ],
      smart_suggestion: [
        `Based on your patterns, consider ${context.suggestion}`,
        `Pro tip: ${context.suggestion}`,
      ],
    };

    const messages = templates[type] || [`Parking reminder`];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * Helper methods
   */
  private async updateUserContext(): Promise<void> {
    // Update location
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      this.userContext.location = await Location.getCurrentPositionAsync();
    }

    // Update calendar events
    if (Platform.OS !== 'web') {
      this.userContext.calendar = await this.getUpcomingEvents();
    }

    // Update weather
    this.userContext.weather = await this.fetchWeatherData();

    // Update parking patterns
    this.userContext.parkingHistory = await this.loadParkingPatterns();
  }

  private async getUpcomingEvents(): Promise<CalendarEvent[]> {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') return [];

      const calendars = await Calendar.getCalendarsAsync();
      const events: CalendarEvent[] = [];

      const startDate = new Date();
      const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      for (const calendar of calendars) {
        const calendarEvents = await Calendar.getEventsAsync(
          [calendar.id],
          startDate,
          endDate
        );

        events.push(...calendarEvents.map(e => ({
          id: e.id,
          title: e.title,
          startDate: new Date(e.startDate),
          endDate: new Date(e.endDate),
          location: e.location,
          alarms: e.alarms?.map(a => new Date(a.absoluteDate)),
        })));
      }

      return events;
    } catch (error) {
      return [];
    }
  }

  private async fetchWeatherData(): Promise<WeatherData | undefined> {
    // Implementation would fetch from weather API
    return undefined;
  }

  private async analyzeParkingPatterns(): Promise<any> {
    // Analyze user's parking history
    const history = await this.loadParkingPatterns();

    const regularSpots = history
      .filter(p => p.frequency > 3)
      .map(p => ({ lat: p.location.lat, lng: p.location.lng }));

    return { regularSpots };
  }

  private async loadParkingPatterns(): Promise<ParkingPattern[]> {
    // Load from database
    return [];
  }

  private async estimateTravelTime(
    from: { lat: number; lng: number },
    to?: string
  ): Promise<number> {
    // Simple estimate - would use Google Maps API in production
    return 15 * 60; // 15 minutes in seconds
  }

  private isNearLocation(
    loc1: any,
    loc2: any,
    radiusMeters: number
  ): boolean {
    if (!loc1 || !loc2) return false;

    const R = 6371e3; // Earth's radius in meters
    const φ1 = (loc1.lat * Math.PI) / 180;
    const φ2 = (loc2.lat * Math.PI) / 180;
    const Δφ = ((loc2.lat - loc1.lat) * Math.PI) / 180;
    const Δλ = ((loc2.lng - loc1.lng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance <= radiusMeters;
  }

  private isLocationAffected(location: any, schedule: any): boolean {
    // Check if location is within cleaning zone
    return false; // Simplified
  }

  private getNextCleaningTime(schedule: any): Date {
    // Calculate next cleaning time from schedule
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  private isQuietHours(time: Date): boolean {
    if (!this.preferences.quietHoursStart || !this.preferences.quietHoursEnd) {
      return false;
    }

    const hours = time.getHours();
    const startHour = parseInt(this.preferences.quietHoursStart.split(':')[0]);
    const endHour = parseInt(this.preferences.quietHoursEnd.split(':')[0]);

    if (startHour > endHour) {
      // Crosses midnight
      return hours >= startHour || hours < endHour;
    }

    return hours >= startHour && hours < endHour;
  }

  private getNextAvailableTime(time: Date): Date {
    if (!this.preferences.quietHoursEnd) return time;

    const endHour = parseInt(this.preferences.quietHoursEnd.split(':')[0]);
    const endMinute = parseInt(this.preferences.quietHoursEnd.split(':')[1] || '0');

    const nextTime = new Date(time);
    nextTime.setHours(endHour, endMinute, 0, 0);

    if (nextTime <= time) {
      nextTime.setDate(nextTime.getDate() + 1);
    }

    return nextTime;
  }

  /**
   * Setup notification handlers
   */
  private setupNotificationHandlers(): void {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Handle notification responses
    Notifications.addNotificationResponseReceivedListener(response => {
      this.handleNotificationResponse(response);
    });
  }

  private async handleNotificationResponse(
    response: Notifications.NotificationResponse
  ): Promise<void> {
    const { actionIdentifier, notification } = response;

    // Record interaction for learning
    await this.recordLearning('interaction', {
      notificationId: notification.request.identifier,
      action: actionIdentifier,
      timestamp: new Date(),
    });

    // Handle specific actions
    switch (actionIdentifier) {
      case 'extend':
        // Handle meter extension
        break;
      case 'navigate':
        // Open navigation
        break;
      case 'snooze':
        // Reschedule notification
        break;
    }
  }

  /**
   * Learning and improvement
   */
  private async recordLearning(type: string, ...data: any[]): Promise<void> {
    const key = `learning_${type}`;
    const existing = this.learningData.get(key) || [];
    existing.push({ timestamp: Date.now(), data });

    // Keep only recent data
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days
    const filtered = existing.filter(e => e.timestamp > cutoff);

    this.learningData.set(key, filtered);
    await this.saveLearningData();
  }

  /**
   * Storage methods
   */
  private async requestPermissions(): Promise<void> {
    await Notifications.requestPermissionsAsync();
  }

  private async startContextMonitoring(): Promise<void> {
    // Start background location updates if needed
    // Monitor calendar changes
    // Track weather updates
  }

  private async scheduleSmartNotifications(): Promise<void> {
    // Schedule regular smart notifications based on patterns
  }

  private async loadPreferences(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.PREFERENCES_KEY);
      if (stored) {
        this.preferences = { ...this.preferences, ...JSON.parse(stored) };
      }
    } catch (error) {
      errorService.logError(error, ErrorSeverity.LOW, ErrorCategory.STORAGE);
    }
  }

  private async loadLearningData(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.LEARNING_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.learningData = new Map(Object.entries(data));
      }
    } catch (error) {
      errorService.logError(error, ErrorSeverity.LOW, ErrorCategory.STORAGE);
    }
  }

  private async saveLearningData(): Promise<void> {
    try {
      const data = Object.fromEntries(this.learningData);
      await AsyncStorage.setItem(this.LEARNING_KEY, JSON.stringify(data));
    } catch (error) {
      errorService.logError(error, ErrorSeverity.LOW, ErrorCategory.STORAGE);
    }
  }

  private async saveScheduledNotifications(): Promise<void> {
    try {
      const data = Object.fromEntries(this.scheduledNotifications);
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      errorService.logError(error, ErrorSeverity.LOW, ErrorCategory.STORAGE);
    }
  }

  /**
   * Public API
   */
  async updatePreferences(prefs: Partial<UserPreferences>): Promise<void> {
    this.preferences = { ...this.preferences, ...prefs };
    await AsyncStorage.setItem(this.PREFERENCES_KEY, JSON.stringify(this.preferences));
  }

  async cancelNotification(notificationId: string): Promise<void> {
    const scheduledId = this.scheduledNotifications.get(notificationId);
    if (scheduledId) {
      await Notifications.cancelScheduledNotificationAsync(scheduledId);
      this.scheduledNotifications.delete(notificationId);
      await this.saveScheduledNotifications();
    }
  }

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    this.scheduledNotifications.clear();
    await this.saveScheduledNotifications();
  }

  getPreferences(): UserPreferences {
    return { ...this.preferences };
  }
}

export const smartNotifications = SmartNotificationsService.getInstance();