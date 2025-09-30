/**
 * Traffic Service
 * CRITICAL: Real-time traffic visualization and alerts
 * Helps users avoid congestion and plan optimal departure times
 */

import { analytics } from './analytics';

export type TrafficSeverity = 'none' | 'light' | 'moderate' | 'heavy' | 'severe';

export interface TrafficSegment {
  id: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  severity: TrafficSeverity;
  speedKmh: number;
  delayMinutes: number;
  startLocation: { latitude: number; longitude: number };
  endLocation: { latitude: number; longitude: number };
  lastUpdated: string;
}

export interface TrafficIncident {
  id: string;
  type: 'accident' | 'construction' | 'closure' | 'event' | 'congestion';
  severity: 'minor' | 'moderate' | 'major';
  location: { latitude: number; longitude: number };
  description: string;
  startTime: string;
  estimatedEndTime?: string;
  affectedRoads: string[];
  delayMinutes: number;
}

export interface TrafficAlert {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  location: { latitude: number; longitude: number };
  radius: number; // meters
  expiresAt: string;
}

export interface RouteTrafficSummary {
  totalDelayMinutes: number;
  averageSpeedKmh: number;
  incidents: TrafficIncident[];
  congestionLevel: TrafficSeverity;
  alternateRouteSuggested: boolean;
  timeSavingsMinutes?: number;
}

class TrafficService {
  private readonly API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  private readonly REFRESH_INTERVAL = 120000; // 2 minutes
  private readonly CACHE_TTL = 300000; // 5 minutes

  private trafficCache: Map<string, { data: any; timestamp: number }> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private listeners: Map<string, ((data: any) => void)[]> = new Map();

  /**
   * Get traffic color for severity level
   */
  getTrafficColor(severity: TrafficSeverity): string {
    switch (severity) {
      case 'none':
        return '#00E676'; // Green
      case 'light':
        return '#FFD600'; // Yellow
      case 'moderate':
        return '#FF9100'; // Orange
      case 'heavy':
        return '#FF3D00'; // Red
      case 'severe':
        return '#D50000'; // Dark Red
      default:
        return '#9E9E9E'; // Gray
    }
  }

  /**
   * Get traffic segments for a route
   */
  async getRouteTraffic(
    polyline: string,
    departureTime?: Date
  ): Promise<TrafficSegment[]> {
    try {
      const cacheKey = `route_${polyline}_${departureTime?.getTime() || 'now'}`;

      // Check cache
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // In production, this would call Google Traffic API or similar
      // For now, we'll simulate traffic data based on time of day
      const segments = this.simulateTrafficSegments(polyline);

      // Cache result
      this.setCache(cacheKey, segments);

      analytics.logEvent('traffic_data_fetched', {
        segment_count: segments.length,
        has_congestion: segments.some(s => s.severity !== 'none'),
      });

      return segments;
    } catch (error) {
      console.error('Error fetching route traffic:', error);
      return [];
    }
  }

  /**
   * Get traffic incidents near a location
   */
  async getTrafficIncidents(
    latitude: number,
    longitude: number,
    radiusKm: number = 10
  ): Promise<TrafficIncident[]> {
    try {
      const cacheKey = `incidents_${latitude}_${longitude}_${radiusKm}`;

      // Check cache
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // In production, integrate with traffic incident APIs:
      // - Google Traffic API
      // - HERE Traffic API
      // - TomTom Traffic API
      // - Waze traffic data
      const incidents = this.simulateTrafficIncidents(latitude, longitude, radiusKm);

      // Cache result
      this.setCache(cacheKey, incidents);

      analytics.logEvent('traffic_incidents_fetched', {
        incident_count: incidents.length,
        location: `${latitude},${longitude}`,
      });

      return incidents;
    } catch (error) {
      console.error('Error fetching traffic incidents:', error);
      return [];
    }
  }

