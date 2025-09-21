/**
 * Watch Connectivity Service
 * Handles communication between the main app and companion watch apps
 * Uses Firebase Realtime Database for cross-platform sync
 */

import {
  getDatabase,
  ref,
  set,
  onValue,
  serverTimestamp,
  Database,
  DatabaseReference
} from 'firebase/database';
import { firebaseApp } from '../config/firebase';
import { analytics } from './analytics';

interface WatchData {
  carLocation: {
    latitude: number;
    longitude: number;
    address?: string;
    timestamp: number;
  } | null;
  userLocation: {
    latitude: number;
    longitude: number;
    timestamp: number;
  } | null;
  distance: number;
  bearing: number;
  isNavigating: boolean;
  lastUpdate: any;
}

interface WatchSession {
  userId: string;
  deviceId: string;
  platform: 'watchOS' | 'wearOS';
  isActive: boolean;
  lastHeartbeat: any;
}

class WatchConnectivityService {
  private db: Database;
  private listeners: Map<string, () => void> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.db = getDatabase(firebaseApp);
  }

  /**
   * Initialize watch connectivity for a user
   */
  async initializeForUser(userId: string): Promise<void> {
    try {
      const watchDataRef = ref(this.db, `watch_data/${userId}`);

      // Set initial data structure
      await set(watchDataRef, {
        carLocation: null,
        userLocation: null,
        distance: 0,
        bearing: 0,
        isNavigating: false,
        lastUpdate: serverTimestamp(),
      });

      analytics.logEvent('watch_connectivity_initialized', { userId });
    } catch (error) {
      console.error('Failed to initialize watch connectivity:', error);
      throw error;
    }
  }

  /**
   * Update car location for watch apps
   */
  async updateCarLocation(
    userId: string,
    location: { latitude: number; longitude: number; address?: string } | null
  ): Promise<void> {
    try {
      const carLocationRef = ref(this.db, `watch_data/${userId}/carLocation`);

      if (location) {
        await set(carLocationRef, {
          ...location,
          timestamp: Date.now(),
        });
      } else {
        await set(carLocationRef, null);
      }

      // Update last update timestamp
      const lastUpdateRef = ref(this.db, `watch_data/${userId}/lastUpdate`);
      await set(lastUpdateRef, serverTimestamp());

      analytics.logEvent('watch_car_location_updated', {
        userId,
        hasLocation: !!location
      });
    } catch (error) {
      console.error('Failed to update car location for watch:', error);
    }
  }

  /**
   * Update user location for watch apps
   */
  async updateUserLocation(
    userId: string,
    location: { latitude: number; longitude: number }
  ): Promise<void> {
    try {
      const userLocationRef = ref(this.db, `watch_data/${userId}/userLocation`);

      await set(userLocationRef, {
        ...location,
        timestamp: Date.now(),
      });

      // Update last update timestamp
      const lastUpdateRef = ref(this.db, `watch_data/${userId}/lastUpdate`);
      await set(lastUpdateRef, serverTimestamp());
    } catch (error) {
      console.error('Failed to update user location for watch:', error);
    }
  }

  /**
   * Update navigation data for watch apps
   */
  async updateNavigationData(
    userId: string,
    data: {
      distance: number;
      bearing: number;
      isNavigating: boolean;
    }
  ): Promise<void> {
    try {
      const navigationRef = ref(this.db, `watch_data/${userId}`);

      await set(navigationRef, {
        distance: data.distance,
        bearing: data.bearing,
        isNavigating: data.isNavigating,
        lastUpdate: serverTimestamp(),
      });

      analytics.logEvent('watch_navigation_updated', {
        userId,
        isNavigating: data.isNavigating
      });
    } catch (error) {
      console.error('Failed to update navigation data for watch:', error);
    }
  }

  /**
   * Subscribe to watch data changes
   */
  subscribeToWatchData(
    userId: string,
    callback: (data: WatchData) => void
  ): () => void {
    const watchDataRef = ref(this.db, `watch_data/${userId}`);

    const unsubscribe = onValue(watchDataRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        callback(data as WatchData);
      }
    });

    // Store unsubscribe function
    const listenerId = `watch_${userId}`;
    this.listeners.set(listenerId, unsubscribe);

    // Return cleanup function
    return () => {
      unsubscribe();
      this.listeners.delete(listenerId);
    };
  }

  /**
   * Register a watch device session
   */
  async registerWatchSession(
    userId: string,
    deviceId: string,
    platform: 'watchOS' | 'wearOS'
  ): Promise<void> {
    try {
      const sessionRef = ref(this.db, `watch_sessions/${userId}/${deviceId}`);

      const session: WatchSession = {
        userId,
        deviceId,
        platform,
        isActive: true,
        lastHeartbeat: serverTimestamp(),
      };

      await set(sessionRef, session);

      analytics.logEvent('watch_session_registered', {
        userId,
        platform,
        deviceId,
      });
    } catch (error) {
      console.error('Failed to register watch session:', error);
    }
  }

  /**
   * Send heartbeat from watch device
   */
  async sendHeartbeat(userId: string, deviceId: string): Promise<void> {
    try {
      const heartbeatRef = ref(this.db, `watch_sessions/${userId}/${deviceId}/lastHeartbeat`);
      await set(heartbeatRef, serverTimestamp());
    } catch (error) {
      console.error('Failed to send watch heartbeat:', error);
    }
  }

  /**
   * Check if any watch is active for user
   */
  async hasActiveWatch(userId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const sessionsRef = ref(this.db, `watch_sessions/${userId}`);

      onValue(sessionsRef, (snapshot) => {
        const sessions = snapshot.val();
        if (!sessions) {
          resolve(false);
          return;
        }

        // Check if any session has recent heartbeat (within last 5 minutes)
        const now = Date.now();
        const hasActive = Object.values(sessions).some((session: any) => {
          const lastHeartbeat = session.lastHeartbeat;
          if (!lastHeartbeat) return false;

          const timeDiff = now - lastHeartbeat;
          return timeDiff < 5 * 60 * 1000; // 5 minutes
        });

        resolve(hasActive);
      }, { onlyOnce: true });
    });
  }

  /**
   * Start automatic updates for watch when navigating
   */
  startNavigationUpdates(
    userId: string,
    intervalMs: number = 5000 // Update every 5 seconds
  ): void {
    this.stopNavigationUpdates();

    this.updateInterval = setInterval(async () => {
      // This will be called from GuidanceScreen to update watch data
      const lastUpdateRef = ref(this.db, `watch_data/${userId}/lastUpdate`);
      await set(lastUpdateRef, serverTimestamp());
    }, intervalMs);

    analytics.logEvent('watch_navigation_updates_started', { userId });
  }

  /**
   * Stop automatic updates
   */
  stopNavigationUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Clean up old watch sessions (older than 24 hours)
   */
  async cleanupOldSessions(userId: string): Promise<void> {
    try {
      const sessionsRef = ref(this.db, `watch_sessions/${userId}`);

      onValue(sessionsRef, async (snapshot) => {
        const sessions = snapshot.val();
        if (!sessions) return;

        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;

        for (const [deviceId, session] of Object.entries(sessions)) {
          const sessionData = session as WatchSession;
          const lastHeartbeat = sessionData.lastHeartbeat;

          if (lastHeartbeat && (now - lastHeartbeat) > oneDayMs) {
            // Remove old session
            const sessionRef = ref(this.db, `watch_sessions/${userId}/${deviceId}`);
            await set(sessionRef, null);
          }
        }
      }, { onlyOnce: true });
    } catch (error) {
      console.error('Failed to cleanup old watch sessions:', error);
    }
  }

  /**
   * Calculate distance between two coordinates (for watch display)
   */
  calculateDistance(
    coord1: { latitude: number; longitude: number },
    coord2: { latitude: number; longitude: number }
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Calculate bearing between two coordinates
   */
  calculateBearing(
    coord1: { latitude: number; longitude: number },
    coord2: { latitude: number; longitude: number }
  ): number {
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
      Math.cos(φ1) * Math.sin(φ2) -
      Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
  }
}

export const watchConnectivity = new WatchConnectivityService();
export default watchConnectivity;