// @ts-nocheck
/**
 * useParkingLocation Hook
 * Integrates with Supabase for parking session management
 * Implements offline-first architecture with automatic sync
 */

import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { supabase, ParkingSession } from '../lib/supabase-client';
import { analytics } from '../services/analytics';
import { offlineQueue } from '../services/offlineQueue';
import { locationFusion } from '../services/locationFusion';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SaveParkingOptions {
  autoDetected?: boolean;
  source?: 'auto' | 'manual' | 'photo' | 'quick_park_button';
  timestamp?: number;
  notes?: string;
  floor?: string;
  venue_name?: string;
}

export const useParkingLocation = () => {
  const [isParked, setIsParked] = useState(false);
  const [currentSession, setCurrentSession] = useState<ParkingSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load current parking session on mount
  useEffect(() => {
    loadCurrentSession();
  }, []);

  /**
   * Load current active parking session
   */
  const loadCurrentSession = async () => {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Load from local storage for anonymous users
        const localSession = await AsyncStorage.getItem('@OkapiFind:currentSession');
        if (localSession) {
          const session = JSON.parse(localSession);
          setCurrentSession(session);
          setIsParked(true);
        }
        return;
      }

      // Load from Supabase for authenticated users
      const { data, error } = await supabase
        .from('parking_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('saved_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setCurrentSession(data);
        setIsParked(true);
      }
    } catch (err) {
      // No active session, which is fine
      setIsParked(false);
    }
  };

  /**
   * Save parking location
   * Implements offline-first with automatic sync
   */
  const saveParkingLocation = useCallback(async (options: SaveParkingOptions = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      // Get current location with high accuracy using sensor fusion
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }

      // Use location fusion for 6x better accuracy!
      const fusedLocation = await locationFusion.getHighAccuracyLocation();

      // Get user
      const { data: { user } } = await supabase.auth.getUser();

      // Prepare session data with fused location
      const sessionData: Partial<ParkingSession> = {
        car_point: {
          coordinates: [fusedLocation.longitude, fusedLocation.latitude]
        },
        saved_at: new Date().toISOString(),
        source: options.source || 'manual',
        floor: options.floor || fusedLocation.floor, // Use detected floor if available
        venue_name: options.venue_name || fusedLocation.venue_name, // Use detected venue
        venue_id: fusedLocation.venue_id,
        notes: options.notes,
        is_active: true,
      };

      if (user) {
        // Authenticated user - save to Supabase
        sessionData.user_id = user.id;

        // Get default vehicle
        const { data: vehicles } = await supabase
          .from('vehicles')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_default', true)
          .limit(1)
          .single();

        if (vehicles) {
          sessionData.vehicle_id = vehicles.id;
        }

        // Try to save to Supabase (offline-first)
        try {
          const { data: savedSession, error } = await supabase
            .from('parking_sessions')
            .insert(sessionData)
            .select()
            .single();

          if (error) throw error;

          setCurrentSession(savedSession);
          setIsParked(true);

          // Log analytics with fusion data
          analytics.logEvent('parking_saved', {
            source: options.source || 'manual',
            auto_detected: options.autoDetected || false,
            has_venue: !!fusedLocation.venue_name,
            has_floor: !!fusedLocation.floor,
            accuracy: fusedLocation.accuracy,
            snapped: fusedLocation.snapped,
            fusion_sources: fusedLocation.sources.join(','),
          });

        } catch (supabaseError) {
          // Network error - save to offline queue
          console.log('Network error, saving to offline queue');
          await offlineQueue.addToQueue({
            type: 'save_parking',
            data: sessionData,
            timestamp: Date.now(),
          });

          // Save locally for immediate use
          const localSession = {
            ...sessionData,
            id: `offline_${Date.now()}`,
            created_at: new Date().toISOString(),
          };
          await AsyncStorage.setItem('@OkapiFind:currentSession', JSON.stringify(localSession));
          setCurrentSession(localSession as ParkingSession);
          setIsParked(true);

          analytics.logEvent('parking_saved_offline', {
            source: options.source || 'manual',
          });
        }
      } else {
        // Anonymous user - save only locally
        const localSession = {
          ...sessionData,
          id: `anonymous_${Date.now()}`,
          user_id: 'anonymous',
          created_at: new Date().toISOString(),
        };
        await AsyncStorage.setItem('@OkapiFind:currentSession', JSON.stringify(localSession));
        setCurrentSession(localSession as ParkingSession);
        setIsParked(true);

        analytics.logEvent('parking_saved_anonymous', {
          source: options.source || 'manual',
        });
      }

    } catch (err) {
      setError(err as Error);
      analytics.logEvent('parking_save_error', {
        error: (err as Error).message,
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Mark parking as found
   */
  const markParkingFound = useCallback(async () => {
    if (!currentSession) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user && !currentSession.id.startsWith('offline_') && !currentSession.id.startsWith('anonymous_')) {
        // Update in Supabase
        await supabase
          .from('parking_sessions')
          .update({
            found_at: new Date().toISOString(),
            is_active: false,
          })
          .eq('id', currentSession.id);
      }

      // Clear local session
      await AsyncStorage.removeItem('@OkapiFind:currentSession');
      setCurrentSession(null);
      setIsParked(false);

      analytics.logEvent('parking_found');
    } catch (err) {
      console.error('Error marking parking found:', err);
    }
  }, [currentSession]);

  /**
   * Get reverse geocoded address for location
   */
  const getAddress = useCallback(async (latitude: number, longitude: number): Promise<string | null> => {
    try {
      const geocoded = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (geocoded.length > 0) {
        const location = geocoded[0];
        return `${location.street || ''} ${location.city || ''}, ${location.region || ''}`.trim();
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    }
    return null;
  }, []);

  return {
    isParked,
    currentSession,
    isLoading,
    error,
    saveParkingLocation,
    markParkingFound,
    getAddress,
    loadCurrentSession,
  };
};

export default useParkingLocation;
