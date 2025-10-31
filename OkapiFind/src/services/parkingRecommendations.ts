/**
 * Smart Parking Recommendations Service
 * AI-powered parking suggestions based on destination, user preferences,
 * historical data, real-time availability, price, and safety
 *
 * This is a MAJOR differentiator from competitors!
 */

import * as Location from 'expo-location';
import { supabase } from '../lib/supabase-client';
import { analytics } from './analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ParkingRecommendation {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
  address: string;
  rating: number; // 0-1 score
  distance_to_destination: number; // meters
  walk_time_minutes: number;
  pricing: {
    hourly?: number;
    daily?: number;
    currency: string;
    free: boolean;
  };
  availability: 'high' | 'medium' | 'low' | 'unknown';
  features: string[]; // ['covered', 'ev_charging', 'security', 'well_lit', '24_7']
  reasons: string[]; // Why this is recommended
  type: 'garage' | 'lot' | 'street' | 'private';
  hours?: {
    open: string;
    close: string;
  };
  safety_score: number; // 0-10
  user_history_score: number; // 0-10 based on past success
}

interface UserPreferences {
  budget: 'low' | 'medium' | 'high' | 'any';
  max_walk_distance: number; // meters
  prefer_covered: boolean;
  prefer_security: boolean;
  prefer_ev_charging: boolean;
  avoid_street_parking: boolean;
}

interface UserParkingPattern {
  frequent_destinations: Array<{
    latitude: number;
    longitude: number;
    address: string;
    visit_count: number;
  }>;
  preferred_parking_types: string[];
  usual_arrival_hour: number;
  usual_departure_hour: number;
  average_duration_hours: number;
}

class ParkingRecommendationsService {
  private cachedRecommendations: Map<string, ParkingRecommendation[]> = new Map();
  private userPreferences: UserPreferences | null = null;
  private userPattern: UserParkingPattern | null = null;

