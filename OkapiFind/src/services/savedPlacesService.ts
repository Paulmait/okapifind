// @ts-nocheck - Types will be generated after running the migration
/**
 * Saved Places Service
 * Handles CRUD operations for saved places (hotels, favorites, custom locations)
 * Integrates with Supabase backend and local cache for offline support
 */

import { supabase } from '../lib/supabase-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SavedPlace,
  Trip,
  UpsertSavedPlaceInput,
  SetHotelInput,
  SavedPlaceRow,
  TripRow,
  savedPlaceFromRow,
  tripFromRow,
  SavedPlaceType,
} from '../types/savedPlaces.types';

// Storage keys for offline cache
const STORAGE_KEYS = {
  SAVED_PLACES: '@OkapiFind:savedPlaces',
  CURRENT_HOTEL: '@OkapiFind:currentHotel',
  DEFAULT_TRIP: '@OkapiFind:defaultTrip',
  SETTINGS: '@OkapiFind:savedPlacesSettings',
};

// Default geofence radius for hotels (larger than regular places)
const DEFAULT_HOTEL_GEOFENCE_RADIUS = 200;
const DEFAULT_PLACE_GEOFENCE_RADIUS = 150;

class SavedPlacesService {
  private static instance: SavedPlacesService;

  private constructor() {}

  public static getInstance(): SavedPlacesService {
    if (!SavedPlacesService.instance) {
      SavedPlacesService.instance = new SavedPlacesService();
    }
    return SavedPlacesService.instance;
  }

  // ============================================
  // TRIP OPERATIONS
  // ============================================

  /**
   * Get or create the default trip for the current user
   */
  async getOrCreateDefaultTrip(): Promise<Trip | null> {
    try {
      const { data, error } = await supabase.rpc('get_or_create_default_trip');

      if (error) {
        console.error('Error getting default trip:', error);
        // Try to load from cache
        return this.loadDefaultTripFromCache();
      }

      if (data) {
        const trip = tripFromRow(data as TripRow);
        await this.cacheDefaultTrip(trip);
        return trip;
      }

      return null;
    } catch (error) {
      console.error('Error in getOrCreateDefaultTrip:', error);
      return this.loadDefaultTripFromCache();
    }
  }

  // ============================================
  // SAVED PLACES OPERATIONS
  // ============================================

  /**
   * List all saved places for the current user
   */
  async listSavedPlaces(tripId?: string): Promise<SavedPlace[]> {
    try {
      let query = supabase
        .from('saved_places')
        .select('*')
        .order('type', { ascending: true })
        .order('created_at', { ascending: false });

      if (tripId) {
        query = query.eq('trip_id', tripId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error listing saved places:', error);
        return this.loadPlacesFromCache();
      }

      const places = (data as SavedPlaceRow[]).map(savedPlaceFromRow);
      await this.cachePlaces(places);
      return places;
    } catch (error) {
      console.error('Error in listSavedPlaces:', error);
      return this.loadPlacesFromCache();
    }
  }

  /**
   * Get a single saved place by ID
   */
  async getSavedPlace(id: string): Promise<SavedPlace | null> {
    try {
      const { data, error } = await supabase
        .from('saved_places')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error getting saved place:', error);
        return null;
      }

      return data ? savedPlaceFromRow(data as SavedPlaceRow) : null;
    } catch (error) {
      console.error('Error in getSavedPlace:', error);
      return null;
    }
  }

