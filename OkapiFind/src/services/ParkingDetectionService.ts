import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { calculateDistance } from '../utils/calculateDistance';
import { CarLocation } from '../hooks/useCarLocation';
import { smartPOIService } from './smartPOIService';

/**
 * Enhanced Parking Detection Service
 * Uses multiple strategies to detect parking events without Timeline API
 */

// Task names for background location tracking
const LOCATION_TRACKING_TASK = 'parking-location-tracking';
const GEOFENCE_TASK = 'parking-geofence-task';

// Storage keys
const STORAGE_KEYS = {
  PARKING_HISTORY: '@OkapiFind:parkingHistory',
  DETECTION_SETTINGS: '@OkapiFind:detectionSettings',
  ACTIVITY_LOG: '@OkapiFind:activityLog',
  FREQUENT_LOCATIONS: '@OkapiFind:frequentLocations',
};

// Detection thresholds
const THRESHOLDS = {
  MIN_PARKING_DURATION_MS: 5 * 60 * 1000, // 5 minutes minimum stop
  MAX_WALKING_SPEED_MS: 1.5, // meters per second (walking speed)
  MIN_DRIVING_SPEED_MS: 5, // meters per second
  PARKING_RADIUS_METERS: 50, // Consider same parking spot within 50m
  CONFIDENCE_THRESHOLD: 0.7, // Minimum confidence for auto-save
  GEOFENCE_RADIUS: 100, // meters
};

export interface ParkingEvent {
  id: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    altitude?: number;
  };
  timestamp: Date;
  endTime?: Date;
  duration?: number; // minutes
  confidence: number;
  detectionMethod: 'manual' | 'automatic' | 'geofence' | 'activity' | 'speed';
  address?: string;
  notes?: string;
  isConfirmed: boolean;
}

export interface ActivityState {
  type: 'still' | 'walking' | 'running' | 'driving' | 'cycling' | 'unknown';
  confidence: number;
  timestamp: Date;
}

export interface DetectionSettings {
  enabled: boolean;
  autoSave: boolean;
  minConfidence: number;
  notifyOnDetection: boolean;
  useGeofencing: boolean;
  frequentLocationsEnabled: boolean;
  backgroundTracking: boolean;
}

export interface FrequentLocation {
  id: string;
  location: {
    latitude: number;
    longitude: number;
  };
  address?: string;
  name?: string;
  visitCount: number;
  lastVisit: Date;
  averageDuration: number; // minutes
  type?: 'home' | 'work' | 'parking' | 'other';
}

class ParkingDetectionService {
  private static instance: ParkingDetectionService;

  private currentActivity: ActivityState | null = null;
  private lastKnownLocation: Location.LocationObject | null = null;
  private potentialParkingLocation: Location.LocationObject | null = null;
  private parkingStartTime: Date | null = null;
  private locationHistory: Location.LocationObject[] = [];
  private isTracking: boolean = false;
  private settings: DetectionSettings = {
    enabled: true,
    autoSave: false,
    minConfidence: 0.7,
    notifyOnDetection: true,
    useGeofencing: true,
    frequentLocationsEnabled: true,
    backgroundTracking: false,
  };

  private constructor() {
    this.loadSettings();
  }

  public static getInstance(): ParkingDetectionService {
    if (!ParkingDetectionService.instance) {
      ParkingDetectionService.instance = new ParkingDetectionService();
    }
    return ParkingDetectionService.instance;
  }

  /**
   * Initialize parking detection service
   */
  public async initialize(): Promise<void> {
    await this.loadSettings();

    if (this.settings.enabled) {
      await this.requestPermissions();

      if (this.settings.backgroundTracking) {
        await this.startBackgroundTracking();
      } else {
        await this.startForegroundTracking();
      }
    }
  }