  /**
   * Get parking recommendations for a destination
   */
  async getRecommendations(
    destination: Location.LocationObject | { latitude: number; longitude: number },
    options?: {
      limit?: number;
      radiusMeters?: number;
    }
  ): Promise<ParkingRecommendation[]> {
    const limit = options?.limit || 5;
    const radiusMeters = options?.radiusMeters || 500;

    const destLat = 'latitude' in destination ? destination.latitude : destination.coords.latitude;
    const destLng = 'longitude' in destination ? destination.longitude : destination.coords.longitude;

    // Generate cache key
    const cacheKey = `${destLat.toFixed(4)}_${destLng.toFixed(4)}_${radiusMeters}`;

    // Check cache
    if (this.cachedRecommendations.has(cacheKey)) {
      const cached = this.cachedRecommendations.get(cacheKey)!;
      if (process.env.NODE_ENV === 'development') {
        console.log('[ParkingRecs] Returning cached recommendations');
      }
      return cached.slice(0, limit);
    }

    try {
      // Load user preferences if not loaded
      if (!this.userPreferences) {
        await this.loadUserPreferences();
      }

      // Load user patterns if not loaded
      if (!this.userPattern) {
        await this.loadUserPatterns();
      }

      // Query parking options near destination
      const options = await this.queryParkingOptions(destLat, destLng, radiusMeters);

      // Score each option
      const scored = options.map(option => {
        const score = this.scoreParkingOption(option, { latitude: destLat, longitude: destLng });
        const reasons = this.generateReasons(option, score);

        return {
          ...option,
          rating: score.total,
          reasons,
        };
      });

      // Sort by rating
      const sorted = scored.sort((a, b) => b.rating - a.rating);

      // Cache results
      this.cachedRecommendations.set(cacheKey, sorted);

      // Log analytics
      analytics.logEvent('parking_recommendations_generated', {
        destination_lat: destLat,
        destination_lng: destLng,
        count: sorted.length,
        top_rating: sorted[0]?.rating,
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('[ParkingRecs] Generated recommendations:', {
          count: sorted.length,
          top: sorted[0]?.name,
          rating: sorted[0]?.rating,
        });
      }

      return sorted.slice(0, limit);

    } catch (error) {
      console.error('[ParkingRecs] Error generating recommendations:', error);
      return [];
    }
  }

  /**
   * Query parking options near destination
   * Integrates with multiple data sources
   */
  private async queryParkingOptions(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): Promise<Omit<ParkingRecommendation, 'rating' | 'reasons'>[]> {
    const options: Omit<ParkingRecommendation, 'rating' | 'reasons'>[] = [];

    // 1. Query Google Places API (in production)
    const googlePlaces = await this.queryGooglePlaces(latitude, longitude, radiusMeters);
    options.push(...googlePlaces);

    // 2. Query OpenStreetMap (free alternative)
    const osmPlaces = await this.queryOpenStreetMap(latitude, longitude, radiusMeters);
    options.push(...osmPlaces);

    // 3. Query user's historical successful parking spots
    const historicalSpots = await this.queryUserHistory(latitude, longitude, radiusMeters);
    options.push(...historicalSpots);

    // 4. Query known parking lots database (your own DB)
    const knownLots = await this.queryKnownLots(latitude, longitude, radiusMeters);
    options.push(...knownLots);

    // Deduplicate by location (within 20m)
    const deduped = this.deduplicateOptions(options, 20);

    return deduped;
  }

  /**
   * Query Google Places API for parking
   */
  private async queryGooglePlaces(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): Promise<Omit<ParkingRecommendation, 'rating' | 'reasons'>[]> {
    // In production, call Google Places API
    // For now, return mock data

    // Example mock parking lots (San Francisco)
    const mockLots: Omit<ParkingRecommendation, 'rating' | 'reasons'>[] = [
      {
        id: 'google_1',
        name: 'Downtown Parking Garage',
        location: { latitude: latitude + 0.001, longitude: longitude + 0.001 },
        address: '123 Main St',
        distance_to_destination: 120,
        walk_time_minutes: 2,
        pricing: { hourly: 4, daily: 25, currency: 'USD', free: false },
        availability: 'medium',
        features: ['covered', 'security', '24_7'],
        type: 'garage',
        hours: { open: '00:00', close: '23:59' },
        safety_score: 8,
        user_history_score: 0,
      },
      {
        id: 'google_2',
        name: 'City Center Lot',
        location: { latitude: latitude + 0.002, longitude: longitude - 0.001 },
        address: '456 Oak Ave',
        distance_to_destination: 200,
        walk_time_minutes: 3,
        pricing: { hourly: 3, daily: 20, currency: 'USD', free: false },
        availability: 'high',
        features: ['ev_charging', 'well_lit'],
        type: 'lot',
        hours: { open: '06:00', close: '22:00' },
        safety_score: 7,
        user_history_score: 0,
      },
    ];

    return mockLots;
  }

  /**
   * Query OpenStreetMap for parking
   */
  private async queryOpenStreetMap(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): Promise<Omit<ParkingRecommendation, 'rating' | 'reasons'>[]> {
    // In production, query Overpass API (OSM)
    // For now, return empty
    return [];
  }

  /**
   * Query user's successful parking history
   */
  private async queryUserHistory(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): Promise<Omit<ParkingRecommendation, 'rating' | 'reasons'>[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Query parking sessions near destination
      const { data, error } = await supabase
        .from('parking_sessions')
        .select('*')
        .eq('user_id', user.id)
        .not('venue_name', 'is', null);

      if (error || !data) return [];

      // Filter by distance and convert to recommendations
      const nearby = data
        .filter(session => {
          const coords = session.car_point.coordinates;
          const distance = this.calculateDistance(
            latitude,
            longitude,
            coords[1],
            coords[0]
          );
          return distance <= radiusMeters;
        })
        .map(session => {
          const coords = session.car_point.coordinates;
          const distance = this.calculateDistance(
            latitude,
            longitude,
            coords[1],
            coords[0]
          );

          return {
            id: `history_${session.id}`,
            name: session.venue_name || 'Previous parking spot',
            location: { latitude: coords[1], longitude: coords[0] },
            address: session.car_address || '',
            distance_to_destination: distance,
            walk_time_minutes: Math.ceil(distance / 80), // 80m/min walk speed
            pricing: { free: false, currency: 'USD' },
            availability: 'unknown' as const,
            features: session.floor ? ['covered'] : [],
            type: session.floor ? 'garage' as const : 'lot' as const,
            safety_score: 7,
            user_history_score: 10, // High score for historical success
          };
        });

      return nearby;
    } catch (error) {
      return [];
    }
  }

