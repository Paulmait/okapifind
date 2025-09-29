/**
 * Centralized Application Configuration
 */

export default {
  // API Configuration
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'https://api.okapifind.com',
  WEBSOCKET_URL: process.env.EXPO_PUBLIC_WEBSOCKET_URL || 'wss://ws.okapifind.com',

  // Supabase Configuration
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',

  // RevenueCat Configuration
  REVENUECAT_API_KEY_IOS: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || '',
  REVENUECAT_API_KEY_ANDROID: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || '',

  // Google Maps
  GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',

  // Sentry
  SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN || '',

  // Mixpanel
  MIXPANEL_TOKEN: process.env.EXPO_PUBLIC_MIXPANEL_TOKEN || '',

  // Feature Flags
  FEATURES: {
    PANIC_MODE: true,
    ML_PREDICTIONS: true,
    OFFLINE_MODE: true,
    FAMILY_SHARING: true,
    CARPLAY_SUPPORT: false,
    AR_NAVIGATION: false,
  },

  // App Settings
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  IDLE_TIMEOUT: 10 * 60 * 1000, // 10 minutes
  CACHE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_OFFLINE_DAYS: 7,

  // Deep Linking
  DEEP_LINK_SCHEME: 'okapifind',
  UNIVERSAL_LINK_DOMAIN: 'okapifind.com',

  // Environment
  IS_DEV: __DEV__,
  IS_PRODUCTION: !__DEV__,
};