  /**
   * Request necessary permissions
   */
  private async requestPermissions(): Promise<boolean> {
    try {
      const { status: foregroundStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        console.log('Foreground location permission denied');
        return false;
      }

      if (this.settings.backgroundTracking) {
        const { status: backgroundStatus } =
          await Location.requestBackgroundPermissionsAsync();

        if (backgroundStatus !== 'granted') {
          console.log('Background location permission denied');
          this.settings.backgroundTracking = false;
          await this.saveSettings();
        }
      }

      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Start foreground location tracking
   */
  public async startForegroundTracking(): Promise<void> {
    if (this.isTracking) return;

    try {
      this.isTracking = true;

      // Watch position with high accuracy
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // Update every 10 seconds
          distanceInterval: 10, // Or every 10 meters
        },
        this.onLocationUpdate.bind(this)
      );

      // Store subscription for cleanup
      (this as any).locationSubscription = subscription;

      console.log('Foreground tracking started');
    } catch (error) {
      console.error('Error starting foreground tracking:', error);
      this.isTracking = false;
    }
  }

  /**
   * Start background location tracking
   */
  public async startBackgroundTracking(): Promise<void> {
    if (Platform.OS === 'web') {
      console.log('Background tracking not supported on web');
      return;
    }

    try {
      // Define background location task
      await TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
        if (error) {
          console.error('Background location error:', error);
          return;
        }

        if (data) {
          const { locations } = data as any;
          if (locations && locations.length > 0) {
            const location = locations[locations.length - 1];
            await this.processBackgroundLocation(location);
          }
        }
      });

