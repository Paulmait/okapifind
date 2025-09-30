/**
 * Google Places Service
 * CRITICAL: Search autocomplete for finding parking destinations
 * Enables users to search by address, business name, or landmark
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { analytics } from './analytics';

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  types: string[];
  distanceMeters?: number;
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  formattedAddress: string;
  location: {
    latitude: number;
    longitude: number;
  };
  types: string[];
  phoneNumber?: string;
  website?: string;
  rating?: number;
  userRatingsTotal?: number;
  openingHours?: {
    isOpen: boolean;
    periods: Array<{
      open: { day: number; time: string };
      close: { day: number; time: string };
    }>;
    weekdayText: string[];
  };
  photos?: Array<{
    photoReference: string;
    height: number;
    width: number;
  }>;
  priceLevel?: number; // 0-4
  businessStatus?: string;
  vicinity?: string;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  placeId?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  timestamp: string;
  resultCount: number;
}

export interface FavoritePlace {
  id: string;
  placeId: string;
  name: string;
  address: string;
  location: {
    latitude: number;
    longitude: number;
  };
  category: 'home' | 'work' | 'favorite' | 'recent';
  notes?: string;
  addedAt: string;
  visitCount: number;
  lastVisited?: string;
}

class PlacesService {
  private readonly API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  private readonly AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
  private readonly DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
  private readonly NEARBY_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

  private readonly SEARCH_HISTORY_KEY = 'places_search_history';
  private readonly FAVORITES_KEY = 'places_favorites';
  private readonly MAX_HISTORY_ITEMS = 50;

  private searchHistory: SearchHistoryItem[] = [];
  private favorites: FavoritePlace[] = [];

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    try {
      await this.loadSearchHistory();
      await this.loadFavorites();
      console.log('Places service initialized');
    } catch (error) {
      console.error('Error initializing places service:', error);
    }
  }

  /**
   * Autocomplete search for places
   */
  async searchPlaces(
    query: string,
    location?: { latitude: number; longitude: number },
    radius?: number
  ): Promise<PlacePrediction[]> {
    try {
      if (!this.API_KEY) {
        throw new Error('Google Places API key not configured');
      }

      if (!query || query.length < 2) {
        return [];
      }

      const params = new URLSearchParams({
        input: query,
        key: this.API_KEY,
        components: 'country:us', // Restrict to US (customize as needed)
      });

      // Add location bias if provided
      if (location) {
        params.append('location', `${location.latitude},${location.longitude}`);
        if (radius) {
          params.append('radius', radius.toString());
        }
      }

      const response = await fetch(`${this.AUTOCOMPLETE_URL}?${params.toString()}`);
      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Places API error: ${data.status}`);
      }

      const predictions: PlacePrediction[] = (data.predictions || []).map((p: any) => ({
        placeId: p.place_id,
        description: p.description,
        mainText: p.structured_formatting.main_text,
        secondaryText: p.structured_formatting.secondary_text,
        types: p.types,
        distanceMeters: p.distance_meters,
      }));

      // Save to search history
      await this.addToSearchHistory(query, predictions.length, location);

      analytics.logEvent('places_search', {
        query,
        result_count: predictions.length,
        has_location: !!location,
      });

      return predictions;
    } catch (error) {
      console.error('Error searching places:', error);
      analytics.logEvent('places_search_error', {
        error: (error as Error).message,
      });
      return [];
    }
  }

  /**
   * Get place details by place ID
   */
  async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    try {
      if (!this.API_KEY) {
        throw new Error('Google Places API key not configured');
      }

      const params = new URLSearchParams({
        place_id: placeId,
        key: this.API_KEY,
        fields: 'place_id,name,formatted_address,geometry,types,formatted_phone_number,website,rating,user_ratings_total,opening_hours,photos,price_level,business_status,vicinity',
      });

      const response = await fetch(`${this.DETAILS_URL}?${params.toString()}`);
      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Place details error: ${data.status}`);
      }

      const result = data.result;
      const details: PlaceDetails = {
        placeId: result.place_id,
        name: result.name,
        formattedAddress: result.formatted_address,
        location: {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
        },
        types: result.types,
        phoneNumber: result.formatted_phone_number,
        website: result.website,
        rating: result.rating,
        userRatingsTotal: result.user_ratings_total,
        priceLevel: result.price_level,
        businessStatus: result.business_status,
        vicinity: result.vicinity,
      };

      if (result.opening_hours) {
        details.openingHours = {
          isOpen: result.opening_hours.open_now,
          periods: result.opening_hours.periods || [],
          weekdayText: result.opening_hours.weekday_text || [],
        };
      }

      if (result.photos) {
        details.photos = result.photos.map((p: any) => ({
          photoReference: p.photo_reference,
          height: p.height,
          width: p.width,
        }));
      }

      analytics.logEvent('place_details_fetched', {
        place_id: placeId,
        place_name: details.name,
      });

      return details;
    } catch (error) {
      console.error('Error fetching place details:', error);
      return null;
    }
  }

  /**
   * Search nearby places by type
   */
  async searchNearbyPlaces(
    location: { latitude: number; longitude: number },
    type: string,
    radius: number = 1000,
    keyword?: string
  ): Promise<PlaceDetails[]> {
    try {
      if (!this.API_KEY) {
        throw new Error('Google Places API key not configured');
      }

      const params = new URLSearchParams({
        location: `${location.latitude},${location.longitude}`,
        radius: radius.toString(),
        type,
        key: this.API_KEY,
      });

      if (keyword) {
        params.append('keyword', keyword);
      }

      const response = await fetch(`${this.NEARBY_URL}?${params.toString()}`);
      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Nearby search error: ${data.status}`);
      }

      const places: PlaceDetails[] = (data.results || []).map((r: any) => ({
        placeId: r.place_id,
        name: r.name,
        formattedAddress: r.vicinity,
        location: {
          latitude: r.geometry.location.lat,
          longitude: r.geometry.location.lng,
        },
        types: r.types,
        rating: r.rating,
        userRatingsTotal: r.user_ratings_total,
        priceLevel: r.price_level,
        businessStatus: r.business_status,
        vicinity: r.vicinity,
      }));

      analytics.logEvent('nearby_places_searched', {
        type,
        radius,
        result_count: places.length,
      });

      return places;
    } catch (error) {
      console.error('Error searching nearby places:', error);
      return [];
    }
  }

  /**
   * Search for parking garages near location
   */
  async searchParkingGarages(
    location: { latitude: number; longitude: number },
    radius: number = 2000
  ): Promise<PlaceDetails[]> {
    return await this.searchNearbyPlaces(location, 'parking', radius, 'garage');
  }

  /**
   * Get photo URL from photo reference
   */
  getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    if (!this.API_KEY) return '';
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${this.API_KEY}`;
  }

  /**
   * Add to search history
   */
  private async addToSearchHistory(
    query: string,
    resultCount: number,
    location?: { latitude: number; longitude: number }
  ): Promise<void> {
    try {
      const historyItem: SearchHistoryItem = {
        id: `${Date.now()}_${query}`,
        query,
        location,
        timestamp: new Date().toISOString(),
        resultCount,
      };

      this.searchHistory.unshift(historyItem);

      // Keep only recent items
      if (this.searchHistory.length > this.MAX_HISTORY_ITEMS) {
        this.searchHistory = this.searchHistory.slice(0, this.MAX_HISTORY_ITEMS);
      }

      await this.saveSearchHistory();
    } catch (error) {
      console.error('Error adding to search history:', error);
    }
  }

  /**
   * Get search history
   */
  async getSearchHistory(limit: number = 10): Promise<SearchHistoryItem[]> {
    await this.loadSearchHistory();
    return this.searchHistory.slice(0, limit);
  }

  /**
   * Clear search history
   */
  async clearSearchHistory(): Promise<void> {
    this.searchHistory = [];
    await AsyncStorage.removeItem(this.SEARCH_HISTORY_KEY);

    analytics.logEvent('search_history_cleared');
  }

  /**
   * Add place to favorites
   */
  async addToFavorites(
    place: PlaceDetails,
    category: FavoritePlace['category'] = 'favorite',
    notes?: string
  ): Promise<void> {
    try {
      const favorite: FavoritePlace = {
        id: place.placeId,
        placeId: place.placeId,
        name: place.name,
        address: place.formattedAddress,
        location: place.location,
        category,
        notes,
        addedAt: new Date().toISOString(),
        visitCount: 0,
      };

      // Remove if already exists
      this.favorites = this.favorites.filter(f => f.placeId !== place.placeId);

      // Add to beginning
      this.favorites.unshift(favorite);

      await this.saveFavorites();

      analytics.logEvent('place_added_to_favorites', {
        place_id: place.placeId,
        category,
      });
    } catch (error) {
      console.error('Error adding to favorites:', error);
      throw error;
    }
  }

  /**
   * Remove from favorites
   */
  async removeFromFavorites(placeId: string): Promise<void> {
    try {
      this.favorites = this.favorites.filter(f => f.placeId !== placeId);
      await this.saveFavorites();

      analytics.logEvent('place_removed_from_favorites', {
        place_id: placeId,
      });
    } catch (error) {
      console.error('Error removing from favorites:', error);
      throw error;
    }
  }

  /**
   * Get favorites
   */
  async getFavorites(category?: FavoritePlace['category']): Promise<FavoritePlace[]> {
    await this.loadFavorites();

    if (category) {
      return this.favorites.filter(f => f.category === category);
    }

    return this.favorites;
  }

  /**
   * Update favorite visit count
   */
  async incrementFavoriteVisit(placeId: string): Promise<void> {
    const favorite = this.favorites.find(f => f.placeId === placeId);
    if (favorite) {
      favorite.visitCount++;
      favorite.lastVisited = new Date().toISOString();
      await this.saveFavorites();
    }
  }

  /**
   * Set home location
   */
  async setHomeLocation(place: PlaceDetails): Promise<void> {
    // Remove existing home
    this.favorites = this.favorites.filter(f => f.category !== 'home');
    await this.addToFavorites(place, 'home');

    analytics.logEvent('home_location_set', {
      place_id: place.placeId,
    });
  }

  /**
   * Set work location
   */
  async setWorkLocation(place: PlaceDetails): Promise<void> {
    // Remove existing work
    this.favorites = this.favorites.filter(f => f.category !== 'work');
    await this.addToFavorites(place, 'work');

    analytics.logEvent('work_location_set', {
      place_id: place.placeId,
    });
  }

  /**
   * Get home location
   */
  async getHomeLocation(): Promise<FavoritePlace | null> {
    await this.loadFavorites();
    return this.favorites.find(f => f.category === 'home') || null;
  }

  /**
   * Get work location
   */
  async getWorkLocation(): Promise<FavoritePlace | null> {
    await this.loadFavorites();
    return this.favorites.find(f => f.category === 'work') || null;
  }

  /**
   * Get suggestions based on history and favorites
   */
  async getSuggestions(
    currentLocation?: { latitude: number; longitude: number },
    limit: number = 5
  ): Promise<Array<{
    type: 'favorite' | 'history' | 'nearby';
    data: FavoritePlace | SearchHistoryItem | PlaceDetails;
  }>> {
    const suggestions: any[] = [];

    // Add favorites (prioritize home/work)
    await this.loadFavorites();
    const priorityFavorites = this.favorites
      .filter(f => f.category === 'home' || f.category === 'work')
      .slice(0, 2);

    suggestions.push(
      ...priorityFavorites.map(f => ({ type: 'favorite', data: f }))
    );

    // Add recent history
    await this.loadSearchHistory();
    const recentHistory = this.searchHistory.slice(0, 2);
    suggestions.push(
      ...recentHistory.map(h => ({ type: 'history', data: h }))
    );

    // Add nearby parking if location available
    if (currentLocation && suggestions.length < limit) {
      const nearby = await this.searchParkingGarages(currentLocation, 1000);
      suggestions.push(
        ...nearby.slice(0, limit - suggestions.length).map(p => ({ type: 'nearby', data: p }))
      );
    }

    return suggestions.slice(0, limit);
  }

  /**
   * Load search history from storage
   */
  private async loadSearchHistory(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(this.SEARCH_HISTORY_KEY);
      if (data) {
        this.searchHistory = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading search history:', error);
      this.searchHistory = [];
    }
  }

  /**
   * Save search history to storage
   */
  private async saveSearchHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.SEARCH_HISTORY_KEY,
        JSON.stringify(this.searchHistory)
      );
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  }

  /**
   * Load favorites from storage
   */
  private async loadFavorites(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(this.FAVORITES_KEY);
      if (data) {
        this.favorites = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
      this.favorites = [];
    }
  }

  /**
   * Save favorites to storage
   */
  private async saveFavorites(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.FAVORITES_KEY,
        JSON.stringify(this.favorites)
      );
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  }
}

// Export singleton instance
export const placesService = new PlacesService();

export default placesService;