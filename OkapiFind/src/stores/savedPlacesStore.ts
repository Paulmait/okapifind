/**
 * Saved Places Store
 * Zustand store for managing saved places state with persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SavedPlace,
  Trip,
  SavedPlacesState,
} from '../types/savedPlaces.types';
import { savedPlacesService } from '../services/savedPlacesService';

interface SavedPlacesActions {
  // Data loading
  hydrate: () => Promise<void>;
  syncFromServer: () => Promise<void>;
  refresh: () => Promise<void>;

  // Hotel operations
  fetchHotel: () => Promise<SavedPlace | null>;

  // Places operations
  fetchPlaces: () => Promise<SavedPlace[]>;
  addPlace: (place: SavedPlace) => void;
  updatePlace: (place: SavedPlace) => void;
  removePlace: (id: string) => void;

  // Settings
  toggleSmartSuggestions: () => void;
  toggleReturnToHotelSuggest: () => void;
}

type SavedPlacesStore = SavedPlacesState & SavedPlacesActions;

export const useSavedPlacesStore = create<SavedPlacesStore>()(
  persist(
    (set, get) => ({
      // Initial state
      places: [],
      currentHotel: null,
      defaultTrip: null,
      isLoading: false,
      isHydrated: false,
      error: null,
      smartSuggestionsEnabled: false, // Default OFF (opt-in)
      returnToHotelSuggestEnabled: false, // Default OFF (opt-in)
      dontAskSaveAgainPlaceIds: [],

      // Basic setters
      setPlaces: (places) => set({ places }),
      setCurrentHotel: (hotel) => set({ currentHotel: hotel }),
      setDefaultTrip: (trip) => set({ defaultTrip: trip }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setIsHydrated: (hydrated) => set({ isHydrated: hydrated }),
      setSmartSuggestionsEnabled: (enabled) => set({ smartSuggestionsEnabled: enabled }),
      setReturnToHotelSuggestEnabled: (enabled) => set({ returnToHotelSuggestEnabled: enabled }),

      addDontAskAgainPlace: (lat, lng) => {
        const placeId = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
        set((state) => ({
          dontAskSaveAgainPlaceIds: [...state.dontAskSaveAgainPlaceIds, placeId],
        }));
      },

      resetDontAskAgain: () => set({ dontAskSaveAgainPlaceIds: [] }),

      // Hydrate from local cache on app start
      hydrate: async () => {
        try {
          set({ isLoading: true, error: null });

          // Load from cache first for immediate display
          // Wrap each call individually to prevent cascading failures
          let cachedPlaces: SavedPlace[] = [];
          let cachedHotel: SavedPlace | null = null;

          try {
            cachedPlaces = await savedPlacesService.loadPlacesFromCache();
          } catch (e) {
            console.warn('Failed to load places from cache:', e);
          }

          try {
            cachedHotel = await savedPlacesService.loadHotelFromCache();
          } catch (e) {
            console.warn('Failed to load hotel from cache:', e);
          }

          set({
            places: cachedPlaces,
            currentHotel: cachedHotel,
            isHydrated: true,
          });

          // Then sync from server in background (don't await, let it run)
          get().syncFromServer().catch((e) => {
            console.warn('Background sync failed:', e);
          });
        } catch (error) {
          console.error('Error hydrating saved places store:', error);
          set({ error: 'Failed to load saved places', isHydrated: true });
        } finally {
          set({ isLoading: false });
        }
      },

      // Sync data from Supabase server
      syncFromServer: async () => {
        try {
          const [places, hotel, defaultTrip] = await Promise.all([
            savedPlacesService.listSavedPlaces(),
            savedPlacesService.getHotel(),
            savedPlacesService.getOrCreateDefaultTrip(),
          ]);

          set({
            places,
            currentHotel: hotel,
            defaultTrip,
            error: null,
          });
        } catch (error) {
          console.error('Error syncing from server:', error);
          // Don't set error if we have cached data
          if (get().places.length === 0) {
            set({ error: 'Failed to sync saved places' });
          }
        }
      },

      // Full refresh (reload everything)
      refresh: async () => {
        set({ isLoading: true, error: null });
        try {
          await get().syncFromServer();
        } finally {
          set({ isLoading: false });
        }
      },

      // Fetch hotel specifically
      fetchHotel: async () => {
        try {
          const hotel = await savedPlacesService.getHotel();
          set({ currentHotel: hotel });
          return hotel;
        } catch (error) {
          console.error('Error fetching hotel:', error);
          return null;
        }
      },

      // Fetch all places
      fetchPlaces: async () => {
        try {
          const places = await savedPlacesService.listSavedPlaces();
          set({ places });
          return places;
        } catch (error) {
          console.error('Error fetching places:', error);
          return get().places;
        }
      },

      // Add a place to the store (after API success)
      addPlace: (place) => {
        set((state) => ({
          places: [...state.places, place],
          // Update currentHotel if this is an active hotel
          currentHotel:
            place.type === 'HOTEL' && place.isActive ? place : state.currentHotel,
        }));
      },

      // Update a place in the store
      updatePlace: (place) => {
        set((state) => {
          const places = state.places.map((p) =>
            p.id === place.id ? place : p
          );

          // If this is the active hotel, update currentHotel
          let currentHotel = state.currentHotel;
          if (place.type === 'HOTEL') {
            if (place.isActive) {
              currentHotel = place;
              // Deactivate other hotels in local state
              places.forEach((p) => {
                if (p.type === 'HOTEL' && p.id !== place.id) {
                  p.isActive = false;
                }
              });
            } else if (currentHotel?.id === place.id) {
              currentHotel = null;
            }
          }

          return { places, currentHotel };
        });
      },

      // Remove a place from the store
      removePlace: (id) => {
        set((state) => ({
          places: state.places.filter((p) => p.id !== id),
          currentHotel: state.currentHotel?.id === id ? null : state.currentHotel,
        }));
      },

      // Toggle smart suggestions setting
      toggleSmartSuggestions: () => {
        set((state) => ({
          smartSuggestionsEnabled: !state.smartSuggestionsEnabled,
        }));
      },

      // Toggle return to hotel suggestion setting
      toggleReturnToHotelSuggest: () => {
        set((state) => ({
          returnToHotelSuggestEnabled: !state.returnToHotelSuggestEnabled,
        }));
      },
    }),
    {
      name: 'okapifind-saved-places',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist settings, not data (data comes from cache/server)
        smartSuggestionsEnabled: state.smartSuggestionsEnabled,
        returnToHotelSuggestEnabled: state.returnToHotelSuggestEnabled,
        dontAskSaveAgainPlaceIds: state.dontAskSaveAgainPlaceIds,
      }),
    }
  )
);

// Selectors for common queries
export const selectHasHotel = (state: SavedPlacesStore) =>
  state.currentHotel !== null;

export const selectActivePlaces = (state: SavedPlacesStore) =>
  state.places.filter((p) => p.isActive);

export const selectFavorites = (state: SavedPlacesStore) =>
  state.places.filter((p) => p.type === 'FAVORITE' && p.isActive);

export const selectPlaceById = (state: SavedPlacesStore, id: string) =>
  state.places.find((p) => p.id === id);

export default useSavedPlacesStore;
