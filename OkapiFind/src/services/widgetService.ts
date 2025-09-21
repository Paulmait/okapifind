/**
 * Widget Service
 * Manages home/lock screen widget data for iOS and Android
 * Syncs with Firebase for real-time updates
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { NativeModules } from 'react-native';
import { watchConnectivity } from './watchConnectivity';
import { analytics } from './analytics';

// Widget data structure
interface WidgetData {
  carLocation: {
    latitude: number;
    longitude: number;
    address?: string;
    timestamp: number;
  } | null;
  distance: string;
  bearing: number;
  lastUpdate: number;
  isActive: boolean;
  message: string;
  userId?: string;
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
}

export const widgetService = new WidgetService();
export default widgetService;