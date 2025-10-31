/**
 * Phase 1 Integration Tests
 * Tests for new Phase 1 features:
 * - Offline Queue
 * - Location Fusion
 * - Parking Recommendations
 * - useParkingLocation hook
 */

import { locationFusion } from '../../services/locationFusion';
import { offlineQueue } from '../../services/offlineQueue';
import { parkingRecommendations } from '../../services/parkingRecommendations';
import * as Location from 'expo-location';

// Mock dependencies
jest.mock('expo-location');
jest.mock('expo-sensors', () => ({
  Barometer: {
    isAvailableAsync: jest.fn().mockResolvedValue(true),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn((callback) => {
      // Simulate barometer reading
      callback({ pressure: 1013.25 }); // Standard atmospheric pressure
      return { remove: jest.fn() };
    }),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
  addEventListener: jest.fn(),
}));

jest.mock('../../lib/supabase-client', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { id: 'test-session-id' },
            error: null,
          }),
        })),
      })),
    })),
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
  },
}));

describe('Phase 1 Integration Tests', () => {
  describe('Location Fusion Service', () => {
    beforeEach(() => {
      // Mock GPS location
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 20,
          altitude: 0,
          heading: 0,
          speed: 0,
        },
        timestamp: Date.now(),
      });
    });

    it('should get high-accuracy fused location', async () => {
      const location = await locationFusion.getHighAccuracyLocation();

      expect(location).toBeDefined();
      expect(location.latitude).toBeCloseTo(37.7749, 4);
      expect(location.longitude).toBeCloseTo(-122.4194, 4);
      expect(location.accuracy).toBeLessThan(20); // Should be better than GPS alone
      expect(location.sources).toContain('gps');
      expect(location.timestamp).toBeDefined();
    }, 10000);

    it('should include multiple sources when available', async () => {
      const location = await locationFusion.getHighAccuracyLocation();

      expect(Array.isArray(location.sources)).toBe(true);
      expect(location.sources.length).toBeGreaterThan(0);
    });

    it('should detect floor when available', async () => {
      const location = await locationFusion.getHighAccuracyLocation();

      // Floor detection may or may not be available depending on barometer
      if (location.floor) {
        expect(typeof location.floor).toBe('string');
        // Floor should be in format: G, 1, 2, B1, B2, etc.
        expect(location.floor).toMatch(/^(G|B?\d+)$/);
      }
    });

    it('should snap to nearby parking venues when close enough', async () => {
      // Mock location near Pier 39 Parking Garage
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: {
          latitude: 37.8087,
          longitude: -122.4098,
          accuracy: 10,
          altitude: 0,
          heading: 0,
          speed: 0,
        },
        timestamp: Date.now(),
      });

      const location = await locationFusion.getHighAccuracyLocation();

      // Should snap to known venue
      if (location.snapped) {
        expect(location.venue_name).toBeDefined();
        expect(location.accuracy).toBeLessThanOrEqual(5); // Snapped accuracy
      }
    });

    it('should handle GPS errors gracefully', async () => {
      (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(
        new Error('GPS unavailable')
      );

      await expect(locationFusion.getHighAccuracyLocation()).rejects.toThrow();
    });
  });

  describe('Offline Queue Service', () => {
    beforeEach(async () => {
      // Clear queue before each test
      await offlineQueue['clearQueue']();
    });

    it('should add operation to queue', async () => {
      const operation = {
        type: 'save_parking' as const,
        data: {
          car_point: { coordinates: [-122.4194, 37.7749] },
          source: 'manual' as const,
          is_active: true,
        },
        timestamp: Date.now(),
      };

      await offlineQueue.addToQueue(operation);

      const queueSize = offlineQueue['queue'].length;
      expect(queueSize).toBe(1);
    });

    it('should assign unique IDs to queued operations', async () => {
      const operation1 = {
        type: 'save_parking' as const,
        data: { car_point: { coordinates: [-122.4194, 37.7749] } },
        timestamp: Date.now(),
      };

      const operation2 = {
        type: 'save_parking' as const,
        data: { car_point: { coordinates: [-122.4195, 37.7750] } },
        timestamp: Date.now(),
      };

      await offlineQueue.addToQueue(operation1);
      await offlineQueue.addToQueue(operation2);

      const queue = offlineQueue['queue'];
      expect(queue[0].id).not.toBe(queue[1].id);
    });

    it('should sync queue when online', async () => {
      // Add operation to queue
      await offlineQueue.addToQueue({
        type: 'save_parking' as const,
        data: {
          car_point: { coordinates: [-122.4194, 37.7749] },
          source: 'manual' as const,
        },
        timestamp: Date.now(),
      });

      // Trigger sync
      await offlineQueue['syncQueue']();

      // Queue should be empty after successful sync
      const queueSize = offlineQueue['queue'].length;
      expect(queueSize).toBe(0);
    });

    it('should retry failed operations', async () => {
      // Mock a failing operation
      const failingOp = {
        type: 'save_parking' as const,
        data: {
          car_point: { coordinates: [-122.4194, 37.7749] },
        },
        timestamp: Date.now(),
      };

      await offlineQueue.addToQueue(failingOp);

      // Mock supabase to fail
      const { supabase } = require('../../lib/supabase-client');
      supabase.from.mockImplementationOnce(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Network error'),
            }),
          })),
        })),
      }));

      await offlineQueue['syncQueue']();

      // Operation should still be in queue with incremented retries
      const queue = offlineQueue['queue'];
      expect(queue.length).toBe(1);
      expect(queue[0].retries).toBeGreaterThan(0);
    });

    it('should remove operations after max retries', async () => {
      // Add operation with max retries already exceeded
      const op = {
        id: 'test-op',
        type: 'save_parking' as const,
        data: { car_point: { coordinates: [-122.4194, 37.7749] } },
        timestamp: Date.now(),
        retries: 5, // Max retries
      };

      offlineQueue['queue'].push(op);

      // Mock supabase to fail
      const { supabase } = require('../../lib/supabase-client');
      supabase.from.mockImplementationOnce(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Network error'),
            }),
          })),
        })),
      }));

      await offlineQueue['syncQueue']();

      // Operation should be removed
      expect(offlineQueue['queue'].length).toBe(0);
    });
  });

  describe('Parking Recommendations Service', () => {
    const testDestination = {
      latitude: 37.7749,
      longitude: -122.4194,
    };

    it('should get parking recommendations', async () => {
      const recommendations = await parkingRecommendations.getRecommendations(
        testDestination,
        { limit: 5, radiusMeters: 500 }
      );

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.length).toBeLessThanOrEqual(5);
    });

    it('should include required fields in recommendations', async () => {
      const recommendations = await parkingRecommendations.getRecommendations(
        testDestination,
        { limit: 1 }
      );

      if (recommendations.length > 0) {
        const rec = recommendations[0];
        expect(rec.name).toBeDefined();
        expect(rec.latitude).toBeDefined();
        expect(rec.longitude).toBeDefined();
        expect(rec.rating).toBeDefined();
        expect(rec.rating).toBeGreaterThanOrEqual(0);
        expect(rec.rating).toBeLessThanOrEqual(1);
        expect(rec.distance_to_destination).toBeDefined();
        expect(rec.reasons).toBeDefined();
        expect(Array.isArray(rec.reasons)).toBe(true);
      }
    });

    it('should sort recommendations by rating', async () => {
      const recommendations = await parkingRecommendations.getRecommendations(
        testDestination,
        { limit: 5 }
      );

      if (recommendations.length > 1) {
        for (let i = 0; i < recommendations.length - 1; i++) {
          expect(recommendations[i].rating).toBeGreaterThanOrEqual(
            recommendations[i + 1].rating
          );
        }
      }
    });

    it('should filter by radius', async () => {
      const recommendations = await parkingRecommendations.getRecommendations(
        testDestination,
        { radiusMeters: 100 }
      );

      // All recommendations should be within radius
      recommendations.forEach((rec) => {
        expect(rec.distance_to_destination).toBeLessThanOrEqual(100);
      });
    });

    it('should include pricing information when available', async () => {
      const recommendations = await parkingRecommendations.getRecommendations(
        testDestination,
        { limit: 5 }
      );

      recommendations.forEach((rec) => {
        if (rec.pricing) {
          expect(rec.pricing.currency).toBeDefined();
          // Should have at least one pricing tier
          expect(
            rec.pricing.hourly || rec.pricing.daily || rec.pricing.monthly
          ).toBeDefined();
        }
      });
    });

    it('should include safety score', async () => {
      const recommendations = await parkingRecommendations.getRecommendations(
        testDestination,
        { limit: 5 }
      );

      recommendations.forEach((rec) => {
        if (rec.safety_score !== undefined) {
          expect(rec.safety_score).toBeGreaterThanOrEqual(0);
          expect(rec.safety_score).toBeLessThanOrEqual(1);
        }
      });
    });

    it('should handle locations with no nearby parking', async () => {
      // Middle of ocean
      const oceanLocation = {
        latitude: 0,
        longitude: 0,
      };

      const recommendations = await parkingRecommendations.getRecommendations(
        oceanLocation,
        { limit: 5, radiusMeters: 100 }
      );

      expect(Array.isArray(recommendations)).toBe(true);
      // Should return empty array or very few results
      expect(recommendations.length).toBeLessThanOrEqual(1);
    });

    it('should generate meaningful reasons for recommendations', async () => {
      const recommendations = await parkingRecommendations.getRecommendations(
        testDestination,
        { limit: 3 }
      );

      recommendations.forEach((rec) => {
        expect(rec.reasons.length).toBeGreaterThan(0);
        rec.reasons.forEach((reason) => {
          expect(typeof reason).toBe('string');
          expect(reason.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Integration: Complete Parking Flow', () => {
    it('should complete full parking save flow with fusion', async () => {
      // 1. Get fused location
      const fusedLocation = await locationFusion.getHighAccuracyLocation();
      expect(fusedLocation).toBeDefined();

      // 2. Get recommendations before parking
      const recommendations = await parkingRecommendations.getRecommendations(
        fusedLocation,
        { limit: 3 }
      );
      expect(recommendations.length).toBeGreaterThan(0);

      // 3. Save parking location
      const parkingData = {
        car_point: {
          coordinates: [fusedLocation.longitude, fusedLocation.latitude],
        },
        source: 'quick_park_button' as const,
        floor: fusedLocation.floor,
        venue_name: fusedLocation.venue_name,
        venue_id: fusedLocation.venue_id,
        is_active: true,
      };

      // Simulate saving (either directly or via offline queue)
      const { supabase } = require('../../lib/supabase-client');
      const { data, error } = await supabase
        .from('parking_sessions')
        .insert(parkingData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.id).toBeDefined();
    });

    it('should handle offline save gracefully', async () => {
      // Mock offline state
      const NetInfo = require('@react-native-community/netinfo');
      NetInfo.fetch.mockResolvedValueOnce({ isConnected: false });

      // Get location
      const fusedLocation = await locationFusion.getHighAccuracyLocation();

      // Try to save - should go to offline queue
      const parkingData = {
        car_point: {
          coordinates: [fusedLocation.longitude, fusedLocation.latitude],
        },
        source: 'manual' as const,
      };

      await offlineQueue.addToQueue({
        type: 'save_parking',
        data: parkingData,
        timestamp: Date.now(),
      });

      expect(offlineQueue['queue'].length).toBe(1);

      // Simulate coming back online
      NetInfo.fetch.mockResolvedValueOnce({ isConnected: true });

      // Sync queue
      await offlineQueue['syncQueue']();

      // Queue should be empty
      expect(offlineQueue['queue'].length).toBe(0);
    });
  });
});
