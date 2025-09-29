/**
 * Central Application Configuration for OkapiFind
 * All app-wide settings and feature flags
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Environment detection
const ENV = process.env.NODE_ENV || 'development';
const isDev = __DEV__ || ENV === 'development';
const isProd = ENV === 'production';

// App version and build info
export const APP_INFO = {
  name: 'OkapiFind',
  version: Constants.expoConfig?.version || '1.0.0',
  buildNumber: Constants.expoConfig?.ios?.buildNumber || '1',
  bundleId: Constants.expoConfig?.ios?.bundleIdentifier || 'com.okapi.find',
  platform: Platform.OS,
  environment: ENV,
};

// API Configuration
export const API_CONFIG = {
  BASE_URL: isProd
    ? 'https://api.okapifind.com'
    : 'https://staging-api.okapifind.com',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  RATE_LIMIT: {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
  },
  ENDPOINTS: {
    AUTH: '/api/v1/auth',
    USER: '/api/v1/user',
    PARKING: '/api/v1/parking',
    VEHICLE: '/api/v1/vehicle',
    TIMER: '/api/v1/timer',
    SHARE: '/api/v1/share',
    ANALYTICS: '/api/v1/analytics',
  },
};

// Security Configuration
export const SECURITY_CONFIG = {
  SESSION_TIMEOUT_MS: 24 * 60 * 60 * 1000, // 24 hours
  TOKEN_REFRESH_THRESHOLD_MS: 5 * 60 * 1000, // 5 minutes before expiry
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 30 * 60 * 1000, // 30 minutes
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  ENABLE_BIOMETRIC_AUTH: true,
  ENABLE_2FA: false, // For future implementation
  CERTIFICATE_PINNING: isProd, // Only in production
};

// Location and Parking Configuration
export const LOCATION_CONFIG = {
  DEFAULT_ACCURACY: Platform.select({
    ios: 'balanced',
    android: 'balanced',
    default: 'high',
  }),
  UPDATE_INTERVAL_MS: 10000, // 10 seconds
  MIN_DISTANCE_METERS: 20, // 20 meters
  PARKING_DETECTION: {
    MIN_PARKING_DURATION_MS: 5 * 60 * 1000, // 5 minutes
    MAX_WALKING_SPEED_MS: 1.5, // meters per second
    MIN_DRIVING_SPEED_MS: 5, // meters per second
    PARKING_RADIUS_METERS: 50, // Consider same parking spot within 50m
    CONFIDENCE_THRESHOLD: 0.7,
    AUTO_DETECT_ENABLED: true,
    USE_ACTIVITY_RECOGNITION: Platform.OS === 'android',
  },
  GEOFENCING: {
    ENABLED: true,
    RADIUS_METERS: 100,
    TRANSITION_DWELL_TIME_MS: 60000, // 1 minute
  },
};

// Map Configuration
export const MAP_CONFIG = {
  DEFAULT_ZOOM: 16,
  DEFAULT_REGION: {
    latitude: 37.7749, // San Francisco (default)
    longitude: -122.4194,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  },
  ENABLE_TRAFFIC: true,
  ENABLE_INDOOR: true,
  ENABLE_COMPASS: true,
  ENABLE_ROTATE: true,
  MAP_TYPE: Platform.select({
    ios: 'standard',
    android: 'normal',
    default: 'standard',
  }),
  MARKER_ANIMATION: true,
};

// Performance Configuration
export const PERFORMANCE_CONFIG = {
  ENABLE_MONITORING: true,
  ENABLE_CRASH_REPORTING: isProd,
  FPS_WARNING_THRESHOLD: 45,
  MEMORY_WARNING_THRESHOLD_MB: 200,
  NETWORK_TIMEOUT_MS: 30000,
  IMAGE_CACHE_SIZE_MB: 100,
  DATA_CACHE_SIZE_MB: 50,
  ENABLE_HERMES: true,
  LAZY_LOAD_SCREENS: true,
  BATCH_BRIDGE_CALLS: true,
};

// Feature Flags
export const FEATURE_FLAGS = {
  // Core Features
  ENABLE_AUTO_PARKING_DETECTION: true,
  ENABLE_MANUAL_PARKING: true,
  ENABLE_PHOTO_PARKING: true,
  ENABLE_TIMER_REMINDERS: true,
  ENABLE_SAFETY_MODE: true,
  ENABLE_VEHICLE_MANAGEMENT: true,

  // Premium Features
  ENABLE_MULTI_VEHICLE: true,
  ENABLE_PARKING_HISTORY: true,
  ENABLE_ADVANCED_ANALYTICS: true,
  ENABLE_CUSTOM_REMINDERS: true,
  ENABLE_EXPORT_DATA: true,
  ENABLE_CLOUD_BACKUP: true,

  // Experimental Features
  ENABLE_AR_NAVIGATION: false,
  ENABLE_VOICE_COMMANDS: false,
  ENABLE_CARPLAY_ANDROID_AUTO: false,
  ENABLE_WIDGET: Platform.OS === 'ios',
  ENABLE_WATCH_APP: Platform.OS === 'ios',
  ENABLE_OFFLINE_MODE: true,

  // UI Features
  ENABLE_DARK_MODE: true,
  ENABLE_HAPTIC_FEEDBACK: Platform.OS === 'ios',
  ENABLE_SKELETON_LOADING: true,
  ENABLE_PULL_TO_REFRESH: true,
  ENABLE_SWIPE_ACTIONS: true,

  // Social Features
  ENABLE_SHARE_LOCATION: true,
  ENABLE_REFERRAL_PROGRAM: false,
  ENABLE_SOCIAL_LOGIN: true,

  // Monetization
  ENABLE_IN_APP_PURCHASE: true,
  ENABLE_SUBSCRIPTION: true,
  ENABLE_ADS: false,
  ENABLE_PAYWALL: true,
};

// Analytics Configuration
export const ANALYTICS_CONFIG = {
  ENABLE_ANALYTICS: true,
  ENABLE_USER_TRACKING: !isDev,
  ENABLE_PERFORMANCE_TRACKING: true,
  ENABLE_ERROR_TRACKING: true,
  ENABLE_CUSTOM_EVENTS: true,
  SESSION_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
  BATCH_SIZE: 50,
  BATCH_INTERVAL_MS: 60000, // 1 minute
  MAX_QUEUE_SIZE: 1000,
};

// Storage Configuration
export const STORAGE_CONFIG = {
  ENABLE_ENCRYPTION: true,
  MAX_STORAGE_SIZE_MB: 100,
  CACHE_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  AUTO_CLEANUP: true,
  CLEANUP_THRESHOLD_PERCENT: 90,
  KEYS: {
    USER_PREFERENCES: '@OkapiFind:preferences',
    CAR_LOCATION: '@OkapiFind:carLocation',
    PARKING_HISTORY: '@OkapiFind:parkingHistory',
    SETTINGS: '@OkapiFind:settings',
    CACHE: '@OkapiFind:cache',
    SECURE_STORE: '@OkapiFind:secure',
  },
};

// Notification Configuration
export const NOTIFICATION_CONFIG = {
  ENABLE_PUSH_NOTIFICATIONS: true,
  ENABLE_LOCAL_NOTIFICATIONS: true,
  ENABLE_TIMER_NOTIFICATIONS: true,
  ENABLE_PARKING_REMINDERS: true,
  ENABLE_PROMOTIONAL_NOTIFICATIONS: false,
  DEFAULT_SOUND: Platform.select({
    ios: 'default',
    android: 'default',
    default: null,
  }),
  VIBRATION_PATTERN: [0, 250, 250, 250],
};

// UI Configuration
export const UI_CONFIG = {
  ANIMATION_DURATION: 300,
  DEBOUNCE_DELAY: 500,
  SEARCH_DEBOUNCE: 300,
  MAX_TOAST_DURATION: 5000,
  SKELETON_ANIMATION_DURATION: 1000,
  PULL_TO_REFRESH_THRESHOLD: 100,
  INFINITE_SCROLL_THRESHOLD: 0.8,
  MAX_IMAGE_SIZE_MB: 5,
  SUPPORTED_IMAGE_FORMATS: ['jpg', 'jpeg', 'png', 'heif', 'heic'],
};

// Revenue Cat Configuration
export const REVENUE_CAT_CONFIG = {
  ENABLE_REVENUE_CAT: true,
  OFFERINGS_CACHE_DURATION_MS: 5 * 60 * 1000, // 5 minutes
  ENABLE_SANDBOX: isDev,
  AUTO_RESTORE_PURCHASES: true,
  ENABLE_ANALYTICS_COLLECTION: !isDev,
};

// Legal and Compliance
export const LEGAL_CONFIG = {
  PRIVACY_POLICY_URL: 'https://okapifind.com/privacy',
  TERMS_OF_SERVICE_URL: 'https://okapifind.com/terms',
  EULA_URL: 'https://okapifind.com/eula',
  SUPPORT_EMAIL: 'support@okapifind.com',
  REQUIRE_CONSENT: true,
  GDPR_ENABLED: true,
  CCPA_ENABLED: true,
  COPPA_ENABLED: false,
  MIN_AGE_REQUIREMENT: 13,
};

// App Store Configuration
export const STORE_CONFIG = {
  APP_STORE_ID: '123456789',
  APP_STORE_URL: 'https://apps.apple.com/app/okapifind/id123456789',
  PLAY_STORE_ID: 'com.okapi.find',
  PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=com.okapi.find',
  ENABLE_RATING_PROMPT: true,
  RATING_PROMPT_DELAY_DAYS: 7,
  RATING_PROMPT_USES: 5,
};

// Development Configuration
export const DEV_CONFIG = {
  ENABLE_REDUX_DEVTOOLS: isDev,
  ENABLE_NETWORK_INSPECTOR: isDev,
  ENABLE_PERFORMANCE_MONITOR: isDev,
  ENABLE_ELEMENT_INSPECTOR: isDev,
  ENABLE_LOGS: isDev,
  LOG_LEVEL: isDev ? 'debug' : 'error',
  MOCK_LOCATION: false,
  MOCK_API_RESPONSES: false,
  SHOW_DEV_MENU: isDev,
};

// Export helper functions
export const isFeatureEnabled = (feature: keyof typeof FEATURE_FLAGS): boolean => {
  return FEATURE_FLAGS[feature] ?? false;
};

export const getApiEndpoint = (endpoint: keyof typeof API_CONFIG.ENDPOINTS): string => {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS[endpoint]}`;
};

export const getStorageKey = (key: keyof typeof STORAGE_CONFIG.KEYS): string => {
  return STORAGE_CONFIG.KEYS[key];
};

// Export all configs as default
export default {
  APP_INFO,
  API_CONFIG,
  SECURITY_CONFIG,
  LOCATION_CONFIG,
  MAP_CONFIG,
  PERFORMANCE_CONFIG,
  FEATURE_FLAGS,
  ANALYTICS_CONFIG,
  STORAGE_CONFIG,
  NOTIFICATION_CONFIG,
  UI_CONFIG,
  REVENUE_CAT_CONFIG,
  LEGAL_CONFIG,
  STORE_CONFIG,
  DEV_CONFIG,
  isFeatureEnabled,
  getApiEndpoint,
  getStorageKey,
};