/**
 * Base Camp Service
 * Handles hotel-specific operations and trigger logic for
 * return-to-hotel suggestions
 */

import { savedPlacesService } from './savedPlacesService';
import {
  SavedPlace,
  SetHotelInput,
  ReturnToHotelContext,
} from '../types/savedPlaces.types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STORAGE_KEYS = {
  LAST_RETURN_SUGGESTION_TIME: '@OkapiFind:lastReturnSuggestionTime',
  RETURN_SUGGESTION_DISMISSED_COUNT: '@OkapiFind:returnSuggestionDismissedCount',
  DONT_SUGGEST_RETURN: '@OkapiFind:dontSuggestReturn',
};

// Configuration for return-to-hotel suggestions
const RETURN_SUGGESTION_CONFIG = {
  MIN_DISTANCE_METERS: 1609, // 1 mile
  EVENING_START_HOUR: 20, // 8 PM
  EVENING_END_HOUR: 6, // 6 AM
  MIN_TIME_AFTER_NAV_END_MS: 5 * 60 * 1000, // 5 minutes
  COOLDOWN_BETWEEN_SUGGESTIONS_MS: 30 * 60 * 1000, // 30 minutes
  MAX_DISMISSALS_BEFORE_DISABLE: 3, // After 3 dismissals, offer "Don't ask again"
};

class BaseCampService {
  private static instance: BaseCampService;

  private constructor() {}

  public static getInstance(): BaseCampService {
    if (!BaseCampService.instance) {
      BaseCampService.instance = new BaseCampService();
    }
    return BaseCampService.instance;
  }

  // ============================================
  // HOTEL OPERATIONS (delegates to savedPlacesService)
  // ============================================

  /**
   * Get current hotel
   */
  async getHotel(): Promise<SavedPlace | null> {
    return savedPlacesService.getHotel();
  }

  /**
   * Set hotel with additional validation
   */
  async setHotel(input: SetHotelInput): Promise<SavedPlace | null> {
    // Validate coordinates
    if (!this.isValidCoordinate(input.lat, input.lng)) {
      console.error('Invalid hotel coordinates');
      return null;
    }

    // Set the hotel
    const hotel = await savedPlacesService.setHotel(input);

    if (hotel) {
      // Reset suggestion state when hotel changes
      await this.resetReturnSuggestionState();
    }

    return hotel;
  }

  /**
   * Clear current hotel
   */
  async clearHotel(): Promise<boolean> {
    const success = await savedPlacesService.clearHotel();
    if (success) {
      await this.resetReturnSuggestionState();
    }
    return success;
  }

  /**
   * Set hotel from current location
   */
  async setHotelFromCurrentLocation(
    lat: number,
    lng: number,
    label: string = 'My Hotel',
    address?: string
  ): Promise<SavedPlace | null> {
    return this.setHotel({
      label,
      lat,
      lng,
      address,
      provider: 'manual',
    });
  }

  // ============================================
  // RETURN-TO-HOTEL SUGGESTION LOGIC
  // ============================================

  /**
   * Check if we should suggest returning to hotel
   * Only call this when returnToHotelSuggestEnabled is true in settings
   */
  async shouldSuggestReturnToHotel(context: ReturnToHotelContext): Promise<{
    shouldSuggest: boolean;
    reason?: string;
    showDontAskAgain?: boolean;
  }> {
    // Check if user has disabled suggestions
    const dontSuggest = await this.isDontSuggestReturnEnabled();
    if (dontSuggest) {
      return { shouldSuggest: false, reason: 'User disabled suggestions' };
    }

    // Check cooldown
    const lastSuggestionTime = await this.getLastReturnSuggestionTime();
    if (lastSuggestionTime) {
      const timeSinceLastSuggestion = Date.now() - lastSuggestionTime;
      if (timeSinceLastSuggestion < RETURN_SUGGESTION_CONFIG.COOLDOWN_BETWEEN_SUGGESTIONS_MS) {
        return { shouldSuggest: false, reason: 'Cooldown active' };
      }
    }

    // Check if within hotel geofence (no need to suggest if already there)
    if (context.distanceToHotelMeters < 200) {
      return { shouldSuggest: false, reason: 'Already near hotel' };
    }

    // Trigger 1: Just ended navigation and far from hotel
    if (
      context.justEndedNavigation &&
      context.timeSinceNavigationEndMs &&
      context.timeSinceNavigationEndMs >= RETURN_SUGGESTION_CONFIG.MIN_TIME_AFTER_NAV_END_MS &&
      context.distanceToHotelMeters >= RETURN_SUGGESTION_CONFIG.MIN_DISTANCE_METERS
    ) {
      const dismissedCount = await this.getReturnSuggestionDismissedCount();
      await this.recordReturnSuggestionTime();
      return {
        shouldSuggest: true,
        reason: 'Navigation ended, far from hotel',
        showDontAskAgain: dismissedCount >= RETURN_SUGGESTION_CONFIG.MAX_DISMISSALS_BEFORE_DISABLE - 1,
      };
    }

    // Trigger 2: Evening hours and far from hotel
    const isEvening =
      context.localHour >= RETURN_SUGGESTION_CONFIG.EVENING_START_HOUR ||
      context.localHour < RETURN_SUGGESTION_CONFIG.EVENING_END_HOUR;

    if (
      isEvening &&
      context.distanceToHotelMeters >= RETURN_SUGGESTION_CONFIG.MIN_DISTANCE_METERS
    ) {
      const dismissedCount = await this.getReturnSuggestionDismissedCount();
      await this.recordReturnSuggestionTime();
      return {
        shouldSuggest: true,
        reason: 'Evening time, far from hotel',
        showDontAskAgain: dismissedCount >= RETURN_SUGGESTION_CONFIG.MAX_DISMISSALS_BEFORE_DISABLE - 1,
      };
    }

    return { shouldSuggest: false };
  }

