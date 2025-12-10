/**
 * Supabase Proxy Service
 * Proxies all sensitive API calls through Supabase Edge Functions
 * API keys are NEVER exposed to the client - they stay server-side
 *
 * This is the recommended way to call external APIs in production:
 * - Google Maps API
 * - Gemini AI API
 * - Any other API requiring secret keys
 */

import { supabase } from '../lib/supabase-client';

// Types for Google Maps API responses
export interface DirectionsResult {
  routes: Array<{
    legs: Array<{
      distance: { text: string; value: number };
      duration: { text: string; value: number };
      steps: Array<{
        distance: { text: string; value: number };
        duration: { text: string; value: number };
        html_instructions: string;
        travel_mode: string;
        maneuver?: string;
        polyline: { points: string };
      }>;
    }>;
    overview_polyline: { points: string };
  }>;
  status: string;
}

export interface GeocodeResult {
  results: Array<{
    formatted_address: string;
    geometry: {
      location: { lat: number; lng: number };
    };
    place_id: string;
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
  }>;
  status: string;
}

export interface PlacesResult {
  results: Array<{
    name: string;
    vicinity: string;
    geometry: {
      location: { lat: number; lng: number };
    };
    place_id: string;
    types: string[];
    opening_hours?: {
      open_now: boolean;
    };
    rating?: number;
  }>;
  status: string;
}

// Types for AI analysis responses
export interface SignAnalysisResult {
  timeLimit: number | null;
  restrictions: string[];
  hoursActive: { start: string; end: string } | null;
  daysActive: string[];
  specialConditions: string[];
  canParkNow: boolean;
  confidence: number;
}

export interface MeterAnalysisResult {
  timeRemaining: number | null;
  maxTime: number | null;
  ratePerHour: number | null;
  paymentMethods: string[];
  status: 'active' | 'expired' | 'out-of-service';
  confidence: number;
}

// App configuration from secure endpoint
export interface SecureAppConfig {
  features: {
    offlineMode: boolean;
    voiceCommands: boolean;
    arNavigation: boolean;
    photoNotes: boolean;
    safetyMode: boolean;
    aiPoweredAnalysis: boolean;
    unlimitedHistory: boolean;
    multiVehicle: boolean;
  };
  limits: {
    maxPhotoSize: number;
    maxPhotosPerSession: number;
    maxSafetyShareDuration: number;
    historyRetention: number;
  };
  endpoints: {
    mapsProxy: string;
    geminiProxy: string;
    signedUpload: string;
    startShare: string;
  };
  version: {
    minAppVersion: string;
    currentVersion: string;
    forceUpdate: boolean;
  };
}

class SupabaseProxyService {
  // ============================================
  // GOOGLE MAPS API (via Edge Function)
  // ============================================

  /**
   * Get directions between two points
   * API key stays server-side in Supabase Edge Function
   */
  async getDirections(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    mode: 'walking' | 'driving' = 'walking'
  ): Promise<DirectionsResult> {
    const { data, error } = await supabase.functions.invoke('google-maps-proxy', {
      body: {
        endpoint: 'directions',
        params: {
          origin: `${origin.lat},${origin.lng}`,
          destination: `${destination.lat},${destination.lng}`,
          mode,
        },
      },
    });

    if (error) {
      console.error('Directions API error:', error);
      throw new Error('Failed to get directions');
    }

    return data;
  }

  /**
   * Get address from coordinates (reverse geocode)
   * API key stays server-side
   */
  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    const { data, error } = await supabase.functions.invoke('google-maps-proxy', {
      body: {
        endpoint: 'geocode',
        params: {
          latlng: `${lat},${lng}`,
        },
      },
    });

    if (error) {
      console.error('Geocode API error:', error);
      return null;
    }

