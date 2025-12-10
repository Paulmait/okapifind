/**
 * useSmartPOI Hook
 * React hook for integrating Smart POI features into components
 *
 * Features:
 * - Automatic initialization
 * - Real-time POI checking
 * - Easy home/work setup
 * - POI management
 */

import { useState, useEffect, useCallback } from 'react';
import { smartPOIService, SavedPOI, POIType, POICheckResult, POISettings } from '../services/smartPOIService';

interface UseSmartPOIReturn {
  // State
  isInitialized: boolean;
  isLoading: boolean;
  currentPOICheck: POICheckResult | null;
  allPOIs: SavedPOI[];
  home: SavedPOI | undefined;
  work: SavedPOI | undefined;
  settings: POISettings;
  analytics: ReturnType<typeof smartPOIService.getAnalytics>;

  // Actions
  checkLocation: (lat: number, lng: number) => Promise<POICheckResult>;
  setHome: (lat: number, lng: number, address?: string) => Promise<SavedPOI>;
  setWork: (lat: number, lng: number, address?: string) => Promise<SavedPOI>;
  addPOI: (poi: Omit<SavedPOI, 'id' | 'createdAt' | 'updatedAt' | 'visitCount' | 'isAutoLearned'>) => Promise<SavedPOI>;
  updatePOI: (id: string, updates: Partial<SavedPOI>) => Promise<SavedPOI | null>;
  deletePOI: (id: string) => Promise<boolean>;
  updateSettings: (updates: Partial<POISettings>) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSmartPOI(): UseSmartPOIReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPOICheck, setCurrentPOICheck] = useState<POICheckResult | null>(null);
  const [allPOIs, setAllPOIs] = useState<SavedPOI[]>([]);
  const [home, setHomeState] = useState<SavedPOI | undefined>(undefined);
  const [work, setWorkState] = useState<SavedPOI | undefined>(undefined);
  const [settings, setSettingsState] = useState<POISettings>(smartPOIService.getSettings());
  const [analytics, setAnalytics] = useState(smartPOIService.getAnalytics());

  // Initialize service
  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        await smartPOIService.initialize();
        await refreshData();
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize Smart POI:', error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  // Refresh all data from service
  const refreshData = async () => {
    setAllPOIs(smartPOIService.getAllPOIs());
    setHomeState(smartPOIService.getHomeLocation());
    setWorkState(smartPOIService.getWorkLocation());
    setSettingsState(smartPOIService.getSettings());
    setAnalytics(smartPOIService.getAnalytics());
  };

  // Check if at a known POI
  const checkLocation = useCallback(async (lat: number, lng: number): Promise<POICheckResult> => {
    const result = await smartPOIService.checkLocation(lat, lng);
    setCurrentPOICheck(result);
    await refreshData(); // Refresh to get updated visit counts
    return result;
  }, []);

  // Set home location
  const setHome = useCallback(async (lat: number, lng: number, address?: string): Promise<SavedPOI> => {
    const result = await smartPOIService.setHomeLocation(lat, lng, address);
    await refreshData();
    return result;
  }, []);

  // Set work location
  const setWork = useCallback(async (lat: number, lng: number, address?: string): Promise<SavedPOI> => {
    const result = await smartPOIService.setWorkLocation(lat, lng, address);
    await refreshData();
    return result;
  }, []);

  // Add a new POI
  const addPOI = useCallback(async (poi: Omit<SavedPOI, 'id' | 'createdAt' | 'updatedAt' | 'visitCount' | 'isAutoLearned'>): Promise<SavedPOI> => {
    const result = await smartPOIService.savePOI(poi);
    await refreshData();
    return result;
  }, []);

  // Update a POI
  const updatePOI = useCallback(async (id: string, updates: Partial<SavedPOI>): Promise<SavedPOI | null> => {
    const result = await smartPOIService.updatePOI(id, updates);
    await refreshData();
    return result;
  }, []);

  // Delete a POI
  const deletePOI = useCallback(async (id: string): Promise<boolean> => {
    const result = await smartPOIService.deletePOI(id);
    await refreshData();
    return result;
  }, []);

  // Update settings
  const updateSettings = useCallback(async (updates: Partial<POISettings>): Promise<void> => {
    await smartPOIService.updateSettings(updates);
    await refreshData();
  }, []);

  // Manual refresh
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await refreshData();
    setIsLoading(false);
  }, []);

  return {
    isInitialized,
    isLoading,
    currentPOICheck,
    allPOIs,
    home,
    work,
    settings,
    analytics,
    checkLocation,
    setHome,
    setWork,
    addPOI,
    updatePOI,
    deletePOI,
    updateSettings,
    refresh,
  };
}

/**
 * Hook for checking if current location is at a known POI
 * Useful for conditionally showing/hiding UI elements
 */
export function useIsAtKnownPOI(
  latitude: number | undefined,
  longitude: number | undefined
): {
  isAtKnownPOI: boolean;
  poiInfo: POICheckResult | null;
  isChecking: boolean;
} {
  const [isAtKnownPOI, setIsAtKnownPOI] = useState(false);
  const [poiInfo, setPOIInfo] = useState<POICheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (latitude === undefined || longitude === undefined) {
        setIsAtKnownPOI(false);
        setPOIInfo(null);
        return;
      }

      setIsChecking(true);
      try {
        await smartPOIService.initialize();
        const result = await smartPOIService.checkLocation(latitude, longitude);
        setIsAtKnownPOI(result.isAtKnownPOI);
        setPOIInfo(result);
      } catch (error) {
        console.error('Error checking POI:', error);
      } finally {
        setIsChecking(false);
      }
    };

    check();
  }, [latitude, longitude]);

  return { isAtKnownPOI, poiInfo, isChecking };
}

export default useSmartPOI;
