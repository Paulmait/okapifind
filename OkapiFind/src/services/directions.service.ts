/**
 * Directions Service with Google Directions API
 * CRITICAL: Real turn-by-turn navigation replacing compass-only guidance
 * Provides accurate routing, ETAs, and rerouting capabilities
 */

import { analytics } from './analytics';
import * as Location from 'expo-location';

export interface DirectionsRequest {
  origin: {
    latitude: number;
    longitude: number;
  };
  destination: {
    latitude: number;
    longitude: number;
  };
  mode?: 'driving' | 'walking' | 'bicycling' | 'transit';
  alternatives?: boolean;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
  departureTime?: Date;
  arrivalTime?: Date;
}

export interface RouteStep {
  instruction: string;
  distance: number; // meters
  duration: number; // seconds
  startLocation: {
    latitude: number;
    longitude: number;
  };
  endLocation: {
    latitude: number;
    longitude: number;
  };
  polyline: string;
  maneuver?: string;
  travelMode?: string;
}

export interface Route {
  id: string;
  summary: string;
  legs: RouteLeg[];
  overviewPolyline: string;
  bounds: {
    northeast: { latitude: number; longitude: number };
    southwest: { latitude: number; longitude: number };
  };
  copyrights: string;
  warnings: string[];
  waypointOrder: number[];
  totalDistance: number; // meters
  totalDuration: number; // seconds
}

export interface RouteLeg {
  steps: RouteStep[];
  distance: number; // meters
  duration: number; // seconds
  durationInTraffic?: number; // seconds
  startAddress: string;
  endAddress: string;
  startLocation: {
    latitude: number;
    longitude: number;
  };
  endLocation: {
    latitude: number;
    longitude: number;
  };
}

export interface NavigationState {
  currentRoute: Route;
  currentLeg: number;
  currentStep: number;
  distanceToNextStep: number; // meters
  timeToNextStep: number; // seconds
  distanceRemaining: number; // meters
  timeRemaining: number; // seconds
  nextInstruction: string;
  nextManeuver?: string;
  isOffRoute: boolean;
  shouldReroute: boolean;
}

class DirectionsService {
  private readonly API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  private readonly BASE_URL = 'https://maps.googleapis.com/maps/api/directions/json';
  private readonly REROUTE_THRESHOLD = 50; // meters off route before rerouting

  private currentNavigation: NavigationState | null = null;
  private locationSubscription: Location.LocationSubscription | null = null;
  private navigationListeners: ((state: NavigationState) => void)[] = [];

