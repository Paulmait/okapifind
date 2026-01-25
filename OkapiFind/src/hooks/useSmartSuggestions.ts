/**
 * useSmartSuggestions Hook
 * Manages Smart Suggestions service lifecycle based on screen focus
 * and app state. Only active when enabled and map screen is focused.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { smartSuggestionsService, SmartSuggestionResult } from '../services/smartSuggestionsService';
import { useSavedPlacesStore } from '../stores/savedPlacesStore';

export interface UseSmartSuggestionsReturn {
  // State
  isEnabled: boolean;
  isMonitoring: boolean;
  currentSuggestion: SmartSuggestionResult | null;

  // Actions
  dismissSuggestion: () => void;
  dismissWithDontAskAgain: () => void;
  clearSuggestion: () => void;
}

export function useSmartSuggestions(): UseSmartSuggestionsReturn {
  const isFocused = useIsFocused();
  const appState = useRef(AppState.currentState);

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentSuggestion, setCurrentSuggestion] = useState<SmartSuggestionResult | null>(null);

  // Get enabled state from store
  const smartSuggestionsEnabled = useSavedPlacesStore(
    (state) => state.smartSuggestionsEnabled
  );
  const addDontAskAgainPlace = useSavedPlacesStore(
    (state) => state.addDontAskAgainPlace
  );

  // Sync service enabled state with store
  useEffect(() => {
    smartSuggestionsService.setEnabled(smartSuggestionsEnabled);
  }, [smartSuggestionsEnabled]);

  // Handle suggestion callback
  const handleSuggestion = useCallback((result: SmartSuggestionResult) => {
    if (result.shouldSuggest) {
      setCurrentSuggestion(result);
    }
  }, []);

  // Start/stop monitoring based on focus and app state
  useEffect(() => {
    const shouldMonitor = smartSuggestionsEnabled && isFocused && appState.current === 'active';

    if (shouldMonitor && !isMonitoring) {
      smartSuggestionsService.startMonitoring(handleSuggestion);
      setIsMonitoring(true);
    } else if (!shouldMonitor && isMonitoring) {
      smartSuggestionsService.stopMonitoring();
      setIsMonitoring(false);
    }

    return () => {
      if (isMonitoring) {
        smartSuggestionsService.stopMonitoring();
        setIsMonitoring(false);
      }
    };
  }, [smartSuggestionsEnabled, isFocused, isMonitoring, handleSuggestion]);

  // Listen to app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const wasActive = appState.current === 'active';
      const isActive = nextAppState === 'active';

      appState.current = nextAppState;

      // Stop monitoring when going to background
      if (wasActive && !isActive && isMonitoring) {
        smartSuggestionsService.stopMonitoring();
        setIsMonitoring(false);
      }

      // Resume monitoring when coming to foreground (if conditions met)
      if (!wasActive && isActive && smartSuggestionsEnabled && isFocused && !isMonitoring) {
        smartSuggestionsService.startMonitoring(handleSuggestion);
        setIsMonitoring(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [smartSuggestionsEnabled, isFocused, isMonitoring, handleSuggestion]);

  // Dismiss suggestion
  const dismissSuggestion = useCallback(() => {
    setCurrentSuggestion(null);
  }, []);

  // Dismiss with "don't ask again"
  const dismissWithDontAskAgain = useCallback(() => {
    if (currentSuggestion?.location) {
      const { lat, lng } = currentSuggestion.location;
      addDontAskAgainPlace(lat, lng);
      smartSuggestionsService.addDontAskAgain(lat, lng);
    }
    setCurrentSuggestion(null);
  }, [currentSuggestion, addDontAskAgainPlace]);

  // Clear suggestion without any action
  const clearSuggestion = useCallback(() => {
    setCurrentSuggestion(null);
  }, []);

  return {
    isEnabled: smartSuggestionsEnabled,
    isMonitoring,
    currentSuggestion,
    dismissSuggestion,
    dismissWithDontAskAgain,
    clearSuggestion,
  };
}

export default useSmartSuggestions;
