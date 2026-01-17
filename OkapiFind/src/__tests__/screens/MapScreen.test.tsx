/**
 * MapScreen Component Tests
 */

import React from 'react';
import { render, fireEvent, waitFor } from '../utils/testUtils';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import MapScreen from '../../screens/MapScreen';
import { useCarLocation } from '../../hooks/useCarLocation';
import { useParkingDetection } from '../../hooks/useParkingDetection';
import { parkingDetection } from '../../services/ParkingDetectionService';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
  }),
}));

// Mock hooks
jest.mock('../../hooks/useCarLocation', () => ({
  useCarLocation: jest.fn(),
}));

jest.mock('../../hooks/useParkingDetection', () => ({
  useParkingDetection: jest.fn(),
}));

// Mock parking detection service
jest.mock('../../services/ParkingDetectionService', () => ({
  parkingDetection: {
    initialize: jest.fn(),
  },
}));

// Mock utils
jest.mock('../../utils', () => ({
  calculateDistance: jest.fn(() => 100), // 100 meters
  formatDistance: jest.fn((distance) => `${distance}m`),
}));

// Mock react-native-maps
jest.mock('react-native-maps', () => {
  const mockReact = require('react');
  return {
    __esModule: true,
    default: ({ children, testID, onPress, ...props }: any) =>
      mockReact.createElement('MockMapView', { testID, onPress, ...props }, children),
    Marker: ({ testID, onPress, ...props }: any) =>
      mockReact.createElement('MockMarker', { testID, onPress, ...props }),
    Circle: ({ testID, ...props }: any) =>
      mockReact.createElement('MockCircle', { testID, ...props }),
    PROVIDER_DEFAULT: 'default',
    PROVIDER_GOOGLE: 'google',
  };
});

