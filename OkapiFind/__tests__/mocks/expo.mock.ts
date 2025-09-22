/**
 * Expo Modules Mock for Testing
 */

export const mockExpoNotifications = {
  setNotificationHandler: jest.fn(),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'mock-expo-push-token' })),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('mock-notification-id')),
  cancelScheduledNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
  dismissAllNotificationsAsync: jest.fn(),
  getPresentedNotificationsAsync: jest.fn(() => Promise.resolve([])),
  getBadgeCountAsync: jest.fn(() => Promise.resolve(0)),
  setBadgeCountAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  removeNotificationSubscription: jest.fn(),
};

export const mockExpoLocation = {
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestBackgroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: {
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: 0,
      accuracy: 5,
      heading: 0,
      speed: 0,
    },
    timestamp: Date.now(),
  })),
  watchPositionAsync: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
  geocodeAsync: jest.fn(() => Promise.resolve([{
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 5,
  }])),
  reverseGeocodeAsync: jest.fn(() => Promise.resolve([{
    city: 'San Francisco',
    country: 'United States',
    district: null,
    isoCountryCode: 'US',
    name: '123 Main St',
    postalCode: '94102',
    region: 'CA',
    street: 'Main St',
    streetNumber: '123',
    subregion: null,
    timezone: 'America/Los_Angeles',
  }])),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(() => Promise.resolve(false)),
  Accuracy: {
    Lowest: 1,
    Low: 2,
    Balanced: 3,
    High: 4,
    Highest: 5,
    BestForNavigation: 6,
  },
};

export const mockExpoSecureStore = {
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
};

export const mockExpoCamera = {
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  Camera: {
    Constants: {
      Type: {
        back: 'back',
        front: 'front',
      },
      FlashMode: {
        on: 'on',
        off: 'off',
        auto: 'auto',
        torch: 'torch',
      },
    },
  },
};

export const mockExpoImagePicker = {
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({
    cancelled: false,
    assets: [{
      uri: 'mock-image-uri',
      width: 100,
      height: 100,
      type: 'image',
    }],
  })),
  launchCameraAsync: jest.fn(() => Promise.resolve({
    cancelled: false,
    assets: [{
      uri: 'mock-camera-uri',
      width: 100,
      height: 100,
      type: 'image',
    }],
  })),
  MediaTypeOptions: {
    All: 'All',
    Videos: 'Videos',
    Images: 'Images',
  },
};

export const mockExpoDevice = {
  isDevice: true,
  brand: 'Apple',
  manufacturer: 'Apple',
  modelName: 'iPhone 14',
  modelId: 'iPhone15,2',
  deviceName: 'Test iPhone',
  deviceYearClass: 2022,
  totalMemory: 6442450944,
  supportedCpuArchitectures: ['arm64'],
  osName: 'iOS',
  osVersion: '16.0',
  osBuildId: '20A362',
  osInternalBuildId: '20A362',
  platformApiLevel: null,
  deviceType: 2,
};

export const mockExpoConstants = {
  expoConfig: {
    name: 'OkapiFind',
    slug: 'okapifind',
    version: '1.0.0',
    extra: {
      firebaseApiKey: 'mock-firebase-api-key',
      supabaseUrl: 'https://mock-supabase.com',
      supabaseAnonKey: 'mock-supabase-anon-key',
    },
  },
  manifest: {
    name: 'OkapiFind',
    slug: 'okapifind',
    version: '1.0.0',
  },
  executionEnvironment: 'storeClient',
  isDevice: true,
  platform: {
    ios: {
      buildNumber: '1',
      platform: 'ios',
    },
  },
};

// Mock all expo modules
jest.mock('expo-notifications', () => mockExpoNotifications);
jest.mock('expo-location', () => mockExpoLocation);
jest.mock('expo-secure-store', () => mockExpoSecureStore);
jest.mock('expo-camera', () => mockExpoCamera);
jest.mock('expo-image-picker', () => mockExpoImagePicker);
jest.mock('expo-device', () => mockExpoDevice);
jest.mock('expo-constants', () => mockExpoConstants);

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  signInAsync: jest.fn(() => Promise.resolve({
    user: 'mock-apple-user-id',
    email: 'test@example.com',
    fullName: {
      givenName: 'Test',
      familyName: 'User',
    },
    identityToken: 'mock-identity-token',
    authorizationCode: 'mock-auth-code',
  })),
  getCredentialStateAsync: jest.fn(() => Promise.resolve('AUTHORIZED')),
  AppleAuthenticationScope: {
    FULL_NAME: 0,
    EMAIL: 1,
  },
  AppleAuthenticationCredentialState: {
    REVOKED: 0,
    AUTHORIZED: 1,
    NOT_FOUND: 2,
    TRANSFERRED: 3,
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([])),
  isSpeakingAsync: jest.fn(() => Promise.resolve(false)),
  maxSpeechInputLength: 4000,
}));

jest.mock('expo-sensors', () => ({
  Accelerometer: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
    setUpdateInterval: jest.fn(),
    isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  },
  Gyroscope: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
    setUpdateInterval: jest.fn(),
    isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  },
  Magnetometer: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
    setUpdateInterval: jest.fn(),
    isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  },
}));