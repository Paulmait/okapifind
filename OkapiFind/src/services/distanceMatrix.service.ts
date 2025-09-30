/**
 * Distance Matrix Service
 * CRITICAL: Accurate ETAs with real-time traffic for multiple destinations
 * Helps users compare parking options and choose the fastest route
 */

import { analytics } from './analytics';

export interface DistanceMatrixRequest {
  origins: Array<{ latitude: number; longitude: number }>;
  destinations: Array<{ latitude: number; longitude: number }>;
  mode?: 'driving' | 'walking' | 'bicycling' | 'transit';
  avoid?: Array<'tolls' | 'highways' | 'ferries'>;
  departureTime?: Date;
  arrivalTime?: Date;
  trafficModel?: 'best_guess' | 'pessimistic' | 'optimistic';
}

export interface DistanceMatrixElement {
  distance: {
    text: string;
    value: number; // meters
  };
  duration: {
    text: string;
    value: number; // seconds
  };
  durationInTraffic?: {
    text: string;
    value: number; // seconds
  };
  status: 'OK' | 'NOT_FOUND' | 'ZERO_RESULTS';
  fare?: {
    currency: string;
    value: number;
    text: string;
  };
}

export interface DistanceMatrixRow {
  elements: DistanceMatrixElement[];
}

export interface DistanceMatrixResponse {
  originAddresses: string[];
  destinationAddresses: string[];
  rows: DistanceMatrixRow[];
}

export interface RouteComparison {
  destinationId: string;
  destinationName: string;
  location: { latitude: number; longitude: number };
  distance: number; // meters
  duration: number; // seconds
  durationInTraffic?: number; // seconds
  trafficDelay: number; // seconds
  estimatedArrival: Date;
  isFastest: boolean;
  isShortest: boolean;
  parkingAvailable?: boolean;
  parkingPrice?: number;
  recommendation: 'best' | 'good' | 'ok' | 'avoid';
}

class DistanceMatrixService {
  private readonly API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  private readonly BASE_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
  private readonly CACHE_TTL = 300000; // 5 minutes

  private cache: Map<string, { data: DistanceMatrixResponse; timestamp: number }> = new Map();