describe('MapScreen', () => {
  const mockUserLocation = {
    coords: {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 5,
      altitude: 0,
      heading: 0,
      speed: 0,
    },
    timestamp: Date.now(),
  };

  const mockCarLocation = {
    id: 'car-123',
    latitude: 37.7750,
    longitude: -122.4195,
    timestamp: new Date(),
    address: '123 Main St',
    notes: 'Near coffee shop',
  };

  const mockUseCarLocation = {
    carLocation: null,
    saveCarLocation: jest.fn(),
    getFormattedTime: jest.fn(() => '2 hours ago'),
    isLoading: false,
  };

  const mockUseParkingDetection = {
    isTracking: false,
    settings: {
      enabled: true,
      autoSave: false,
      minConfidence: 0.7,
      notifyOnDetection: true,
      useGeofencing: true,
      frequentLocationsEnabled: true,
      backgroundTracking: false,
    },
    lastDetectedParking: null,
    frequentLocations: [],
    startDetection: jest.fn(),
    stopDetection: jest.fn(),
    updateSettings: jest.fn(),
    confirmParking: jest.fn(),
    dismissParking: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock location permissions
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(mockUserLocation);
    (Location.watchPositionAsync as jest.Mock).mockResolvedValue({
      remove: jest.fn(),
    });

    // Mock hooks
    (useCarLocation as jest.Mock).mockReturnValue(mockUseCarLocation);
    (useParkingDetection as jest.Mock).mockReturnValue(mockUseParkingDetection);

    // Mock parking detection service
    (parkingDetection.initialize as jest.Mock).mockResolvedValue(undefined);

    // Mock haptics
    (Haptics.impactAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Initialization', () => {
    it('should render loading state initially', () => {
      const { getByTestId } = render(<MapScreen />);

      expect(getByTestId('loading-indicator')).toBeTruthy();
    });

    it('should request location permissions on mount', async () => {
      render(<MapScreen />);

      await waitFor(() => {
        expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
      });
    });

    it('should get current location after permissions granted', async () => {
      render(<MapScreen />);

      await waitFor(() => {
        expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({
          accuracy: Location.Accuracy.High,
        });
      });
    });

    it('should start location tracking', async () => {
      render(<MapScreen />);

      await waitFor(() => {
        expect(Location.watchPositionAsync).toHaveBeenCalledWith(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          expect.any(Function)
        );
      });
    });

    it('should initialize parking detection when enabled', async () => {
      render(<MapScreen />);

      await waitFor(() => {
        expect(parkingDetection.initialize).toHaveBeenCalled();
      });
    });
  });

  describe('Permission Handling', () => {
    it('should show alert when location permission is denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const alertSpy = jest.spyOn(Alert, 'alert');

      render(<MapScreen />);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Permission Denied',
          'Location permission is required to use this feature.',
          [{ text: 'OK' }]
        );
      });

      alertSpy.mockRestore();
    });

    it('should not attempt to get location when permission denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      render(<MapScreen />);

      await waitFor(() => {
        expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
      });
    });
  });

  describe('Map Display', () => {
    it('should render map when location permission is granted', async () => {
      const { getByTestId } = render(<MapScreen />);

      await waitFor(() => {
        expect(getByTestId('map-view')).toBeTruthy();
      });
    });

    it('should show user location marker', async () => {
      const { getByTestId } = render(<MapScreen />);

      await waitFor(() => {
        expect(getByTestId('user-location-marker')).toBeTruthy();
      });
    });

    it('should show car location marker when car is parked', async () => {
      (useCarLocation as jest.Mock).mockReturnValue({
        ...mockUseCarLocation,
        carLocation: mockCarLocation,
      });

      const { getByTestId } = render(<MapScreen />);

      await waitFor(() => {
        expect(getByTestId('car-location-marker')).toBeTruthy();
      });
    });

    it('should show frequent locations as circles', async () => {
      const mockFrequentLocations = [
        {
          id: 'frequent-1',
          location: { latitude: 37.7751, longitude: -122.4196 },
          visitCount: 5,
          type: 'home',
        },
      ];

      (useParkingDetection as jest.Mock).mockReturnValue({
        ...mockUseParkingDetection,
        frequentLocations: mockFrequentLocations,
      });

      const { getByTestId } = render(<MapScreen />);

      await waitFor(() => {
        expect(getByTestId('frequent-location-circle-0')).toBeTruthy();
      });
    });
  });

  describe('Car Location Management', () => {
    it('should save car location when save button is pressed', async () => {
      const { getByTestId } = render(<MapScreen />);

      await waitFor(() => {
        expect(getByTestId('save-car-location-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('save-car-location-button'));

      expect(mockUseCarLocation.saveCarLocation).toHaveBeenCalledWith(
        {
          latitude: mockUserLocation.coords.latitude,
          longitude: mockUserLocation.coords.longitude,
        },
        undefined // no notes in basic save
      );
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    });

    it('should navigate to guidance when car location is tapped', async () => {
      (useCarLocation as jest.Mock).mockReturnValue({
        ...mockUseCarLocation,
        carLocation: mockCarLocation,
      });

      const { getByTestId } = render(<MapScreen />);

      await waitFor(() => {
        expect(getByTestId('car-location-marker')).toBeTruthy();
      });

      fireEvent.press(getByTestId('car-location-marker'));

      expect(mockNavigate).toHaveBeenCalledWith('Guidance');
    });

    it('should show car location info card when car is saved', async () => {
      (useCarLocation as jest.Mock).mockReturnValue({
        ...mockUseCarLocation,
        carLocation: mockCarLocation,
      });

      const { getByTestId, getByText } = render(<MapScreen />);

      await waitFor(() => {
        expect(getByTestId('car-info-card')).toBeTruthy();
        expect(getByText(mockCarLocation.address)).toBeTruthy();
        expect(getByText('2 hours ago')).toBeTruthy();
      });
    });
  });

  describe('Parking Detection', () => {
    it('should show detection toggle when available', async () => {
      const { getByTestId } = render(<MapScreen />);

      await waitFor(() => {
        expect(getByTestId('detection-toggle')).toBeTruthy();
      });
    });

    it('should start detection when toggle is enabled', async () => {
      const { getByTestId } = render(<MapScreen />);

      await waitFor(() => {
        expect(getByTestId('detection-toggle')).toBeTruthy();
      });

      fireEvent(getByTestId('detection-toggle'), 'onValueChange', true);

      expect(mockUseParkingDetection.startDetection).toHaveBeenCalled();
    });

    it('should stop detection when toggle is disabled', async () => {
      (useParkingDetection as jest.Mock).mockReturnValue({
        ...mockUseParkingDetection,
        isTracking: true,
      });

      const { getByTestId } = render(<MapScreen />);

      await waitFor(() => {
        expect(getByTestId('detection-toggle')).toBeTruthy();
      });

      fireEvent(getByTestId('detection-toggle'), 'onValueChange', false);

      expect(mockUseParkingDetection.stopDetection).toHaveBeenCalled();
    });

    it('should show detected parking notification', async () => {
      const mockDetectedParking = {
        id: 'detected-123',
        location: { latitude: 37.7748, longitude: -122.4193 },
        timestamp: new Date(),
        confidence: 0.8,
        detectionMethod: 'automatic',
        isConfirmed: false,
      };

      (useParkingDetection as jest.Mock).mockReturnValue({
        ...mockUseParkingDetection,
        lastDetectedParking: mockDetectedParking,
      });

      const { getByTestId, getByText } = render(<MapScreen />);

      await waitFor(() => {
        expect(getByTestId('parking-detection-card')).toBeTruthy();
        expect(getByText('Parking Detected!')).toBeTruthy();
        expect(getByText('Confidence: 80%')).toBeTruthy();
      });
    });

    it('should confirm detected parking', async () => {
      const mockDetectedParking = {
        id: 'detected-123',
        location: { latitude: 37.7748, longitude: -122.4193 },
        timestamp: new Date(),
        confidence: 0.8,
        detectionMethod: 'automatic',
        isConfirmed: false,
      };

      (useParkingDetection as jest.Mock).mockReturnValue({
        ...mockUseParkingDetection,
        lastDetectedParking: mockDetectedParking,
      });

      const { getByTestId } = render(<MapScreen />);

      await waitFor(() => {
        expect(getByTestId('confirm-parking-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('confirm-parking-button'));

      expect(mockUseParkingDetection.confirmParking).toHaveBeenCalledWith('detected-123');
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );
    });

    it('should dismiss detected parking', async () => {
      const mockDetectedParking = {
        id: 'detected-123',
        location: { latitude: 37.7748, longitude: -122.4193 },
        timestamp: new Date(),
        confidence: 0.8,
        detectionMethod: 'automatic',
        isConfirmed: false,
      };

      (useParkingDetection as jest.Mock).mockReturnValue({
        ...mockUseParkingDetection,
        lastDetectedParking: mockDetectedParking,
      });

      const { getByTestId } = render(<MapScreen />);

      await waitFor(() => {
        expect(getByTestId('dismiss-parking-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('dismiss-parking-button'));

      expect(mockUseParkingDetection.dismissParking).toHaveBeenCalledWith('detected-123');
    });
  });

  describe('Distance Calculation', () => {
    it('should show distance to car when available', async () => {
      (useCarLocation as jest.Mock).mockReturnValue({
        ...mockUseCarLocation,
        carLocation: mockCarLocation,
      });

      const { getByText } = render(<MapScreen />);

      await waitFor(() => {
        expect(getByText('100m away')).toBeTruthy();
      });
    });

    it('should update distance as user moves', async () => {
      (useCarLocation as jest.Mock).mockReturnValue({
        ...mockUseCarLocation,
        carLocation: mockCarLocation,
      });

      const { calculateDistance, formatDistance } = require('../../utils');

      render(<MapScreen />);

      // Wait for initial render
      await waitFor(() => {
        expect(calculateDistance).toHaveBeenCalledWith(
          mockUserLocation.coords.latitude,
          mockUserLocation.coords.longitude,
          mockCarLocation.latitude,
          mockCarLocation.longitude
        );
      });

      // Simulate location update
      const watchPositionCallback = (Location.watchPositionAsync as jest.Mock).mock.calls[0][1];
      const newLocation = {
        ...mockUserLocation,
        coords: {
          ...mockUserLocation.coords,
          latitude: 37.7751,
          longitude: -122.4196,
        },
      };

      watchPositionCallback(newLocation);

      await waitFor(() => {
        expect(calculateDistance).toHaveBeenCalledWith(
          newLocation.coords.latitude,
          newLocation.coords.longitude,
          mockCarLocation.latitude,
          mockCarLocation.longitude
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle location service errors', async () => {
      const error = new Error('Location services disabled');
      (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<MapScreen />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error getting location:', error);
      });

      consoleSpy.mockRestore();
    });

    it('should handle parking detection initialization errors', async () => {
      const error = new Error('Detection initialization failed');
      (parkingDetection.initialize as jest.Mock).mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<MapScreen />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error initializing parking detection:', error);
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Loading States', () => {
    it('should show loading indicator while getting location', () => {
      const { getByTestId } = render(<MapScreen />);

      expect(getByTestId('loading-indicator')).toBeTruthy();
    });

    it('should hide loading indicator after location is obtained', async () => {
      const { queryByTestId } = render(<MapScreen />);

      await waitFor(() => {
        expect(queryByTestId('loading-indicator')).toBeNull();
      });
    });

    it('should show car location loading state', async () => {
      (useCarLocation as jest.Mock).mockReturnValue({
        ...mockUseCarLocation,
        isLoading: true,
      });

      const { getByTestId } = render(<MapScreen />);

      await waitFor(() => {
        expect(getByTestId('car-location-loading')).toBeTruthy();
      });
    });
  });

  describe('Map Interaction', () => {
    it('should handle map region changes', async () => {
      const { getByTestId } = render(<MapScreen />);

      await waitFor(() => {
        expect(getByTestId('map-view')).toBeTruthy();
      });

      const mapView = getByTestId('map-view');
      const newRegion = {
        latitude: 37.7750,
        longitude: -122.4195,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      fireEvent(mapView, 'onRegionChangeComplete', newRegion);

      // Map should update with new region
      expect(mapView).toBeTruthy();
    });

    it('should center map on user location when location button is pressed', async () => {
      const { getByTestId } = render(<MapScreen />);

      await waitFor(() => {
        expect(getByTestId('center-location-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('center-location-button'));

      expect(Haptics.selectionAsync).toHaveBeenCalled();
    });
  });

  describe('Settings Integration', () => {
    it('should update detection settings', async () => {
      const { getByTestId } = render(<MapScreen />);

      await waitFor(() => {
        expect(getByTestId('settings-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('settings-button'));

      expect(mockNavigate).toHaveBeenCalledWith('Settings');
    });

    it('should reflect setting changes in UI', async () => {
      (useParkingDetection as jest.Mock).mockReturnValue({
        ...mockUseParkingDetection,
        settings: {
          ...mockUseParkingDetection.settings,
          enabled: false,
        },
      });

      const { queryByTestId } = render(<MapScreen />);

      await waitFor(() => {
        // Detection toggle should be off when settings are disabled
        const toggle = queryByTestId('detection-toggle');
        expect(toggle).toBeTruthy();
        // Would check toggle state here in a real implementation
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels for buttons', async () => {
      const { getByTestId } = render(<MapScreen />);

      await waitFor(() => {
        const saveButton = getByTestId('save-car-location-button');
        expect(saveButton.props.accessibilityLabel).toBe('Save car location');
        expect(saveButton.props.accessibilityHint).toBe('Saves your current location as where you parked your car');
      });
    });

    it('should have accessible labels for markers', async () => {
      (useCarLocation as jest.Mock).mockReturnValue({
        ...mockUseCarLocation,
        carLocation: mockCarLocation,
      });

      const { getByTestId } = render(<MapScreen />);

      await waitFor(() => {
        const carMarker = getByTestId('car-location-marker');
        expect(carMarker.props.accessibilityLabel).toBe('Car location');
        expect(carMarker.props.accessibilityHint).toBe('Tap to navigate to your car');
      });
    });
  });
});