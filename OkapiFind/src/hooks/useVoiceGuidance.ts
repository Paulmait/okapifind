/**
 * useVoiceGuidance Hook
 * React hook for voice guidance integration in navigation screens.
 */

import { useCallback, useEffect, useState } from 'react';
import { voiceGuidanceService, ManeuverType } from '../services/voiceGuidanceService';
import { useAudioOutput } from './useAudioOutput';
import i18n from '../i18n';

export interface UseVoiceGuidanceReturn {
  // State
  isEnabled: boolean;
  isSpeaking: boolean;
  isAvailable: boolean;
  autoEnableWithHeadphones: boolean;
  hasHeadphones: boolean;

  // Actions
  setEnabled: (enabled: boolean) => void;
  setAutoEnableWithHeadphones: (enabled: boolean) => void;
  speakManeuver: (maneuver: ManeuverType, distanceMeters: number, streetName?: string) => Promise<void>;
  speakArrival: (destinationName?: string) => Promise<void>;
  speakReturningToHotel: (hotelName?: string) => Promise<void>;
  speak: (text: string) => Promise<void>;
  stop: () => Promise<void>;
}

export function useVoiceGuidance(): UseVoiceGuidanceReturn {
  const { audioOutput } = useAudioOutput();

  const [isEnabled, setIsEnabledState] = useState(voiceGuidanceService.getEnabled());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [autoEnableWithHeadphones, setAutoEnableState] = useState(true);

  // Check availability on mount
  useEffect(() => {
    voiceGuidanceService.isAvailable().then(setIsAvailable);
  }, []);

  // Sync language with i18n
  useEffect(() => {
    voiceGuidanceService.setLanguage(i18n.language);

    const handleLanguageChange = () => {
      voiceGuidanceService.setLanguage(i18n.language);
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  // Poll speaking state
  useEffect(() => {
    const interval = setInterval(() => {
      setIsSpeaking(voiceGuidanceService.isSpeakingNow());
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Set enabled
  const setEnabled = useCallback((enabled: boolean) => {
    voiceGuidanceService.setEnabled(enabled);
    setIsEnabledState(enabled);
  }, []);

  // Set auto-enable with headphones
  const setAutoEnableWithHeadphones = useCallback((enabled: boolean) => {
    voiceGuidanceService.setAutoEnableWithHeadphones(enabled);
    setAutoEnableState(enabled);
  }, []);

  // Speak maneuver
  const speakManeuver = useCallback(
    async (maneuver: ManeuverType, distanceMeters: number, streetName?: string) => {
      await voiceGuidanceService.speakManeuver(maneuver, distanceMeters, streetName);
    },
    []
  );

  // Speak arrival
  const speakArrival = useCallback(async (destinationName?: string) => {
    await voiceGuidanceService.speakArrival(destinationName);
  }, []);

  // Speak returning to hotel
  const speakReturningToHotel = useCallback(async (hotelName?: string) => {
    await voiceGuidanceService.speakReturningToHotel(hotelName);
  }, []);

  // Speak custom text
  const speak = useCallback(async (text: string) => {
    await voiceGuidanceService.speak(text);
  }, []);

  // Stop speaking
  const stop = useCallback(async () => {
    await voiceGuidanceService.stop();
  }, []);

  return {
    isEnabled,
    isSpeaking,
    isAvailable,
    autoEnableWithHeadphones,
    hasHeadphones: audioOutput.isBluetoothConnected || audioOutput.isHeadphonesConnected,
    setEnabled,
    setAutoEnableWithHeadphones,
    speakManeuver,
    speakArrival,
    speakReturningToHotel,
    speak,
    stop,
  };
}

export default useVoiceGuidance;
