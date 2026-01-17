/**
 * User Location Hook
 * Provides current user location for navigation
 */

import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface UseUserLocationReturn {
  userLocation: UserLocation | null;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  refreshLocation: () => Promise<void>;
}

export function useUserLocation(): UseUserLocationReturn {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (err) {
      setError('Failed to request location permission');
      return false;
    }
  };

  const refreshLocation = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (err) {
      setError('Failed to get current location');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let subscription: Location.LocationSubscription | null = null;

    const startWatching = async () => {
      const hasPermission = await requestPermission();
      if (!hasPermission || !isMounted) {
        setIsLoading(false);
        return;
      }

      try {
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (location) => {
            if (isMounted) {
              setUserLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });
              setIsLoading(false);
            }
          }
        );
      } catch (err) {
        if (isMounted) {
          setError('Failed to watch location');
          setIsLoading(false);
        }
      }
    };

    startWatching();

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  return {
    userLocation,
    isLoading,
    error,
    requestPermission,
    refreshLocation,
  };
}

export default useUserLocation;
