/**
 * Compass Hook
 * Provides device heading/compass information
 */

import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

interface UseCompassReturn {
  heading: number;
  accuracy: number | null;
  isAvailable: boolean;
  error: string | null;
}

export function useCompass(): UseCompassReturn {
  const [heading, setHeading] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setIsAvailable(false);
      setError('Compass not available on web');
      return;
    }

    let isMounted = true;

    const startCompass = async () => {
      try {
        // Dynamically import Magnetometer to avoid web issues
        const { Magnetometer } = require('expo-sensors');

        const isAvailable = await Magnetometer.isAvailableAsync();
        if (!isAvailable) {
          if (isMounted) {
            setIsAvailable(false);
            setError('Magnetometer not available on this device');
          }
          return;
        }

        Magnetometer.setUpdateInterval(100);

        subscriptionRef.current = Magnetometer.addListener(
          (data: { x: number; y: number; z: number }) => {
            if (isMounted) {
              // Calculate heading from magnetometer data
              let angle = Math.atan2(data.y, data.x);
              angle = angle * (180 / Math.PI);
              angle = angle + 90;
              angle = (angle + 360) % 360;

              setHeading(Math.round(angle));

              // Estimate accuracy based on magnetic field strength
              const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
              setAccuracy(magnitude > 20 ? 15 : magnitude > 10 ? 30 : 45);
            }
          }
        );
      } catch (err) {
        if (isMounted) {
          setIsAvailable(false);
          setError('Failed to initialize compass');
        }
      }
    };

    startCompass();

    return () => {
      isMounted = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }
    };
  }, []);

  return {
    heading,
    accuracy,
    isAvailable,
    error,
  };
}

export default useCompass;
