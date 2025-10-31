/**
 * Enhanced AR Navigation Service
 * 3D arrows pointing to car with floor indicators
 * Premium feature - revenue driver
 */

import * as Haptics from 'expo-haptics';
import { analytics } from './analytics';

export interface ARNavigationState {
  distance: number; // meters to car
  bearing: number; // degrees 0-360
  elevation: number; // vertical distance (floors)
  floor_difference: number; // number of floors to go up/down
  direction: 'up' | 'down' | 'same';
  instructions: string[];
  accuracy: 'high' | 'medium' | 'low';
}

export interface CarLocation {
  latitude: number;
  longitude: number;
  floor?: string;
  altitude?: number;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  heading?: number;
}

export type HapticPattern = 'left' | 'right' | 'straight' | 'arrived';

class ARNavigationService {
  private hapticInterval: NodeJS.Timeout | null = null;
  private lastBearing: number = 0;
  private isNavigating = false;

  /**
   * Calculate AR navigation state
   */
  calculateNavigationState(
    userLocation: UserLocation,
    carLocation: CarLocation
  ): ARNavigationState {
    // Calculate horizontal distance and bearing
    const { distance, bearing } = this.calculateDistanceAndBearing(
      userLocation.latitude,
      userLocation.longitude,
      carLocation.latitude,
      carLocation.longitude
    );

    // Calculate vertical distance (floors)
    const { elevation, floor_difference, direction } = this.calculateElevation(
      userLocation.altitude,
      carLocation.altitude,
      carLocation.floor
    );

    // Generate turn-by-turn instructions
    const instructions = this.generateInstructions(
      distance,
      bearing,
      floor_difference,
      direction,
      userLocation.heading
    );

    // Determine accuracy
    const accuracy = this.determineAccuracy(distance, userLocation.heading);

    return {
      distance,
      bearing,
      elevation,
      floor_difference,
      direction,
      instructions,
      accuracy,
    };
  }

  /**
   * Start haptic guidance
   * Pulses get faster as user gets closer
   */
  startHapticGuidance(navState: ARNavigationState): void {
    if (this.hapticInterval) {
      this.stopHapticGuidance();
    }

    this.isNavigating = true;

    // Determine haptic pattern based on direction
    const pattern = this.getHapticPattern(navState);

    // Determine pulse interval based on distance
    const interval = this.getHapticInterval(navState.distance);

    this.hapticInterval = setInterval(() => {
      if (!this.isNavigating) {
        this.stopHapticGuidance();
        return;
      }

      this.triggerHapticPattern(pattern);
    }, interval);

    analytics.logEvent('ar_haptic_guidance_started', {
      distance: navState.distance,
      floor_difference: navState.floor_difference,
    });
  }

  /**
   * Stop haptic guidance
   */
  stopHapticGuidance(): void {
    if (this.hapticInterval) {
      clearInterval(this.hapticInterval);
      this.hapticInterval = null;
    }
    this.isNavigating = false;
  }

  /**
   * Get haptic pattern based on navigation direction
   */
  private getHapticPattern(navState: ARNavigationState): HapticPattern {
    const { distance, bearing } = navState;

    // Arrived at car
    if (distance < 3) {
      return 'arrived';
    }

    // Calculate relative bearing (accounting for user's heading)
    const relativeBearing = this.normalizeAngle(bearing - this.lastBearing);

    // Determine direction
    if (Math.abs(relativeBearing) < 15) {
      return 'straight';
    } else if (relativeBearing > 0 && relativeBearing < 180) {
      return 'right';
    } else {
      return 'left';
    }
  }

  /**
   * Get haptic pulse interval based on distance
   * Closer = faster pulses
   */
  private getHapticInterval(distance: number): number {
    if (distance < 5) return 300; // Very close - rapid pulses
    if (distance < 10) return 500;
    if (distance < 20) return 800;
    if (distance < 50) return 1200;
    return 1500; // Far away - slow pulses
  }

  /**
   * Trigger haptic feedback based on pattern
   */
  private async triggerHapticPattern(pattern: HapticPattern): Promise<void> {
    try {
      switch (pattern) {
        case 'arrived':
          // Success pattern - celebration!
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await new Promise((resolve) => setTimeout(resolve, 100));
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;

        case 'straight':
          // Single pulse
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;

        case 'left':
          // Two quick pulses
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await new Promise((resolve) => setTimeout(resolve, 100));
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;

        case 'right':
          // Three quick pulses
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await new Promise((resolve) => setTimeout(resolve, 100));
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await new Promise((resolve) => setTimeout(resolve, 100));
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
      }
    } catch (error) {
      console.error('[ARNavigation] Haptic error:', error);
    }
  }

