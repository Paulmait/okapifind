/**
 * Smart POI Service
 * Intelligent Point of Interest Management
 *
 * KEY FEATURE FOR INVESTORS:
 * - Automatically learns user's frequent locations (home, work, gym, etc.)
 * - Suppresses unnecessary "find your car" prompts at familiar locations
 * - Provides seamless, non-intrusive user experience
 * - Increases retention by reducing notification fatigue
 *
 * This differentiates OkapiFind from simple parking apps by understanding
 * user context and behavior patterns.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { calculateDistance } from '../utils/calculateDistance';

// Storage keys
const STORAGE_KEYS = {
  SAVED_POIS: '@OkapiFind:savedPOIs',
  AUTO_LEARNED_POIS: '@OkapiFind:autoLearnedPOIs',
  POI_SETTINGS: '@OkapiFind:poiSettings',
  VISIT_HISTORY: '@OkapiFind:poiVisitHistory',
};

// POI Types with investor-friendly naming
export type POIType =
  | 'home'           // Primary residence
  | 'work'           // Workplace
  | 'second_home'    // Vacation home, parents' house
  | 'gym'            // Fitness center
  | 'school'         // School, daycare
  | 'shopping'       // Regular shopping locations
  | 'restaurant'     // Frequent dining spots
  | 'friend_family'  // Friends/family homes
  | 'parking_lot'    // Dedicated parking (monthly parking)
  | 'transit_hub'    // Train station, bus stop
  | 'custom';        // User-defined

export interface SavedPOI {
  id: string;
  name: string;
  type: POIType;
  location: {
    latitude: number;
    longitude: number;
  };
  address?: string;
  radius: number; // meters - how far from center to trigger
  suppressNavigation: boolean; // Don't show "find car" prompts here
  suppressAutoDetection: boolean; // Don't auto-save parking here
  icon?: string; // Custom icon for the POI
  color?: string; // Custom color for map marker
  createdAt: Date;
  updatedAt: Date;
  isAutoLearned: boolean;
  visitCount: number;
  lastVisit?: Date;
  averageStayDuration?: number; // minutes
  typicalArrivalTimes?: string[]; // e.g., ["08:00", "18:00"]
  typicalDepartureTimes?: string[]; // e.g., ["09:00", "19:00"]
  notes?: string;
}

export interface POIVisit {
  poiId: string;
  arrivalTime: Date;
  departureTime?: Date;
  duration?: number; // minutes
}

export interface POISettings {
  autoLearnEnabled: boolean;
  minVisitsToLearn: number; // visits before suggesting as POI
  homeDetectionEnabled: boolean;
  workDetectionEnabled: boolean;
  suppressionEnabled: boolean;
  learningRadius: number; // meters
  maxAutoPOIs: number; // prevent too many auto POIs
}

export interface POICheckResult {
  isAtKnownPOI: boolean;
  poi?: SavedPOI;
  shouldSuppressNavigation: boolean;
  shouldSuppressAutoDetection: boolean;
  distance?: number;
  message?: string;
}

class SmartPOIService {
  private static instance: SmartPOIService;
  private savedPOIs: SavedPOI[] = [];
  private autoLearnedPOIs: SavedPOI[] = [];
  private visitHistory: POIVisit[] = [];
  private settings: POISettings = {
    autoLearnEnabled: true,
    minVisitsToLearn: 3, // After 3 visits, suggest as POI
    homeDetectionEnabled: true,
    workDetectionEnabled: true,
    suppressionEnabled: true,
    learningRadius: 100, // meters
    maxAutoPOIs: 10,
  };
  private currentPOI: SavedPOI | null = null;
  private arrivalTime: Date | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): SmartPOIService {
    if (!SmartPOIService.instance) {
      SmartPOIService.instance = new SmartPOIService();
    }
    return SmartPOIService.instance;
  }

  /**
   * Initialize the POI service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await Promise.all([
      this.loadSavedPOIs(),
      this.loadAutoLearnedPOIs(),
      this.loadSettings(),
      this.loadVisitHistory(),
    ]);

    this.isInitialized = true;
  }

  // ============================================
  // CORE POI MANAGEMENT
  // ============================================

  /**
   * Save a new POI (user-created)
   */
  public async savePOI(poi: Omit<SavedPOI, 'id' | 'createdAt' | 'updatedAt' | 'visitCount' | 'isAutoLearned'>): Promise<SavedPOI> {
    const newPOI: SavedPOI = {
      ...poi,
      id: `poi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      visitCount: 0,
      isAutoLearned: false,
    };

    this.savedPOIs.push(newPOI);
    await this.persistSavedPOIs();

    return newPOI;
  }

  /**
   * Update an existing POI
   */
  public async updatePOI(id: string, updates: Partial<SavedPOI>): Promise<SavedPOI | null> {
    const index = this.savedPOIs.findIndex(p => p.id === id);
    if (index === -1) {
      // Check auto-learned POIs
      const autoIndex = this.autoLearnedPOIs.findIndex(p => p.id === id);
      if (autoIndex !== -1) {
        this.autoLearnedPOIs[autoIndex] = {
          ...this.autoLearnedPOIs[autoIndex],
          ...updates,
          updatedAt: new Date(),
        };
        await this.persistAutoLearnedPOIs();
        return this.autoLearnedPOIs[autoIndex];
      }
      return null;
    }

    this.savedPOIs[index] = {
      ...this.savedPOIs[index],
      ...updates,
      updatedAt: new Date(),
    };

    await this.persistSavedPOIs();
    return this.savedPOIs[index];
  }

  /**
   * Delete a POI
   */
  public async deletePOI(id: string): Promise<boolean> {
    const savedIndex = this.savedPOIs.findIndex(p => p.id === id);
    if (savedIndex !== -1) {
      this.savedPOIs.splice(savedIndex, 1);
      await this.persistSavedPOIs();
      return true;
    }

    const autoIndex = this.autoLearnedPOIs.findIndex(p => p.id === id);
    if (autoIndex !== -1) {
      this.autoLearnedPOIs.splice(autoIndex, 1);
      await this.persistAutoLearnedPOIs();
      return true;
    }

    return false;
  }

  /**
   * Get all POIs (saved + auto-learned)
   */
  public getAllPOIs(): SavedPOI[] {
    return [...this.savedPOIs, ...this.autoLearnedPOIs];
  }

  /**
   * Get POIs by type
   */
  public getPOIsByType(type: POIType): SavedPOI[] {
    return this.getAllPOIs().filter(p => p.type === type);
  }

  // ============================================
  // SMART LOCATION CHECKING
  // ============================================

  /**
   * Check if user is at a known POI
   * This is the CORE function for suppressing unnecessary prompts
   */
  public async checkLocation(
    latitude: number,
    longitude: number
  ): Promise<POICheckResult> {
    const allPOIs = this.getAllPOIs();

    for (const poi of allPOIs) {
      const distance = calculateDistance(
        poi.location.latitude,
        poi.location.longitude,
        latitude,
        longitude
      );

      if (distance <= poi.radius) {
        // User is at this POI
        await this.recordPOIVisit(poi);

        return {
          isAtKnownPOI: true,
          poi,
          shouldSuppressNavigation: poi.suppressNavigation && this.settings.suppressionEnabled,
          shouldSuppressAutoDetection: poi.suppressAutoDetection,
          distance,
          message: this.getSuppressionMessage(poi),
        };
      }
    }

    // Not at any known POI - potentially learn new location
    if (this.settings.autoLearnEnabled) {
      await this.learnLocation(latitude, longitude);
    }

    return {
      isAtKnownPOI: false,
      shouldSuppressNavigation: false,
      shouldSuppressAutoDetection: false,
    };
  }

  /**
   * Get appropriate message for suppressed location
   */
  private getSuppressionMessage(poi: SavedPOI): string {
    switch (poi.type) {
      case 'home':
        return "You're home - no parking reminder needed.";
      case 'work':
        return "You're at work - parking reminder suppressed.";
      case 'gym':
        return "You're at the gym - enjoy your workout!";
      case 'school':
        return "You're at school - have a great day!";
      case 'friend_family':
        return `You're at ${poi.name} - enjoy your visit!`;
      case 'parking_lot':
        return `You're at your regular parking spot at ${poi.name}.`;
      default:
        return `You're at ${poi.name} - parking reminder suppressed.`;
    }
  }

  /**
   * Record a visit to a POI
   */
  private async recordPOIVisit(poi: SavedPOI): Promise<void> {
    // Update visit count and last visit
    await this.updatePOI(poi.id, {
      visitCount: poi.visitCount + 1,
      lastVisit: new Date(),
    });

    // Track arrival if not already at this POI
    if (this.currentPOI?.id !== poi.id) {
      // Record departure from previous POI if applicable
      if (this.currentPOI && this.arrivalTime) {
        const visit: POIVisit = {
          poiId: this.currentPOI.id,
          arrivalTime: this.arrivalTime,
          departureTime: new Date(),
          duration: (Date.now() - this.arrivalTime.getTime()) / 60000, // minutes
        };
        this.visitHistory.push(visit);
        await this.persistVisitHistory();

        // Update average stay duration
        await this.updateAverageStayDuration(this.currentPOI.id);
      }

      this.currentPOI = poi;
      this.arrivalTime = new Date();
    }
  }

  /**
   * Update average stay duration for a POI
   */
  private async updateAverageStayDuration(poiId: string): Promise<void> {
    const visits = this.visitHistory.filter(v => v.poiId === poiId && v.duration);
    if (visits.length === 0) return;

    const totalDuration = visits.reduce((sum, v) => sum + (v.duration || 0), 0);
    const avgDuration = totalDuration / visits.length;

    await this.updatePOI(poiId, { averageStayDuration: avgDuration });
  }

  // ============================================
  // AUTO-LEARNING
  // ============================================

  /**
   * Learn a new location from visit patterns
   */
  private async learnLocation(latitude: number, longitude: number): Promise<void> {
    if (this.autoLearnedPOIs.length >= this.settings.maxAutoPOIs) {
      return; // Don't learn more POIs
    }

    // Check if near any auto-learned POI
    for (const poi of this.autoLearnedPOIs) {
      const distance = calculateDistance(
        poi.location.latitude,
        poi.location.longitude,
        latitude,
        longitude
      );

      if (distance <= this.settings.learningRadius) {
        // Increment visit count for this location
        await this.updatePOI(poi.id, {
          visitCount: poi.visitCount + 1,
          lastVisit: new Date(),
        });

        // If threshold reached and not yet converted, suggest to user
        if (poi.visitCount >= this.settings.minVisitsToLearn && !poi.name) {
          // This could trigger a notification to the user
          this.suggestPOIToUser(poi);
        }
        return;
      }
    }

    // New location - start tracking
    const newPOI: SavedPOI = {
      id: `auto_poi_${Date.now()}`,
      name: '', // Will be filled in by user
      type: this.detectPOIType(latitude, longitude),
      location: { latitude, longitude },
      radius: 100,
      suppressNavigation: false, // User can enable later
      suppressAutoDetection: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      isAutoLearned: true,
      visitCount: 1,
      lastVisit: new Date(),
    };

    this.autoLearnedPOIs.push(newPOI);
    await this.persistAutoLearnedPOIs();
  }

  /**
   * Detect POI type based on visit patterns
   */
  private detectPOIType(latitude: number, longitude: number): POIType {
    const hour = new Date().getHours();
    const isWeekday = [1, 2, 3, 4, 5].includes(new Date().getDay());

    // Night visits (10pm - 6am) suggest home
    if (this.settings.homeDetectionEnabled && (hour >= 22 || hour < 6)) {
      return 'home';
    }

    // Weekday daytime (8am - 6pm) suggests work
    if (this.settings.workDetectionEnabled && isWeekday && hour >= 8 && hour <= 18) {
      return 'work';
    }

    return 'custom';
  }

  /**
   * Suggest a learned POI to the user
   * This could trigger a notification or in-app prompt
   */
  private suggestPOIToUser(poi: SavedPOI): void {
    // This would integrate with notification service
    console.log(`Suggesting POI to user: ${poi.id} (type: ${poi.type}, visits: ${poi.visitCount})`);

    // In production, this would:
    // 1. Show a non-intrusive notification
    // 2. Allow user to name the location
    // 3. Set suppression preferences
  }

  // ============================================
  // HOME & WORK QUICK SETUP
  // ============================================

  /**
   * Quick setup for home location
   */
  public async setHomeLocation(
    latitude: number,
    longitude: number,
    address?: string
  ): Promise<SavedPOI> {
    // Remove any existing home
    const existingHome = this.savedPOIs.find(p => p.type === 'home');
    if (existingHome) {
      await this.deletePOI(existingHome.id);
    }

    return this.savePOI({
      name: 'Home',
      type: 'home',
      location: { latitude, longitude },
      address,
      radius: 150, // Larger radius for home
      suppressNavigation: true, // Always suppress at home
      suppressAutoDetection: true, // Don't auto-detect parking at home
    });
  }

  /**
   * Quick setup for work location
   */
  public async setWorkLocation(
    latitude: number,
    longitude: number,
    address?: string
  ): Promise<SavedPOI> {
    // Remove any existing work
    const existingWork = this.savedPOIs.find(p => p.type === 'work');
    if (existingWork) {
      await this.deletePOI(existingWork.id);
    }

    return this.savePOI({
      name: 'Work',
      type: 'work',
      location: { latitude, longitude },
      address,
      radius: 200, // Larger radius for work (parking may be further)
      suppressNavigation: true, // Always suppress at work
      suppressAutoDetection: false, // May still want to save parking at work
    });
  }

  /**
   * Get home location if set
   */
  public getHomeLocation(): SavedPOI | undefined {
    return this.savedPOIs.find(p => p.type === 'home');
  }

  /**
   * Get work location if set
   */
  public getWorkLocation(): SavedPOI | undefined {
    return this.savedPOIs.find(p => p.type === 'work');
  }

  // ============================================
  // SETTINGS MANAGEMENT
  // ============================================

  /**
   * Update POI settings
   */
  public async updateSettings(updates: Partial<POISettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.persistSettings();
  }

  /**
   * Get current settings
   */
  public getSettings(): POISettings {
    return { ...this.settings };
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  private async loadSavedPOIs(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_POIS);
      if (data) {
        this.savedPOIs = JSON.parse(data).map((p: any) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
          lastVisit: p.lastVisit ? new Date(p.lastVisit) : undefined,
        }));
      }
    } catch (error) {
      console.error('Error loading saved POIs:', error);
    }
  }

  private async loadAutoLearnedPOIs(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.AUTO_LEARNED_POIS);
      if (data) {
        this.autoLearnedPOIs = JSON.parse(data).map((p: any) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
          lastVisit: p.lastVisit ? new Date(p.lastVisit) : undefined,
        }));
      }
    } catch (error) {
      console.error('Error loading auto-learned POIs:', error);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.POI_SETTINGS);
      if (data) {
        this.settings = { ...this.settings, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('Error loading POI settings:', error);
    }
  }

  private async loadVisitHistory(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.VISIT_HISTORY);
      if (data) {
        this.visitHistory = JSON.parse(data).map((v: any) => ({
          ...v,
          arrivalTime: new Date(v.arrivalTime),
          departureTime: v.departureTime ? new Date(v.departureTime) : undefined,
        }));

        // Keep only last 30 days
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        this.visitHistory = this.visitHistory.filter(
          v => v.arrivalTime.getTime() > thirtyDaysAgo
        );
      }
    } catch (error) {
      console.error('Error loading visit history:', error);
    }
  }

  private async persistSavedPOIs(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_POIS, JSON.stringify(this.savedPOIs));
    } catch (error) {
      console.error('Error saving POIs:', error);
    }
  }

  private async persistAutoLearnedPOIs(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTO_LEARNED_POIS, JSON.stringify(this.autoLearnedPOIs));
    } catch (error) {
      console.error('Error saving auto-learned POIs:', error);
    }
  }

  private async persistSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.POI_SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Error saving POI settings:', error);
    }
  }

  private async persistVisitHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.VISIT_HISTORY, JSON.stringify(this.visitHistory));
    } catch (error) {
      console.error('Error saving visit history:', error);
    }
  }

  // ============================================
  // ANALYTICS FOR INVESTORS
  // ============================================

  /**
   * Get analytics data for investor dashboard
   */
  public getAnalytics(): {
    totalPOIs: number;
    userCreatedPOIs: number;
    autoLearnedPOIs: number;
    homeSetup: boolean;
    workSetup: boolean;
    totalVisitsTracked: number;
    averageVisitsPerPOI: number;
    suppressedNotificationsEstimate: number;
  } {
    const totalVisits = this.savedPOIs.reduce((sum, p) => sum + p.visitCount, 0) +
      this.autoLearnedPOIs.reduce((sum, p) => sum + p.visitCount, 0);

    const totalPOIs = this.savedPOIs.length + this.autoLearnedPOIs.length;

    // Estimate how many unnecessary notifications we've suppressed
    const suppressedLocations = this.getAllPOIs().filter(p => p.suppressNavigation);
    const suppressedVisits = suppressedLocations.reduce((sum, p) => sum + p.visitCount, 0);

    return {
      totalPOIs,
      userCreatedPOIs: this.savedPOIs.length,
      autoLearnedPOIs: this.autoLearnedPOIs.length,
      homeSetup: !!this.getHomeLocation(),
      workSetup: !!this.getWorkLocation(),
      totalVisitsTracked: totalVisits,
      averageVisitsPerPOI: totalPOIs > 0 ? totalVisits / totalPOIs : 0,
      suppressedNotificationsEstimate: suppressedVisits,
    };
  }
}

// Export singleton instance
export const smartPOIService = SmartPOIService.getInstance();
export default smartPOIService;
