import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Google API Service for fetching parking location data
 *
 * REQUIRED OAuth 2.0 SCOPES:
 * - https://www.googleapis.com/auth/location.history.read - Read location history
 * - https://www.googleapis.com/auth/maps-timeline.read - Read Maps timeline data
 * - https://www.googleapis.com/auth/drive.activity.readonly - Read Drive activity (for parking detection)
 *
 * OPTIONAL SCOPES (for enhanced features):
 * - https://www.googleapis.com/auth/calendar.readonly - Read calendar for parking-related events
 * - https://www.googleapis.com/auth/gmail.readonly - Read emails for parking receipts/confirmations
 *
 * SETUP REQUIREMENTS:
 * 1. Create a project in Google Cloud Console
 * 2. Enable Google Maps Timeline API, Places API, and Location History API
 * 3. Create OAuth 2.0 credentials (iOS and Android)
 * 4. Add authorized redirect URIs for Expo
 * 5. Configure app.json with proper scheme for OAuth redirect
 */

// WebBrowser configuration for OAuth flow
WebBrowser.maybeCompleteAuthSession();

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: '@OkapiFind:googleAccessToken',
  REFRESH_TOKEN: '@OkapiFind:googleRefreshToken',
  USER_INFO: '@OkapiFind:googleUserInfo',
  TOKEN_EXPIRY: '@OkapiFind:googleTokenExpiry',
};

// Google API Configuration
export const GOOGLE_CONFIG = {
  // Replace with your actual OAuth client IDs
  CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',

  // For Expo Go development
  EXPO_CLIENT_ID: process.env.EXPO_GOOGLE_CLIENT_ID || 'YOUR_EXPO_CLIENT_ID.apps.googleusercontent.com',

  // For production builds
  IOS_CLIENT_ID: process.env.IOS_GOOGLE_CLIENT_ID || 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
  ANDROID_CLIENT_ID: process.env.ANDROID_GOOGLE_CLIENT_ID || 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',

  // API endpoints
  TOKEN_ENDPOINT: 'https://oauth2.googleapis.com/token',
  REVOKE_ENDPOINT: 'https://oauth2.googleapis.com/revoke',
  TIMELINE_API_BASE: 'https://timeline.googleapis.com/v1',
  PLACES_API_BASE: 'https://maps.googleapis.com/maps/api/place',
  LOCATION_HISTORY_API: 'https://www.googleapis.com/locationhistory/v1',
};

// Types for Google API responses
export interface GoogleAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope: string;
  idToken?: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface ParkingLocation {
  latitude: number;
  longitude: number;
  timestamp: Date;
  confidence: number; // 0-1 confidence score
  address?: string;
  placeId?: string;
  placeName?: string;
  parkingType?: 'street' | 'lot' | 'garage' | 'unknown';
  duration?: number; // parking duration in minutes
  source: 'timeline' | 'activity' | 'places' | 'manual';
}

export interface TimelineLocation {
  latitudeE7: number; // Latitude in E7 format (multiply by 10^-7)
  longitudeE7: number; // Longitude in E7 format
  accuracy: number;
  timestamp: string;
  velocity?: number;
  heading?: number;
  altitude?: number;
  activity?: {
    type: string;
    confidence: number;
  }[];
}

export interface ActivitySegment {
  startLocation: TimelineLocation;
  endLocation: TimelineLocation;
  duration: {
    startTimestamp: string;
    endTimestamp: string;
  };
  distance?: number;
  activityType: string;
  confidence: number;
  waypoints?: TimelineLocation[];
}

/**
 * Google API Service Class
 */
