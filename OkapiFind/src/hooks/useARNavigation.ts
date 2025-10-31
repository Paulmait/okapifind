/**
 * useARNavigation Hook
 * Provides AR navigation state and controls
 */

import { useState, useEffect, useCallback } from 'react';
import { arNavigation, ARNavigationState } from '../services/arNavigation';
import * as Location from 'expo-location';

export interface UseARNavigationOptions {
  enableHapticGuidance?: boolean;
  updateInterval?: number; // milliseconds
}

export function useARNavigation(
  carLocation: {
    latitude: number;
    longitude: number;
    floor?: string;
    altitude?: number;
  } | null,
  options: UseARNavigationOptions = {}
) {
  const { enableHapticGuidance = false, updateInterval = 1000 } = options;

  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [navState, setNavState] = useState<ARNavigationState | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to location updates
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    let updateTimer: NodeJS.Timeout | null = null;

    const startLocationTracking = async () => {
      try {
        // Check permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Location permission denied');
          return;
        }

        // Start watching location
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: updateInterval,
            distanceInterval: 1, // Update every 1 meter
          },
          (location) => {
            setUserLocation(location);
          }
        );
      } catch (err) {
        console.error('[useARNavigation] Location error:', err);
        setError(err instanceof Error ? err.message : 'Failed to get location');
      }
    };

    if (isNavigating && carLocation) {
      startLocationTracking();
    }

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      if (updateTimer) {
        clearInterval(updateTimer);
      }
    };
  }, [isNavigating, carLocation, updateInterval]);

  // Calculate navigation state
  useEffect(() => {
    if (!userLocation || !carLocation) {
      setNavState(null);
      return;
    }

    const state = arNavigation.calculateNavigationState(
      {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        altitude: userLocation.coords.altitude || undefined,
        heading: userLocation.coords.heading || undefined,
      },
      carLocation
    );

    setNavState(state);

    // Check if arrived
    if (state.distance < 3 && !hasArrived) {
      setHasArrived(true);
      stopNavigation();
    }
  }, [userLocation, carLocation, hasArrived]);

  // Haptic guidance
  useEffect(() => {
    if (enableHapticGuidance && isNavigating && navState) {
      arNavigation.startHapticGuidance(navState);
    } else {
      arNavigation.stopHapticGuidance();
    }

    return () => {
      arNavigation.stopHapticGuidance();
    };
  }, [enableHapticGuidance, isNavigating, navState]);

  const startNavigation = useCallback(() => {
    if (!carLocation) {
      setError('No car location available');
      return false;
    }

    setIsNavigating(true);
    setHasArrived(false);
    setError(null);
    return true;
  }, [carLocation]);

  const stopNavigation = useCallback(() => {
    setIsNavigating(false);
    arNavigation.stopHapticGuidance();
  }, []);

  const resetArrival = useCallback(() => {
    setHasArrived(false);
  }, []);

  return {
    // State
    navState,
    userLocation,
    isNavigating,
    hasArrived,
    error,

    // Controls
    startNavigation,
    stopNavigation,
    resetArrival,

    // Helpers
    isReady: !!(userLocation && carLocation),
    distance: navState?.distance || null,
    bearing: navState?.bearing || null,
    instructions: navState?.instructions || [],
  };
}

export default useARNavigation;
