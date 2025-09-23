import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Get config values from app.config.js extra field
const {
  firebaseApiKey,
  firebaseAuthDomain,
  firebaseProjectId,
  firebaseStorageBucket,
  firebaseMessagingSenderId,
  firebaseAppId,
  firebaseMeasurementId,
} = Constants.expoConfig?.extra || {};

// Firebase configuration using values from app.config.js
const firebaseConfig = {
  apiKey: firebaseApiKey || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: firebaseAuthDomain || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: firebaseProjectId || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: firebaseStorageBucket || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: firebaseMessagingSenderId || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: firebaseAppId || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: firebaseMeasurementId || process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase App (check if already initialized to prevent errors)
let firebaseApp: FirebaseApp;
if (getApps().length === 0) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApp();
}

// Initialize Firebase Auth with proper persistence for React Native
let firebaseAuth: Auth;
try {
  if (Platform.OS === 'web') {
    // For web platform, use standard getAuth
    firebaseAuth = getAuth(firebaseApp);
  } else {
    // For iOS and Android, use getAuth - persistence is handled automatically
    firebaseAuth = getAuth(firebaseApp);
  }
} catch (error) {
  // If auth is already initialized, just get the existing instance
  firebaseAuth = getAuth(firebaseApp);
}

// Initialize Firebase Firestore
let firebaseFirestore: Firestore;
try {
  firebaseFirestore = getFirestore(firebaseApp);
  if (__DEV__) {
    console.log('Firebase Firestore initialized successfully');
  }
} catch (error) {
  console.error('Failed to initialize Firebase Firestore:', error);
  throw error;
}

// Initialize Firebase Realtime Database
let firebaseDatabase: Database;
try {
  firebaseDatabase = getDatabase(firebaseApp);
  if (__DEV__) {
    console.log('Firebase Realtime Database initialized successfully');
  }
} catch (error) {
  console.error('Failed to initialize Firebase Realtime Database:', error);
  throw error;
}

// Initialize Firebase Storage
let firebaseStorage: FirebaseStorage;
try {
  firebaseStorage = getStorage(firebaseApp);
  if (__DEV__) {
    console.log('Firebase Storage initialized successfully');
  }
} catch (error) {
  console.error('Failed to initialize Firebase Storage:', error);
  throw error;
}

// Log initialization status in development
if (__DEV__) {
  console.log('Firebase initialized:', {
    platform: Platform.OS,
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
  });
}

// Export configured instances
export { firebaseApp, firebaseAuth, firebaseFirestore, firebaseDatabase, firebaseStorage };

// Also export config for use in other parts of the app
export const firebaseConfigExport = firebaseConfig;

// Export Google OAuth client IDs from app.config.js
export const GOOGLE_OAUTH_CONFIG = {
  webClientId: Constants.expoConfig?.extra?.googleWebClientId || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: Constants.expoConfig?.extra?.googleIosClientId || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: Constants.expoConfig?.extra?.googleAndroidClientId || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
};