export class GoogleApiService {
  private static instance: GoogleApiService;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: Date | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): GoogleApiService {
    if (!GoogleApiService.instance) {
      GoogleApiService.instance = new GoogleApiService();
    }
    return GoogleApiService.instance;
  }

  /**
   * Initialize OAuth authentication with Google
   * @returns Authentication result with tokens
   */
  public async authenticate(): Promise<GoogleAuthTokens | null> {
    try {
      // Use Expo AuthSession for OAuth 2.0 flow
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'okapifind', // Must match app.json scheme
      });

      const discovery = {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: GOOGLE_CONFIG.TOKEN_ENDPOINT,
        revocationEndpoint: GOOGLE_CONFIG.REVOKE_ENDPOINT,
      };

      const request = new AuthSession.AuthRequest({
        clientId: __DEV__ ? GOOGLE_CONFIG.EXPO_CLIENT_ID : GOOGLE_CONFIG.CLIENT_ID,
        scopes: [
          'openid',
          'profile',
          'email',
          'https://www.googleapis.com/auth/location.history.read',
          'https://www.googleapis.com/auth/maps-timeline.read',
        ],
        responseType: AuthSession.ResponseType.Code,
        redirectUri,
        prompt: AuthSession.Prompt.SelectAccount,
        extraParams: {
          access_type: 'offline', // Request refresh token
        },
      });

      const result = await request.promptAsync(discovery);

      if (result.type === 'success' && result.params.code) {
        // Exchange authorization code for tokens
        const tokens = await this.exchangeCodeForTokens(
          result.params.code,
          redirectUri
        );

        if (tokens) {
          await this.saveTokens(tokens);
          return tokens;
        }
      }

      return null;
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  private async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<GoogleAuthTokens | null> {
    try {
      const response = await fetch(GOOGLE_CONFIG.TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: __DEV__ ? GOOGLE_CONFIG.EXPO_CLIENT_ID : GOOGLE_CONFIG.CLIENT_ID,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }).toString(),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange code for tokens');
      }

      const data = await response.json();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope,
        idToken: data.id_token,
      };
    } catch (error) {
      console.error('Token exchange error:', error);
      return null;
    }
  }

  /**
   * Refresh the access token using refresh token
   */
  public async refreshAccessToken(): Promise<boolean> {
    try {
      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

      if (!refreshToken) {
        console.log('No refresh token available');
        return false;
      }

      const response = await fetch(GOOGLE_CONFIG.TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: __DEV__ ? GOOGLE_CONFIG.EXPO_CLIENT_ID : GOOGLE_CONFIG.CLIENT_ID,
          grant_type: 'refresh_token',
        }).toString(),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();

      const tokens: GoogleAuthTokens = {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope,
      };

      await this.saveTokens(tokens);
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  /**
   * Save tokens to AsyncStorage
   */
  private async saveTokens(tokens: GoogleAuthTokens): Promise<void> {
    this.accessToken = tokens.accessToken;
    if (tokens.refreshToken) {
      this.refreshToken = tokens.refreshToken;
    }

    const expiryTime = new Date();
    expiryTime.setSeconds(expiryTime.getSeconds() + tokens.expiresIn);
    this.tokenExpiry = expiryTime;

    await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
    if (tokens.refreshToken) {
      await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toISOString());
  }

  /**
   * Load tokens from AsyncStorage
   */
  public async loadTokens(): Promise<boolean> {
    try {
      const accessToken = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      const tokenExpiry = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);

      if (accessToken && tokenExpiry) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.tokenExpiry = new Date(tokenExpiry);

        // Check if token is expired
        if (this.isTokenExpired()) {
          return await this.refreshAccessToken();
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error loading tokens:', error);
      return false;
    }
  }

  /**
   * Check if access token is expired
   */
  private isTokenExpired(): boolean {
    if (!this.tokenExpiry) return true;
    return new Date() >= this.tokenExpiry;
  }

  /**
   * Get valid access token (refresh if needed)
   */
  private async getValidAccessToken(): Promise<string | null> {
    if (!this.accessToken) {
      const loaded = await this.loadTokens();
      if (!loaded) return null;
    }

    if (this.isTokenExpired()) {
      const refreshed = await this.refreshAccessToken();
      if (!refreshed) return null;
    }

    return this.accessToken;
  }

  /**
   * Fetch last parked location from Google Timeline
   *
   * @param hoursAgo - How many hours back to search (default: 24)
   * @returns Last detected parking location or null
   */
  public async fetchLastParkedLocation(hoursAgo: number = 24): Promise<ParkingLocation | null> {
    try {
      const accessToken = await this.getValidAccessToken();
      if (!accessToken) {
        throw new Error('No valid access token');
      }

      // Calculate time range
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - hoursAgo * 60 * 60 * 1000);

      // TODO: Implement actual Google Timeline API call
      // This is a placeholder - actual implementation would call Timeline API
      console.log('Fetching parking location from Timeline API...');
      console.log(`Time range: ${startTime.toISOString()} to ${endTime.toISOString()}`);

      // Placeholder response
      const mockParkingLocation: ParkingLocation = {
        latitude: 37.78825,
        longitude: -122.4324,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        confidence: 0.85,
        address: 'Market St, San Francisco, CA',
        placeName: 'Public Parking Lot',
        parkingType: 'lot',
        duration: 120, // 2 hours
        source: 'timeline',
      };

      // In production, this would:
      // 1. Call Google Timeline API with date range
      // 2. Analyze activity segments for parking patterns
      // 3. Detect transitions from DRIVING to WALKING
      // 4. Use Places API to identify parking locations
      // 5. Return the most recent parking event

      return mockParkingLocation;
    } catch (error) {
      console.error('Error fetching parking location:', error);
      return null;
    }
  }

  /**
   * Analyze timeline data for parking events
   * Detects when user transitions from driving to walking
   */
  public async detectParkingEvents(
    startTime: Date,
    endTime: Date
  ): Promise<ParkingLocation[]> {
    try {
      const accessToken = await this.getValidAccessToken();
      if (!accessToken) {
        throw new Error('No valid access token');
      }

      // TODO: Implement timeline analysis
      // This would:
      // 1. Fetch timeline data for the specified period
      // 2. Identify DRIVING activity segments
      // 3. Find transitions from DRIVING to WALKING/STILL
      // 4. Mark these transitions as potential parking events
      // 5. Use Places API to validate parking locations

      console.log('Analyzing timeline for parking events...');

      // Placeholder implementation
      return [];
    } catch (error) {
      console.error('Error detecting parking events:', error);
      return [];
    }
  }

  /**
   * Get detailed place information for a location
   */
  public async getPlaceDetails(
    latitude: number,
    longitude: number
  ): Promise<any> {
    try {
      const accessToken = await this.getValidAccessToken();
      if (!accessToken) {
        throw new Error('No valid access token');
      }

      // TODO: Implement Places API call
      // Would use Nearby Search or Place Details API
      // to get information about parking facilities

      console.log(`Getting place details for ${latitude}, ${longitude}`);

      return null;
    } catch (error) {
      console.error('Error getting place details:', error);
      return null;
    }
  }

  /**
   * Fetch raw timeline data
   * Note: Requires special approval from Google
   */
  public async fetchTimelineData(
    startTime: Date,
    endTime: Date
  ): Promise<ActivitySegment[]> {
    try {
      const accessToken = await this.getValidAccessToken();
      if (!accessToken) {
        throw new Error('No valid access token');
      }

      // TODO: Implement Timeline API call
      // Note: Google Timeline API has restricted access
      // Alternative: Use Location History API or Semantic Location History

      const url = `${GOOGLE_CONFIG.TIMELINE_API_BASE}/timeline`;

      // This is a conceptual implementation
      // Actual API may differ based on Google's current offerings

      console.log('Fetching timeline data...');

      return [];
    } catch (error) {
      console.error('Error fetching timeline data:', error);
      return [];
    }
  }

  /**
   * Sign out and clear all stored tokens
   */
  public async signOut(): Promise<void> {
    try {
      // Revoke token if possible
      if (this.accessToken) {
        await fetch(GOOGLE_CONFIG.REVOKE_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            token: this.accessToken,
          }).toString(),
        });
      }

      // Clear stored data
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER_INFO,
        STORAGE_KEYS.TOKEN_EXPIRY,
      ]);

      // Clear instance data
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  /**
   * Check if user is authenticated
   */
  public async isAuthenticated(): Promise<boolean> {
    const token = await this.getValidAccessToken();
    return token !== null;
  }
}

// Export singleton instance
export const googleApi = GoogleApiService.getInstance();