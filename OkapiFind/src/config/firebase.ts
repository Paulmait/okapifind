/**
 * Firebase Configuration
 * Central configuration for Firebase services
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import Constants from 'expo-constants';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey ||
          process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain ||
              process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: Constants.expoConfig?.extra?.firebaseProjectId ||
             process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket ||
                 process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId ||
                     process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: Constants.expoConfig?.extra?.firebaseAppId ||
         process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: Constants.expoConfig?.extra?.firebaseMeasurementId ||
                 process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
};

// Google OAuth configuration
export const GOOGLE_OAUTH_CONFIG = {
  webClientId: Constants.expoConfig?.extra?.googleWebClientId ||
               process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
  iosClientId: Constants.expoConfig?.extra?.googleIosClientId ||
               process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
  androidClientId: Constants.expoConfig?.extra?.googleAndroidClientId ||
                   process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
};

// Validate Firebase configuration
function validateFirebaseConfig(): boolean {
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);

  if (missingFields.length > 0) {
    console.warn('⚠️ Firebase configuration incomplete. Missing fields:', missingFields);
    console.warn('⚠️ Please set Firebase environment variables in .env file');
    return false;
  }

  return true;
}

// Initialize Firebase
let firebaseApp: FirebaseApp;
let firebaseAuth: Auth;

try {
  // Validate config before initializing
  const isValid = validateFirebaseConfig();

  if (isValid) {
    firebaseApp = initializeApp(firebaseConfig);
    firebaseAuth = getAuth(firebaseApp);
    console.log('✅ Firebase initialized successfully');
  } else {
    // Create a mock app for development without crashing
    console.warn('⚠️ Running with incomplete Firebase config - authentication will not work');
    firebaseApp = {} as FirebaseApp;
    firebaseAuth = {} as Auth;
  }
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  // Provide fallback to prevent app crash
  firebaseApp = {} as FirebaseApp;
  firebaseAuth = {} as Auth;
}

// Export Firebase instances
export { firebaseApp, firebaseAuth };

// Export configuration for debugging (in dev mode only)
if (__DEV__) {
  console.log('Firebase Config Status:', {
    hasApiKey: !!firebaseConfig.apiKey,
    hasAuthDomain: !!firebaseConfig.authDomain,
    hasProjectId: !!firebaseConfig.projectId,
    hasAppId: !!firebaseConfig.appId,
    projectId: firebaseConfig.projectId || 'NOT_SET',
  });
}

// Helper function to check if Firebase is properly configured
export function isFirebaseConfigured(): boolean {
  return validateFirebaseConfig();
}

// Export config for testing purposes
export const firebaseConfigForTesting = __DEV__ ? firebaseConfig : null;