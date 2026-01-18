import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CarLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
  address?: string;
  notes?: string;
}

const STORAGE_KEY = '@OkapiFind:carLocation';

export const useCarLocation = () => {
  const [carLocation, setCarLocation] = useState<CarLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load saved car location on mount
  useEffect(() => {
    loadCarLocation();
  }, []);

  /**
   * Load car location from AsyncStorage
   * Falls back to mock location if nothing is saved
   */
  const loadCarLocation = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const savedLocation = await AsyncStorage.getItem(STORAGE_KEY);

      if (savedLocation) {
        const parsed = JSON.parse(savedLocation) as CarLocation;
        setCarLocation(parsed);
      } else {
        // No saved location - start fresh
        setCarLocation(null);
      }
    } catch (err) {
      console.error('Error loading car location:', err);
      setError('Failed to load car location');
      // No fallback - keep null state
      setCarLocation(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Save car location from current user position
   * @param latitude - Current user latitude
   * @param longitude - Current user longitude
   * @param options - Optional address and notes
   */
  const saveCarLocation = useCallback(async (
    latitude: number,
    longitude: number,
    options?: {
      address?: string;
      notes?: string;
    }
  ): Promise<void> => {
    try {
      setError(null);

      const newLocation: CarLocation = {
        latitude,
        longitude,
        timestamp: Date.now(),
        address: options?.address,
        notes: options?.notes,
      };

      // Save to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newLocation));

      // Update state
      setCarLocation(newLocation);

      console.log('Car location saved successfully:', newLocation);
    } catch (err) {
      console.error('Error saving car location:', err);
      setError('Failed to save car location');
      throw err;
    }
  }, []);

  /**
   * Clear saved car location
   */
  const clearCarLocation = useCallback(async (): Promise<void> => {
    try {
      setError(null);

      await AsyncStorage.removeItem(STORAGE_KEY);

      // Reset to null - no saved location
      setCarLocation(null);

      console.log('Car location cleared');
    } catch (err) {
      console.error('Error clearing car location:', err);
      setError('Failed to clear car location');
      throw err;
    }
  }, []);

  /**
   * Get car location from external API (placeholder for future implementation)
   * Currently not implemented - reserved for connected car integrations
   * @param _vehicleId - Vehicle identifier for API lookup
   */
  const fetchCarLocationFromAPI = useCallback(async (_vehicleId?: string): Promise<CarLocation | null> => {
    // This feature is reserved for future connected car integrations
    // (e.g., Tesla, BMW, Mercedes APIs)
    setError('Connected car feature not yet available');
    return null;
  }, []);

  /**
   * Update car location notes
   */
  const updateCarNotes = useCallback(async (notes: string): Promise<void> => {
    if (!carLocation) {
      setError('No car location to update');
      return;
    }

    try {
      const updatedLocation: CarLocation = {
        ...carLocation,
        notes,
      };

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLocation));
      setCarLocation(updatedLocation);
    } catch (err) {
      console.error('Error updating car notes:', err);
      setError('Failed to update car notes');
      throw err;
    }
  }, [carLocation]);

  /**
   * Check if car location is recent (within last 24 hours)
   */
  const isLocationRecent = useCallback((): boolean => {
    if (!carLocation) return false;

    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    return carLocation.timestamp > twentyFourHoursAgo;
  }, [carLocation]);

  /**
   * Get formatted timestamp
   */
  const getFormattedTime = useCallback((): string => {
    if (!carLocation) return 'Unknown';

    const date = new Date(carLocation.timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }, [carLocation]);

  return {
    carLocation,
    isLoading,
    error,
    saveCarLocation,
    clearCarLocation,
    fetchCarLocationFromAPI,
    updateCarNotes,
    isLocationRecent,
    getFormattedTime,
    reloadCarLocation: loadCarLocation,
  };
};