  /**
   * Record that user dismissed the return-to-hotel suggestion
   */
  async recordReturnSuggestionDismissal(dontAskAgain: boolean = false): Promise<void> {
    if (dontAskAgain) {
      await AsyncStorage.setItem(STORAGE_KEYS.DONT_SUGGEST_RETURN, 'true');
    } else {
      const count = await this.getReturnSuggestionDismissedCount();
      await AsyncStorage.setItem(
        STORAGE_KEYS.RETURN_SUGGESTION_DISMISSED_COUNT,
        String(count + 1)
      );
    }
  }

  /**
   * Check if user has enabled "Don't suggest return to hotel"
   */
  private async isDontSuggestReturnEnabled(): Promise<boolean> {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.DONT_SUGGEST_RETURN);
    return value === 'true';
  }

  /**
   * Get the last time a return suggestion was shown
   */
  private async getLastReturnSuggestionTime(): Promise<number | null> {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.LAST_RETURN_SUGGESTION_TIME);
    return value ? parseInt(value, 10) : null;
  }

  /**
   * Record the time of the last return suggestion
   */
  private async recordReturnSuggestionTime(): Promise<void> {
    await AsyncStorage.setItem(
      STORAGE_KEYS.LAST_RETURN_SUGGESTION_TIME,
      String(Date.now())
    );
  }

  /**
   * Get the count of times user has dismissed return suggestions
   */
  private async getReturnSuggestionDismissedCount(): Promise<number> {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.RETURN_SUGGESTION_DISMISSED_COUNT);
    return value ? parseInt(value, 10) : 0;
  }

  /**
   * Reset all return suggestion state (when hotel changes)
   */
  private async resetReturnSuggestionState(): Promise<void> {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.LAST_RETURN_SUGGESTION_TIME),
      AsyncStorage.removeItem(STORAGE_KEYS.RETURN_SUGGESTION_DISMISSED_COUNT),
      // Note: We don't reset DONT_SUGGEST_RETURN - that's a permanent user preference
    ]);
  }

  /**
   * Re-enable return suggestions (user can do this from settings)
   */
  async enableReturnSuggestions(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.DONT_SUGGEST_RETURN);
    await AsyncStorage.removeItem(STORAGE_KEYS.RETURN_SUGGESTION_DISMISSED_COUNT);
  }

  // ============================================
  // NAVIGATION HELPERS
  // ============================================

  /**
   * Get directions to hotel from current location
   */
  getDirectionsToHotel(
    currentLat: number,
    currentLng: number,
    hotel: SavedPlace
  ): {
    distance: number;
    bearing: number;
    direction: string;
  } {
    const distance = savedPlacesService.calculateDistance(
      currentLat,
      currentLng,
      hotel.lat,
      hotel.lng
    );

    const bearing = savedPlacesService.calculateBearing(
      currentLat,
      currentLng,
      hotel.lat,
      hotel.lng
    );

    const direction = this.bearingToDirection(bearing);

    return { distance, bearing, direction };
  }

  /**
   * Convert bearing to cardinal direction
   */
  private bearingToDirection(bearing: number): string {
    const directions = [
      'north',
      'northeast',
      'east',
      'southeast',
      'south',
      'southwest',
      'west',
      'northwest',
    ];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  }

  /**
   * Format distance for display
   */
  formatDistance(meters: number, useImperial: boolean = false): string {
    if (useImperial) {
      const feet = meters * 3.28084;
      if (feet < 1000) {
        return `${Math.round(feet)} ft`;
      }
      const miles = meters / 1609.34;
      return `${miles.toFixed(1)} mi`;
    } else {
      if (meters < 1000) {
        return `${Math.round(meters)} m`;
      }
      const km = meters / 1000;
      return `${km.toFixed(1)} km`;
    }
  }

  // ============================================
  // VALIDATION HELPERS
  // ============================================

  /**
   * Validate coordinates
   */
  private isValidCoordinate(lat: number, lng: number): boolean {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  }
}

// Export singleton instance
export const baseCampService = BaseCampService.getInstance();
export default baseCampService;