  /**
   * Query known parking lots from database
   */
  private async queryKnownLots(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): Promise<Omit<ParkingRecommendation, 'rating' | 'reasons'>[]> {
    // Query your own parking lots database
    // This would be a curated list of parking facilities
    return [];
  }

  /**
   * Deduplicate parking options
   */
  private deduplicateOptions(
    options: Omit<ParkingRecommendation, 'rating' | 'reasons'>[],
    thresholdMeters: number
  ): Omit<ParkingRecommendation, 'rating' | 'reasons'>[] {
    const unique: Omit<ParkingRecommendation, 'rating' | 'reasons'>[] = [];

    for (const option of options) {
      const isDuplicate = unique.some(existing => {
        const distance = this.calculateDistance(
          option.location.latitude,
          option.location.longitude,
          existing.location.latitude,
          existing.location.longitude
        );
        return distance < thresholdMeters;
      });

      if (!isDuplicate) {
        unique.push(option);
      }
    }

    return unique;
  }

  /**
   * Score a parking option
   */
  private scoreParkingOption(
    option: Omit<ParkingRecommendation, 'rating' | 'reasons'>,
    destination: { latitude: number; longitude: number }
  ): {
    total: number;
    distance: number;
    price: number;
    safety: number;
    availability: number;
    features: number;
    history: number;
  } {
    const prefs = this.userPreferences || this.getDefaultPreferences();

    // Distance score (closer is better)
    const maxDistance = prefs.max_walk_distance;
    const distanceScore = Math.max(0, 1 - (option.distance_to_destination / maxDistance));

    // Price score (cheaper is better for budget-conscious)
    let priceScore = 0.5; // Default if no pricing
    if (option.pricing.hourly) {
      if (prefs.budget === 'low') {
        priceScore = Math.max(0, 1 - (option.pricing.hourly / 10));
      } else if (prefs.budget === 'medium') {
        priceScore = option.pricing.hourly < 8 ? 0.7 : 0.5;
      } else {
        priceScore = 0.8; // High budget doesn't care much
      }
    }
    if (option.pricing.free) priceScore = 1;

    // Safety score (normalized to 0-1)
    const safetyScore = option.safety_score / 10;

    // Availability score
    const availabilityScore =
      option.availability === 'high' ? 1 :
      option.availability === 'medium' ? 0.7 :
      option.availability === 'low' ? 0.3 : 0.5;

    // Features score
    let featuresScore = 0;
    let featureCount = 0;
    if (prefs.prefer_covered && option.features.includes('covered')) {
      featuresScore += 0.25;
      featureCount++;
    }
    if (prefs.prefer_security && option.features.includes('security')) {
      featuresScore += 0.25;
      featureCount++;
    }
    if (prefs.prefer_ev_charging && option.features.includes('ev_charging')) {
      featuresScore += 0.25;
      featureCount++;
    }
    if (option.features.includes('well_lit')) {
      featuresScore += 0.15;
      featureCount++;
    }
    featuresScore = featureCount > 0 ? featuresScore : 0.5; // Default if no preferences

    // History score (normalized to 0-1)
    const historyScore = option.user_history_score / 10;

    // Weighted total score
    const weights = {
      distance: 0.30,
      price: 0.20,
      safety: 0.20,
      availability: 0.15,
      features: 0.10,
      history: 0.05,
    };

    const total =
      distanceScore * weights.distance +
      priceScore * weights.price +
      safetyScore * weights.safety +
      availabilityScore * weights.availability +
      featuresScore * weights.features +
      historyScore * weights.history;

    return {
      total: Math.min(total, 1),
      distance: distanceScore,
      price: priceScore,
      safety: safetyScore,
      availability: availabilityScore,
      features: featuresScore,
      history: historyScore,
    };
  }

