/**
 * Supabase Configuration
 * Central configuration for all Supabase services
 */

import Constants from 'expo-constants';

// Supabase project configuration
export const SUPABASE_CONFIG = {
  // Main project URL and key
  url: Constants.expoConfig?.extra?.supabaseUrl ||
       process.env.EXPO_PUBLIC_SUPABASE_URL ||
       '',

  anonKey: Constants.expoConfig?.extra?.supabaseAnonKey ||
           process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
           '',

  // Edge Function endpoints
  functions: {
    revenuecatWebhook: `${Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || ''}/functions/v1/revenuecat-webhook`,
    signedUpload: `${Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || ''}/functions/v1/signed-upload`,
    startShare: `${Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || ''}/functions/v1/start-share`,
    cronReminders: `${Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || ''}/functions/v1/cron-reminders`,
    // Secure API proxies - API keys stay server-side
    googleMapsProxy: `${Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || ''}/functions/v1/google-maps-proxy`,
    geminiProxy: `${Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || ''}/functions/v1/gemini-proxy`,
    secureConfig: `${Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || ''}/functions/v1/secure-config`,
  },

  // Storage buckets
  storage: {
    meterPhotos: 'meter-photos',
    avatars: 'avatars',
  },

  // Public URLs
  public: {
    shareBaseUrl: Constants.expoConfig?.extra?.shareBaseUrl ||
                  process.env.EXPO_PUBLIC_SHARE_BASE_URL ||
                  'https://okapifind.com/track',
  },

  // Realtime channels
  channels: {
    shareLocations: (shareId: string) => `share-locations-${shareId}`,
    timers: (sessionId: string) => `timers-${sessionId}`,
    userUpdates: (userId: string) => `user-${userId}`,
  },
};

// Validate configuration
export function validateSupabaseConfig(): boolean {
  if (!SUPABASE_CONFIG.url) {
    console.error('Supabase URL is not configured');
    return false;
  }

  if (!SUPABASE_CONFIG.anonKey) {
    console.error('Supabase Anon Key is not configured');
    return false;
  }

  return true;
}

// Helper to construct Edge Function URL
export function getEdgeFunctionUrl(functionName: keyof typeof SUPABASE_CONFIG.functions): string {
  return SUPABASE_CONFIG.functions[functionName];
}

// Helper to construct storage URL
export function getStorageUrl(bucket: keyof typeof SUPABASE_CONFIG.storage, path: string): string {
  return `${SUPABASE_CONFIG.url}/storage/v1/object/public/${SUPABASE_CONFIG.storage[bucket]}/${path}`;
}

// Helper to construct share URL
export function getShareUrl(shareToken: string): string {
  return `${SUPABASE_CONFIG.public.shareBaseUrl}/${shareToken}`;
}

// Helper to get view share data URL
export function getShareViewUrl(shareToken: string): string {
  return `${SUPABASE_CONFIG.functions.startShare}/view?token=${shareToken}`;
}

export default SUPABASE_CONFIG;