      // Start background location updates
      await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000, // 30 seconds
        distanceInterval: 50, // 50 meters
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'OkapiFind',
          notificationBody: 'Tracking your parking location',
          notificationColor: '#007AFF',
        },
      });

      console.log('Background tracking started');
    } catch (error) {
      console.error('Error starting background tracking:', error);
    }
  }

  /**
   * Process location update
   */
  private async onLocationUpdate(location: Location.LocationObject): Promise<void> {
    // Add to history
    this.locationHistory.push(location);
    if (this.locationHistory.length > 100) {
      this.locationHistory.shift(); // Keep only last 100 points
    }

    // Detect activity changes
    const activity = await this.detectActivity(location);

    // Check for parking events
    await this.checkForParking(location, activity);

    // Update frequent locations
    if (this.settings.frequentLocationsEnabled) {
      await this.updateFrequentLocations(location);
    }

    this.lastKnownLocation = location;
  }

  /**
   * Process background location update
   */
  private async processBackgroundLocation(location: Location.LocationObject): Promise<void> {
    // Store in activity log
    const activityLog = await this.getActivityLog();
    activityLog.push({
      location,
      timestamp: new Date(),
    });

    // Keep only last 24 hours
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = activityLog.filter(
      (entry: any) => new Date(entry.timestamp).getTime() > dayAgo
    );

    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVITY_LOG, JSON.stringify(filtered));

    // Process for parking detection
    await this.onLocationUpdate(location);
  }

  /**
   * Detect activity type based on movement patterns
   */
  private async detectActivity(location: Location.LocationObject): Promise<ActivityState> {
    if (!this.lastKnownLocation) {
      return {
        type: 'unknown',
        confidence: 0,
        timestamp: new Date(),
      };
    }

    const distance = calculateDistance(
      this.lastKnownLocation.coords.latitude,
      this.lastKnownLocation.coords.longitude,
      location.coords.latitude,
      location.coords.longitude
    );

    const timeDiff = (location.timestamp - this.lastKnownLocation.timestamp) / 1000; // seconds
    const speed = timeDiff > 0 ? distance / timeDiff : 0; // m/s

    let activity: ActivityState;

    // Use speed and accuracy to determine activity
    if (speed < THRESHOLDS.MAX_WALKING_SPEED_MS) {
      if (distance < 5) {
        activity = { type: 'still', confidence: 0.9, timestamp: new Date() };
      } else {
        activity = { type: 'walking', confidence: 0.8, timestamp: new Date() };
      }
    } else if (speed < THRESHOLDS.MIN_DRIVING_SPEED_MS) {
      activity = { type: 'cycling', confidence: 0.6, timestamp: new Date() };
    } else {
      activity = { type: 'driving', confidence: 0.8, timestamp: new Date() };
    }

    // Check for activity transition
    if (this.currentActivity && this.currentActivity.type !== activity.type) {
      await this.onActivityTransition(this.currentActivity, activity, location);
    }

    this.currentActivity = activity;
    return activity;
  }

  /**
   * Handle activity transitions (e.g., driving to walking)
   */
  private async onActivityTransition(
    fromActivity: ActivityState,
    toActivity: ActivityState,
    location: Location.LocationObject
  ): Promise<void> {
    // Detect parking: transition from driving to walking/still
    if (fromActivity.type === 'driving' &&
        (toActivity.type === 'walking' || toActivity.type === 'still')) {

      console.log('Potential parking detected: driving -> walking/still');

      this.potentialParkingLocation = location;
      this.parkingStartTime = new Date();

      // Set a timer to confirm parking after minimum duration
      setTimeout(() => {
        this.confirmParking(location);
      }, THRESHOLDS.MIN_PARKING_DURATION_MS);
    }

    // Detect departure: transition from still/walking to driving
    if ((fromActivity.type === 'still' || fromActivity.type === 'walking') &&
        toActivity.type === 'driving') {

      console.log('Departure detected: walking/still -> driving');

      // Clear any pending parking detection
      this.potentialParkingLocation = null;
      this.parkingStartTime = null;
    }
  }

  /**
   * Check for parking based on current state
   */
  private async checkForParking(
    location: Location.LocationObject,
    activity: ActivityState
  ): Promise<void> {
    // If we've been still for a while after driving
    if (this.potentialParkingLocation && this.parkingStartTime) {
      const duration = Date.now() - this.parkingStartTime.getTime();

      if (duration >= THRESHOLDS.MIN_PARKING_DURATION_MS) {
        const distance = calculateDistance(
          this.potentialParkingLocation.coords.latitude,
          this.potentialParkingLocation.coords.longitude,
          location.coords.latitude,
          location.coords.longitude
        );

        // If still near the potential parking location
        if (distance < THRESHOLDS.PARKING_RADIUS_METERS) {
          await this.confirmParking(this.potentialParkingLocation);
        }
      }
    }
  }

  /**
   * Confirm and save parking location
   * Integrates with Smart POI service to suppress at known locations (home, work, etc.)
   */
  private async confirmParking(location: Location.LocationObject): Promise<void> {
    if (!this.potentialParkingLocation || !this.parkingStartTime) return;

    // SMART POI CHECK: Don't auto-save parking at known locations like home/work
    try {
      await smartPOIService.initialize();
      const poiCheck = await smartPOIService.checkLocation(
        location.coords.latitude,
        location.coords.longitude
      );

      if (poiCheck.isAtKnownPOI && poiCheck.shouldSuppressAutoDetection) {
        console.log(`Parking at known POI "${poiCheck.poi?.name}" - suppressing auto-save`);
        // Reset detection state without saving
        this.potentialParkingLocation = null;
        this.parkingStartTime = null;
        return;
      }
    } catch (error) {
      console.log('Smart POI check failed, continuing with parking detection:', error);
    }

    const confidence = this.calculateParkingConfidence(location);

    const parkingEvent: ParkingEvent = {
      id: `parking_${Date.now()}`,
      location: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        altitude: location.coords.altitude || undefined,
      },
      timestamp: this.parkingStartTime,
      confidence,
      detectionMethod: 'activity',
      isConfirmed: false,
    };

    // Get address if possible
    try {
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address) {
        parkingEvent.address = `${address.street || ''} ${address.name || ''}, ${address.city || ''}`.trim();
      }
    } catch (error) {
      console.log('Could not reverse geocode:', error);
    }

    // Save to history
    await this.saveParkingEvent(parkingEvent);

    // Auto-save as current car location if confidence is high
    if (this.settings.autoSave && confidence >= this.settings.minConfidence) {
      await this.saveAsCarLocation(parkingEvent);
    }

    // Notify user if enabled
    if (this.settings.notifyOnDetection) {
      this.notifyParkingDetected(parkingEvent);
    }

    // Reset detection state
    this.potentialParkingLocation = null;
    this.parkingStartTime = null;
  }

  /**
   * Calculate confidence score for parking detection
   */
  private calculateParkingConfidence(location: Location.LocationObject): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on accuracy
    if (location.coords.accuracy && location.coords.accuracy < 20) {
      confidence += 0.2;
    } else if (location.coords.accuracy && location.coords.accuracy < 50) {
      confidence += 0.1;
    }

    // Increase confidence if near a known frequent location
    // (would check against frequent locations here)

    // Increase confidence based on time of day (parking more likely during business hours)
    const hour = new Date().getHours();
    if (hour >= 8 && hour <= 18) {
      confidence += 0.1;
    }

    // Increase confidence if activity pattern is clear
    if (this.currentActivity && this.currentActivity.confidence > 0.8) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Save parking event to history
   */
  private async saveParkingEvent(event: ParkingEvent): Promise<void> {
    try {
      const historyStr = await AsyncStorage.getItem(STORAGE_KEYS.PARKING_HISTORY);
      const history = historyStr ? JSON.parse(historyStr) : [];

      history.push(event);

      // Keep only last 50 parking events
      if (history.length > 50) {
        history.shift();
      }

      await AsyncStorage.setItem(STORAGE_KEYS.PARKING_HISTORY, JSON.stringify(history));
    } catch (error) {
      console.error('Error saving parking event:', error);
    }
  }

  /**
   * Save parking event as current car location
   */
  private async saveAsCarLocation(event: ParkingEvent): Promise<void> {
    const carLocation: CarLocation = {
      latitude: event.location.latitude,
      longitude: event.location.longitude,
      timestamp: event.timestamp.getTime(),
      address: event.address,
      notes: `Auto-detected parking (${(event.confidence * 100).toFixed(0)}% confidence)`,
    };

    // Use the car location hook's storage
    await AsyncStorage.setItem('@OkapiFind:carLocation', JSON.stringify(carLocation));
  }

  /**
   * Notify user about detected parking
   */
  private notifyParkingDetected(event: ParkingEvent): void {
    // This would trigger a local notification
    // For now, just log it
    console.log('Parking detected:', event);

    // In production, would use expo-notifications to show:
    // "Parking location detected. Confidence: X%. Tap to confirm."
  }

  /**
   * Update frequent locations
   */
  private async updateFrequentLocations(location: Location.LocationObject): Promise<void> {
    try {
      const frequentStr = await AsyncStorage.getItem(STORAGE_KEYS.FREQUENT_LOCATIONS);
      const frequentLocations: FrequentLocation[] = frequentStr ? JSON.parse(frequentStr) : [];

      // Check if near any existing frequent location
      let foundNearby = false;

      for (const freq of frequentLocations) {
        const distance = calculateDistance(
          freq.location.latitude,
          freq.location.longitude,
          location.coords.latitude,
          location.coords.longitude
        );

        if (distance < THRESHOLDS.PARKING_RADIUS_METERS) {
          freq.visitCount++;
          freq.lastVisit = new Date();
          foundNearby = true;
          break;
        }
      }

      // If not near any frequent location and we've been here a while, add it
      if (!foundNearby && this.parkingStartTime) {
        const duration = (Date.now() - this.parkingStartTime.getTime()) / 60000; // minutes

        if (duration > 30) { // Been here for 30+ minutes
          const newFrequent: FrequentLocation = {
            id: `freq_${Date.now()}`,
            location: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            },
            visitCount: 1,
            lastVisit: new Date(),
            averageDuration: duration,
          };

          frequentLocations.push(newFrequent);
        }
      }

      await AsyncStorage.setItem(
        STORAGE_KEYS.FREQUENT_LOCATIONS,
        JSON.stringify(frequentLocations)
      );
    } catch (error) {
      console.error('Error updating frequent locations:', error);
    }
  }

  /**
   * Set up geofencing for frequent parking spots
   */
  public async setupGeofences(locations: FrequentLocation[]): Promise<void> {
    if (!this.settings.useGeofencing || Platform.OS === 'web') {
      return;
    }

    try {
      // Define geofence task
      await TaskManager.defineTask(GEOFENCE_TASK, ({ data, error }) => {
        if (error) {
          console.error('Geofence error:', error);
          return;
        }

        if (data) {
          const { eventType, region } = data as any;

          if (eventType === Location.GeofencingEventType.Enter) {
            console.log('Entered geofence:', region);
            // Could auto-save parking here
          } else if (eventType === Location.GeofencingEventType.Exit) {
            console.log('Exited geofence:', region);
            // Could start tracking for new parking
          }
        }
      });

      // Start geofencing for frequent parking spots
      const regions = locations
        .filter(loc => loc.visitCount > 3) // Only frequent spots
        .map(loc => ({
          identifier: loc.id,
          latitude: loc.location.latitude,
          longitude: loc.location.longitude,
          radius: THRESHOLDS.GEOFENCE_RADIUS,
          notifyOnEnter: true,
          notifyOnExit: true,
        }));

      if (regions.length > 0) {
        await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
        console.log(`Set up ${regions.length} geofences`);
      }
    } catch (error) {
      console.error('Error setting up geofences:', error);
    }
  }

  /**
   * Get parking history
   */
  public async getParkingHistory(): Promise<ParkingEvent[]> {
    try {
      const historyStr = await AsyncStorage.getItem(STORAGE_KEYS.PARKING_HISTORY);
      return historyStr ? JSON.parse(historyStr) : [];
    } catch (error) {
      console.error('Error getting parking history:', error);
      return [];
    }
  }

  /**
   * Get frequent locations
   */
  public async getFrequentLocations(): Promise<FrequentLocation[]> {
    try {
      const frequentStr = await AsyncStorage.getItem(STORAGE_KEYS.FREQUENT_LOCATIONS);
      return frequentStr ? JSON.parse(frequentStr) : [];
    } catch (error) {
      console.error('Error getting frequent locations:', error);
      return [];
    }
  }

  /**
   * Get activity log
   */
  private async getActivityLog(): Promise<any[]> {
    try {
      const logStr = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVITY_LOG);
      return logStr ? JSON.parse(logStr) : [];
    } catch (error) {
      console.error('Error getting activity log:', error);
      return [];
    }
  }

  /**
   * Load detection settings
   */
  private async loadSettings(): Promise<void> {
    try {
      const settingsStr = await AsyncStorage.getItem(STORAGE_KEYS.DETECTION_SETTINGS);
      if (settingsStr) {
        this.settings = { ...this.settings, ...JSON.parse(settingsStr) };
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  /**
   * Save detection settings
   */
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.DETECTION_SETTINGS,
        JSON.stringify(this.settings)
      );
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  /**
   * Update settings
   */
  public async updateSettings(settings: Partial<DetectionSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    await this.saveSettings();

    // Restart tracking if needed
    if (settings.enabled !== undefined || settings.backgroundTracking !== undefined) {
      await this.stop();
      if (this.settings.enabled) {
        await this.initialize();
      }
    }
  }

  /**
   * Get current settings
   */
  public getSettings(): DetectionSettings {
    return { ...this.settings };
  }

  /**
   * Stop tracking
   */
  public async stop(): Promise<void> {
    this.isTracking = false;

    // Stop foreground tracking
    if ((this as any).locationSubscription) {
      (this as any).locationSubscription.remove();
      (this as any).locationSubscription = null;
    }

    // Stop background tracking
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    } catch (error) {
      console.log('No background task to stop');
    }

    // Stop geofencing
    try {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
    } catch (error) {
      console.log('No geofencing to stop');
    }
  }

  /**
   * Cleanup method - stops all tracking and clears subscriptions
   * Alias to stop() for compatibility with component cleanup patterns
   */
  public async cleanup(): Promise<void> {
    await this.stop();
  }

  /**
   * Manual parking save
   */
  public async manualSaveParking(location: {
    latitude: number;
    longitude: number;
  }, notes?: string): Promise<void> {
    const parkingEvent: ParkingEvent = {
      id: `parking_manual_${Date.now()}`,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
      },
      timestamp: new Date(),
      confidence: 1.0,
      detectionMethod: 'manual',
      notes,
      isConfirmed: true,
    };

    await this.saveParkingEvent(parkingEvent);
    await this.saveAsCarLocation(parkingEvent);
  }
}

// Export singleton instance
export const parkingDetection = ParkingDetectionService.getInstance();