  /**
   * Generate human-readable reasons for recommendation
   */
  private generateReasons(
    option: Omit<ParkingRecommendation, 'rating' | 'reasons'>,
    score: ReturnType<typeof this.scoreParkingOption>
  ): string[] {
    const reasons: string[] = [];

    // Distance reasons
    if (option.distance_to_destination < 100) {
      reasons.push('Very close to destination');
    } else if (option.distance_to_destination < 200) {
      reasons.push('Short walk');
    }

    // Price reasons
    if (option.pricing.free) {
      reasons.push('Free parking');
    } else if (option.pricing.hourly && option.pricing.hourly < 5) {
      reasons.push('Affordable');
    }

    // Availability reasons
    if (option.availability === 'high') {
      reasons.push('Usually has spots');
    }

    // Features reasons
    if (option.features.includes('covered')) {
      reasons.push('Covered parking');
    }
    if (option.features.includes('security')) {
      reasons.push('Secure facility');
    }
    if (option.features.includes('ev_charging')) {
      reasons.push('EV charging available');
    }
    if (option.features.includes('24_7')) {
      reasons.push('Open 24/7');
    }

    // Safety reasons
    if (option.safety_score >= 8) {
      reasons.push('Safe area');
    }

    // History reasons
    if (option.user_history_score >= 8) {
      reasons.push('You\'ve parked here before');
    }

    return reasons;
  }

  /**
   * Load user preferences
   */
  private async loadUserPreferences(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('@OkapiFind:parkingPreferences');
      if (stored) {
        this.userPreferences = JSON.parse(stored);
      } else {
        this.userPreferences = this.getDefaultPreferences();
      }
    } catch (error) {
      this.userPreferences = this.getDefaultPreferences();
    }
  }

  /**
   * Load user parking patterns
   */
  private async loadUserPatterns(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Analyze user's parking history
      const { data, error } = await supabase
        .from('parking_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('saved_at', { ascending: false })
        .limit(50);

      if (!data || error) return;

      // Analyze patterns
      const pattern: UserParkingPattern = {
        frequent_destinations: [],
        preferred_parking_types: [],
        usual_arrival_hour: 9,
        usual_departure_hour: 17,
        average_duration_hours: 8,
      };

      // Calculate average duration
      const durations = data
        .filter(s => s.found_at)
        .map(s => {
          const start = new Date(s.saved_at).getTime();
          const end = new Date(s.found_at).getTime();
          return (end - start) / (1000 * 60 * 60); // hours
        });

      if (durations.length > 0) {
        pattern.average_duration_hours = durations.reduce((a, b) => a + b, 0) / durations.length;
      }

      this.userPattern = pattern;
    } catch (error) {
      this.userPattern = null;
    }
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      budget: 'medium',
      max_walk_distance: 400, // 400 meters = 5 min walk
      prefer_covered: false,
      prefer_security: true,
      prefer_ev_charging: false,
      avoid_street_parking: false,
    };
  }

  /**
   * Calculate distance between two points (Haversine)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cachedRecommendations.clear();
  }
}

// Export singleton
export const parkingRecommendations = new ParkingRecommendationsService();
export default parkingRecommendations;
