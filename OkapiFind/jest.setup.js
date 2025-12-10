// Jest setup file
import 'react-native-gesture-handler/jestSetup';

// ✅ FIX: Prevent "Cannot redefine property: window" error
// This happens because React Native tries to redefine window
// Save the original window before React Native setup
global.___window = global.window;

// Mock expo modules
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {},
  },
}));

jest.mock('expo-location', () => ({}));
jest.mock('expo-sensors', () => ({}));
jest.mock('expo-haptics', () => ({}));
jest.mock('expo-speech', () => ({}));
jest.mock('expo-task-manager', () => ({}));
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
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