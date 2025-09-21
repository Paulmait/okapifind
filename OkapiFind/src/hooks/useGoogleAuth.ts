import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { googleApi, ParkingLocation, GoogleAuthTokens } from '../utils/googleApi';

interface UseGoogleAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastParkingLocation: ParkingLocation | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchParkingLocation: (hoursAgo?: number) => Promise<ParkingLocation | null>;
  checkAuthStatus: () => Promise<void>;
}

/**
 * Custom hook for Google authentication and parking location detection
 */
export const useGoogleAuth = (): UseGoogleAuthReturn => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastParkingLocation, setLastParkingLocation] = useState<ParkingLocation | null>(null);

  /**
   * Check authentication status on mount
   */
  useEffect(() => {
    checkAuthStatus();
  }, []);

  /**
   * Check if user is already authenticated
   */
  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const authenticated = await googleApi.isAuthenticated();
      setIsAuthenticated(authenticated);

      if (authenticated) {
        // Try to fetch last parking location
        const parking = await googleApi.fetchLastParkedLocation();
        if (parking) {
          setLastParkingLocation(parking);
        }
      }
    } catch (err) {
      console.error('Error checking auth status:', err);
      setError('Failed to check authentication status');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign in with Google
   */
  const signIn = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const tokens = await googleApi.authenticate();

      if (tokens) {
        setIsAuthenticated(true);

        Alert.alert(
          'Success',
          'Successfully connected to Google account',
          [{ text: 'OK' }]
        );

        // Try to fetch parking location after sign in
        const parking = await googleApi.fetchLastParkedLocation();
        if (parking) {
          setLastParkingLocation(parking);
        }
      } else {
        setError('Authentication cancelled or failed');
        Alert.alert(
          'Authentication Failed',
          'Could not connect to Google account. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || 'Failed to sign in');

      Alert.alert(
        'Sign In Error',
        err.message || 'An error occurred during sign in',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Sign out from Google
   */
  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      await googleApi.signOut();

      setIsAuthenticated(false);
      setLastParkingLocation(null);

      Alert.alert(
        'Signed Out',
        'Successfully disconnected from Google account',
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      console.error('Sign out error:', err);
      setError(err.message || 'Failed to sign out');

      Alert.alert(
        'Sign Out Error',
        'An error occurred during sign out',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch parking location from Google Timeline
   */
  const fetchParkingLocation = useCallback(async (hoursAgo: number = 24): Promise<ParkingLocation | null> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isAuthenticated) {
        setError('Not authenticated');
        Alert.alert(
          'Not Connected',
          'Please connect your Google account first to detect parking location',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Connect', onPress: signIn }
          ]
        );
        return null;
      }

      const parking = await googleApi.fetchLastParkedLocation(hoursAgo);

      if (parking) {
        setLastParkingLocation(parking);

        Alert.alert(
          'Parking Location Found',
          `Found parking location from ${new Date(parking.timestamp).toLocaleString()}`,
          [{ text: 'OK' }]
        );

        return parking;
      } else {
        Alert.alert(
          'No Parking Found',
          `No parking location found in the last ${hoursAgo} hours`,
          [{ text: 'OK' }]
        );

        return null;
      }
    } catch (err: any) {
      console.error('Fetch parking error:', err);
      setError(err.message || 'Failed to fetch parking location');

      Alert.alert(
        'Error',
        'Could not fetch parking location from Google',
        [{ text: 'OK' }]
      );

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, signIn]);

  return {
    isAuthenticated,
    isLoading,
    error,
    lastParkingLocation,
    signIn,
    signOut,
    fetchParkingLocation,
    checkAuthStatus,
  };
};