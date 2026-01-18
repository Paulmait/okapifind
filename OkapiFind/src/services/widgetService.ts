// @ts-nocheck
/**
 * Enhanced Widget Service
 * Premium home/lock screen widgets for iOS and Android with advanced features
 * Supports multiple widget sizes, interactive elements, and real-time updates
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { NativeModules } from 'react-native';
import { watchConnectivity } from './watchConnectivity';
import { analytics } from './analytics';
import { smartParkingAI } from './smartParkingAI';
import { batteryOptimizationService } from './batteryOptimization';

// Enhanced widget data structure
interface WidgetData {
  carLocation: {
    latitude: number;
    longitude: number;
    address?: string;
    timestamp: number;
    floor?: string;
    notes?: string;
  } | null;
  distance: string;
  bearing: number;
  lastUpdate: number;
  isActive: boolean;
  message: string;
  userId?: string;
  // Premium features
  parkingTimer?: {
    expiresAt: number;
    reminderAt: number;
    remainingTime: string;
    isExpired: boolean;
  };
  weatherInfo?: {
    temperature: number;
    condition: string;
    icon: string;
  };
  aiPrediction?: {
    confidence: number;
    nextSpotSuggestion: string;
    walkTime: number;
  };
  quickActions: WidgetAction[];
  theme: WidgetTheme;
  size: WidgetSize;
}

interface WidgetAction {
  id: string;
  title: string;
  icon: string;
  action: 'find_car' | 'save_location' | 'set_timer' | 'navigate' | 'call_friends';
  isEnabled: boolean;
  isPremium: boolean;
}

interface WidgetTheme {
  name: 'light' | 'dark' | 'auto' | 'custom';
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
}

interface WidgetSize {
  type: 'small' | 'medium' | 'large' | 'extra_large';
  width: number;
  height: number;
  supportedFeatures: string[];
}

interface WidgetConfiguration {
  enableWeather: boolean;
  enableAIPredictions: boolean;
  enableTimer: boolean;
  enableQuickActions: boolean;
  enableInteractiveElements: boolean;
  enableBatteryOptimization: boolean;
  maxQuickActions: number;
  updateFrequency: 'real_time' | 'frequent' | 'normal' | 'battery_saver';
  showPrivacyMode: boolean;
}

interface WidgetAnalytics {
  views: number;
  interactions: number;
  actionUsage: Record<string, number>;
  averageViewTime: number;
  clickThroughRate: number;
  lastViewTime: number;
}

// Widget update intervals
const UPDATE_INTERVAL = {
  ACTIVE: 60000,    // 60 seconds when navigating
  INACTIVE: 300000, // 5 minutes when idle
  BACKGROUND: 180000 // 3 minutes in background
};

class WidgetService {
  private updateTimer: NodeJS.Timeout | null = null;
  private isNavigating: boolean = false;
  private widgetBridge: any = null;

  constructor() {
    this.initializeNativeBridge();
  }

  /**
   * Initialize native module bridge for widget communication
   */
  private initializeNativeBridge() {
    try {
      if (Platform.OS === 'ios') {
        // iOS WidgetKit bridge
        this.widgetBridge = NativeModules.WidgetKitBridge;
      } else if (Platform.OS === 'android') {
        // Android AppWidget bridge
        this.widgetBridge = NativeModules.AppWidgetBridge;
      }
    } catch (error) {
      console.log('Widget bridge not available:', error);
      // Widget functionality will be limited without native bridge
    }
  }

  /**
   * Update widget data
   */
  async updateWidget(data: Partial<WidgetData>): Promise<void> {
    try {
      // Get existing widget data
      const existingData = await this.getWidgetData();

      // Merge with new data
      const updatedData: WidgetData = {
        ...existingData,
        ...data,
        lastUpdate: Date.now(),
      };

      // Store in AsyncStorage for app group access
      await AsyncStorage.setItem('@widget_data', JSON.stringify(updatedData));

      // Update native widget
      if (this.widgetBridge) {
        if (Platform.OS === 'ios') {
          await this.updateiOSWidget(updatedData);
        } else if (Platform.OS === 'android') {
          await this.updateAndroidWidget(updatedData);
        }
      }

      analytics.logEvent('widget_updated', {
        hasCarLocation: !!updatedData.carLocation,
        isActive: updatedData.isActive,
      });
    } catch (error) {
      console.error('Failed to update widget:', error);
    }
  }

  /**
   * Update iOS WidgetKit widget
   */
  private async updateiOSWidget(data: WidgetData): Promise<void> {
    if (!this.widgetBridge?.updateWidget) return;

    try {
      // Format data for iOS widget
      const widgetPayload = {
        carLocation: data.carLocation ? {
          latitude: data.carLocation.latitude,
          longitude: data.carLocation.longitude,
          address: data.carLocation.address || '',
        } : null,
        distance: data.distance || 'No car saved',
        bearing: data.bearing || 0,
        message: data.message || 'Tap to find your car',
        timestamp: data.lastUpdate,
        isActive: data.isActive,
      };

      // Call native method to update widget
      await this.widgetBridge.updateWidget(widgetPayload);

      // Request widget timeline reload
      if (this.widgetBridge.reloadTimeline) {
        await this.widgetBridge.reloadTimeline('com.okapifind.widget');
      }
    } catch (error) {
      console.error('Failed to update iOS widget:', error);
    }
  }

  /**
   * Update Android AppWidget
   */
  private async updateAndroidWidget(data: WidgetData): Promise<void> {
    if (!this.widgetBridge?.updateWidget) return;

    try {
      // Format data for Android widget
      const widgetPayload = {
        carLatitude: data.carLocation?.latitude || 0,
        carLongitude: data.carLocation?.longitude || 0,
        carAddress: data.carLocation?.address || '',
        distance: data.distance || 'No car saved',
        bearing: data.bearing || 0,
        message: data.message || 'Tap to find your car',
        timestamp: data.lastUpdate,
        isActive: data.isActive,
      };

      // Call native method to update widget
      await this.widgetBridge.updateWidget(widgetPayload);

      // Force widget update
      if (this.widgetBridge.forceUpdate) {
        await this.widgetBridge.forceUpdate();
      }
    } catch (error) {
      console.error('Failed to update Android widget:', error);
    }
  }

  /**
   * Get current widget data
   */
  async getWidgetData(): Promise<WidgetData> {
    try {
      const dataStr = await AsyncStorage.getItem('@widget_data');
      if (dataStr) {
        return JSON.parse(dataStr);
      }
    } catch (error) {
      console.error('Failed to get widget data:', error);
    }

    // Return default data
    return {
      carLocation: null,
      distance: 'No car saved',
      bearing: 0,
      lastUpdate: Date.now(),
      isActive: false,
      message: 'Save your parking location',
    };
  }

  /**
   * Start widget updates for navigation
   */
  startNavigationUpdates(
    carLocation: { latitude: number; longitude: number; address?: string },
    userId?: string
  ): void {
    this.isNavigating = true;

    // Update immediately
    this.updateWidget({
      carLocation: {
        ...carLocation,
        timestamp: Date.now(),
      },
      isActive: true,
      message: 'Walking to car...',
      userId,
    });

    // Start periodic updates
    this.startPeriodicUpdates(UPDATE_INTERVAL.ACTIVE);

    analytics.logEvent('widget_navigation_started');
  }

  /**
   * Stop navigation updates
   */
  stopNavigationUpdates(): void {
    this.isNavigating = false;

    // Update widget to inactive state
    this.updateWidget({
      isActive: false,
      message: 'Tap to find your car',
    });

    // Switch to slower update interval
    this.startPeriodicUpdates(UPDATE_INTERVAL.INACTIVE);

    analytics.logEvent('widget_navigation_stopped');
  }

  /**
   * Start periodic widget updates
   */
  private startPeriodicUpdates(intervalMs: number): void {
    // Clear existing timer
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    // Set new timer
    this.updateTimer = setInterval(async () => {
      const data = await this.getWidgetData();

      // Only update if there's a car location
      if (data.carLocation) {
        await this.updateWidget({
          lastUpdate: Date.now(),
        });
      }
    }, intervalMs);
  }

  /**
   * Stop all widget updates
   */
  stopAllUpdates(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    this.updateWidget({
      isActive: false,
      message: 'App closed',
    });
  }

  /**
   * Update distance display for widget
   */
  async updateDistance(
    userLocation: { latitude: number; longitude: number },
    carLocation: { latitude: number; longitude: number }
  ): Promise<void> {
    const distance = this.calculateDistance(userLocation, carLocation);
    const bearing = this.calculateBearing(userLocation, carLocation);

    let distanceText: string;
    if (distance < 100) {
      distanceText = `${Math.round(distance)} m away`;
    } else if (distance < 1000) {
      distanceText = `${Math.round(distance / 10) * 10} m away`;
    } else {
      distanceText = `${(distance / 1000).toFixed(1)} km away`;
    }

    await this.updateWidget({
      distance: distanceText,
      bearing: bearing,
      message: this.isNavigating ? 'Walking to car...' : 'Car is nearby',
    });
  }

  /**
   * Clear widget data
   */
  async clearWidget(): Promise<void> {
    await this.updateWidget({
      carLocation: null,
      distance: 'No car saved',
      bearing: 0,
      isActive: false,
      message: 'Save your parking location',
    });

    analytics.logEvent('widget_cleared');
  }

  /**
   * Handle app background/foreground state
   */
  handleAppStateChange(isActive: boolean): void {
    if (isActive) {
      // App is active, use faster updates if navigating
      if (this.isNavigating) {
        this.startPeriodicUpdates(UPDATE_INTERVAL.ACTIVE);
      } else {
        this.startPeriodicUpdates(UPDATE_INTERVAL.INACTIVE);
      }
    } else {
      // App in background, use slower updates
      this.startPeriodicUpdates(UPDATE_INTERVAL.BACKGROUND);
    }
  }

  /**
   * Register widget tap handler
   */
  registerWidgetTapHandler(handler: () => void): void {
    if (this.widgetBridge?.setTapHandler) {
      this.widgetBridge.setTapHandler(handler);
    }
  }

  /**
   * Check if widgets are supported
   */
  isSupported(): boolean {
    return !!this.widgetBridge;
  }

  /**
   * Calculate distance between two coordinates
   */
  private calculateDistance(
    coord1: { latitude: number; longitude: number },
    coord2: { latitude: number; longitude: number }
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Calculate bearing between two coordinates
   */
  private calculateBearing(
    coord1: { latitude: number; longitude: number },
    coord2: { latitude: number; longitude: number }
  ): number {
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
      Math.cos(φ1) * Math.sin(φ2) -
      Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
  }

  // PREMIUM FEATURES

  /**
   * Configure widget with premium features
   */
  async configureWidget(config: Partial<WidgetConfiguration>): Promise<void> {
    try {
      const currentConfig = await this.getWidgetConfiguration();
      const newConfig = { ...currentConfig, ...config };

      await AsyncStorage.setItem('@widget_config', JSON.stringify(newConfig));

      // Update widget with new configuration
      await this.updateWidgetWithPremiumFeatures();

      analytics.logEvent('widget_configured', {
        features_enabled: Object.keys(config).length,
        premium_features: Object.entries(config).filter(([k, v]) =>
          k.includes('AI') || k.includes('weather') || k.includes('interactive')
        ).length,
      });
    } catch (error) {
      console.error('Failed to configure widget:', error);
    }
  }

  /**
   * Update widget with premium features enabled
   */
  private async updateWidgetWithPremiumFeatures(): Promise<void> {
    const config = await this.getWidgetConfiguration();
    const widgetData = await this.getWidgetData();

    // Add AI predictions if enabled
    if (config.enableAIPredictions && widgetData.carLocation) {
      const prediction = await smartParkingAI.predictParkingSpot({
        coords: widgetData.carLocation
      } as any);

      widgetData.aiPrediction = {
        confidence: prediction.confidence,
        nextSpotSuggestion: prediction.reasons[0] || 'Good parking area nearby',
        walkTime: prediction.estimatedWalkTime,
      };
    }

    // Add weather information if enabled
    if (config.enableWeather && widgetData.carLocation) {
      const weather = await this.fetchWeatherForLocation(widgetData.carLocation);
      widgetData.weatherInfo = weather;
    }

    // Add parking timer if enabled
    if (config.enableTimer) {
      const timer = await this.getParkingTimer();
      widgetData.parkingTimer = timer;
    }

    // Configure quick actions
    if (config.enableQuickActions) {
      widgetData.quickActions = await this.getQuickActions(config.maxQuickActions);
    }

    // Apply theme
    widgetData.theme = await this.getWidgetTheme();

    // Battery optimization
    if (config.enableBatteryOptimization) {
      const batteryStatus = await batteryOptimizationService.getBatteryStatus();

      // Adjust update frequency based on battery
      if (batteryStatus.batteryLevel < 0.2) {
        config.updateFrequency = 'battery_saver';
      }
    }

    await this.updateWidget(widgetData);
  }

  /**
   * Handle widget interaction
   */
  async handleWidgetInteraction(actionId: string): Promise<void> {
    try {
      const analytics_data = {
        action_id: actionId,
        widget_size: await this.getCurrentWidgetSize(),
        timestamp: Date.now(),
      };

      // Update analytics
      await this.updateWidgetAnalytics(actionId);

      switch (actionId) {
        case 'find_car':
          await this.openAppToFindCar();
          break;
        case 'save_location':
          await this.quickSaveLocation();
          break;
        case 'set_timer':
          await this.openTimerInterface();
          break;
        case 'navigate':
          await this.startNavigation();
          break;
        case 'call_friends':
          await this.callEmergencyContacts();
          break;
        default:
          console.warn(`Unknown widget action: ${actionId}`);
      }

      analytics.logEvent('widget_interaction', analytics_data);
    } catch (error) {
      console.error('Failed to handle widget interaction:', error);
    }
  }

  /**
   * Create interactive widget timeline (iOS)
   */
  async createInteractiveTimeline(): Promise<void> {
    if (Platform.OS !== 'ios' || !this.widgetBridge?.createTimeline) return;

    try {
      const config = await this.getWidgetConfiguration();
      const entries = [];

      // Create timeline entries for the next 24 hours
      const now = new Date();
      for (let i = 0; i < 24; i++) {
        const entryTime = new Date(now.getTime() + (i * 60 * 60 * 1000));
        const widgetData = await this.predictWidgetDataForTime(entryTime);

        entries.push({
          date: entryTime.toISOString(),
          data: widgetData,
          relevance: this.calculateTimelineRelevance(entryTime, widgetData),
        });
      }

      await this.widgetBridge.createTimeline(entries);

      analytics.logEvent('interactive_timeline_created', {
        entries_count: entries.length,
        features_enabled: config,
      });
    } catch (error) {
      console.error('Failed to create interactive timeline:', error);
    }
  }

  /**
   * Setup widget intents (iOS)
   */
  async setupWidgetIntents(): Promise<void> {
    if (Platform.OS !== 'ios' || !this.widgetBridge?.setupIntents) return;

    const intents = [
      {
        identifier: 'FindCarIntent',
        title: 'Find My Car',
        description: 'Navigate to your parked car',
        parameters: [],
      },
      {
        identifier: 'SaveLocationIntent',
        title: 'Save Parking Location',
        description: 'Save current location as parking spot',
        parameters: [],
      },
      {
        identifier: 'SetTimerIntent',
        title: 'Set Parking Timer',
        description: 'Set a reminder for parking meter',
        parameters: [
          { name: 'duration', type: 'integer', required: true },
          { name: 'unit', type: 'string', required: true },
        ],
      },
    ];

    await this.widgetBridge.setupIntents(intents);
  }

  /**
   * Configure widget sizes and layouts
   */
  async configureWidgetSizes(): Promise<void> {
    const sizes: WidgetSize[] = [
      {
        type: 'small',
        width: 170,
        height: 170,
        supportedFeatures: ['distance', 'bearing', 'timer'],
      },
      {
        type: 'medium',
        width: 360,
        height: 170,
        supportedFeatures: ['distance', 'bearing', 'timer', 'weather', 'quickActions'],
      },
      {
        type: 'large',
        width: 360,
        height: 380,
        supportedFeatures: ['distance', 'bearing', 'timer', 'weather', 'quickActions', 'aiPrediction', 'map'],
      },
      {
        type: 'extra_large',
        width: 720,
        height: 380,
        supportedFeatures: ['all'],
      },
    ];

    await AsyncStorage.setItem('@widget_sizes', JSON.stringify(sizes));

    if (this.widgetBridge?.configureLayouts) {
      await this.widgetBridge.configureLayouts(sizes);
    }
  }

  /**
   * Enable widget privacy mode
   */
  async enablePrivacyMode(enabled: boolean): Promise<void> {
    const config = await this.getWidgetConfiguration();
    config.showPrivacyMode = enabled;

    await AsyncStorage.setItem('@widget_config', JSON.stringify(config));

    // Update widget to hide sensitive information
    if (enabled) {
      await this.updateWidget({
        carLocation: null,
        distance: 'Hidden',
        message: 'Privacy mode enabled',
        quickActions: [],
      });
    }

    analytics.logEvent('widget_privacy_mode_toggled', { enabled });
  }

  /**
   * Get widget analytics
   */
  async getWidgetAnalytics(): Promise<WidgetAnalytics> {
    try {
      const data = await AsyncStorage.getItem('@widget_analytics');
      return data ? JSON.parse(data) : {
        views: 0,
        interactions: 0,
        actionUsage: {},
        averageViewTime: 0,
        clickThroughRate: 0,
        lastViewTime: 0,
      };
    } catch (error) {
      console.error('Failed to get widget analytics:', error);
      return {
        views: 0,
        interactions: 0,
        actionUsage: {},
        averageViewTime: 0,
        clickThroughRate: 0,
        lastViewTime: 0,
      };
    }
  }

  /**
   * Update widget analytics
   */
  private async updateWidgetAnalytics(actionId?: string): Promise<void> {
    try {
      const analytics = await this.getWidgetAnalytics();

      if (actionId) {
        analytics.interactions++;
        analytics.actionUsage[actionId] = (analytics.actionUsage[actionId] || 0) + 1;
      } else {
        analytics.views++;
        analytics.lastViewTime = Date.now();
      }

      // Calculate click-through rate
      analytics.clickThroughRate = analytics.interactions / Math.max(analytics.views, 1);

      await AsyncStorage.setItem('@widget_analytics', JSON.stringify(analytics));
    } catch (error) {
      console.error('Failed to update widget analytics:', error);
    }
  }

  // Helper methods for premium features

  private async getWidgetConfiguration(): Promise<WidgetConfiguration> {
    try {
      const data = await AsyncStorage.getItem('@widget_config');
      return data ? JSON.parse(data) : {
        enableWeather: true,
        enableAIPredictions: true,
        enableTimer: true,
        enableQuickActions: true,
        enableInteractiveElements: true,
        enableBatteryOptimization: true,
        maxQuickActions: 4,
        updateFrequency: 'normal',
        showPrivacyMode: false,
      };
    } catch (error) {
      console.error('Failed to get widget configuration:', error);
      return {} as WidgetConfiguration;
    }
  }

  private async fetchWeatherForLocation(location: any): Promise<any> {
    // This would integrate with a weather API
    return {
      temperature: 22,
      condition: 'Sunny',
      icon: 'sun.max.fill',
    };
  }

  private async getParkingTimer(): Promise<any> {
    // This would integrate with your timer service
    const now = Date.now();
    const expiresAt = now + (2 * 60 * 60 * 1000); // 2 hours from now

    return {
      expiresAt,
      reminderAt: expiresAt - (15 * 60 * 1000), // 15 minutes before
      remainingTime: '1h 45m',
      isExpired: false,
    };
  }

  private async getQuickActions(maxActions: number): Promise<WidgetAction[]> {
    const allActions: WidgetAction[] = [
      {
        id: 'find_car',
        title: 'Find Car',
        icon: 'car.fill',
        action: 'find_car',
        isEnabled: true,
        isPremium: false,
      },
      {
        id: 'save_location',
        title: 'Save Location',
        icon: 'mappin.circle.fill',
        action: 'save_location',
        isEnabled: true,
        isPremium: false,
      },
      {
        id: 'set_timer',
        title: 'Set Timer',
        icon: 'timer.circle.fill',
        action: 'set_timer',
        isEnabled: true,
        isPremium: true,
      },
      {
        id: 'navigate',
        title: 'Navigate',
        icon: 'location.north.circle.fill',
        action: 'navigate',
        isEnabled: true,
        isPremium: true,
      },
      {
        id: 'call_friends',
        title: 'Call Friends',
        icon: 'phone.circle.fill',
        action: 'call_friends',
        isEnabled: true,
        isPremium: true,
      },
    ];

    return allActions.slice(0, maxActions);
  }

  private async getWidgetTheme(): Promise<WidgetTheme> {
    try {
      const data = await AsyncStorage.getItem('@widget_theme');
      return data ? JSON.parse(data) : {
        name: 'auto',
        primaryColor: '#007AFF',
        secondaryColor: '#34C759',
        backgroundColor: '#FFFFFF',
        textColor: '#000000',
        accentColor: '#FF3B30',
      };
    } catch (error) {
      console.error('Failed to get widget theme:', error);
      return {} as WidgetTheme;
    }
  }

  private async getCurrentWidgetSize(): Promise<string> {
    // This would be provided by the native widget
    return 'medium';
  }

  private async predictWidgetDataForTime(time: Date): Promise<Partial<WidgetData>> {
    // Predict what the widget should show at a specific time
    const hour = time.getHours();

    if (hour >= 7 && hour <= 9) {
      return {
        message: 'Morning commute - check parking ahead',
        isActive: true,
      };
    } else if (hour >= 17 && hour <= 19) {
      return {
        message: 'Evening commute - expect busy parking',
        isActive: true,
      };
    } else {
      return {
        message: 'Tap to find your car',
        isActive: false,
      };
    }
  }

  private calculateTimelineRelevance(time: Date, data: any): number {
    // Calculate how relevant this timeline entry is
    const hour = time.getHours();

    // Peak hours are more relevant
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      return 1.0;
    }

    // Regular hours
    if (hour >= 6 && hour <= 22) {
      return 0.7;
    }

    // Night hours
    return 0.3;
  }

  // Action handlers
  private async openAppToFindCar(): Promise<void> {
    if (this.widgetBridge?.openApp) {
      await this.widgetBridge.openApp({ action: 'find_car' });
    }
  }

  private async quickSaveLocation(): Promise<void> {
    // Quick save current location
    if (this.widgetBridge?.quickAction) {
      await this.widgetBridge.quickAction({ action: 'save_location' });
    }
  }

  private async openTimerInterface(): Promise<void> {
    if (this.widgetBridge?.openApp) {
      await this.widgetBridge.openApp({ action: 'timer', screen: 'timer_setup' });
    }
  }

  private async startNavigation(): Promise<void> {
    // Start navigation to saved car location
    if (this.widgetBridge?.startNavigation) {
      const widgetData = await this.getWidgetData();
      if (widgetData.carLocation) {
        await this.widgetBridge.startNavigation(widgetData.carLocation);
      }
    }
  }

  private async callEmergencyContacts(): Promise<void> {
    // Emergency feature to call predefined contacts
    if (this.widgetBridge?.makeCall) {
      // This would get emergency contacts from user settings
      await this.widgetBridge.makeCall({ type: 'emergency' });
    }
  }
}

export const widgetService = new WidgetService();
export default widgetService;