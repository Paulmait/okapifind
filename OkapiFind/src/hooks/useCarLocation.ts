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

// Mock car location for demo purposes (San Francisco area)
const MOCK_CAR_LOCATION: CarLocation = {
  latitude: 37.78825,
  longitude: -122.4324,
  timestamp: Date.now(),
  address: 'Mock Location - San Francisco',
  notes: 'Demo car location',
};

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
        // Use mock location if no saved location exists
        setCarLocation(MOCK_CAR_LOCATION);
      }
    } catch (err) {
      console.error('Error loading car location:', err);
      setError('Failed to load car location');
      // Fallback to mock location on error
      setCarLocation(MOCK_CAR_LOCATION);
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

      // Reset to mock location
      setCarLocation(MOCK_CAR_LOCATION);

      console.log('Car location cleared');
    } catch (err) {
      console.error('Error clearing car location:', err);
      setError('Failed to clear car location');
      throw err;
    }
  }, []);

  /**
   * Get car location from external API (placeholder for future implementation)
   * For now, returns the mock location
   * @param vehicleId - Vehicle identifier for API lookup
   */
  const fetchCarLocationFromAPI = useCallback(async (vehicleId?: string): Promise<CarLocation> => {
    // TODO: Implement actual API call to Google Maps or other service
    // For now, simulate API delay and return mock data

    setIsLoading(true);
    setError(null);

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // In future, this would be an actual API call like:
      // const response = await fetch(`https://api.example.com/vehicles/${vehicleId}/location`);
      // const data = await response.json();

      const apiLocation: CarLocation = {
        ...MOCK_CAR_LOCATION,
        timestamp: Date.now(),
        notes: vehicleId ? `Vehicle ID: ${vehicleId}` : 'API mock location',
      };

      setCarLocation(apiLocation);

      // Also save to storage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(apiLocation));

      return apiLocation;
    } catch (err) {
      console.error('Error fetching from API:', err);
      setError('Failed to fetch car location from API');
      throw err;
    } finally {
      setIsLoading(false);
    }
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