  /**
   * Calculate distance and bearing using Haversine formula
   */
  private calculateDistanceAndBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): { distance: number; bearing: number } {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    // Distance
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    // Bearing
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
      Math.cos(φ1) * Math.sin(φ2) -
      Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    const bearing = ((θ * 180) / Math.PI + 360) % 360;

    return { distance, bearing };
  }

  /**
   * Calculate elevation difference (floors)
   */
  private calculateElevation(
    userAltitude?: number,
    carAltitude?: number,
    carFloor?: string
  ): { elevation: number; floor_difference: number; direction: 'up' | 'down' | 'same' } {
    if (!userAltitude || !carAltitude) {
      // No altitude data - try to use floor information
      if (carFloor) {
        // Assume user is on ground floor if no altitude
        const carFloorNum = this.parseFloorNumber(carFloor);
        return {
          elevation: carFloorNum * 3, // 3 meters per floor
          floor_difference: Math.abs(carFloorNum),
          direction: carFloorNum > 0 ? 'up' : carFloorNum < 0 ? 'down' : 'same',
        };
      }

      return { elevation: 0, floor_difference: 0, direction: 'same' };
    }

    const elevationDiff = carAltitude - userAltitude;
    const floorDiff = Math.round(elevationDiff / 3); // 3 meters per floor

    return {
      elevation: Math.abs(elevationDiff),
      floor_difference: Math.abs(floorDiff),
      direction: floorDiff > 0 ? 'up' : floorDiff < 0 ? 'down' : 'same',
    };
  }

  /**
   * Parse floor number from string (e.g., "B2" -> -2, "3" -> 3, "G" -> 0)
   */
  private parseFloorNumber(floor: string): number {
    if (floor === 'G') return 0;
    if (floor.startsWith('B')) {
      return -parseInt(floor.substring(1), 10);
    }
    return parseInt(floor, 10) || 0;
  }

  /**
   * Generate turn-by-turn instructions
   */
  private generateInstructions(
    distance: number,
    bearing: number,
    floor_difference: number,
    direction: 'up' | 'down' | 'same',
    userHeading?: number
  ): string[] {
    const instructions: string[] = [];

    // Floor instructions first
    if (floor_difference > 0) {
      if (direction === 'up') {
        instructions.push(`Go up ${floor_difference} floor${floor_difference > 1 ? 's' : ''}`);
      } else if (direction === 'down') {
        instructions.push(`Go down ${floor_difference} floor${floor_difference > 1 ? 's' : ''}`);
      }
    }

    // Distance and direction
    if (distance < 3) {
      instructions.push('🎉 You have arrived!');
    } else if (distance < 10) {
      instructions.push(`Your car is ${Math.round(distance)}m ahead`);
    } else if (distance < 50) {
      // Add directional guidance
      const direction = this.getCardinalDirection(bearing, userHeading);
      instructions.push(`Walk ${direction} for ${Math.round(distance)}m`);
    } else {
      const direction = this.getCardinalDirection(bearing, userHeading);
      instructions.push(`Head ${direction} (${Math.round(distance)}m away)`);
    }

    return instructions;
  }

  /**
   * Get cardinal direction (N, NE, E, SE, S, SW, W, NW)
   */
  private getCardinalDirection(bearing: number, userHeading?: number): string {
    let relativeBearing = bearing;

    // If user heading is available, make it relative
    if (userHeading !== undefined) {
      relativeBearing = this.normalizeAngle(bearing - userHeading);
    }

    const directions = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
    const index = Math.round(relativeBearing / 45) % 8;
    return directions[index];
  }

  /**
   * Normalize angle to 0-360 range
   */
  private normalizeAngle(angle: number): number {
    let normalized = angle % 360;
    if (normalized < 0) normalized += 360;
    return normalized;
  }

  /**
   * Determine accuracy based on distance and heading availability
   */
  private determineAccuracy(distance: number, heading?: number): 'high' | 'medium' | 'low' {
    if (distance < 5 && heading !== undefined) return 'high';
    if (distance < 20 && heading !== undefined) return 'medium';
    if (heading === undefined) return 'low';
    return 'medium';
  }

  /**
   * Get 3D arrow rotation angles for AR rendering
   */
  getArrowRotation(navState: ARNavigationState, userHeading: number = 0): {
    yaw: number; // Horizontal rotation (pointing direction)
    pitch: number; // Vertical rotation (up/down)
    roll: number; // Not used for arrow
  } {
    // Yaw: Point arrow in direction of car
    const yaw = this.normalizeAngle(navState.bearing - userHeading);

    // Pitch: Point arrow up or down based on floor difference
    let pitch = 0;
    if (navState.floor_difference > 0) {
      // Point up or down
      const angle = Math.atan2(navState.elevation, navState.distance);
      pitch = (angle * 180) / Math.PI;

      if (navState.direction === 'down') {
        pitch = -pitch;
      }
    }

    return { yaw, pitch, roll: 0 };
  }

  /**
   * Get AR overlay color based on distance
   */
  getArrowColor(distance: number): string {
    if (distance < 5) return '#4CAF50'; // Green - very close
    if (distance < 20) return '#FFC107'; // Yellow - close
    if (distance < 50) return '#FF9800'; // Orange - medium
    return '#F44336'; // Red - far
  }

  /**
   * Get AR overlay size based on distance
   * Closer = bigger arrow
   */
  getArrowScale(distance: number): number {
    if (distance < 5) return 2.0; // Very large
    if (distance < 10) return 1.5;
    if (distance < 20) return 1.2;
    if (distance < 50) return 1.0;
    return 0.8; // Small when far away
  }
}

// Export singleton
export const arNavigation = new ARNavigationService();
export default arNavigation;