  /**
   * Get traffic alerts for user's route
   */
  async getTrafficAlertsForRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ): Promise<TrafficAlert[]> {
    try {
      // Get incidents along route
      const midLat = (origin.latitude + destination.latitude) / 2;
      const midLng = (origin.longitude + destination.longitude) / 2;

      const incidents = await this.getTrafficIncidents(midLat, midLng, 5);

      // Convert to alerts
      const alerts: TrafficAlert[] = incidents
        .filter(incident => incident.severity !== 'minor')
        .map(incident => ({
          id: `alert_${incident.id}`,
          message: this.generateAlertMessage(incident),
          severity: this.mapIncidentToAlertSeverity(incident.severity),
          location: incident.location,
          radius: 1000, // 1km
          expiresAt: incident.estimatedEndTime || new Date(Date.now() + 3600000).toISOString(),
        }));

      analytics.logEvent('traffic_alerts_generated', {
        alert_count: alerts.length,
      });

      return alerts;
    } catch (error) {
      console.error('Error generating traffic alerts:', error);
      return [];
    }
  }

  /**
   * Get route traffic summary
   */
  async getRouteTrafficSummary(
    polyline: string,
    departureTime?: Date
  ): Promise<RouteTrafficSummary> {
    try {
      const segments = await this.getRouteTraffic(polyline, departureTime);

      // Calculate metrics
      const totalDelayMinutes = segments.reduce((sum, s) => sum + s.delayMinutes, 0);
      const averageSpeedKmh = segments.reduce((sum, s) => sum + s.speedKmh, 0) / segments.length;

      // Determine overall congestion level
      const maxSeverity = this.getMaxSeverity(segments.map(s => s.severity));

      // Get incidents along route
      const midPoint = segments[Math.floor(segments.length / 2)];
      const incidents = midPoint
        ? await this.getTrafficIncidents(
            midPoint.startLocation.latitude,
            midPoint.startLocation.longitude,
            2
          )
        : [];

      // Suggest alternate route if heavy traffic
      const alternateRouteSuggested = maxSeverity === 'heavy' || maxSeverity === 'severe';
      const timeSavingsMinutes = alternateRouteSuggested ? Math.ceil(totalDelayMinutes * 0.4) : undefined;

      return {
        totalDelayMinutes,
        averageSpeedKmh,
        incidents,
        congestionLevel: maxSeverity,
        alternateRouteSuggested,
        timeSavingsMinutes,
      };
    } catch (error) {
      console.error('Error getting route traffic summary:', error);
      return {
        totalDelayMinutes: 0,
        averageSpeedKmh: 50,
        incidents: [],
        congestionLevel: 'none',
        alternateRouteSuggested: false,
      };
    }
  }

  /**
   * Subscribe to traffic updates for a location
   */
  subscribeToTrafficUpdates(
    locationId: string,
    latitude: number,
    longitude: number,
    callback: (incidents: TrafficIncident[]) => void
  ): () => void {
    // Add listener
    const listeners = this.listeners.get(locationId) || [];
    listeners.push(callback);
    this.listeners.set(locationId, listeners);

    // Start update interval if not already running
    if (!this.updateInterval) {
      this.startTrafficUpdates();
    }

    // Initial fetch
    this.getTrafficIncidents(latitude, longitude, 10).then(callback);

    analytics.logEvent('traffic_subscription_started', {
      location_id: locationId,
    });

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(locationId) || [];
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }

      // Stop updates if no more listeners
      if (this.getTotalListenerCount() === 0) {
        this.stopTrafficUpdates();
      }

      analytics.logEvent('traffic_subscription_stopped', {
        location_id: locationId,
      });
    };
  }

  /**
   * Get optimal departure time to avoid traffic
   */
  async getOptimalDepartureTime(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    preferredTime: Date,
    windowHours: number = 2
  ): Promise<{
    optimalTime: Date;
    estimatedDurationMinutes: number;
    timeSavingsMinutes: number;
    trafficLevel: TrafficSeverity;
  }> {
    try {
      const startTime = new Date(preferredTime.getTime() - windowHours * 3600000 / 2);
      const endTime = new Date(preferredTime.getTime() + windowHours * 3600000 / 2);

      // Sample traffic at 15-minute intervals
      const samples: Array<{
        time: Date;
        duration: number;
        traffic: TrafficSeverity;
      }> = [];

      for (let time = new Date(startTime); time <= endTime; time.setMinutes(time.getMinutes() + 15)) {
        const trafficLevel = this.estimateTrafficLevel(time);
        const baseDuration = 20; // Base duration in minutes
        const trafficMultiplier = this.getTrafficMultiplier(trafficLevel);
        const duration = baseDuration * trafficMultiplier;

        samples.push({
          time: new Date(time),
          duration,
          traffic: trafficLevel,
        });
      }

      // Find optimal time (lowest duration)
      const optimal = samples.reduce((best, current) =>
        current.duration < best.duration ? current : best
      );

      const preferredSample = samples.find(
        s => Math.abs(s.time.getTime() - preferredTime.getTime()) < 450000 // 7.5 min
      ) || samples[Math.floor(samples.length / 2)];

      analytics.logEvent('optimal_departure_time_calculated', {
        time_savings: preferredSample.duration - optimal.duration,
        optimal_hour: optimal.time.getHours(),
      });

      return {
        optimalTime: optimal.time,
        estimatedDurationMinutes: optimal.duration,
        timeSavingsMinutes: Math.round(preferredSample.duration - optimal.duration),
        trafficLevel: optimal.traffic,
      };
    } catch (error) {
      console.error('Error calculating optimal departure time:', error);
      return {
        optimalTime: preferredTime,
        estimatedDurationMinutes: 20,
        timeSavingsMinutes: 0,
        trafficLevel: 'none',
      };
    }
  }

  /**
   * Start periodic traffic updates
   */
  private startTrafficUpdates(): void {
    this.updateInterval = setInterval(() => {
      // Notify all listeners with fresh data
      this.listeners.forEach((callbacks, locationId) => {
        // Extract lat/lng from locationId (format: "lat_lng")
        const [lat, lng] = locationId.split('_').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          this.getTrafficIncidents(lat, lng, 10).then(incidents => {
            callbacks.forEach(callback => callback(incidents));
          });
        }
      });
    }, this.REFRESH_INTERVAL);
  }

  /**
   * Stop periodic traffic updates
   */
  private stopTrafficUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Get total listener count
   */
  private getTotalListenerCount(): number {
    let count = 0;
    this.listeners.forEach(callbacks => {
      count += callbacks.length;
    });
    return count;
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): any {
    const cached = this.trafficCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.trafficCache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Clean up old cache entries
    if (this.trafficCache.size > 100) {
      const oldestKey = Array.from(this.trafficCache.keys())[0];
      this.trafficCache.delete(oldestKey);
    }
  }

  /**
   * Simulate traffic segments (for development)
   */
  private simulateTrafficSegments(polyline: string): TrafficSegment[] {
    const now = new Date();
    const hour = now.getHours();

    // Simulate rush hour traffic
    const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19);

    return [
      {
        id: 'seg_1',
        coordinates: [],
        severity: isRushHour ? 'heavy' : 'light',
        speedKmh: isRushHour ? 25 : 50,
        delayMinutes: isRushHour ? 8 : 2,
        startLocation: { latitude: 38.9072, longitude: -77.0369 },
        endLocation: { latitude: 38.9101, longitude: -77.0362 },
        lastUpdated: now.toISOString(),
      },
    ];
  }

  /**
   * Simulate traffic incidents (for development)
   */
  private simulateTrafficIncidents(
    latitude: number,
    longitude: number,
    radiusKm: number
  ): TrafficIncident[] {
    const now = new Date();
    const random = Math.random();

    // 30% chance of incident
    if (random < 0.3) {
      return [
        {
          id: `incident_${Date.now()}`,
          type: 'accident',
          severity: 'moderate',
          location: {
            latitude: latitude + (Math.random() - 0.5) * 0.01,
            longitude: longitude + (Math.random() - 0.5) * 0.01,
          },
          description: 'Traffic accident reported, expect delays',
          startTime: now.toISOString(),
          estimatedEndTime: new Date(now.getTime() + 3600000).toISOString(),
          affectedRoads: ['Main St', 'Highway 101'],
          delayMinutes: 15,
        },
      ];
    }

    return [];
  }

  /**
   * Generate alert message from incident
   */
  private generateAlertMessage(incident: TrafficIncident): string {
    const delayText = incident.delayMinutes > 0
      ? ` Expect ${incident.delayMinutes} min delay.`
      : '';

    return `${incident.type.charAt(0).toUpperCase() + incident.type.slice(1)} on ${incident.affectedRoads.join(', ')}.${delayText}`;
  }

  /**
   * Map incident severity to alert severity
   */
  private mapIncidentToAlertSeverity(severity: 'minor' | 'moderate' | 'major'): 'info' | 'warning' | 'critical' {
    switch (severity) {
      case 'minor':
        return 'info';
      case 'moderate':
        return 'warning';
      case 'major':
        return 'critical';
    }
  }

  /**
   * Get maximum severity from list
   */
  private getMaxSeverity(severities: TrafficSeverity[]): TrafficSeverity {
    const order: TrafficSeverity[] = ['none', 'light', 'moderate', 'heavy', 'severe'];
    return severities.reduce((max, current) => {
      const maxIndex = order.indexOf(max);
      const currentIndex = order.indexOf(current);
      return currentIndex > maxIndex ? current : max;
    }, 'none');
  }

  /**
   * Estimate traffic level based on time of day
   */
  private estimateTrafficLevel(time: Date): TrafficSeverity {
    const hour = time.getHours();
    const dayOfWeek = time.getDay();

    // Weekend traffic is generally lighter
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      if (hour >= 10 && hour <= 20) return 'light';
      return 'none';
    }

    // Weekday traffic patterns
    if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)) {
      return 'heavy'; // Rush hour
    } else if ((hour >= 6 && hour <= 10) || (hour >= 15 && hour <= 20)) {
      return 'moderate'; // Near rush hour
    } else if (hour >= 11 && hour <= 14) {
      return 'light'; // Lunch time
    }

    return 'none'; // Off-peak
  }

  /**
   * Get traffic multiplier for duration calculation
   */
  private getTrafficMultiplier(severity: TrafficSeverity): number {
    switch (severity) {
      case 'none':
        return 1.0;
      case 'light':
        return 1.2;
      case 'moderate':
        return 1.5;
      case 'heavy':
        return 2.0;
      case 'severe':
        return 2.5;
      default:
        return 1.0;
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.trafficCache.clear();
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.stopTrafficUpdates();
    this.clearCache();
    this.listeners.clear();
  }
}

// Export singleton instance
export const trafficService = new TrafficService();

export default trafficService;