  /**
   * Get directions between two points
   */
  async getDirections(request: DirectionsRequest): Promise<Route[]> {
    try {
      if (!this.API_KEY) {
        throw new Error('Google Maps API key not configured');
      }

      const params = new URLSearchParams({
        origin: `${request.origin.latitude},${request.origin.longitude}`,
        destination: `${request.destination.latitude},${request.destination.longitude}`,
        mode: request.mode || 'driving',
        alternatives: request.alternatives ? 'true' : 'false',
        key: this.API_KEY,
        // Request traffic data
        departure_time: request.departureTime
          ? Math.floor(request.departureTime.getTime() / 1000).toString()
          : 'now',
      });

      // Add avoidance preferences
      const avoid: string[] = [];
      if (request.avoidTolls) avoid.push('tolls');
      if (request.avoidHighways) avoid.push('highways');
      if (request.avoidFerries) avoid.push('ferries');
      if (avoid.length > 0) {
        params.append('avoid', avoid.join('|'));
      }

      const response = await fetch(`${this.BASE_URL}?${params.toString()}`);
      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Directions API error: ${data.status} - ${data.error_message || ''}`);
      }

      const routes = data.routes.map((route: any, index: number) => this.parseRoute(route, index));

      analytics.logEvent('directions_fetched', {
        origin: `${request.origin.latitude},${request.origin.longitude}`,
        destination: `${request.destination.latitude},${request.destination.longitude}`,
        mode: request.mode || 'driving',
        routes_count: routes.length,
      });

      return routes;
    } catch (error) {
      console.error('Error fetching directions:', error);

      analytics.logEvent('directions_error', {
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Start turn-by-turn navigation
   */
  async startNavigation(
    route: Route,
    onUpdate: (state: NavigationState) => void
  ): Promise<void> {
    try {
      // Initialize navigation state
      this.currentNavigation = {
        currentRoute: route,
        currentLeg: 0,
        currentStep: 0,
        distanceToNextStep: route.legs[0].steps[0].distance,
        timeToNextStep: route.legs[0].steps[0].duration,
        distanceRemaining: route.totalDistance,
        timeRemaining: route.totalDuration,
        nextInstruction: route.legs[0].steps[0].instruction,
        nextManeuver: route.legs[0].steps[0].maneuver,
        isOffRoute: false,
        shouldReroute: false,
      };

      // Add listener
      this.navigationListeners.push(onUpdate);

      // Start location tracking
      await this.startLocationTracking();

      // Initial update
      onUpdate(this.currentNavigation);

      analytics.logEvent('navigation_started', {
        route_id: route.id,
        total_distance: route.totalDistance,
        total_duration: route.totalDuration,
      });

      console.log('Navigation started');
    } catch (error) {
      console.error('Error starting navigation:', error);
      throw error;
    }
  }

  /**
   * Stop navigation
   */
  async stopNavigation(): Promise<void> {
    try {
      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = null;
      }

      if (this.currentNavigation) {
        analytics.logEvent('navigation_stopped', {
          route_id: this.currentNavigation.currentRoute.id,
          completed_percentage:
            ((this.currentNavigation.currentRoute.totalDistance - this.currentNavigation.distanceRemaining) /
              this.currentNavigation.currentRoute.totalDistance) *
            100,
        });
      }

      this.currentNavigation = null;
      this.navigationListeners = [];

      console.log('Navigation stopped');
    } catch (error) {
      console.error('Error stopping navigation:', error);
    }
  }

  /**
   * Get current navigation state
   */
  getCurrentNavigation(): NavigationState | null {
    return this.currentNavigation;
  }

  /**
   * Calculate distance between two points (Haversine)
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Earth's radius in meters
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

  /**
   * Decode polyline to coordinates
   */
  decodePolyline(encoded: string): Array<{ latitude: number; longitude: number }> {
    const points: Array<{ latitude: number; longitude: number }> = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b: number;
      let shift = 0;
      let result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  }

  /**
   * Simplify instruction text for TTS
   */
  simplifyInstruction(instruction: string): string {
    // Remove HTML tags
    let simplified = instruction.replace(/<[^>]*>/g, ' ');

    // Replace common abbreviations
    simplified = simplified
      .replace(/\bft\b/g, 'feet')
      .replace(/\bmi\b/g, 'miles')
      .replace(/\bm\b/g, 'meters')
      .replace(/\bkm\b/g, 'kilometers');

    return simplified.trim();
  }

  /**
   * Parse route from API response
   */
  private parseRoute(route: any, index: number): Route {
    const legs: RouteLeg[] = route.legs.map((leg: any) => ({
      steps: leg.steps.map((step: any) => ({
        instruction: step.html_instructions,
        distance: step.distance.value,
        duration: step.duration.value,
        startLocation: {
          latitude: step.start_location.lat,
          longitude: step.start_location.lng,
        },
        endLocation: {
          latitude: step.end_location.lat,
          longitude: step.end_location.lng,
        },
        polyline: step.polyline.points,
        maneuver: step.maneuver,
        travelMode: step.travel_mode,
      })),
      distance: leg.distance.value,
      duration: leg.duration.value,
      durationInTraffic: leg.duration_in_traffic?.value,
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      startLocation: {
        latitude: leg.start_location.lat,
        longitude: leg.start_location.lng,
      },
      endLocation: {
        latitude: leg.end_location.lat,
        longitude: leg.end_location.lng,
      },
    }));

    const totalDistance = legs.reduce((sum, leg) => sum + leg.distance, 0);
    const totalDuration = legs.reduce((sum, leg) => sum + leg.duration, 0);

    return {
      id: `route_${index}_${Date.now()}`,
      summary: route.summary,
      legs,
      overviewPolyline: route.overview_polyline.points,
      bounds: {
        northeast: {
          latitude: route.bounds.northeast.lat,
          longitude: route.bounds.northeast.lng,
        },
        southwest: {
          latitude: route.bounds.southwest.lat,
          longitude: route.bounds.southwest.lng,
        },
      },
      copyrights: route.copyrights,
      warnings: route.warnings || [],
      waypointOrder: route.waypoint_order || [],
      totalDistance,
      totalDuration,
    };
  }

  /**
   * Start tracking user location during navigation
   */
  private async startLocationTracking(): Promise<void> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission not granted');
    }

    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000, // Update every second
        distanceInterval: 5, // Update every 5 meters
      },
      (location) => {
        this.handleLocationUpdate(location);
      }
    );
  }

  /**
   * Handle location updates during navigation
   */
  private handleLocationUpdate(location: Location.LocationObject): void {
    if (!this.currentNavigation) return;

    const { latitude, longitude } = location.coords;
    const nav = this.currentNavigation;
    const currentLeg = nav.currentRoute.legs[nav.currentLeg];
    const currentStep = currentLeg.steps[nav.currentStep];

    // Calculate distance to next step's end location
    const distanceToStepEnd = this.calculateDistance(
      latitude,
      longitude,
      currentStep.endLocation.latitude,
      currentStep.endLocation.longitude
    );

    // Check if user has completed the current step (within 20 meters)
    if (distanceToStepEnd < 20) {
      // Move to next step
      if (nav.currentStep < currentLeg.steps.length - 1) {
        nav.currentStep++;
        const nextStep = currentLeg.steps[nav.currentStep];
        nav.nextInstruction = nextStep.instruction;
        nav.nextManeuver = nextStep.maneuver;

        analytics.logEvent('navigation_step_completed', {
          route_id: nav.currentRoute.id,
          step_number: nav.currentStep,
        });
      } else if (nav.currentLeg < nav.currentRoute.legs.length - 1) {
        // Move to next leg
        nav.currentLeg++;
        nav.currentStep = 0;
        const nextLeg = nav.currentRoute.legs[nav.currentLeg];
        nav.nextInstruction = nextLeg.steps[0].instruction;
        nav.nextManeuver = nextLeg.steps[0].maneuver;
      } else {
        // Navigation complete
        analytics.logEvent('navigation_completed', {
          route_id: nav.currentRoute.id,
        });
        this.stopNavigation();
        return;
      }
    }

    // Update navigation state
    nav.distanceToNextStep = distanceToStepEnd;
    nav.distanceRemaining = this.calculateRemainingDistance(nav);

    // Check if user is off route
    const distanceToRoute = this.calculateDistanceToPolyline(
      latitude,
      longitude,
      currentStep.polyline
    );

    nav.isOffRoute = distanceToRoute > this.REROUTE_THRESHOLD;
    nav.shouldReroute = nav.isOffRoute;

    // Notify listeners
    this.notifyNavigationListeners(nav);

    // Auto-reroute if off route
    if (nav.shouldReroute) {
      this.handleRerouting({ latitude, longitude });
    }
  }

  /**
   * Calculate remaining distance in route
   */
  private calculateRemainingDistance(nav: NavigationState): number {
    let distance = 0;

    // Add distance from remaining steps in current leg
    const currentLeg = nav.currentRoute.legs[nav.currentLeg];
    for (let i = nav.currentStep; i < currentLeg.steps.length; i++) {
      distance += currentLeg.steps[i].distance;
    }

    // Add distance from remaining legs
    for (let i = nav.currentLeg + 1; i < nav.currentRoute.legs.length; i++) {
      distance += nav.currentRoute.legs[i].distance;
    }

    return distance;
  }

  /**
   * Calculate distance from point to polyline
   */
  private calculateDistanceToPolyline(
    lat: number,
    lng: number,
    polyline: string
  ): number {
    const points = this.decodePolyline(polyline);

    let minDistance = Infinity;

    for (const point of points) {
      const distance = this.calculateDistance(lat, lng, point.latitude, point.longitude);
      minDistance = Math.min(minDistance, distance);
    }

    return minDistance;
  }

  /**
   * Handle rerouting when user goes off route
   */
  private async handleRerouting(
    currentLocation: { latitude: number; longitude: number }
  ): Promise<void> {
    if (!this.currentNavigation) return;

    try {
      const destination = this.currentNavigation.currentRoute.legs[
        this.currentNavigation.currentRoute.legs.length - 1
      ].endLocation;

      analytics.logEvent('navigation_rerouting', {
        route_id: this.currentNavigation.currentRoute.id,
      });

      const routes = await this.getDirections({
        origin: currentLocation,
        destination,
        mode: 'driving',
      });

      if (routes.length > 0) {
        // Update current route with new route
        this.currentNavigation.currentRoute = routes[0];
        this.currentNavigation.currentLeg = 0;
        this.currentNavigation.currentStep = 0;
        this.currentNavigation.isOffRoute = false;
        this.currentNavigation.shouldReroute = false;
        this.currentNavigation.nextInstruction = routes[0].legs[0].steps[0].instruction;

        this.notifyNavigationListeners(this.currentNavigation);
      }
    } catch (error) {
      console.error('Error rerouting:', error);
    }
  }

  /**
   * Notify navigation listeners
   */
  private notifyNavigationListeners(state: NavigationState): void {
    this.navigationListeners.forEach(listener => listener(state));
  }

  /**
   * Convert degrees to radians
   */
  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}

// Export singleton instance
export const directionsService = new DirectionsService();

export default directionsService;