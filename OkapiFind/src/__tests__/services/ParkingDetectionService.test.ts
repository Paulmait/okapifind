/**
 * ParkingDetectionService Tests
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import ParkingDetectionService, {
  ParkingEvent,
  ActivityState,
  DetectionSettings,
  FrequentLocation,
} from '../../services/ParkingDetectionService';

// Mock calculateDistance utility
jest.mock('../../utils/calculateDistance', () => ({
  calculateDistance: jest.fn((lat1, lon1, lat2, lon2) => {
    // Simple mock distance calculation
    const dx = lat2 - lat1;
    const dy = lon2 - lon1;
    return Math.sqrt(dx * dx + dy * dy) * 111000; // Convert to meters
  }),
}));

// Mock hooks
jest.mock('../../hooks/useCarLocation', () => ({
  CarLocation: {},
}));

describe('ParkingDetectionService', () => {
  let service: ParkingDetectionService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset AsyncStorage
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    // Reset Location mocks
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Location.watchPositionAsync as jest.Mock).mockResolvedValue({
      remove: jest.fn(),
    });
    (Location.startLocationUpdatesAsync as jest.Mock).mockResolvedValue(undefined);

    // Get fresh instance
    service = ParkingDetectionService.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ParkingDetectionService.getInstance();
      const instance2 = ParkingDetectionService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Initialization', () => {
    it('should initialize with default settings', async () => {
      await service.initialize();

      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    });

    it('should request background permissions when enabled', async () => {
      // Mock settings with background tracking enabled
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({
          enabled: true,
          backgroundTracking: true,
          autoSave: false,
          minConfidence: 0.7,
          notifyOnDetection: true,
          useGeofencing: true,
          frequentLocationsEnabled: true,
        })
      );

      await service.initialize();

      expect(Location.requestBackgroundPermissionsAsync).toHaveBeenCalled();
    });

    it('should handle permission denial', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const result = await service['requestPermissions']();

      expect(result).toBe(false);
    });

    it('should disable background tracking if permission denied', async () => {
      (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      // Mock settings with background tracking enabled
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({
          enabled: true,
          backgroundTracking: true,
          autoSave: false,
          minConfidence: 0.7,
          notifyOnDetection: true,
          useGeofencing: true,
          frequentLocationsEnabled: true,
        })
      );

      await service.initialize();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@OkapiFind:detectionSettings',
        expect.stringContaining('"backgroundTracking":false')
      );
    });
  });

  describe('Foreground Tracking', () => {
    it('should start foreground tracking', async () => {
      await service.startForegroundTracking();

      expect(Location.watchPositionAsync).toHaveBeenCalledWith(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        expect.any(Function)
      );
    });

    it('should not start tracking if already tracking', async () => {
      // Start tracking first time
      await service.startForegroundTracking();
      jest.clearAllMocks();

      // Try to start again
      await service.startForegroundTracking();

      expect(Location.watchPositionAsync).not.toHaveBeenCalled();
    });

    it('should handle foreground tracking errors', async () => {
      const error = new Error('Location error');
      (Location.watchPositionAsync as jest.Mock).mockRejectedValue(error);

      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      await service.startForegroundTracking();

      expect(consoleError).toHaveBeenCalledWith('Error starting foreground tracking:', error);
      expect(service['isTracking']).toBe(false);

      consoleError.mockRestore();
    });
  });

  describe('Background Tracking', () => {
    it('should skip background tracking on web', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'web' });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.startBackgroundTracking();

      expect(consoleSpy).toHaveBeenCalledWith('Background tracking not supported on web');
      expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should start background tracking on mobile', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios' });

      await service.startBackgroundTracking();

      expect(TaskManager.defineTask).toHaveBeenCalled();
      expect(Location.startLocationUpdatesAsync).toHaveBeenCalled();
    });
  });

  describe('Location Updates', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should process location update', async () => {
      const mockLocation = {
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          speed: 0,
        },
        timestamp: Date.now(),
      };

      await service.startForegroundTracking();

      // Get the callback function that was passed to watchPositionAsync
      const callback = (Location.watchPositionAsync as jest.Mock).mock.calls[0][1];

      // Call the callback with mock location
      callback(mockLocation);

      expect(service['lastKnownLocation']).toEqual(mockLocation);
    });

    it('should detect potential parking when speed drops', async () => {
      const drivingLocation = {
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          speed: 10, // driving speed
        },
        timestamp: Date.now(),
      };

      const stoppedLocation = {
        coords: {
          latitude: 37.7750,
          longitude: -122.4195,
          accuracy: 5,
          speed: 0, // stopped
        },
        timestamp: Date.now() + 1000,
      };

      await service.startForegroundTracking();
      const callback = (Location.watchPositionAsync as jest.Mock).mock.calls[0][1];

      // First location: driving
      callback(drivingLocation);
      expect(service['potentialParkingLocation']).toBeNull();

      // Second location: stopped
      callback(stoppedLocation);
      expect(service['potentialParkingLocation']).toEqual(stoppedLocation);
    });

    it('should confirm parking after sufficient stop time', async () => {
      const parkingLocation = {
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          speed: 0,
        },
        timestamp: Date.now(),
      };

      await service.startForegroundTracking();
      const callback = (Location.watchPositionAsync as jest.Mock).mock.calls[0][1];

      // Set potential parking location
      service['potentialParkingLocation'] = parkingLocation;
      service['parkingStartTime'] = new Date(Date.now() - 6 * 60 * 1000); // 6 minutes ago

      // Continue sending same location
      callback(parkingLocation);

      // Fast forward time
      jest.advanceTimersByTime(10000);

      // Should have triggered parking detection
      expect(service['potentialParkingLocation']).not.toBeNull();
    });
  });

  describe('Manual Parking Detection', () => {
    it('should save manual parking event', async () => {
      const location = {
        latitude: 37.7749,
        longitude: -122.4194,
      };

      const savedEvent = await service.saveParkingLocation(location, 'Manual parking');

      expect(savedEvent).toBeDefined();
      expect(savedEvent.location).toEqual(location);
      expect(savedEvent.notes).toBe('Manual parking');
      expect(savedEvent.detectionMethod).toBe('manual');
      expect(savedEvent.isConfirmed).toBe(true);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@OkapiFind:parkingHistory',
        expect.any(String)
      );
    });

    it('should generate unique ID for parking event', async () => {
      const location = {
        latitude: 37.7749,
        longitude: -122.4194,
      };

      const event1 = await service.saveParkingLocation(location);
      const event2 = await service.saveParkingLocation(location);

      expect(event1.id).not.toBe(event2.id);
    });
  });

  describe('Settings Management', () => {
    it('should load default settings when none exist', async () => {
      await service['loadSettings']();

      const settings = service['settings'];
      expect(settings.enabled).toBe(true);
      expect(settings.autoSave).toBe(false);
      expect(settings.minConfidence).toBe(0.7);
    });

    it('should load saved settings', async () => {
      const savedSettings = {
        enabled: false,
        autoSave: true,
        minConfidence: 0.8,
        notifyOnDetection: false,
        useGeofencing: false,
        frequentLocationsEnabled: false,
        backgroundTracking: true,
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(savedSettings)
      );

      await service['loadSettings']();

      expect(service['settings']).toEqual(savedSettings);
    });

    it('should update settings', async () => {
      const newSettings: Partial<DetectionSettings> = {
        enabled: false,
        autoSave: true,
      };

      await service.updateSettings(newSettings);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@OkapiFind:detectionSettings',
        expect.stringContaining('"enabled":false')
      );
      expect(service['settings'].enabled).toBe(false);
      expect(service['settings'].autoSave).toBe(true);
    });
  });

  describe('Parking History', () => {
    it('should retrieve parking history', async () => {
      const mockHistory: ParkingEvent[] = [
        {
          id: '1',
          location: { latitude: 37.7749, longitude: -122.4194 },
          timestamp: new Date(),
          confidence: 0.9,
          detectionMethod: 'manual',
          isConfirmed: true,
        },
        {
          id: '2',
          location: { latitude: 37.7750, longitude: -122.4195 },
          timestamp: new Date(),
          confidence: 0.8,
          detectionMethod: 'automatic',
          isConfirmed: false,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockHistory)
      );

      const history = await service.getParkingHistory();

      expect(history).toEqual(mockHistory);
    });

    it('should return empty array when no history exists', async () => {
      const history = await service.getParkingHistory();
      expect(history).toEqual([]);
    });

    it('should handle corrupted history data', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid-json');

      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const history = await service.getParkingHistory();

      expect(history).toEqual([]);
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });

    it('should delete parking event', async () => {
      const mockHistory: ParkingEvent[] = [
        {
          id: '1',
          location: { latitude: 37.7749, longitude: -122.4194 },
          timestamp: new Date(),
          confidence: 0.9,
          detectionMethod: 'manual',
          isConfirmed: true,
        },
        {
          id: '2',
          location: { latitude: 37.7750, longitude: -122.4195 },
          timestamp: new Date(),
          confidence: 0.8,
          detectionMethod: 'automatic',
          isConfirmed: false,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockHistory)
      );

      await service.deleteParkingEvent('1');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@OkapiFind:parkingHistory',
        JSON.stringify([mockHistory[1]])
      );
    });
  });

  describe('Frequent Locations', () => {
    it('should analyze frequent locations', async () => {
      const mockHistory: ParkingEvent[] = [
        {
          id: '1',
          location: { latitude: 37.7749, longitude: -122.4194 },
          timestamp: new Date(Date.now() - 86400000), // 1 day ago
          duration: 60,
          confidence: 0.9,
          detectionMethod: 'manual',
          isConfirmed: true,
        },
        {
          id: '2',
          location: { latitude: 37.7750, longitude: -122.4195 },
          timestamp: new Date(Date.now() - 172800000), // 2 days ago
          duration: 120,
          confidence: 0.8,
          detectionMethod: 'manual',
          isConfirmed: true,
        },
        {
          id: '3',
          location: { latitude: 37.7749, longitude: -122.4194 },
          timestamp: new Date(Date.now() - 259200000), // 3 days ago
          duration: 90,
          confidence: 0.9,
          detectionMethod: 'manual',
          isConfirmed: true,
        },
      ];

      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify(mockHistory)) // for getParkingHistory
        .mockResolvedValueOnce(null); // for existing frequent locations

      await service.analyzeFrequentLocations();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@OkapiFind:frequentLocations',
        expect.any(String)
      );
    });

    it('should retrieve frequent locations', async () => {
      const mockLocations: FrequentLocation[] = [
        {
          id: '1',
          location: { latitude: 37.7749, longitude: -122.4194 },
          visitCount: 5,
          lastVisit: new Date(),
          averageDuration: 90,
          type: 'home',
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockLocations)
      );

      const locations = await service.getFrequentLocations();

      expect(locations).toEqual(mockLocations);
    });
  });

  describe('Activity Detection', () => {
    it('should update activity state', () => {
      const activityState: ActivityState = {
        type: 'driving',
        confidence: 0.9,
        timestamp: new Date(),
      };

      service.updateActivityState(activityState);

      expect(service['currentActivity']).toEqual(activityState);
    });

    it('should detect parking from activity change', () => {
      const drivingActivity: ActivityState = {
        type: 'driving',
        confidence: 0.9,
        timestamp: new Date(),
      };

      const stillActivity: ActivityState = {
        type: 'still',
        confidence: 0.8,
        timestamp: new Date(),
      };

      service.updateActivityState(drivingActivity);
      service.updateActivityState(stillActivity);

      // Should detect potential parking transition
      expect(service['currentActivity']).toEqual(stillActivity);
    });
  });

  describe('Error Handling', () => {
    it('should handle AsyncStorage errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );

      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const history = await service.getParkingHistory();

      expect(history).toEqual([]);
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });

    it('should handle location permission errors', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockRejectedValue(
        new Error('Permission error')
      );

      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const result = await service['requestPermissions']();

      expect(result).toBe(false);
      expect(consoleError).toHaveBeenCalledWith(
        'Error requesting permissions:',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });

  describe('Geofencing', () => {
    it('should start geofencing for frequent locations', async () => {
      const mockLocations: FrequentLocation[] = [
        {
          id: '1',
          location: { latitude: 37.7749, longitude: -122.4194 },
          visitCount: 5,
          lastVisit: new Date(),
          averageDuration: 90,
          type: 'home',
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockLocations)
      );

      await service.startGeofencing();

      expect(Location.startGeofencingAsync).toHaveBeenCalled();
    });

    it('should handle geofencing not available', async () => {
      (Location.hasStartedGeofencingAsync as jest.Mock).mockResolvedValue(false);
      (Location.startGeofencingAsync as jest.Mock).mockRejectedValue(
        new Error('Geofencing not available')
      );

      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      await service.startGeofencing();

      expect(consoleError).toHaveBeenCalledWith(
        'Error starting geofencing:',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('should stop all tracking', async () => {
      // Start tracking first
      await service.startForegroundTracking();

      // Mock the subscription
      const mockSubscription = { remove: jest.fn() };
      service['locationSubscription'] = mockSubscription;

      await service.stopTracking();

      expect(mockSubscription.remove).toHaveBeenCalled();
      expect(Location.stopLocationUpdatesAsync).toHaveBeenCalled();
      expect(service['isTracking']).toBe(false);
    });

    it('should clear parking detection state', () => {
      // Set some state
      service['potentialParkingLocation'] = {
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
        },
        timestamp: Date.now(),
      };
      service['parkingStartTime'] = new Date();

      service.clearPotentialParking();

      expect(service['potentialParkingLocation']).toBeNull();
      expect(service['parkingStartTime']).toBeNull();
    });
  });
});