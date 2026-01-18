// @ts-nocheck
/**
 * Parking History Service
 * Tracks and manages parking history with search capabilities
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase-client';

// Types
export interface ParkingHistoryEntry {
  id: string;
  latitude: number;
  longitude: number;
  address?: string;
  addressComponents?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  floorLevel?: number;
  parkingSpot?: string;
  notes?: string;
  photoUrls?: string[];
  parkedAt: string;
  leftAt?: string;
  duration?: number; // minutes
  cost?: number;
  meterExpiry?: string;
  wasTimerUsed?: boolean;
  tags?: string[]; // e.g., ['mall', 'work', 'airport']
  isFavorite?: boolean;
}

export interface SearchFilters {
  query?: string;
  startDate?: Date;
  endDate?: Date;
  minDuration?: number;
  maxDuration?: number;
  tags?: string[];
  favoritesOnly?: boolean;
  hasPhotos?: boolean;
}

export interface ParkingStats {
  totalParks: number;
  totalDuration: number; // minutes
  averageDuration: number;
  totalCost: number;
  mostVisitedLocations: { address: string; count: number }[];
  parkingByDayOfWeek: { day: string; count: number }[];
  parkingByHour: { hour: number; count: number }[];
}

// Constants
const STORAGE_KEY = '@okapifind/parking_history';
const MAX_LOCAL_ENTRIES = 500;

class ParkingHistoryService {
  private static instance: ParkingHistoryService;
  private cache: ParkingHistoryEntry[] = [];
  private isInitialized = false;

  private constructor() {}

  static getInstance(): ParkingHistoryService {
    if (!ParkingHistoryService.instance) {
      ParkingHistoryService.instance = new ParkingHistoryService();
    }
    return ParkingHistoryService.instance;
  }

  /**
   * Initialize the service and load history
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.loadFromStorage();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize parking history:', error);
    }
  }

  /**
   * Add a new parking entry
   */
  async addEntry(entry: Omit<ParkingHistoryEntry, 'id'>): Promise<ParkingHistoryEntry> {
    await this.initialize();

    const newEntry: ParkingHistoryEntry = {
      ...entry,
      id: this.generateId(),
    };

    // Add to beginning of cache (most recent first)
    this.cache.unshift(newEntry);

    // Trim to max entries
    if (this.cache.length > MAX_LOCAL_ENTRIES) {
      this.cache = this.cache.slice(0, MAX_LOCAL_ENTRIES);
    }

    // Save
    await this.saveToStorage();
    await this.syncToSupabase(newEntry);

    return newEntry;
  }

  /**
   * Update an existing entry (e.g., when leaving parking spot)
   */
  async updateEntry(
    id: string,
    updates: Partial<ParkingHistoryEntry>
  ): Promise<ParkingHistoryEntry | null> {
    await this.initialize();

    const index = this.cache.findIndex((e) => e.id === id);
    if (index === -1) return null;

    // Calculate duration if leaving
    if (updates.leftAt && !this.cache[index].leftAt) {
      const parkedAt = new Date(this.cache[index].parkedAt);
      const leftAt = new Date(updates.leftAt);
      updates.duration = Math.round((leftAt.getTime() - parkedAt.getTime()) / 60000);
    }

    this.cache[index] = { ...this.cache[index], ...updates };

    await this.saveToStorage();
    await this.syncToSupabase(this.cache[index]);

    return this.cache[index];
  }

  /**
   * Get recent parking history
   */
  async getRecent(limit: number = 20): Promise<ParkingHistoryEntry[]> {
    await this.initialize();
    return this.cache.slice(0, limit);
  }

  /**
   * Search parking history
   */
  async search(filters: SearchFilters): Promise<ParkingHistoryEntry[]> {
    await this.initialize();

    let results = [...this.cache];

    // Text search
    if (filters.query) {
      const query = filters.query.toLowerCase();
      results = results.filter((entry) => {
        const searchableText = [
          entry.address,
          entry.addressComponents?.street,
          entry.addressComponents?.city,
          entry.notes,
          entry.parkingSpot,
          ...(entry.tags || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText.includes(query);
      });
    }

    // Date range
    if (filters.startDate) {
      const start = filters.startDate.getTime();
      results = results.filter((e) => new Date(e.parkedAt).getTime() >= start);
    }

    if (filters.endDate) {
      const end = filters.endDate.getTime();
      results = results.filter((e) => new Date(e.parkedAt).getTime() <= end);
    }

    // Duration filters
    if (filters.minDuration !== undefined) {
      results = results.filter((e) => (e.duration || 0) >= filters.minDuration!);
    }

    if (filters.maxDuration !== undefined) {
      results = results.filter((e) => (e.duration || 0) <= filters.maxDuration!);
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter((e) =>
        filters.tags!.some((tag) => e.tags?.includes(tag))
      );
    }

    // Favorites only
    if (filters.favoritesOnly) {
      results = results.filter((e) => e.isFavorite);
    }

    // Has photos
    if (filters.hasPhotos) {
      results = results.filter((e) => e.photoUrls && e.photoUrls.length > 0);
    }

    return results;
  }

  /**
   * Get parking history by date
   */
  async getByDate(date: Date): Promise<ParkingHistoryEntry[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.search({
      startDate: startOfDay,
      endDate: endOfDay,
    });
  }

  /**
   * Get parking history by location (nearby)
   */
  async getNearby(
    latitude: number,
    longitude: number,
    radiusKm: number = 0.5
  ): Promise<ParkingHistoryEntry[]> {
    await this.initialize();

    return this.cache.filter((entry) => {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        entry.latitude,
        entry.longitude
      );
      return distance <= radiusKm;
    });
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(id: string): Promise<boolean> {
    const entry = this.cache.find((e) => e.id === id);
    if (!entry) return false;

    const newStatus = !entry.isFavorite;
    await this.updateEntry(id, { isFavorite: newStatus });

    return newStatus;
  }

  /**
   * Add tags to an entry
   */
  async addTags(id: string, tags: string[]): Promise<void> {
    const entry = this.cache.find((e) => e.id === id);
    if (!entry) return;

    const existingTags = entry.tags || [];
    const uniqueTags = [...new Set([...existingTags, ...tags])];

    await this.updateEntry(id, { tags: uniqueTags });
  }

  /**
   * Get parking statistics
   */
  async getStats(): Promise<ParkingStats> {
    await this.initialize();

    const entries = this.cache;

    // Total parks
    const totalParks = entries.length;

    // Duration stats
    const entriesWithDuration = entries.filter((e) => e.duration);
    const totalDuration = entriesWithDuration.reduce(
      (sum, e) => sum + (e.duration || 0),
      0
    );
    const averageDuration =
      entriesWithDuration.length > 0
        ? Math.round(totalDuration / entriesWithDuration.length)
        : 0;

    // Cost stats
    const totalCost = entries
      .filter((e) => e.cost)
      .reduce((sum, e) => sum + (e.cost || 0), 0);

    // Most visited locations
    const locationCounts = new Map<string, number>();
    entries.forEach((entry) => {
      if (entry.address) {
        const count = locationCounts.get(entry.address) || 0;
        locationCounts.set(entry.address, count + 1);
      }
    });

    const mostVisitedLocations = Array.from(locationCounts.entries())
      .map(([address, count]) => ({ address, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Parking by day of week
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayCounts = new Array(7).fill(0);
    entries.forEach((entry) => {
      const day = new Date(entry.parkedAt).getDay();
      dayCounts[day]++;
    });

    const parkingByDayOfWeek = dayNames.map((day, index) => ({
      day,
      count: dayCounts[index],
    }));

    // Parking by hour
    const hourCounts = new Array(24).fill(0);
    entries.forEach((entry) => {
      const hour = new Date(entry.parkedAt).getHours();
      hourCounts[hour]++;
    });

    const parkingByHour = hourCounts.map((count, hour) => ({ hour, count }));

    return {
      totalParks,
      totalDuration,
      averageDuration,
      totalCost,
      mostVisitedLocations,
      parkingByDayOfWeek,
      parkingByHour,
    };
  }

  /**
   * Delete an entry
   */
  async deleteEntry(id: string): Promise<void> {
    await this.initialize();

    this.cache = this.cache.filter((e) => e.id !== id);
    await this.saveToStorage();

    // Delete from Supabase
    try {
      await supabase.from('parking_history').delete().eq('id', id);
    } catch {
      // Ignore Supabase errors
    }
  }

  /**
   * Clear all history
   */
  async clearAll(): Promise<void> {
    this.cache = [];
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Export history as JSON
   */
  async exportHistory(): Promise<string> {
    await this.initialize();
    return JSON.stringify(this.cache, null, 2);
  }

  // Private helper methods

  private generateId(): string {
    return `park_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.cache = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load parking history:', error);
      this.cache = [];
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
    } catch (error) {
      console.error('Failed to save parking history:', error);
    }
  }

  private async syncToSupabase(entry: ParkingHistoryEntry): Promise<void> {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;

      await supabase.from('parking_history').upsert({
        id: entry.id,
        user_id: session.session.user.id,
        latitude: entry.latitude,
        longitude: entry.longitude,
        address: entry.address,
        address_components: entry.addressComponents,
        floor_level: entry.floorLevel,
        parking_spot: entry.parkingSpot,
        notes: entry.notes,
        photo_urls: entry.photoUrls,
        parked_at: entry.parkedAt,
        left_at: entry.leftAt,
        duration: entry.duration,
        cost: entry.cost,
        meter_expiry: entry.meterExpiry,
        was_timer_used: entry.wasTimerUsed,
        tags: entry.tags,
        is_favorite: entry.isFavorite,
      });
    } catch {
      // Silently fail - local storage is the primary
    }
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const parkingHistoryService = ParkingHistoryService.getInstance();
export default parkingHistoryService;
