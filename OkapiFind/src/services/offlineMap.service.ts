/**
 * Offline Map Service
 * CRITICAL: Enables map functionality in parking garages with no signal
 * Target: 80%+ of users download their city for offline use
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { MAPBOX_CONFIG } from '../config/mapbox';
import { analytics } from './analytics';

export interface OfflineRegion {
  id: string;
  name: string;
  bounds: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  minZoom: number;
  maxZoom: number;
  downloadProgress: number;
  downloadComplete: boolean;
  estimatedSize: number; // MB
  actualSize?: number; // MB
  downloadedAt?: string;
  lastAccessed?: string;
}

export interface DownloadProgress {
  regionId: string;
  regionName: string;
  progress: number; // 0-100
  completedResourceCount: number;
  completedResourceSize: number; // bytes
  requiredResourceCount: number;
  status: 'downloading' | 'complete' | 'error' | 'paused';
  error?: string;
}

class OfflineMapService {
  private readonly STORAGE_KEY = 'offline_maps';
  private regions: Map<string, OfflineRegion> = new Map();
  private downloadListeners: Map<string, ((progress: DownloadProgress) => void)[]> = new Map();

  /**
   * Initialize offline map service
   */
  async initialize(): Promise<void> {
    try {
      await this.loadRegions();
      console.log('Offline map service initialized');

      analytics.logEvent('offline_maps_initialized', {
        total_regions: this.regions.size,
        platform: Platform.OS,
      });
    } catch (error) {
      console.error('Error initializing offline map service:', error);
    }
  }

  /**
   * Get all downloaded regions
   */
  async getDownloadedRegions(): Promise<OfflineRegion[]> {
    await this.loadRegions();
    return Array.from(this.regions.values()).filter(r => r.downloadComplete);
  }

  /**
   * Get total storage used by offline maps
   */
  async getStorageUsed(): Promise<number> {
    const regions = await this.getDownloadedRegions();
    return regions.reduce((total, region) => total + (region.actualSize || 0), 0);
  }

  /**
   * Check if storage limit would be exceeded
   */
  async canDownloadRegion(estimatedSize: number): Promise<boolean> {
    const currentUsage = await this.getStorageUsed();
    const maxStorage = MAPBOX_CONFIG.offline.maxTotalStorage;
    return (currentUsage + estimatedSize) <= maxStorage;
  }

  /**
   * Download offline region
   */
  async downloadRegion(
    name: string,
    bounds: [number, number, number, number],
    options: {
      minZoom?: number;
      maxZoom?: number;
      onProgress?: (progress: DownloadProgress) => void;
    } = {}
  ): Promise<OfflineRegion> {
    try {
      const regionId = this.generateRegionId(name, bounds);

      // Check if already downloaded
      const existing = this.regions.get(regionId);
      if (existing?.downloadComplete) {
        console.log('Region already downloaded:', name);
        return existing;
      }

      // Estimate size
      const estimatedSize = this.estimateRegionSize(
        bounds,
        options.minZoom || MAPBOX_CONFIG.offline.minZoom,
        options.maxZoom || MAPBOX_CONFIG.offline.maxZoom
      );

      // Check storage
      const canDownload = await this.canDownloadRegion(estimatedSize);
      if (!canDownload) {
        throw new Error('Insufficient storage for offline map. Please delete old regions.');
      }

      // Create region
      const region: OfflineRegion = {
        id: regionId,
        name,
        bounds,
        minZoom: options.minZoom || MAPBOX_CONFIG.offline.minZoom,
        maxZoom: options.maxZoom || MAPBOX_CONFIG.offline.maxZoom,
        downloadProgress: 0,
        downloadComplete: false,
        estimatedSize,
      };

      this.regions.set(regionId, region);
      await this.saveRegions();

      // Register progress listener
      if (options.onProgress) {
        this.addDownloadListener(regionId, options.onProgress);
      }

      // Start download (platform-specific)
      await this.startDownload(region);

      analytics.logEvent('offline_map_download_started', {
        region_name: name,
        estimated_size: estimatedSize,
      });

      return region;
    } catch (error) {
      console.error('Error downloading region:', error);

      analytics.logEvent('offline_map_download_error', {
        region_name: name,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Download current city based on user location
   */
  async downloadCurrentCity(
    latitude: number,
    longitude: number,
    cityName?: string
  ): Promise<OfflineRegion> {
    // Calculate bounds (approximately 20km radius around location)
    const latOffset = 0.18; // ~20km
    const lngOffset = 0.18;

    const bounds: [number, number, number, number] = [
      longitude - lngOffset, // minLng
      latitude - latOffset,  // minLat
      longitude + lngOffset, // maxLng
      latitude + latOffset,  // maxLat
    ];

    const name = cityName || `Area around ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;

    return await this.downloadRegion(name, bounds);
  }

  /**
   * Delete offline region
   */
  async deleteRegion(regionId: string): Promise<void> {
    try {
      const region = this.regions.get(regionId);
      if (!region) {
        throw new Error('Region not found');
      }

      // Delete from native offline pack
      // This would call native Mapbox module
      // await Mapbox.offlineManager.deletePack(regionId);

      this.regions.delete(regionId);
      await this.saveRegions();

      analytics.logEvent('offline_map_deleted', {
        region_name: region.name,
        size: region.actualSize || 0,
      });

      console.log('Deleted offline region:', region.name);
    } catch (error) {
      console.error('Error deleting region:', error);
      throw error;
    }
  }

  /**
   * Pause download
   */
  async pauseDownload(regionId: string): Promise<void> {
    try {
      // This would call native Mapbox module
      // await Mapbox.offlineManager.pauseDownload(regionId);

      const region = this.regions.get(regionId);
      if (region) {
        this.notifyListeners(regionId, {
          regionId,
          regionName: region.name,
          progress: region.downloadProgress,
          completedResourceCount: 0,
          completedResourceSize: 0,
          requiredResourceCount: 0,
          status: 'paused',
        });
      }

      analytics.logEvent('offline_map_download_paused', {
        region_id: regionId,
      });
    } catch (error) {
      console.error('Error pausing download:', error);
      throw error;
    }
  }

  /**
   * Resume download
   */
  async resumeDownload(regionId: string): Promise<void> {
    try {
      const region = this.regions.get(regionId);
      if (!region) {
        throw new Error('Region not found');
      }

      await this.startDownload(region);

      analytics.logEvent('offline_map_download_resumed', {
        region_id: regionId,
      });
    } catch (error) {
      console.error('Error resuming download:', error);
      throw error;
    }
  }

  /**
   * Check if coordinates are covered by offline maps
   */
  async isLocationCovered(latitude: number, longitude: number): Promise<boolean> {
    const regions = await this.getDownloadedRegions();

    return regions.some(region => {
      const [minLng, minLat, maxLng, maxLat] = region.bounds;
      return (
        longitude >= minLng &&
        longitude <= maxLng &&
        latitude >= minLat &&
        latitude <= maxLat
      );
    });
  }

  /**
   * Get recommended download regions based on user's saved parking locations
   */
  async getRecommendedRegions(
    parkingLocations: Array<{ latitude: number; longitude: number }>
  ): Promise<Array<{ name: string; bounds: [number, number, number, number]; priority: number }>> {
    // Group locations by proximity
    const clusters = this.clusterLocations(parkingLocations);

    return clusters.map(cluster => {
      const center = this.calculateClusterCenter(cluster);
      const latOffset = 0.09; // ~10km
      const lngOffset = 0.09;

      return {
        name: `Frequent parking area ${center.lat.toFixed(3)}, ${center.lng.toFixed(3)}`,
        bounds: [
          center.lng - lngOffset,
          center.lat - latOffset,
          center.lng + lngOffset,
          center.lat + latOffset,
        ] as [number, number, number, number],
        priority: cluster.length, // More locations = higher priority
      };
    }).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Start download (platform-specific)
   */
  private async startDownload(region: OfflineRegion): Promise<void> {
    // This is a simplified version - actual implementation would use native Mapbox module
    // For React Native Mapbox GL, you would use:
    // await Mapbox.offlineManager.createPack({
    //   name: region.id,
    //   styleURL: MAPBOX_CONFIG.defaultStyle,
    //   bounds: region.bounds,
    //   minZoom: region.minZoom,
    //   maxZoom: region.maxZoom,
    // }, (progressEvent) => {
    //   this.handleDownloadProgress(region.id, progressEvent);
    // });

    // Simulate download for now
    if (__DEV__) {
      this.simulateDownload(region);
    }
  }

  /**
   * Simulate download (for testing)
   */
  private simulateDownload(region: OfflineRegion): void {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;

      const progressData: DownloadProgress = {
        regionId: region.id,
        regionName: region.name,
        progress,
        completedResourceCount: Math.floor((progress / 100) * 1000),
        completedResourceSize: Math.floor((progress / 100) * region.estimatedSize * 1024 * 1024),
        requiredResourceCount: 1000,
        status: progress < 100 ? 'downloading' : 'complete',
      };

      this.handleDownloadProgress(region.id, progressData);

      if (progress >= 100) {
        clearInterval(interval);
      }
    }, 500);
  }

  /**
   * Handle download progress updates
   */
  private async handleDownloadProgress(
    regionId: string,
    progress: DownloadProgress
  ): Promise<void> {
    const region = this.regions.get(regionId);
    if (!region) return;

    region.downloadProgress = progress.progress;

    if (progress.status === 'complete') {
      region.downloadComplete = true;
      region.actualSize = progress.completedResourceSize / (1024 * 1024); // Convert to MB
      region.downloadedAt = new Date().toISOString();

      analytics.logEvent('offline_map_download_completed', {
        region_name: region.name,
        actual_size: region.actualSize,
        estimated_size: region.estimatedSize,
      });
    }

    await this.saveRegions();
    this.notifyListeners(regionId, progress);
  }

  /**
   * Add download progress listener
   */
  private addDownloadListener(
    regionId: string,
    callback: (progress: DownloadProgress) => void
  ): void {
    const listeners = this.downloadListeners.get(regionId) || [];
    listeners.push(callback);
    this.downloadListeners.set(regionId, listeners);
  }

  /**
   * Notify download listeners
   */
  private notifyListeners(regionId: string, progress: DownloadProgress): void {
    const listeners = this.downloadListeners.get(regionId) || [];
    listeners.forEach(callback => callback(progress));
  }

  /**
   * Estimate region size in MB
   */
  private estimateRegionSize(
    bounds: [number, number, number, number],
    minZoom: number,
    maxZoom: number
  ): number {
    const [minLng, minLat, maxLng, maxLat] = bounds;

    // Calculate area
    const area = (maxLng - minLng) * (maxLat - minLat);

    // Estimate tiles per zoom level
    const zoomLevels = maxZoom - minZoom + 1;
    const avgTilesPerZoom = area * 100; // Rough estimate

    // Average tile size: 50KB
    const avgTileSize = 0.05; // MB

    return avgTilesPerZoom * zoomLevels * avgTileSize;
  }

  /**
   * Generate unique region ID
   */
  private generateRegionId(name: string, bounds: [number, number, number, number]): string {
    return `${name.replace(/\s+/g, '_')}_${bounds.join('_')}`;
  }

  /**
   * Cluster locations by proximity
   */
  private clusterLocations(
    locations: Array<{ latitude: number; longitude: number }>,
    maxDistance: number = 0.1 // ~10km
  ): Array<Array<{ latitude: number; longitude: number }>> {
    const clusters: Array<Array<{ latitude: number; longitude: number }>> = [];
    const used = new Set<number>();

    locations.forEach((location, i) => {
      if (used.has(i)) return;

      const cluster = [location];
      used.add(i);

      locations.forEach((other, j) => {
        if (i === j || used.has(j)) return;

        const distance = Math.sqrt(
          Math.pow(location.latitude - other.latitude, 2) +
          Math.pow(location.longitude - other.longitude, 2)
        );

        if (distance < maxDistance) {
          cluster.push(other);
          used.add(j);
        }
      });

      clusters.push(cluster);
    });

    return clusters;
  }

  /**
   * Calculate cluster center
   */
  private calculateClusterCenter(
    cluster: Array<{ latitude: number; longitude: number }>
  ): { lat: number; lng: number } {
    const sum = cluster.reduce(
      (acc, loc) => ({
        lat: acc.lat + loc.latitude,
        lng: acc.lng + loc.longitude,
      }),
      { lat: 0, lng: 0 }
    );

    return {
      lat: sum.lat / cluster.length,
      lng: sum.lng / cluster.length,
    };
  }

  /**
   * Load regions from storage
   */
  private async loadRegions(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const regions: OfflineRegion[] = JSON.parse(data);
        regions.forEach(region => {
          this.regions.set(region.id, region);
        });
      }
    } catch (error) {
      console.error('Error loading offline regions:', error);
    }
  }

  /**
   * Save regions to storage
   */
  private async saveRegions(): Promise<void> {
    try {
      const regions = Array.from(this.regions.values());
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(regions));
    } catch (error) {
      console.error('Error saving offline regions:', error);
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    used: number;
    available: number;
    total: number;
    regions: number;
  }> {
    const used = await this.getStorageUsed();
    const total = MAPBOX_CONFIG.offline.maxTotalStorage;
    const available = total - used;
    const regions = (await this.getDownloadedRegions()).length;

    return { used, available, total, regions };
  }

  /**
   * Clean up old offline maps
   */
  async cleanupOldMaps(olderThanDays: number = 90): Promise<number> {
    try {
      const regions = await this.getDownloadedRegions();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      let deletedCount = 0;

      for (const region of regions) {
        const lastAccessed = region.lastAccessed || region.downloadedAt;
        if (lastAccessed && new Date(lastAccessed) < cutoffDate) {
          await this.deleteRegion(region.id);
          deletedCount++;
        }
      }

      analytics.logEvent('offline_maps_cleanup', {
        deleted_count: deletedCount,
        older_than_days: olderThanDays,
      });

      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old maps:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const offlineMapService = new OfflineMapService();

export default offlineMapService;