/**
 * Smart Suggestions Service
 * Detects when user is stationary at interesting locations
 * and prompts to save the place. Foreground only, opt-in.
 */

import * as Location from 'expo-location';
import { savedPlacesService } from './savedPlacesService';
import { placesService } from './places.service';
import { SavedPlace } from '../types/savedPlaces.types';

// Configuration
const CONFIG = {
  POLL_INTERVAL_MS: 20000, // Poll every 20 seconds
  STATIONARY_RADIUS_METERS: 50, // Consider stationary if within 50m
  STATIONARY_TIME_THRESHOLD_MS: 3 * 60 * 1000, // 3 minutes of being stationary
  MIN_ACCURACY_METERS: 100, // Reject readings with accuracy > 100m
  COOLDOWN_AFTER_PROMPT_MS: 30 * 60 * 1000, // 30 minutes cooldown after showing prompt
  MIN_DISTANCE_FROM_SAVED_PLACE_METERS: 200, // Don't suggest if near existing saved place
};

export interface SmartSuggestionResult {
  shouldSuggest: boolean;
  location?: {
    lat: number;
    lng: number;
    accuracy: number;
  };
  nearbyPlaceName?: string;
  nearbyPlaceAddress?: string;
  reason?: string;
}

interface LocationSample {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

type SuggestionCallback = (result: SmartSuggestionResult) => void;

class SmartSuggestionsService {
  private static instance: SmartSuggestionsService;

  private isEnabled: boolean = false;
  private isMonitoring: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private locationSamples: LocationSample[] = [];
  private lastPromptTime: number = 0;
  private dontAskAgainLocations: Set<string> = new Set();
  private callback: SuggestionCallback | null = null;
  private anchorLocation: LocationSample | null = null;
  private stationaryStartTime: number | null = null;

  private constructor() {}

  public static getInstance(): SmartSuggestionsService {
    if (!SmartSuggestionsService.instance) {
      SmartSuggestionsService.instance = new SmartSuggestionsService();
    }
    return SmartSuggestionsService.instance;
  }

  /**
   * Enable/disable the service
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.stopMonitoring();
    }
  }

  /**
   * Check if service is enabled
   */
  getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Start monitoring for stationary behavior
   * Only call this when the map screen is focused and app is in foreground
   */
  startMonitoring(callback: SuggestionCallback): void {
    if (!this.isEnabled) {
      console.log('[SmartSuggestions] Not enabled, skipping start');
      return;
    }

    if (this.isMonitoring) {
      console.log('[SmartSuggestions] Already monitoring');
      return;
    }

    console.log('[SmartSuggestions] Starting monitoring');
    this.isMonitoring = true;
    this.callback = callback;
    this.locationSamples = [];
    this.anchorLocation = null;
    this.stationaryStartTime = null;

    // Start polling
    this.pollLocation();
    this.pollInterval = setInterval(() => {
      this.pollLocation();
    }, CONFIG.POLL_INTERVAL_MS);
  }

  /**
   * Stop monitoring (call when screen loses focus or app goes to background)
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    console.log('[SmartSuggestions] Stopping monitoring');
    this.isMonitoring = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.locationSamples = [];
    this.anchorLocation = null;
    this.stationaryStartTime = null;
    this.callback = null;
  }

  /**
   * Add a location to the "don't ask again" list
   */
  addDontAskAgain(lat: number, lng: number): void {
    const key = this.getLocationKey(lat, lng);
    this.dontAskAgainLocations.add(key);
  }

  /**
   * Check if a location is in the "don't ask again" list
   */
  isDontAskAgain(lat: number, lng: number): boolean {
    const key = this.getLocationKey(lat, lng);
    return this.dontAskAgainLocations.has(key);
  }

  /**
   * Reset don't ask again list
   */
  resetDontAskAgain(): void {
    this.dontAskAgainLocations.clear();
  }

  /**
   * Poll current location and check for stationary behavior
   */
  private async pollLocation(): Promise<void> {
    if (!this.isMonitoring || !this.callback) return;

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const sample: LocationSample = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy || 999,
        timestamp: Date.now(),
      };

      // Reject low accuracy readings
      if (sample.accuracy > CONFIG.MIN_ACCURACY_METERS) {
        console.log(`[SmartSuggestions] Low accuracy (${sample.accuracy}m), skipping`);
        return;
      }

