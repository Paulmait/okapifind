/**
 * SmartSuggestionsService Tests
 * Tests for stationary detection and suggestion triggering
 */

// Mock dependencies before importing the service
jest.mock('expo-location', () => ({
  getCurrentPositionAsync: jest.fn(),
  Accuracy: {
    High: 6,
  },
}));

jest.mock('../../services/savedPlacesService', () => ({
  savedPlacesService: {
    isWithinSavedPlaceGeofence: jest.fn(() => Promise.resolve({ isWithin: false })),
  },
}));

jest.mock('../../services/places.service', () => ({
  placesService: {
    nearbySearch: jest.fn(() => Promise.resolve([])),
  },
}));

import { smartSuggestionsService } from '../../services/smartSuggestionsService';
import * as Location from 'expo-location';
import { savedPlacesService } from '../../services/savedPlacesService';

describe('SmartSuggestionsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    smartSuggestionsService.stopMonitoring();
    smartSuggestionsService.resetDontAskAgain();
  });

  describe('setEnabled / getEnabled', () => {
    it('should toggle enabled state', () => {
      expect(smartSuggestionsService.getEnabled()).toBe(false);

      smartSuggestionsService.setEnabled(true);
      expect(smartSuggestionsService.getEnabled()).toBe(true);

      smartSuggestionsService.setEnabled(false);
      expect(smartSuggestionsService.getEnabled()).toBe(false);
    });
  });

  describe('startMonitoring / stopMonitoring', () => {
    it('should not start monitoring when disabled', () => {
      const callback = jest.fn();
      smartSuggestionsService.setEnabled(false);
      smartSuggestionsService.startMonitoring(callback);

      // Should not have called location API
      expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    });

    it('should start monitoring when enabled', () => {
      const callback = jest.fn();
      smartSuggestionsService.setEnabled(true);

      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
      });

      smartSuggestionsService.startMonitoring(callback);

      // Give it time to poll
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
          smartSuggestionsService.stopMonitoring();
          resolve();
        }, 100);
      });
    });

    it('should stop monitoring and clear queue', () => {
      const callback = jest.fn();
      smartSuggestionsService.setEnabled(true);
      smartSuggestionsService.startMonitoring(callback);
      smartSuggestionsService.stopMonitoring();

      // After stopping, further location calls should not trigger callback
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('dont ask again', () => {
    it('should track dont ask again locations', () => {
      const lat = 40.7128;
      const lng = -74.0060;

      expect(smartSuggestionsService.isDontAskAgain(lat, lng)).toBe(false);

      smartSuggestionsService.addDontAskAgain(lat, lng);
      expect(smartSuggestionsService.isDontAskAgain(lat, lng)).toBe(true);

      smartSuggestionsService.resetDontAskAgain();
      expect(smartSuggestionsService.isDontAskAgain(lat, lng)).toBe(false);
    });

    it('should match nearby locations with same precision', () => {
      smartSuggestionsService.addDontAskAgain(40.7128, -74.0060);

      // Same location with slightly different coordinates (within ~100m)
      expect(smartSuggestionsService.isDontAskAgain(40.7129, -74.0061)).toBe(true);

      // Different location
      expect(smartSuggestionsService.isDontAskAgain(41.0, -75.0)).toBe(false);
    });
  });

  describe('stationary detection', () => {
    it('should not suggest when near existing saved place', async () => {
      (savedPlacesService.isWithinSavedPlaceGeofence as jest.Mock).mockResolvedValue({
        isWithin: true,
        place: { id: '1', label: 'Existing Place' },
      });

      const callback = jest.fn();
      smartSuggestionsService.setEnabled(true);

      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
      });

      smartSuggestionsService.startMonitoring(callback);

      // Wait for poll cycle
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not trigger suggestion since we're near a saved place
      expect(callback).not.toHaveBeenCalled();

      smartSuggestionsService.stopMonitoring();
    });

    it('should reject low accuracy readings', async () => {
      const callback = jest.fn();
      smartSuggestionsService.setEnabled(true);

      // Return low accuracy reading
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 150, // > 100m threshold
        },
      });

      smartSuggestionsService.startMonitoring(callback);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not process low accuracy readings
      expect(callback).not.toHaveBeenCalled();

      smartSuggestionsService.stopMonitoring();
    });
  });
});