  /**
   * Get distance matrix for origins and destinations
   */
  async getDistanceMatrix(request: DistanceMatrixRequest): Promise<DistanceMatrixResponse | null> {
    try {
      if (!this.API_KEY) {
        throw new Error('Google Maps API key not configured');
      }

      // Check cache
      const cacheKey = this.generateCacheKey(request);
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Build request
      const params = new URLSearchParams({
        origins: request.origins.map(o => `${o.latitude},${o.longitude}`).join('|'),
        destinations: request.destinations.map(d => `${d.latitude},${d.longitude}`).join('|'),
        mode: request.mode || 'driving',
        key: this.API_KEY,
      });

      // Add traffic data if driving
      if (request.mode === 'driving' || !request.mode) {
        if (request.departureTime) {
          params.append('departure_time', Math.floor(request.departureTime.getTime() / 1000).toString());
        } else {
          params.append('departure_time', 'now');
        }

        if (request.trafficModel) {
          params.append('traffic_model', request.trafficModel);
        }
      }

      // Add arrival time for transit
      if (request.mode === 'transit' && request.arrivalTime) {
        params.append('arrival_time', Math.floor(request.arrivalTime.getTime() / 1000).toString());
      }

      // Add avoidances
      if (request.avoid && request.avoid.length > 0) {
        params.append('avoid', request.avoid.join('|'));
      }

      const response = await fetch(`${this.BASE_URL}?${params.toString()}`);
      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Distance Matrix API error: ${data.status}`);
      }

      const result: DistanceMatrixResponse = {
        originAddresses: data.origin_addresses,
        destinationAddresses: data.destination_addresses,
        rows: data.rows.map((row: any) => ({
          elements: row.elements.map((element: any) => ({
            distance: element.distance,
            duration: element.duration,
            durationInTraffic: element.duration_in_traffic,
            status: element.status,
            fare: element.fare,
          })),
        })),
      };

      // Cache result
      this.setCache(cacheKey, result);

      analytics.logEvent('distance_matrix_fetched', {
        origins_count: request.origins.length,
        destinations_count: request.destinations.length,
        mode: request.mode || 'driving',
      });

      return result;
    } catch (error) {
      console.error('Error fetching distance matrix:', error);
      analytics.logEvent('distance_matrix_error', {
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Compare multiple parking destinations
   */
  async compareParkingOptions(
    currentLocation: { latitude: number; longitude: number },
    parkingOptions: Array<{
      id: string;
      name: string;
      location: { latitude: number; longitude: number };
      available?: boolean;
      price?: number;
    }>,
    mode: 'driving' | 'walking' = 'driving'
  ): Promise<RouteComparison[]> {
    try {
      const result = await this.getDistanceMatrix({
        origins: [currentLocation],
        destinations: parkingOptions.map(o => o.location),
        mode,
        departureTime: new Date(),
        trafficModel: 'best_guess',
      });

      if (!result || result.rows.length === 0) {
        return [];
      }

      const comparisons: RouteComparison[] = parkingOptions.map((option, index) => {
        const element = result.rows[0].elements[index];

        if (element.status !== 'OK') {
          return {
            destinationId: option.id,
            destinationName: option.name,
            location: option.location,
            distance: 0,
            duration: 0,
            trafficDelay: 0,
            estimatedArrival: new Date(),
            isFastest: false,
            isShortest: false,
            parkingAvailable: option.available,
            parkingPrice: option.price,
            recommendation: 'avoid',
          };
        }

        const duration = element.duration.value;
        const durationInTraffic = element.durationInTraffic?.value || duration;
        const trafficDelay = durationInTraffic - duration;

        return {
          destinationId: option.id,
          destinationName: option.name,
          location: option.location,
          distance: element.distance.value,
          duration,
          durationInTraffic,
          trafficDelay,
          estimatedArrival: new Date(Date.now() + durationInTraffic * 1000),
          isFastest: false,
          isShortest: false,
          parkingAvailable: option.available,
          parkingPrice: option.price,
          recommendation: 'ok',
        };
      });

      // Mark fastest and shortest
      const validComparisons = comparisons.filter(c => c.duration > 0);
      if (validComparisons.length > 0) {
        const fastest = validComparisons.reduce((a, b) =>
          (a.durationInTraffic || a.duration) < (b.durationInTraffic || b.duration) ? a : b
        );
        fastest.isFastest = true;

        const shortest = validComparisons.reduce((a, b) =>
          a.distance < b.distance ? a : b
        );
        shortest.isShortest = true;

        // Calculate recommendations
        comparisons.forEach(c => {
          if (c.duration === 0) {
            c.recommendation = 'avoid';
          } else if (c.parkingAvailable === false) {
            c.recommendation = 'avoid';
          } else if (c.isFastest || c.isShortest) {
            c.recommendation = 'best';
          } else if (c.trafficDelay < 300) { // Less than 5 min delay
            c.recommendation = 'good';
          } else if (c.trafficDelay < 600) { // Less than 10 min delay
            c.recommendation = 'ok';
          } else {
            c.recommendation = 'avoid';
          }
        });
      }

      // Sort by duration with traffic
      comparisons.sort((a, b) => {
        const aDuration = a.durationInTraffic || a.duration;
        const bDuration = b.durationInTraffic || b.duration;
        return aDuration - bDuration;
      });

      analytics.logEvent('parking_options_compared', {
        option_count: parkingOptions.length,
        best_option_id: comparisons[0]?.destinationId,
      });

      return comparisons;
    } catch (error) {
      console.error('Error comparing parking options:', error);
      return [];
    }
  }

  /**
   * Get ETA to single destination
   */
  async getETA(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    mode: 'driving' | 'walking' | 'bicycling' = 'walking'
  ): Promise<{
    distance: number;
    duration: number;
    durationInTraffic?: number;
    estimatedArrival: Date;
  } | null> {
    try {
      const result = await this.getDistanceMatrix({
        origins: [origin],
        destinations: [destination],
        mode,
        departureTime: new Date(),
      });

      if (!result || result.rows.length === 0 || result.rows[0].elements.length === 0) {
        return null;
      }

      const element = result.rows[0].elements[0];

      if (element.status !== 'OK') {
        return null;
      }

      const duration = element.duration.value;
      const durationInTraffic = element.durationInTraffic?.value;

      return {
        distance: element.distance.value,
        duration,
        durationInTraffic,
        estimatedArrival: new Date(Date.now() + (durationInTraffic || duration) * 1000),
      };
    } catch (error) {
      console.error('Error getting ETA:', error);
      return null;
    }
  }

  /**
   * Get multiple ETAs efficiently
   */
  async getBatchETAs(
    origin: { latitude: number; longitude: number },
    destinations: Array<{ id: string; location: { latitude: number; longitude: number } }>,
    mode: 'driving' | 'walking' | 'bicycling' = 'walking'
  ): Promise<Map<string, {
    distance: number;
    duration: number;
    durationInTraffic?: number;
    estimatedArrival: Date;
  }>> {
    try {
      const result = await this.getDistanceMatrix({
        origins: [origin],
        destinations: destinations.map(d => d.location),
        mode,
        departureTime: new Date(),
      });

      const etas = new Map();

      if (!result || result.rows.length === 0) {
        return etas;
      }

      result.rows[0].elements.forEach((element, index) => {
        if (element.status === 'OK') {
          const duration = element.duration.value;
          const durationInTraffic = element.durationInTraffic?.value;

          etas.set(destinations[index].id, {
            distance: element.distance.value,
            duration,
            durationInTraffic,
            estimatedArrival: new Date(Date.now() + (durationInTraffic || duration) * 1000),
          });
        }
      });

      return etas;
    } catch (error) {
      console.error('Error getting batch ETAs:', error);
      return new Map();
    }
  }

  /**
   * Calculate walking time from parking to destination
   */
  async calculateParkAndWalkTime(
    currentLocation: { latitude: number; longitude: number },
    parkingLocation: { latitude: number; longitude: number },
    finalDestination: { latitude: number; longitude: number }
  ): Promise<{
    totalTime: number;
    driveTime: number;
    walkTime: number;
    totalDistance: number;
    recommendation: string;
  } | null> {
    try {
      // Get driving time to parking
      const drivingResult = await this.getDistanceMatrix({
        origins: [currentLocation],
        destinations: [parkingLocation],
        mode: 'driving',
        departureTime: new Date(),
      });

      // Get walking time from parking to destination
      const walkingResult = await this.getDistanceMatrix({
        origins: [parkingLocation],
        destinations: [finalDestination],
        mode: 'walking',
      });

      if (!drivingResult || !walkingResult) {
        return null;
      }

      const driveElement = drivingResult.rows[0]?.elements[0];
      const walkElement = walkingResult.rows[0]?.elements[0];

      if (!driveElement || driveElement.status !== 'OK' || !walkElement || walkElement.status !== 'OK') {
        return null;
      }

      const driveTime = driveElement.durationInTraffic?.value || driveElement.duration.value;
      const walkTime = walkElement.duration.value;
      const totalTime = driveTime + walkTime;
      const totalDistance = driveElement.distance.value + walkElement.distance.value;

      // Generate recommendation
      let recommendation = '';
      if (walkTime < 300) { // Less than 5 min walk
        recommendation = 'Great choice! Short walk from parking.';
      } else if (walkTime < 600) { // Less than 10 min walk
        recommendation = 'Good option. Moderate walk from parking.';
      } else if (walkTime < 900) { // Less than 15 min walk
        recommendation = 'Consider closer parking if available.';
      } else {
        recommendation = 'Long walk. Look for closer parking.';
      }

      analytics.logEvent('park_and_walk_calculated', {
        drive_time: driveTime,
        walk_time: walkTime,
        total_time: totalTime,
      });

      return {
        totalTime,
        driveTime,
        walkTime,
        totalDistance,
        recommendation,
      };
    } catch (error) {
      console.error('Error calculating park and walk time:', error);
      return null;
    }
  }

  /**
   * Find optimal parking with walk time consideration
   */
  async findOptimalParking(
    currentLocation: { latitude: number; longitude: number },
    finalDestination: { latitude: number; longitude: number },
    parkingOptions: Array<{
      id: string;
      name: string;
      location: { latitude: number; longitude: number };
      available?: boolean;
      price?: number;
    }>
  ): Promise<RouteComparison[]> {
    try {
      const results: RouteComparison[] = [];

      for (const parking of parkingOptions) {
        const parkAndWalk = await this.calculateParkAndWalkTime(
          currentLocation,
          parking.location,
          finalDestination
        );

        if (parkAndWalk) {
          results.push({
            destinationId: parking.id,
            destinationName: parking.name,
            location: parking.location,
            distance: parkAndWalk.totalDistance,
            duration: parkAndWalk.totalTime,
            durationInTraffic: parkAndWalk.totalTime,
            trafficDelay: 0,
            estimatedArrival: new Date(Date.now() + parkAndWalk.totalTime * 1000),
            isFastest: false,
            isShortest: false,
            parkingAvailable: parking.available,
            parkingPrice: parking.price,
            recommendation: parkAndWalk.walkTime < 600 ? 'best' : 'ok',
          });
        }
      }

      // Mark fastest
      if (results.length > 0) {
        const fastest = results.reduce((a, b) => a.duration < b.duration ? a : b);
        fastest.isFastest = true;
      }

      // Sort by total time
      results.sort((a, b) => a.duration - b.duration);

      return results;
    } catch (error) {
      console.error('Error finding optimal parking:', error);
      return [];
    }
  }

  /**
   * Format duration to human-readable string
   */
  formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)} sec`;
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)} min`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.round((seconds % 3600) / 60);
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  }

  /**
   * Format distance to human-readable string
   */
  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      return `${(meters / 1000).toFixed(1)} km`;
    }
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(request: DistanceMatrixRequest): string {
    const origins = request.origins.map(o => `${o.latitude},${o.longitude}`).join('|');
    const destinations = request.destinations.map(d => `${d.latitude},${d.longitude}`).join('|');
    const mode = request.mode || 'driving';
    const time = request.departureTime ? Math.floor(request.departureTime.getTime() / 60000) : 'now';

    return `${origins}_${destinations}_${mode}_${time}`;
  }

  /**
   * Get from cache
   */
  private getFromCache(key: string): DistanceMatrixResponse | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set cache
   */
  private setCache(key: string, data: DistanceMatrixResponse): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Clean up old cache entries
    if (this.cache.size > 100) {
      const oldestKey = Array.from(this.cache.keys())[0];
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const distanceMatrixService = new DistanceMatrixService();

export default distanceMatrixService;