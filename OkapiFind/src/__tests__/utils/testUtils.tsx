/**
 * Test Utilities for React Native Testing
 */

import React from 'react';
import { render, fireEvent, waitFor, screen, RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Re-export testing library utilities
export { render, fireEvent, waitFor, screen };

// Create a mock store for testing (Zustand-compatible)
interface MockStoreState {
  auth?: Record<string, unknown>;
  parking?: Record<string, unknown>;
  user?: Record<string, unknown>;
}

const createMockStore = (initialState: MockStoreState = {}) => {
  return {
    getState: () => initialState,
    setState: jest.fn(),
    subscribe: jest.fn(() => jest.fn()),
    destroy: jest.fn(),
  };
};

// Render with providers
export const renderWithProviders = (
  component: React.ReactElement,
  options: {
    initialState?: MockStoreState;
  } & Omit<RenderOptions, 'wrapper'> = {}
) => {
  const { initialState, ...renderOptions } = options;

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <SafeAreaProvider>
      <NavigationContainer>
        {children}
      </NavigationContainer>
    </SafeAreaProvider>
  );

  return render(component, { wrapper: Wrapper, ...renderOptions });
};

// Mock navigation
export const createMockNavigation = () => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
  reset: jest.fn(),
  setParams: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  removeListener: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => false),
  getId: jest.fn(() => 'test-screen'),
  getParent: jest.fn(),
  getState: jest.fn(() => ({
    routes: [],
    index: 0,
    key: 'test-key',
    routeNames: [],
    history: [],
    stale: false,
    type: 'stack',
  })),
});

// Mock route
export const createMockRoute = <T extends Record<string, unknown> = Record<string, unknown>>(params: T = {} as T) => ({
  key: 'test-route',
  name: 'TestScreen',
  params,
});

// Wait for async operations
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// Flush all promises
export const flushPromises = () => new Promise(setImmediate);

// Mock async storage
export const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
};

// Mock location data
export const createMockLocation = (overrides = {}) => ({
  latitude: 37.7749,
  longitude: -122.4194,
  altitude: 0,
  accuracy: 5,
  heading: 0,
  speed: 0,
  timestamp: Date.now(),
  ...overrides,
});

// Mock user data
export const createMockUser = (overrides = {}) => ({
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
  providerId: 'google.com',
  ...overrides,
});

// Mock parking spot
export const createMockParkingSpot = (overrides = {}) => ({
  id: 'parking-spot-123',
  latitude: 37.7749,
  longitude: -122.4194,
  timestamp: new Date().toISOString(),
  address: '123 Main St, San Francisco, CA',
  notes: 'Near the coffee shop',
  photoUri: null,
  isTimerActive: false,
  timerEndTime: null,
  reminderMinutes: 60,
  ...overrides,
});

export { createMockStore };
