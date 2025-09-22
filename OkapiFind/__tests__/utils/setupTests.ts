/**
 * Test Setup and Configuration
 */

import 'react-native-gesture-handler/jestSetup';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

// Import all mocks
import './../mocks/firebase.mock';
import './../mocks/supabase.mock';
import './../mocks/revenueCat.mock';
import './../mocks/expo.mock';

// Setup AsyncStorage mock
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock React Native modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');

  RN.NativeModules.StatusBarManager = {
    HEIGHT: 20,
    getHeight: jest.fn((callback) => callback({ height: 20 })),
  };

  RN.NativeModules.PlatformConstants = {
    forceTouchAvailable: false,
  };

  return Object.setPrototypeOf(
    {
      Platform: {
        ...RN.Platform,
        OS: 'ios',
        Version: '14.0',
        select: jest.fn((platforms) => platforms[RN.Platform.OS] || platforms.default),
      },
      Dimensions: {
        get: jest.fn(() => ({ width: 375, height: 667 })),
        set: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
      Alert: {
        alert: jest.fn(),
        prompt: jest.fn(),
      },
      Linking: {
        openURL: jest.fn(() => Promise.resolve()),
        canOpenURL: jest.fn(() => Promise.resolve(true)),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        getInitialURL: jest.fn(() => Promise.resolve(null)),
      },
      PermissionsAndroid: {
        check: jest.fn(() => Promise.resolve(true)),
        request: jest.fn(() => Promise.resolve('granted')),
        requestMultiple: jest.fn(() => Promise.resolve({})),
        PERMISSIONS: {
          ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
          ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION',
          CAMERA: 'android.permission.CAMERA',
          WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
          READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
        },
        RESULTS: {
          GRANTED: 'granted',
          DENIED: 'denied',
          NEVER_ASK_AGAIN: 'never_ask_again',
        },
      },
      StatusBar: {
        setBarStyle: jest.fn(),
        setHidden: jest.fn(),
        setBackgroundColor: jest.fn(),
        setTranslucent: jest.fn(),
      },
      Keyboard: {
        addListener: jest.fn(() => ({ remove: jest.fn() })),
        removeListener: jest.fn(),
        dismiss: jest.fn(),
      },
      AppState: {
        currentState: 'active',
        addEventListener: jest.fn(() => ({ remove: jest.fn() })),
        removeEventListener: jest.fn(),
      },
      NetInfo: {
        getCurrentState: jest.fn(() => Promise.resolve({ isConnected: true })),
        addEventListener: jest.fn(() => jest.fn()),
      },
    },
    RN
  );
});

// Mock react-navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
    reset: jest.fn(),
    canGoBack: jest.fn(() => false),
    isFocused: jest.fn(() => true),
    addListener: jest.fn(() => jest.fn()),
    removeListener: jest.fn(),
    setParams: jest.fn(),
    setOptions: jest.fn(),
  }),
  useRoute: () => ({
    key: 'test-route',
    name: 'TestScreen',
    params: {},
  }),
  useFocusEffect: jest.fn((callback) => {
    callback();
  }),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  useSafeAreaFrame: () => ({ width: 375, height: 667, x: 0, y: 0 }),
}));

// Mock zustand
jest.mock('zustand', () => ({
  create: jest.fn((createState) => {
    let state: any;
    const setState = jest.fn((partial) => {
      state = { ...state, ...partial };
    });
    const getState = jest.fn(() => state);
    state = createState(setState, getState);
    return () => state;
  }),
}));

// Mock react-native-maps
jest.mock('react-native-maps', () => ({
  __esModule: true,
  default: 'MapView',
  Marker: 'Marker',
  Callout: 'Callout',
  Circle: 'Circle',
  Polyline: 'Polyline',
  Polygon: 'Polygon',
  Overlay: 'Overlay',
  PROVIDER_GOOGLE: 'google',
  PROVIDER_DEFAULT: 'default',
}));

// Mock gesture handler
jest.mock('react-native-gesture-handler', () => ({
  PanGestureHandler: 'PanGestureHandler',
  TapGestureHandler: 'TapGestureHandler',
  LongPressGestureHandler: 'LongPressGestureHandler',
  PinchGestureHandler: 'PinchGestureHandler',
  RotationGestureHandler: 'RotationGestureHandler',
  FlingGestureHandler: 'FlingGestureHandler',
  ForceTouchGestureHandler: 'ForceTouchGestureHandler',
  NativeViewGestureHandler: 'NativeViewGestureHandler',
  RawButton: 'RawButton',
  BaseButton: 'BaseButton',
  RectButton: 'RectButton',
  BorderlessButton: 'BorderlessButton',
  TouchableOpacity: 'TouchableOpacity',
  TouchableHighlight: 'TouchableHighlight',
  TouchableNativeFeedback: 'TouchableNativeFeedback',
  TouchableWithoutFeedback: 'TouchableWithoutFeedback',
  ScrollView: 'ScrollView',
  Swipeable: 'Swipeable',
  DrawerLayout: 'DrawerLayout',
  State: {},
  Directions: {},
}));

// Global test configuration
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// Global error handler
global.console.error = jest.fn();
global.console.warn = jest.fn();

// Mock global functions
global.fetch = jest.fn();
global.FormData = jest.fn();
global.FileReader = jest.fn();

// Setup test environment
process.env.NODE_ENV = 'test';