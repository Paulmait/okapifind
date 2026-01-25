/**
 * useSavedPlaces Hook
 * Provides a convenient interface for saved places operations
 */

import { useCallback, useEffect } from 'react';
import { useSavedPlacesStore, selectHasHotel, selectActivePlaces, selectFavorites } from '../stores/savedPlacesStore';
import { savedPlacesService } from '../services/savedPlacesService';
import {
  SavedPlace,
  UpsertSavedPlaceInput,
  SetHotelInput,
  SavedPlaceType,
} from '../types/savedPlaces.types';

export interface UseSavedPlacesReturn {
  // State
  places: SavedPlace[];
  activePlaces: SavedPlace[];
  favorites: SavedPlace[];
  currentHotel: SavedPlace | null;
  hasHotel: boolean;
  isLoading: boolean;
  error: string | null;
  isHydrated: boolean;

  // Settings
  smartSuggestionsEnabled: boolean;
  returnToHotelSuggestEnabled: boolean;

  // Actions
  refresh: () => Promise<void>;
  setHotel: (input: SetHotelInput) => Promise<SavedPlace | null>;
  clearHotel: () => Promise<boolean>;
  addFavorite: (input: Omit<UpsertSavedPlaceInput, 'type'>) => Promise<SavedPlace | null>;
  addCustomPlace: (input: Omit<UpsertSavedPlaceInput, 'type'>) => Promise<SavedPlace | null>;
  updatePlace: (input: UpsertSavedPlaceInput & { id: string }) => Promise<SavedPlace | null>;
  removePlace: (id: string) => Promise<boolean>;
  getPlacesByType: (type: SavedPlaceType) => SavedPlace[];
  isWithinSavedPlace: (lat: number, lng: number) => Promise<{ isWithin: boolean; place?: SavedPlace }>;
  getDistanceToHotel: (lat: number, lng: number) => number | null;
  getBearingToHotel: (lat: number, lng: number) => number | null;

  // Settings toggles
  toggleSmartSuggestions: () => void;
  toggleReturnToHotelSuggest: () => void;
  addDontAskAgainPlace: (lat: number, lng: number) => void;
  resetDontAskAgain: () => void;
  isDontAskAgainPlace: (lat: number, lng: number) => boolean;
}

export function useSavedPlaces(): UseSavedPlacesReturn {
  const store = useSavedPlacesStore();
  const hasHotel = useSavedPlacesStore(selectHasHotel);
  const activePlaces = useSavedPlacesStore(selectActivePlaces);
  const favorites = useSavedPlacesStore(selectFavorites);

  // Hydrate store on mount if not already hydrated
  useEffect(() => {
    if (!store.isHydrated) {
      // Wrap in try-catch to prevent crashes during initialization
      try {
        store.hydrate().catch((error) => {
          console.warn('Failed to hydrate saved places store:', error);
        });
      } catch (error) {
        console.warn('Error initiating hydration:', error);
      }
    }
  }, [store.isHydrated]);

  // Set hotel
  const setHotel = useCallback(async (input: SetHotelInput): Promise<SavedPlace | null> => {
    const hotel = await savedPlacesService.setHotel(input);
    if (hotel) {
      store.updatePlace(hotel);
    }
    return hotel;
  }, [store]);

  // Clear hotel
  const clearHotel = useCallback(async (): Promise<boolean> => {
    const success = await savedPlacesService.clearHotel();
    if (success) {
      store.setCurrentHotel(null);
      // Refresh places to update hotel status
      await store.fetchPlaces();
    }
    return success;
  }, [store]);

  // Add favorite
  const addFavorite = useCallback(async (
    input: Omit<UpsertSavedPlaceInput, 'type'>
  ): Promise<SavedPlace | null> => {
    const place = await savedPlacesService.upsertSavedPlace({
      ...input,
      type: 'FAVORITE',
    });
    if (place) {
      store.addPlace(place);
    }
    return place;
  }, [store]);

  // Add custom place
  const addCustomPlace = useCallback(async (
    input: Omit<UpsertSavedPlaceInput, 'type'>
  ): Promise<SavedPlace | null> => {
    const place = await savedPlacesService.upsertSavedPlace({
      ...input,
      type: 'CUSTOM',
    });
    if (place) {
      store.addPlace(place);
    }
    return place;
  }, [store]);

  // Update place
  const updatePlace = useCallback(async (
    input: UpsertSavedPlaceInput & { id: string }
  ): Promise<SavedPlace | null> => {
    const place = await savedPlacesService.upsertSavedPlace(input);
    if (place) {
      store.updatePlace(place);
    }
    return place;
  }, [store]);

  // Remove place
  const removePlace = useCallback(async (id: string): Promise<boolean> => {
    const success = await savedPlacesService.removeSavedPlace(id);
    if (success) {
      store.removePlace(id);
    }
    return success;
  }, [store]);

  // Get places by type (from local state)
  const getPlacesByType = useCallback((type: SavedPlaceType): SavedPlace[] => {
    return store.places.filter(p => p.type === type && p.isActive);
  }, [store.places]);

  // Check if location is within any saved place
  const isWithinSavedPlace = useCallback(async (
    lat: number,
    lng: number
  ): Promise<{ isWithin: boolean; place?: SavedPlace }> => {
    return savedPlacesService.isWithinSavedPlaceGeofence(lat, lng);
  }, []);

  // Get distance to hotel
  const getDistanceToHotel = useCallback((lat: number, lng: number): number | null => {
    if (!store.currentHotel) return null;
    return savedPlacesService.calculateDistance(
      lat,
      lng,
      store.currentHotel.lat,
      store.currentHotel.lng
    );
  }, [store.currentHotel]);

  // Get bearing to hotel
  const getBearingToHotel = useCallback((lat: number, lng: number): number | null => {
    if (!store.currentHotel) return null;
    return savedPlacesService.calculateBearing(
      lat,
      lng,
      store.currentHotel.lat,
      store.currentHotel.lng
    );
  }, [store.currentHotel]);

  // Check if a location is in the "don't ask again" list
  const isDontAskAgainPlace = useCallback((lat: number, lng: number): boolean => {
    const placeId = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
    return store.dontAskSaveAgainPlaceIds.includes(placeId);
  }, [store.dontAskSaveAgainPlaceIds]);

  return {
    // State
    places: store.places,
    activePlaces,
    favorites,
    currentHotel: store.currentHotel,
    hasHotel,
    isLoading: store.isLoading,
    error: store.error,
    isHydrated: store.isHydrated,

    // Settings
    smartSuggestionsEnabled: store.smartSuggestionsEnabled,
    returnToHotelSuggestEnabled: store.returnToHotelSuggestEnabled,

    // Actions
    refresh: store.refresh,
    setHotel,
    clearHotel,
    addFavorite,
    addCustomPlace,
    updatePlace,
    removePlace,
    getPlacesByType,
    isWithinSavedPlace,
    getDistanceToHotel,
    getBearingToHotel,

    // Settings toggles
    toggleSmartSuggestions: store.toggleSmartSuggestions,
    toggleReturnToHotelSuggest: store.toggleReturnToHotelSuggest,
    addDontAskAgainPlace: store.addDontAskAgainPlace,
    resetDontAskAgain: store.resetDontAskAgain,
    isDontAskAgainPlace,
  };
}

export default useSavedPlaces;
