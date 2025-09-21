import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import {
  parkingDetection,
  ParkingEvent,
  DetectionSettings,
  FrequentLocation
} from '../services/ParkingDetectionService';
import { useCarLocation } from './useCarLocation';

interface UseParkingDetectionReturn {
  isTracking: boolean;
  settings: DetectionSettings;
  parkingHistory: ParkingEvent[];
  frequentLocations: FrequentLocation[];
  lastDetectedParking: ParkingEvent | null;
  startDetection: () => Promise<void>;
  stopDetection: () => Promise<void>;
  updateSettings: (settings: Partial<DetectionSettings>) => Promise<void>;
  confirmParking: (event: ParkingEvent) => Promise<void>;
  dismissParking: (eventId: string) => Promise<void>;
  clearHistory: () => Promise<void>;
}

/**
 * Hook for automatic parking detection
 */
export const useParkingDetection = (): UseParkingDetectionReturn => {
  const [isTracking, setIsTracking] = useState(false);
  const [settings, setSettings] = useState<DetectionSettings>(
    parkingDetection.getSettings()
  );
  const [parkingHistory, setParkingHistory] = useState<ParkingEvent[]>([]);
  const [frequentLocations, setFrequentLocations] = useState<FrequentLocation[]>([]);
  const [lastDetectedParking, setLastDetectedParking] = useState<ParkingEvent | null>(null);

  const { saveCarLocation } = useCarLocation();

  // Load initial data
  useEffect(() => {
    loadParkingData();
    checkTrackingStatus();
  }, []);

  // Set up parking detection listener
  useEffect(() => {
    // This would listen for parking detection events
    // For now, we'll poll the history periodically
    const interval = setInterval(() => {
      if (settings.enabled) {
        checkForNewParking();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [settings.enabled]);

  /**
   * Load parking history and frequent locations
   */
  const loadParkingData = async () => {
    try {
      const history = await parkingDetection.getParkingHistory();
      setParkingHistory(history);

      const frequent = await parkingDetection.getFrequentLocations();
      setFrequentLocations(frequent);

      // Get last unconfirmed parking
      const unconfirmed = history.find(event => !event.isConfirmed);
      if (unconfirmed) {
        setLastDetectedParking(unconfirmed);
      }
    } catch (error) {
      console.error('Error loading parking data:', error);
    }
  };

  /**
   * Check tracking status
   */
  const checkTrackingStatus = () => {
    const currentSettings = parkingDetection.getSettings();
    setIsTracking(currentSettings.enabled);
    setSettings(currentSettings);
  };

  /**
   * Check for new parking detections
   */
  const checkForNewParking = async () => {
    const history = await parkingDetection.getParkingHistory();

    // Check if there's a new unconfirmed parking
    const unconfirmed = history.find(event => !event.isConfirmed);

    if (unconfirmed && (!lastDetectedParking || unconfirmed.id !== lastDetectedParking.id)) {
      setLastDetectedParking(unconfirmed);
      setParkingHistory(history);

      // Show notification if settings allow
      if (settings.notifyOnDetection) {
        showParkingNotification(unconfirmed);
      }
    }
  };

  /**
   * Show parking detection notification
   */
  const showParkingNotification = (event: ParkingEvent) => {
    const confidence = Math.round(event.confidence * 100);

    Alert.alert(
      '🚗 Parking Detected',
      `We detected you may have parked your car (${confidence}% confidence).\n\n` +
      `Location: ${event.address || 'Unknown address'}\n` +
      `Time: ${new Date(event.timestamp).toLocaleTimeString()}\n\n` +
      `Would you like to save this as your car location?`,
      [
        {
          text: 'Dismiss',
          style: 'cancel',
          onPress: () => dismissParking(event.id),
        },
        {
          text: 'Save',
          onPress: () => confirmParking(event),
        },
      ],
      { cancelable: false }
    );
  };

  /**
   * Start automatic parking detection
   */
  const startDetection = useCallback(async () => {
    try {
      await parkingDetection.initialize();
      setIsTracking(true);

      Alert.alert(
        'Detection Started',
        'OkapiFind is now tracking your parking automatically.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error starting detection:', error);
      Alert.alert(
        'Error',
        'Could not start parking detection. Please check location permissions.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  /**
   * Stop automatic parking detection
   */
  const stopDetection = useCallback(async () => {
    try {
      await parkingDetection.stop();
      setIsTracking(false);

      Alert.alert(
        'Detection Stopped',
        'Automatic parking detection has been disabled.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error stopping detection:', error);
    }
  }, []);

  /**
   * Update detection settings
   */
  const updateSettings = useCallback(async (newSettings: Partial<DetectionSettings>) => {
    try {
      await parkingDetection.updateSettings(newSettings);
      const updated = parkingDetection.getSettings();
      setSettings(updated);
      setIsTracking(updated.enabled);

      // Set up geofences if enabled
      if (updated.useGeofencing && frequentLocations.length > 0) {
        await parkingDetection.setupGeofences(frequentLocations);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      Alert.alert(
        'Error',
        'Could not update detection settings.',
        [{ text: 'OK' }]
      );
    }
  }, [frequentLocations]);

  /**
   * Confirm a detected parking event
   */
  const confirmParking = useCallback(async (event: ParkingEvent) => {
    try {
      // Mark as confirmed in history
      const history = await parkingDetection.getParkingHistory();
      const updated = history.map(e =>
        e.id === event.id ? { ...e, isConfirmed: true } : e
      );

      // Save as car location
      await saveCarLocation(
        event.location.latitude,
        event.location.longitude,
        {
          address: event.address,
          notes: `Auto-detected (${Math.round(event.confidence * 100)}% confidence)`,
        }
      );

      setParkingHistory(updated);
      setLastDetectedParking(null);

      Alert.alert(
        'Location Saved',
        'Your car location has been saved successfully.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error confirming parking:', error);
      Alert.alert(
        'Error',
        'Could not save parking location.',
        [{ text: 'OK' }]
      );
    }
  }, [saveCarLocation]);

  /**
   * Dismiss a detected parking event
   */
  const dismissParking = useCallback(async (eventId: string) => {
    try {
      const history = await parkingDetection.getParkingHistory();
      const updated = history.filter(e => e.id !== eventId);
      setParkingHistory(updated);

      if (lastDetectedParking?.id === eventId) {
        setLastDetectedParking(null);
      }
    } catch (error) {
      console.error('Error dismissing parking:', error);
    }
  }, [lastDetectedParking]);

  /**
   * Clear parking history
   */
  const clearHistory = useCallback(async () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all parking history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear from AsyncStorage
              setParkingHistory([]);
              setLastDetectedParking(null);

              Alert.alert(
                'History Cleared',
                'Parking history has been cleared.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('Error clearing history:', error);
            }
          },
        },
      ]
    );
  }, []);

  return {
    isTracking,
    settings,
    parkingHistory,
    frequentLocations,
    lastDetectedParking,
    startDetection,
    stopDetection,
    updateSettings,
    confirmParking,
    dismissParking,
    clearHistory,
  };
};