  /**
   * Create or update a saved place
   */
  async upsertSavedPlace(input: UpsertSavedPlaceInput): Promise<SavedPlace | null> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        console.error('User not authenticated');
        return null;
      }

      const row: Partial<SavedPlaceRow> = {
        user_id: userData.user.id,
        trip_id: input.tripId,
        type: input.type,
        label: input.label,
        address: input.address,
        lat: input.lat,
        lng: input.lng,
        provider: input.provider || 'manual',
        provider_place_id: input.providerPlaceId,
        geofence_radius_m: input.geofenceRadiusM ||
          (input.type === 'HOTEL' ? DEFAULT_HOTEL_GEOFENCE_RADIUS : DEFAULT_PLACE_GEOFENCE_RADIUS),
        is_active: input.isActive ?? true,
        check_in_date: input.checkInDate,
        check_out_date: input.checkOutDate,
        notes: input.notes,
      };

      if (input.id) {
        row.id = input.id;
      }

      const { data, error } = await supabase
        .from('saved_places')
        .upsert(row)
        .select()
        .single();

      if (error) {
        console.error('Error upserting saved place:', error);
        return null;
      }

      const place = savedPlaceFromRow(data as SavedPlaceRow);

      // Update cache
      const places = await this.loadPlacesFromCache();
      const existingIndex = places.findIndex(p => p.id === place.id);
      if (existingIndex >= 0) {
        places[existingIndex] = place;
      } else {
        places.push(place);
      }
      await this.cachePlaces(places);

      return place;
    } catch (error) {
      console.error('Error in upsertSavedPlace:', error);
      return null;
    }
  }

  /**
   * Remove a saved place
   */
  async removeSavedPlace(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('saved_places')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error removing saved place:', error);
        return false;
      }

      // Update cache
      const places = await this.loadPlacesFromCache();
      const filtered = places.filter(p => p.id !== id);
      await this.cachePlaces(filtered);

      return true;
    } catch (error) {
      console.error('Error in removeSavedPlace:', error);
      return false;
    }
  }

  // ============================================
  // HOTEL (BASE CAMP) OPERATIONS
  // ============================================

  /**
   * Get the current active hotel
   */
  async getHotel(): Promise<SavedPlace | null> {
    try {
      const { data, error } = await supabase.rpc('get_current_hotel');

      if (error) {
        console.error('Error getting hotel:', error);
        return this.loadHotelFromCache();
      }

      if (data && Array.isArray(data) && data.length > 0) {
        const hotel = savedPlaceFromRow(data[0] as SavedPlaceRow);
        await this.cacheHotel(hotel);
        return hotel;
      }

      // No hotel found
      await this.cacheHotel(null);
      return null;
    } catch (error) {
      console.error('Error in getHotel:', error);
      return this.loadHotelFromCache();
    }
  }

  /**
   * Set the hotel (deactivates previous hotel atomically)
   */
  async setHotel(input: SetHotelInput): Promise<SavedPlace | null> {
    try {
      const { data, error } = await supabase.rpc('set_hotel', {
        p_label: input.label,
        p_lat: input.lat,
        p_lng: input.lng,
        p_address: input.address || null,
        p_provider: input.provider || 'manual',
        p_provider_place_id: input.providerPlaceId || null,
        p_check_in_date: input.checkInDate || null,
        p_check_out_date: input.checkOutDate || null,
        p_notes: input.notes || null,
        p_geofence_radius_m: input.geofenceRadiusM || DEFAULT_HOTEL_GEOFENCE_RADIUS,
      });

      if (error) {
        console.error('Error setting hotel:', error);
        return null;
      }

      if (data) {
        const hotel = savedPlaceFromRow(data as SavedPlaceRow);
        await this.cacheHotel(hotel);

        // Also update places cache
        const places = await this.loadPlacesFromCache();
        // Deactivate old hotels in cache
        places.forEach(p => {
          if (p.type === 'HOTEL' && p.id !== hotel.id) {
            p.isActive = false;
          }
        });
        // Add or update new hotel
        const existingIndex = places.findIndex(p => p.id === hotel.id);
        if (existingIndex >= 0) {
          places[existingIndex] = hotel;
        } else {
          places.push(hotel);
        }
        await this.cachePlaces(places);

        return hotel;
      }

      return null;
    } catch (error) {
      console.error('Error in setHotel:', error);
      return null;
    }
  }

  /**
   * Clear the current hotel (deactivate without deleting)
   */
  async clearHotel(): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('clear_hotel');

      if (error) {
        console.error('Error clearing hotel:', error);
        return false;
      }

      await this.cacheHotel(null);

      // Update places cache
      const places = await this.loadPlacesFromCache();
      places.forEach(p => {
        if (p.type === 'HOTEL') {
          p.isActive = false;
        }
      });
      await this.cachePlaces(places);

      return true;
    } catch (error) {
      console.error('Error in clearHotel:', error);
      return false;
    }
  }

  // ============================================
  // QUERY HELPERS
  // ============================================

  /**
   * Get places by type
   */
  async getPlacesByType(type: SavedPlaceType): Promise<SavedPlace[]> {
    try {
      const { data, error } = await supabase
        .from('saved_places')
        .select('*')
        .eq('type', type)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error getting places by type:', error);
        // Fallback to cache
        const cached = await this.loadPlacesFromCache();
        return cached.filter(p => p.type === type && p.isActive);
      }

      return (data as SavedPlaceRow[]).map(savedPlaceFromRow);
    } catch (error) {
      console.error('Error in getPlacesByType:', error);
      const cached = await this.loadPlacesFromCache();
      return cached.filter(p => p.type === type && p.isActive);
    }
  }

  /**
   * Check if a location is within any saved place geofence
   */
  async isWithinSavedPlaceGeofence(
    lat: number,
    lng: number
  ): Promise<{ isWithin: boolean; place?: SavedPlace }> {
    const places = await this.loadPlacesFromCache();

    for (const place of places) {
      if (!place.isActive) continue;

      const distance = this.calculateDistance(lat, lng, place.lat, place.lng);
      if (distance <= place.geofenceRadiusM) {
        return { isWithin: true, place };
      }
    }

    return { isWithin: false };
  }

  // ============================================
  // CACHE OPERATIONS
  // ============================================

  /**
   * Cache places locally
   */
  private async cachePlaces(places: SavedPlace[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_PLACES, JSON.stringify(places));
    } catch (error) {
      console.error('Error caching places:', error);
    }
  }

  /**
   * Load places from local cache
   */
  async loadPlacesFromCache(): Promise<SavedPlace[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_PLACES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading places from cache:', error);
      return [];
    }
  }

  /**
   * Cache hotel locally
   */
  private async cacheHotel(hotel: SavedPlace | null): Promise<void> {
    try {
      if (hotel) {
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_HOTEL, JSON.stringify(hotel));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_HOTEL);
      }
    } catch (error) {
      console.error('Error caching hotel:', error);
    }
  }

  /**
   * Load hotel from local cache
   */
  async loadHotelFromCache(): Promise<SavedPlace | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_HOTEL);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading hotel from cache:', error);
      return null;
    }
  }

  /**
   * Cache default trip locally
   */
  private async cacheDefaultTrip(trip: Trip): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DEFAULT_TRIP, JSON.stringify(trip));
    } catch (error) {
      console.error('Error caching default trip:', error);
    }
  }

  /**
   * Load default trip from local cache
   */
  private async loadDefaultTripFromCache(): Promise<Trip | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_TRIP);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading default trip from cache:', error);
      return null;
    }
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.SAVED_PLACES),
        AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_HOTEL),
        AsyncStorage.removeItem(STORAGE_KEYS.DEFAULT_TRIP),
        AsyncStorage.removeItem(STORAGE_KEYS.SETTINGS),
      ]);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Calculate distance between two points using Haversine formula
   * Returns distance in meters
   */
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
   * Calculate bearing from one point to another
   * Returns bearing in degrees (0-360)
   */
  calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLng = this.toRad(lng2 - lng1);
    const lat1Rad = this.toRad(lat1);
    const lat2Rad = this.toRad(lat2);

    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

    const bearing = Math.atan2(y, x) * (180 / Math.PI);
    return (bearing + 360) % 360;
  }
}

// Export singleton instance
export const savedPlacesService = SavedPlacesService.getInstance();
export default savedPlacesService;
