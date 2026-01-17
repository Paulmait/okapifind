/**
 * Map Fallback Service
 * Provides OpenStreetMap fallback when Google Maps is unavailable
 * Also provides OSRM routing as fallback for Google Directions
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GOOGLE_MAPS_TEST_URL = 'https://maps.googleapis.com/maps/api/staticmap?size=1x1';
const OSM_NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const OSRM_URL = 'https://router.project-osrm.org';

export type MapProvider = 'google' | 'openstreetmap' | 'apple';

interface DirectionsResult {
  routes: Array<{
    legs: Array<{
      distance: { text: string; value: number };
      duration: { text: string; value: number };
      steps: Array<{
        instruction: string;
        distance: { text: string; value: number };
        duration: { text: string; value: number };
        maneuver?: string;
        startLocation: { lat: number; lng: number };
        endLocation: { lat: number; lng: number };
      }>;
    }>;
    polyline: string;
  }>;
  status: 'OK' | 'FALLBACK' | 'ERROR';
  provider: MapProvider;
}

interface GeocodingResult {
  address: string;
  lat: number;
  lng: number;
  provider: MapProvider;
}

class MapFallbackService {
  private googleMapsAvailable: boolean | null = null;
  private lastGoogleCheck: number = 0;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

  /**
   * Check if Google Maps API is available
   */
  async isGoogleMapsAvailable(): Promise<boolean> {
    const now = Date.now();

    // Return cached result if recent
    if (this.googleMapsAvailable !== null && (now - this.lastGoogleCheck) < this.CHECK_INTERVAL) {
      return this.googleMapsAvailable;
    }

    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.warn('Google Maps API key not configured');
        this.googleMapsAvailable = false;
        return false;
      }

      const response = await fetch(`${GOOGLE_MAPS_TEST_URL}&key=${apiKey}`, {
        method: 'HEAD',
      });

      this.googleMapsAvailable = response.ok;
      this.lastGoogleCheck = now;

      if (!response.ok) {
        console.warn('Google Maps API unavailable, using fallback');
      }

      return this.googleMapsAvailable;
    } catch (error) {
      console.warn('Google Maps check failed:', error);
      this.googleMapsAvailable = false;
      this.lastGoogleCheck = now;
      return false;
    }
  }

  /**
   * Get the best available map provider
   */
  async getPreferredProvider(): Promise<MapProvider> {
    const googleAvailable = await this.isGoogleMapsAvailable();

    if (googleAvailable) {
      return 'google';
    }

    // On iOS, use Apple Maps as first fallback
    if (Platform.OS === 'ios') {
      return 'apple';
    }

    // On Android/Web, use OpenStreetMap
    return 'openstreetmap';
  }

  /**
   * Get OpenStreetMap tile URL template
   */
  getOSMTileUrl(): string {
    return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  }

  /**
   * Get directions using OSRM (Open Source Routing Machine)
   * Free, no API key required
   */
  async getDirectionsOSRM(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    mode: 'walking' | 'driving' = 'walking'
  ): Promise<DirectionsResult> {
    try {
      const profile = mode === 'walking' ? 'foot' : 'car';
      const url = `${OSRM_URL}/route/v1/${profile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&steps=true&geometries=polyline`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No routes found');
      }

      const route = data.routes[0];
      const legs = route.legs.map((leg: any) => ({
        distance: {
          text: this.formatDistance(leg.distance),
          value: leg.distance,
        },
        duration: {
          text: this.formatDuration(leg.duration),
          value: leg.duration,
        },
        steps: leg.steps.map((step: any) => ({
          instruction: this.formatOSRMInstruction(step),
          distance: {
            text: this.formatDistance(step.distance),
            value: step.distance,
          },
          duration: {
            text: this.formatDuration(step.duration),
            value: step.duration,
          },
          maneuver: step.maneuver?.type,
          startLocation: {
            lat: step.maneuver?.location[1],
            lng: step.maneuver?.location[0],
          },
          endLocation: {
            lat: step.maneuver?.location[1],
            lng: step.maneuver?.location[0],
          },
        })),
      }));

      return {
        routes: [{
          legs,
          polyline: route.geometry,
        }],
        status: 'FALLBACK',
        provider: 'openstreetmap',
      };
    } catch (error) {
      console.error('OSRM routing error:', error);
      return {
        routes: [],
        status: 'ERROR',
        provider: 'openstreetmap',
      };
    }
  }

  /**
   * Reverse geocode coordinates to address using OSM Nominatim
   */
  async reverseGeocodeOSM(lat: number, lng: number): Promise<GeocodingResult | null> {
    try {
      const url = `${OSM_NOMINATIM_URL}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'OkapiFind/1.0 (parking app)',
        },
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      return {
        address: data.display_name,
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lon),
        provider: 'openstreetmap',
      };
    } catch (error) {
      console.error('OSM Nominatim reverse geocode error:', error);
      return null;
    }
  }

  /**
   * Calculate bearing between two points (for compass direction)
   */
  calculateBearing(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
  ): number {
    const lat1 = this.toRadians(from.lat);
    const lat2 = this.toRadians(to.lat);
    const dLng = this.toRadians(to.lng - from.lng);

    const x = Math.sin(dLng) * Math.cos(lat2);
    const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

    let bearing = Math.atan2(x, y);
    bearing = this.toDegrees(bearing);
    bearing = (bearing + 360) % 360;

    return bearing;
  }

  /**
   * Get compass direction from bearing
   */
  getCompassDirection(bearing: number): string {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  calculateDistance(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(to.lat - from.lat);
    const dLng = this.toRadians(to.lng - from.lng);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(from.lat)) * Math.cos(this.toRadians(to.lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Generate simple walking directions (fallback when APIs unavailable)
   */
  generateSimpleDirections(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
  ): DirectionsResult {
    const distance = this.calculateDistance(from, to);
    const bearing = this.calculateBearing(from, to);
    const direction = this.getCompassDirection(bearing);

    // Estimate walking time (average walking speed: 5 km/h = 83.3 m/min)
    const durationSeconds = (distance / 83.3) * 60;

    return {
      routes: [{
        legs: [{
          distance: {
            text: this.formatDistance(distance),
            value: distance,
          },
          duration: {
            text: this.formatDuration(durationSeconds),
            value: durationSeconds,
          },
          steps: [{
            instruction: `Head ${direction} toward your car`,
            distance: {
              text: this.formatDistance(distance),
              value: distance,
            },
            duration: {
              text: this.formatDuration(durationSeconds),
              value: durationSeconds,
            },
            maneuver: 'straight',
            startLocation: { lat: from.lat, lng: from.lng },
            endLocation: { lat: to.lat, lng: to.lng },
          }],
        }],
        polyline: '',
      }],
      status: 'FALLBACK',
      provider: 'openstreetmap',
    };
  }

  // Helper methods
  private formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  }

  private formatDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours} hr ${remainingMinutes} min`;
  }

  private formatOSRMInstruction(step: any): string {
    const maneuver = step.maneuver;
    if (!maneuver) return 'Continue';

    const type = maneuver.type;
    const modifier = maneuver.modifier;

    switch (type) {
      case 'turn':
        return `Turn ${modifier || 'ahead'}`;
      case 'new name':
        return `Continue onto ${step.name || 'the road'}`;
      case 'depart':
        return `Head ${modifier || 'straight'}`;
      case 'arrive':
        return 'You have arrived';
      case 'merge':
        return `Merge ${modifier || 'ahead'}`;
      case 'fork':
        return `Take the ${modifier || 'fork'}`;
      case 'roundabout':
        return `Enter the roundabout`;
      default:
        return `Continue ${modifier || 'straight'}`;
    }
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }
}

export const mapFallbackService = new MapFallbackService();
export default mapFallbackService;