    const result = data as GeocodeResult;
    return result.results?.[0]?.formatted_address || null;
  }

  /**
   * Search for nearby places
   * API key stays server-side
   */
  async searchNearby(
    lat: number,
    lng: number,
    type: string = 'parking',
    radius: number = 500
  ): Promise<PlacesResult['results']> {
    const { data, error } = await supabase.functions.invoke('google-maps-proxy', {
      body: {
        endpoint: 'nearbysearch',
        params: {
          location: `${lat},${lng}`,
          radius: radius.toString(),
          type,
        },
      },
    });

    if (error) {
      console.error('Places API error:', error);
      return [];
    }

    const result = data as PlacesResult;
    return result.results || [];
  }

  /**
   * Get distance matrix between multiple points
   * API key stays server-side
   */
  async getDistanceMatrix(
    origins: Array<{ lat: number; lng: number }>,
    destinations: Array<{ lat: number; lng: number }>,
    mode: 'walking' | 'driving' = 'walking'
  ) {
    const { data, error } = await supabase.functions.invoke('google-maps-proxy', {
      body: {
        endpoint: 'distance',
        params: {
          origins: origins.map((o) => `${o.lat},${o.lng}`).join('|'),
          destinations: destinations.map((d) => `${d.lat},${d.lng}`).join('|'),
          mode,
        },
      },
    });

    if (error) {
      console.error('Distance Matrix API error:', error);
      throw new Error('Failed to get distance');
    }

    return data;
  }

  // ============================================
  // GEMINI AI API (via Edge Function)
  // ============================================

  /**
   * Analyze a parking sign image using AI
   * Gemini API key stays server-side
   */
  async analyzeSign(imageBase64: string): Promise<SignAnalysisResult | null> {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'analyze-sign',
        imageBase64,
      },
    });

    if (error) {
      console.error('Sign analysis error:', error);
      return null;
    }

    return data?.result as SignAnalysisResult;
  }

  /**
   * Analyze a parking meter image using AI
   * Gemini API key stays server-side
   */
  async analyzeMeter(imageBase64: string): Promise<MeterAnalysisResult | null> {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'analyze-meter',
        imageBase64,
      },
    });

    if (error) {
      console.error('Meter analysis error:', error);
      return null;
    }

    return data?.result as MeterAnalysisResult;
  }

  /**
   * Generate a smart parking reminder message
   * Gemini API key stays server-side
   */
  async generateReminder(context: {
    timeRemaining: number;
    location: string;
    restrictions?: string[];
  }): Promise<string> {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        action: 'generate-reminder',
        prompt: `Generate a friendly, concise parking reminder for a user who has ${context.timeRemaining} minutes remaining at ${context.location}. ${
          context.restrictions?.length
            ? `Note: ${context.restrictions.join(', ')}`
            : ''
        }`,
        context,
      },
    });

    if (error) {
      console.error('Reminder generation error:', error);
      return `Your parking at ${context.location} expires in ${context.timeRemaining} minutes.`;
    }

    return data?.result?.text || `Parking expires in ${context.timeRemaining} minutes.`;
  }

  // ============================================
  // SECURE CONFIGURATION
  // ============================================

  /**
   * Get secure app configuration
   * Fetches feature flags and limits based on user's subscription status
   */
  async getSecureConfig(): Promise<SecureAppConfig> {
    const { data, error } = await supabase.functions.invoke('secure-config');

    if (error) {
      console.error('Config fetch error:', error);
      // Return default config on error
      return {
        features: {
          offlineMode: true,
          voiceCommands: true,
          arNavigation: false,
          photoNotes: true,
          safetyMode: true,
          aiPoweredAnalysis: false,
          unlimitedHistory: false,
          multiVehicle: false,
        },
        limits: {
          maxPhotoSize: 5 * 1024 * 1024,
          maxPhotosPerSession: 3,
          maxSafetyShareDuration: 120,
          historyRetention: 30,
        },
        endpoints: {
          mapsProxy: '',
          geminiProxy: '',
          signedUpload: '',
          startShare: '',
        },
        version: {
          minAppVersion: '1.0.0',
          currentVersion: '1.0.0',
          forceUpdate: false,
        },
      };
    }

    return data?.config;
  }
}

// Export singleton instance
export const supabaseProxy = new SupabaseProxyService();
export default supabaseProxy;
