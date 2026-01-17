// Jest setup file
// Note: Using node test environment to avoid window conflicts

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => ({
  Swipeable: 'Swipeable',
  DrawerLayout: 'DrawerLayout',
  State: {},
  ScrollView: 'ScrollView',
  Slider: 'Slider',
  Switch: 'Switch',
  TextInput: 'TextInput',
  ToolbarAndroid: 'ToolbarAndroid',
  ViewPagerAndroid: 'ViewPagerAndroid',
  DrawerLayoutAndroid: 'DrawerLayoutAndroid',
  WebView: 'WebView',
  NativeViewGestureHandler: 'NativeViewGestureHandler',
  TapGestureHandler: 'TapGestureHandler',
  FlingGestureHandler: 'FlingGestureHandler',
  ForceTouchGestureHandler: 'ForceTouchGestureHandler',
  LongPressGestureHandler: 'LongPressGestureHandler',
  PanGestureHandler: 'PanGestureHandler',
  PinchGestureHandler: 'PinchGestureHandler',
  RotationGestureHandler: 'RotationGestureHandler',
  RawButton: 'RawButton',
  BaseButton: 'BaseButton',
  RectButton: 'RectButton',
  BorderlessButton: 'BorderlessButton',
  FlatList: 'FlatList',
  gestureHandlerRootHOC: jest.fn(),
  Directions: {},
}));

// Mock expo modules
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {},
  },
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 0, longitude: 0, accuracy: 5 },
    timestamp: Date.now(),
  }),
  watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
  Accuracy: {
    Lowest: 1,
    Low: 2,
    Balanced: 3,
    High: 4,
    Highest: 5,
    BestForNavigation: 6,
  },
}));

jest.mock('expo-sensors', () => ({
  Magnetometer: {
    isAvailableAsync: jest.fn().mockResolvedValue(true),
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    setUpdateInterval: jest.fn(),
  },
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn().mockResolvedValue(false),
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn().mockResolvedValue(false),
  unregisterTaskAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'test-token' }),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  AndroidImportance: {
    MAX: 5,
    HIGH: 4,
    DEFAULT: 3,
    LOW: 2,
    MIN: 1,
  },
}));

jest.mock('expo-device', () => ({
  isDevice: true,
  brand: 'TestBrand',
  modelName: 'TestModel',
  osName: 'iOS',
  osVersion: '15.0',
}));

jest.mock('react-native-tts', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  setDefaultLanguage: jest.fn(),
  setDefaultRate: jest.fn(),
  setDefaultPitch: jest.fn(),
  voices: jest.fn().mockResolvedValue([]),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Firebase
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApp: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  signInWithCredential: jest.fn(),
  GoogleAuthProvider: {
    credential: jest.fn(),
  },
  OAuthProvider: jest.fn().mockImplementation(() => ({
    credential: jest.fn(),
  })),
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn(),
}));

// Sentry mock removed - sentry-expo disabled for SDK 54 compatibility

// Silence console during tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};