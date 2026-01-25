/**
 * Saved Places Types
 * Types for Base Camp (Hotel), Favorites, and Custom saved places
 */

/**
 * Types of saved places
 */
export type SavedPlaceType = 'HOTEL' | 'FAVORITE' | 'CUSTOM' | 'CAR';

/**
 * Provider used to search/add the place
 */
export type PlaceProvider = 'apple' | 'google' | 'manual';

/**
 * Saved Place entity
 */
export interface SavedPlace {
  id: string;
  userId: string;
  tripId?: string | null;
  type: SavedPlaceType;
  label: string;
  address?: string | null;
  lat: number;
  lng: number;
  provider?: PlaceProvider | null;
  providerPlaceId?: string | null;
  geofenceRadiusM: number;
  isActive: boolean;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Trip entity (for organizing saved places)
 */
export interface Trip {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating/updating a saved place
 */
export interface UpsertSavedPlaceInput {
  id?: string;
  tripId?: string | null;
  type: SavedPlaceType;
  label: string;
  address?: string | null;
  lat: number;
  lng: number;
  provider?: PlaceProvider;
  providerPlaceId?: string | null;
  geofenceRadiusM?: number;
  isActive?: boolean;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  notes?: string | null;
}

/**
 * Input specifically for setting a hotel
 */
export interface SetHotelInput {
  label: string;
  lat: number;
  lng: number;
  address?: string | null;
  provider?: PlaceProvider;
  providerPlaceId?: string | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  notes?: string | null;
  geofenceRadiusM?: number;
}

/**
 * Saved Places store state
 */
export interface SavedPlacesState {
  // Data
  places: SavedPlace[];
  currentHotel: SavedPlace | null;
  defaultTrip: Trip | null;

  // Loading states
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;

  // Settings (opt-in features)
  smartSuggestionsEnabled: boolean;
  returnToHotelSuggestEnabled: boolean;
  dontAskSaveAgainPlaceIds: string[]; // Places user dismissed with "Don't ask again"

  // Actions
  setPlaces: (places: SavedPlace[]) => void;
  setCurrentHotel: (hotel: SavedPlace | null) => void;
  setDefaultTrip: (trip: Trip | null) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setIsHydrated: (hydrated: boolean) => void;
  setSmartSuggestionsEnabled: (enabled: boolean) => void;
  setReturnToHotelSuggestEnabled: (enabled: boolean) => void;
  addDontAskAgainPlace: (lat: number, lng: number) => void;
  resetDontAskAgain: () => void;
}

/**
 * Context for smart suggestion triggers
 */
export interface SuggestionContext {
  currentLat: number;
  currentLng: number;
  accuracy: number;
  stationaryDurationMs: number;
  isAppForeground: boolean;
  isMapScreenActive: boolean;
  existingPlaces: SavedPlace[];
  currentHotel: SavedPlace | null;
}

/**
 * Context for return-to-hotel suggestion triggers
 */
export interface ReturnToHotelContext {
  currentLat: number;
  currentLng: number;
  hotelLat: number;
  hotelLng: number;
  distanceToHotelMeters: number;
  localHour: number; // 0-23
  justEndedNavigation: boolean;
  timeSinceNavigationEndMs?: number;
}

/**
 * Database row types for Supabase (snake_case)
 */
export interface SavedPlaceRow {
  id: string;
  user_id: string;
  trip_id: string | null;
  type: SavedPlaceType;
  label: string;
  address: string | null;
  lat: number;
  lng: number;
  provider: PlaceProvider | null;
  provider_place_id: string | null;
  geofence_radius_m: number;
  is_active: boolean;
  check_in_date: string | null;
  check_out_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripRow {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Convert database row to SavedPlace entity
 */
export const savedPlaceFromRow = (row: SavedPlaceRow): SavedPlace => ({
  id: row.id,
  userId: row.user_id,
  tripId: row.trip_id,
  type: row.type,
  label: row.label,
  address: row.address,
  lat: row.lat,
  lng: row.lng,
  provider: row.provider,
  providerPlaceId: row.provider_place_id,
  geofenceRadiusM: row.geofence_radius_m,
  isActive: row.is_active,
  checkInDate: row.check_in_date,
  checkOutDate: row.check_out_date,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Convert Trip row to Trip entity
 */
export const tripFromRow = (row: TripRow): Trip => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  isDefault: row.is_default,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