      // Add to samples (keep last 10)
      this.locationSamples.push(sample);
      if (this.locationSamples.length > 10) {
        this.locationSamples.shift();
      }

      // Check for stationary behavior
      await this.checkStationary(sample);
    } catch (error) {
      console.error('[SmartSuggestions] Error polling location:', error);
    }
  }

  /**
   * Check if user is stationary and should be prompted
   */
  private async checkStationary(currentSample: LocationSample): Promise<void> {
    if (!this.callback) return;

    // If no anchor, set current as anchor
    if (!this.anchorLocation) {
      this.anchorLocation = currentSample;
      this.stationaryStartTime = currentSample.timestamp;
      return;
    }

    // Calculate distance from anchor
    const distance = this.calculateDistance(
      this.anchorLocation.lat,
      this.anchorLocation.lng,
      currentSample.lat,
      currentSample.lng
    );

    // If moved outside stationary radius, reset anchor
    if (distance > CONFIG.STATIONARY_RADIUS_METERS) {
      console.log(`[SmartSuggestions] Moved ${distance.toFixed(0)}m, resetting anchor`);
      this.anchorLocation = currentSample;
      this.stationaryStartTime = currentSample.timestamp;
      return;
    }

    // Check if stationary for long enough
    const stationaryDuration = currentSample.timestamp - (this.stationaryStartTime || currentSample.timestamp);

    if (stationaryDuration < CONFIG.STATIONARY_TIME_THRESHOLD_MS) {
      console.log(`[SmartSuggestions] Stationary for ${Math.round(stationaryDuration / 1000)}s, need ${CONFIG.STATIONARY_TIME_THRESHOLD_MS / 1000}s`);
      return;
    }

    // Check cooldown
    if (Date.now() - this.lastPromptTime < CONFIG.COOLDOWN_AFTER_PROMPT_MS) {
      console.log('[SmartSuggestions] Still in cooldown');
      return;
    }

    // Check if in "don't ask again" list
    if (this.isDontAskAgain(currentSample.lat, currentSample.lng)) {
      console.log('[SmartSuggestions] Location in dont-ask-again list');
      return;
    }

    // Check if already near a saved place
    const nearSaved = await savedPlacesService.isWithinSavedPlaceGeofence(
      currentSample.lat,
      currentSample.lng
    );

    if (nearSaved.isWithin) {
      console.log(`[SmartSuggestions] Near saved place: ${nearSaved.place?.label}`);
      // Reset to avoid repeated checks
      this.anchorLocation = null;
      this.stationaryStartTime = null;
      return;
    }

    // Try to get nearby place info
    let nearbyPlaceName: string | undefined;
    let nearbyPlaceAddress: string | undefined;

    try {
      const nearbyPlaces = await placesService.searchNearbyPlaces(
        { latitude: currentSample.lat, longitude: currentSample.lng },
        'point_of_interest',
        50
      );

      if (nearbyPlaces && nearbyPlaces.length > 0) {
        nearbyPlaceName = nearbyPlaces[0].name;
        nearbyPlaceAddress = nearbyPlaces[0].formattedAddress || nearbyPlaces[0].vicinity;
      }
    } catch (error) {
      // Ignore - nearby place info is optional
    }

    // Trigger suggestion!
    console.log('[SmartSuggestions] Triggering suggestion!');
    this.lastPromptTime = Date.now();

    // Reset anchor to avoid repeated triggers
    this.anchorLocation = null;
    this.stationaryStartTime = null;

    this.callback({
      shouldSuggest: true,
      location: {
        lat: currentSample.lat,
        lng: currentSample.lng,
        accuracy: currentSample.accuracy,
      },
      nearbyPlaceName,
      nearbyPlaceAddress,
      reason: 'Stationary at location',
    });
  }

  /**
   * Calculate distance between two points in meters (Haversine formula)
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Generate a location key for deduplication
   */
  private getLocationKey(lat: number, lng: number): string {
    // Round to ~100m precision
    return `${lat.toFixed(3)}_${lng.toFixed(3)}`;
  }
}

// Export singleton
export const smartSuggestionsService = SmartSuggestionsService.getInstance();
export default smartSuggestionsService;
