/**
 * GuidanceScreen Tests
 * Tests navigation and guidance functionality
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import GuidanceScreen from '../GuidanceScreen';
import { useCarLocation } from '../../hooks/useCarLocation';
import { useUserLocation } from '../../hooks/useUserLocation';
import { useCompass } from '../../hooks/useCompass';

// Mock hooks
jest.mock('../../hooks/useCarLocation');
jest.mock('../../hooks/useUserLocation');
jest.mock('../../hooks/useCompass');
jest.mock('../../services/tts', () => ({
  tts: {
    speak: jest.fn(),
    stop: jest.fn(),
  },
}));

describe('GuidanceScreen', () => {
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
      carLocation: mockCarLocation,
    });

    (useUserLocation as jest.Mock).mockReturnValue({
      userLocation: mockUserLocation,
      isLoading: false,
    });

    (useCompass as jest.Mock).mockReturnValue({
      heading: 45,
      accuracy: 10,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    const { getByText } = render(<GuidanceScreen navigation={{} as any} route={{} as any} />);
    expect(getByText(/Finding your car/i)).toBeTruthy();
  });

  it('displays distance to car', () => {
    const { getByText } = render(<GuidanceScreen navigation={{} as any} route={{} as any} />);
    expect(getByText(/meters/i)).toBeTruthy();
  });

  it('shows compass direction', () => {
    const { getByTestId } = render(<GuidanceScreen navigation={{} as any} route={{} as any} />);
    expect(getByTestId('compass-arrow')).toBeTruthy();
  });

  it('provides voice guidance when enabled', async () => {
    const { getByText } = render(<GuidanceScreen navigation={{} as any} route={{} as any} />);
    const voiceButton = getByText(/Voice/i);

    fireEvent.press(voiceButton);

    await waitFor(() => {
      const tts = require('../../services/tts').tts;
      expect(tts.speak).toHaveBeenCalled();
    });
  });

  it('shows arrival message when very close', () => {
    (useUserLocation as jest.Mock).mockReturnValue({
      userLocation: {
        latitude: mockCarLocation.latitude,
        longitude: mockCarLocation.longitude,
      },
      isLoading: false,
    });

    const { getByText } = render(<GuidanceScreen navigation={{} as any} route={{} as any} />);
    expect(getByText(/You're here/i)).toBeTruthy();
  });

  it('redirects when no car location set', () => {
    const mockNavigate = jest.fn();
    (useCarLocation as jest.Mock).mockReturnValue({
      carLocation: null,
    });

    render(<GuidanceScreen navigation={{ navigate: mockNavigate } as any} route={{} as any} />);

    expect(mockNavigate).toHaveBeenCalledWith('Map');
  });
});
