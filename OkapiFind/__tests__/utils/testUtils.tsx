/**
 * Test Utilities
 * Provides reusable testing utilities and helpers
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Mock navigation for testing
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
  reset: jest.fn(),
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
  setParams: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  removeListener: jest.fn(),
};

const mockRoute = {
  key: 'test-route-key',
  name: 'TestScreen',
  params: {},
  path: undefined,
};

// Test wrapper component that provides navigation and safe area context
interface TestWrapperProps {
  children: React.ReactNode;
  initialRouteName?: string;
}

const TestWrapper: React.FC<TestWrapperProps> = ({ children, initialRouteName = 'Home' }) => {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {children}
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

// Custom render function that includes providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    initialRouteName?: string;
  }
) => {
  const { initialRouteName, ...renderOptions } = options || {};

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestWrapper initialRouteName={initialRouteName}>
      {children}
    </TestWrapper>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Test data factories
export const createMockUser = (overrides = {}) => ({
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
  providerId: 'google.com',
  ...overrides,
});

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

export const createMockNotification = (overrides = {}) => ({
  identifier: 'notification-123',
  title: 'Test Notification',
  body: 'This is a test notification',
  data: {},
  date: new Date(),
  ...overrides,
});

// Mock AsyncStorage helpers
export const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
  clear: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
};

// Timer helpers for testing
export const advanceTimersByTime = (ms: number) => {
  jest.advanceTimersByTime(ms);
};

export const runAllTimers = () => {
  jest.runAllTimers();
};

export const runOnlyPendingTimers = () => {
  jest.runOnlyPendingTimers();
};

// Promise helpers
export const flushPromises = () => new Promise(setImmediate);

export const waitForAsync = async (callback: () => void | Promise<void>) => {
  await callback();
  await flushPromises();
};

// Error boundary for testing error scenarios
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class TestErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

// Custom matchers
export const expectToHaveBeenCalledWithObject = (
  mockFn: jest.MockedFunction<any>,
  expectedObject: any
) => {
  expect(mockFn).toHaveBeenCalledWith(
    expect.objectContaining(expectedObject)
  );
};

export const expectToHaveBeenCalledWithArray = (
  mockFn: jest.MockedFunction<any>,
  expectedArray: any[]
) => {
  expect(mockFn).toHaveBeenCalledWith(
    expect.arrayContaining(expectedArray)
  );
};

// Re-export everything from testing library
export * from '@testing-library/react-native';

// Override the default render
export { customRender as render };

// Export navigation mocks
export { mockNavigation, mockRoute };