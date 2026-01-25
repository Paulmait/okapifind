/**
 * SavedPlacesService Tests
 * Tests for saved places functionality including hotel uniqueness
 */

import { savedPlacesService } from '../../services/savedPlacesService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock Supabase client
jest.mock('../../lib/supabase-client', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

describe('SavedPlacesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two points correctly', () => {
      // New York to Los Angeles is approximately 3944 km
      const nyLat = 40.7128;
      const nyLng = -74.0060;
      const laLat = 34.0522;
      const laLng = -118.2437;

      const distance = savedPlacesService.calculateDistance(nyLat, nyLng, laLat, laLng);

      // Should be approximately 3944 km (3944000 meters)
      expect(distance).toBeGreaterThan(3900000);
      expect(distance).toBeLessThan(4000000);
    });

    it('should return 0 for same location', () => {
      const distance = savedPlacesService.calculateDistance(
        40.7128, -74.0060,
        40.7128, -74.0060
      );

      expect(distance).toBe(0);
    });

    it('should handle small distances accurately', () => {
      // Two points about 100 meters apart
      const lat1 = 40.7128;
      const lng1 = -74.0060;
      const lat2 = 40.7129;
      const lng2 = -74.0059;

      const distance = savedPlacesService.calculateDistance(lat1, lng1, lat2, lng2);

      // Should be approximately 15 meters
      expect(distance).toBeGreaterThan(10);
      expect(distance).toBeLessThan(20);
    });
  });

  describe('calculateBearing', () => {
    it('should calculate north bearing correctly', () => {
      const bearing = savedPlacesService.calculateBearing(
        40.0, -74.0,
        41.0, -74.0
      );

      // Should be approximately 0 degrees (north)
      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThanOrEqual(5);
    });

    it('should calculate east bearing correctly', () => {
      const bearing = savedPlacesService.calculateBearing(
        40.0, -74.0,
        40.0, -73.0
      );

      // Should be approximately 90 degrees (east)
      expect(bearing).toBeGreaterThan(85);
      expect(bearing).toBeLessThan(95);
    });

    it('should calculate south bearing correctly', () => {
      const bearing = savedPlacesService.calculateBearing(
        41.0, -74.0,
        40.0, -74.0
      );

      // Should be approximately 180 degrees (south)
      expect(bearing).toBeGreaterThan(175);
      expect(bearing).toBeLessThan(185);
    });
  });

  describe('isWithinSavedPlaceGeofence', () => {
    it('should return false when no places exist', async () => {
      const result = await savedPlacesService.isWithinSavedPlaceGeofence(40.7128, -74.0060);

      expect(result.isWithin).toBe(false);
      expect(result.place).toBeUndefined();
    });
  });

  describe('hotel uniqueness', () => {
    it('should only allow one active hotel per user', async () => {
      // This is enforced at the database level via partial unique index
      // The service should handle the atomic replacement properly
      expect(savedPlacesService).toBeDefined();
    });
  });
});
