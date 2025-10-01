/**
 * MapScreen Tests
 * Tests core parking location functionality
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import MapScreen from '../MapScreen';
import { useCarLocation } from '../../hooks/useCarLocation';
import { useUserLocation } from '../../hooks/useUserLocation';

// Mock hooks
jest.mock('../../hooks/useCarLocation');
jest.mock('../../hooks/useUserLocation');
jest.mock('../../services/haptics', () => ({
  haptics: {
    success: jest.fn(),
    impact: jest.fn(),
  },
}));

describe('MapScreen', () => {
  const mockCarLocation = {
    latitude: 37.7749,
    longitude: -122.4194,
    timestamp: Date.now(),
  };

  const mockUserLocation = {
    latitude: 37.7750,
    longitude: -122.4195,
  };

  beforeEach(() => {
    (useCarLocation as jest.Mock).mockReturnValue({
      carLocation: null,
      saveCarLocation: jest.fn(),
      clearCarLocation: jest.fn(),
      isLoading: false,
    });

    (useUserLocation as jest.Mock).mockReturnValue({
      userLocation: mockUserLocation,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    const { getByText } = render(<MapScreen navigation={{} as any} route={{} as any} />);
    expect(getByText(/Set Car Location/i)).toBeTruthy();
  });

  it('displays save button when no car location is set', () => {
    const { getByText } = render(<MapScreen navigation={{} as any} route={{} as any} />);
    expect(getByText(/Set Car Location/i)).toBeTruthy();
  });

  it('saves car location on button press', async () => {
    const mockSave = jest.fn().mockResolvedValue(true);
    (useCarLocation as jest.Mock).mockReturnValue({
      carLocation: null,
      saveCarLocation: mockSave,
      clearCarLocation: jest.fn(),
      isLoading: false,
    });

    const { getByText } = render(<MapScreen navigation={{} as any} route={{} as any} />);
    const saveButton = getByText(/Set Car Location/i);

    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled With(mockUserLocation);
    });
  });

  it('shows distance when car location is set', () => {
    (useCarLocation as jest.Mock).mockReturnValue({
      carLocation: mockCarLocation,
      saveCarLocation: jest.fn(),
      clearCarLocation: jest.fn(),
      isLoading: false,
    });

    const { getByText } = render(<MapScreen navigation={{} as any} route={{} as any} />);
    expect(getByText(/m away/i)).toBeTruthy();
  });

  it('shows loading state', () => {
    (useCarLocation as jest.Mock).mockReturnValue({
      carLocation: null,
      saveCarLocation: jest.fn(),
      clearCarLocation: jest.fn(),
      isLoading: true,
    });

    const { getByTestId } = render(<MapScreen navigation={{} as any} route={{} as any} />);
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('handles location permission denial', () => {
    (useUserLocation as jest.Mock).mockReturnValue({
      userLocation: null,
      isLoading: false,
      error: 'Permission denied',
    });

    const { getByText } = render(<MapScreen navigation={{} as any} route={{} as any} />);
    expect(getByText(/enable location/i)).toBeTruthy();
  });

  it('clears car location', async () => {
    const mockClear = jest.fn();
    (useCarLocation as jest.Mock).mockReturnValue({
      carLocation: mockCarLocation,
      saveCarLocation: jest.fn(),
      clearCarLocation: mockClear,
      isLoading: false,
    });

    const { getByText } = render(<MapScreen navigation={{} as any} route={{} as any} />);
    const clearButton = getByText(/Clear/i);

    fireEvent.press(clearButton);

    await waitFor(() => {
      expect(mockClear).toHaveBeenCalled();
    });
  });
});
