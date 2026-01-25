/**
 * React Hook for Audio Output Detection
 * Provides easy access to audio output state and voice guidance controls
 */

import { useState, useEffect, useCallback } from 'react';
import {
  audioOutputService,
  AudioOutputInfo,
  VoicePreferences,
} from '../services/audioOutputService';

export interface UseAudioOutputReturn {
  // Current audio output info
  audioOutput: AudioOutputInfo;

  // Whether voice guidance is currently enabled
  isVoiceGuidanceEnabled: boolean;

  // Voice preferences
  preferences: VoicePreferences;

  // Methods
  speakDirection: (direction: string, distance?: number) => Promise<void>;
  speakDistance: (distance: number, destination?: string) => Promise<void>;
  speakArrival: (destination?: string) => Promise<void>;
  speakLandmark: (landmark: string, position: 'left' | 'right' | 'ahead') => Promise<void>;
  updatePreferences: (updates: Partial<VoicePreferences>) => Promise<void>;

  // For testing
  simulateHeadphones: (connected: boolean) => void;
  simulateBluetooth: (connected: boolean, deviceName?: string) => void;
}

/**
 * Hook for accessing audio output detection and voice guidance
 *
 * @example
 * ```tsx
 * function NavigationScreen() {
 *   const { audioOutput, isVoiceGuidanceEnabled, speakDirection } = useAudioOutput();
 *
 *   useEffect(() => {
 *     if (isVoiceGuidanceEnabled) {
 *       speakDirection('Turn left', 50);
 *     }
 *   }, [currentDirection]);
 *
 *   return (
 *     <View>
 *       {audioOutput.isBluetoothConnected && (
 *         <Text>Connected to {audioOutput.name}</Text>
 *       )}
 *     </View>
 *   );
 * }
 * ```
 */
export function useAudioOutput(): UseAudioOutputReturn {
  const [audioOutput, setAudioOutput] = useState<AudioOutputInfo>(
    audioOutputService.getCurrentOutput()
  );
  const [preferences, setPreferences] = useState<VoicePreferences>(
    audioOutputService.getPreferences()
  );

  useEffect(() => {
    // Initialize the service
    audioOutputService.initialize().catch(console.error);

    // Subscribe to audio output changes
    const unsubscribe = audioOutputService.subscribe((output) => {
      setAudioOutput(output);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const isVoiceGuidanceEnabled = audioOutputService.shouldEnableVoiceGuidance();

  const speakDirection = useCallback(
    async (direction: string, distance?: number) => {
      await audioOutputService.speakDirection(direction, distance);
    },
    []
  );

  const speakDistance = useCallback(
    async (distance: number, destination?: string) => {
      await audioOutputService.speakDistance(distance, destination);
    },
    []
  );

  const speakArrival = useCallback(async (destination?: string) => {
    await audioOutputService.speakArrival(destination);
  }, []);

  const speakLandmark = useCallback(
    async (landmark: string, position: 'left' | 'right' | 'ahead') => {
      await audioOutputService.speakLandmark(landmark, position);
    },
    []
  );

  const updatePreferences = useCallback(
    async (updates: Partial<VoicePreferences>) => {
      await audioOutputService.updatePreferences(updates);
      setPreferences(audioOutputService.getPreferences());
    },
    []
  );

  const simulateHeadphones = useCallback((connected: boolean) => {
    audioOutputService.simulateHeadphoneConnection(connected);
  }, []);

  const simulateBluetooth = useCallback(
    (connected: boolean, deviceName?: string) => {
      audioOutputService.simulateBluetoothConnection(connected, deviceName);
    },
    []
  );

  return {
    audioOutput,
    isVoiceGuidanceEnabled,
    preferences,
    speakDirection,
    speakDistance,
    speakArrival,
    speakLandmark,
    updatePreferences,
    simulateHeadphones,
    simulateBluetooth,
  };
}

export default useAudioOutput;
