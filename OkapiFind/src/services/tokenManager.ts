// @ts-nocheck
/**
 * Token Manager Service
 * Handles JWT token storage, refresh, and rotation with automatic renewal
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { errorService, ErrorSeverity, ErrorCategory } from './errorService';
import { securityService } from './security';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
}

interface TokenRefreshResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

class TokenManager {
  private static instance: TokenManager;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private tokenRotationEnabled: boolean = true;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // Start with 1 second

  private readonly TOKEN_STORAGE_KEY = '@OkapiFind:tokens';
  private readonly REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry
  private readonly MIN_TOKEN_VALIDITY_MS = 60 * 1000; // 1 minute

  private constructor() {}

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Initialize token manager and load stored tokens
   */
  async initialize(): Promise<void> {
    try {
      await this.loadStoredTokens();

      if (this.accessToken && this.expiresAt) {
        this.scheduleTokenRefresh();
      }
    } catch (error) {
      errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.AUTH, {
        action: 'token_manager_initialization',
      });
    }
  }

  /**
   * Store new token pair
   */
  async setTokens(tokens: TokenPair): Promise<void> {
    try {
      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;
      this.expiresAt = tokens.expiresAt;

      // Store securely
      await this.storeTokens(tokens);

      // Schedule automatic refresh
      this.scheduleTokenRefresh();

      errorService.logInfo('Tokens updated successfully', {
        expiresAt: new Date(tokens.expiresAt).toISOString(),
      });
    } catch (error) {
      errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.AUTH, {
        action: 'set_tokens',
      });
      throw error;
    }
  }

  /**
   * Get current access token, refreshing if needed
   */
  async getAccessToken(): Promise<string | null> {
    try {
      // Check if token exists
      if (!this.accessToken) {
        await this.loadStoredTokens();
        if (!this.accessToken) {
          return null;
        }
      }

      // Check if token is expired or about to expire
      if (this.isTokenExpired()) {
        const refreshed = await this.refreshAccessToken();
        if (!refreshed) {
          return null;
        }
      }

      return this.accessToken;
    } catch (error) {
      errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.AUTH, {
        action: 'get_access_token',
      });
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<boolean> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh with retry logic
   */
  private async performTokenRefresh(): Promise<boolean> {
    if (!this.refreshToken) {
      errorService.logError(
        new Error('No refresh token available'),
        ErrorSeverity.HIGH,
        ErrorCategory.AUTH
      );
      return false;
    }

    let retries = 0;
    let delay = this.retryDelay;

    while (retries < this.maxRetries) {
      try {
        // Check rate limiting
        const canProceed = await securityService.checkRateLimit('token_refresh');
        if (!canProceed) {
          throw new Error('Rate limit exceeded for token refresh');
        }

        const response = await fetch(`${this.getAuthEndpoint()}/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Version': '1.0.0',
          },
          body: JSON.stringify({
            refresh_token: this.refreshToken,
            grant_type: 'refresh_token',
          }),
        });

        if (!response.ok) {
          if (response.status === 401) {
            // Refresh token is invalid, need to re-authenticate
            await this.clearTokens();
            return false;
          }
          throw new Error(`Token refresh failed with status ${response.status}`);
        }

        const data: TokenRefreshResponse = await response.json();

        // Update tokens
        const newTokens: TokenPair = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || this.refreshToken!, // Keep old refresh token if not rotated
          expiresAt: Date.now() + (data.expires_in * 1000),
          tokenType: data.token_type,
        };

        await this.setTokens(newTokens);

        errorService.logInfo('Token refreshed successfully');
        return true;

      } catch (error) {
        retries++;

        if (retries >= this.maxRetries) {
          errorService.logError(error, ErrorSeverity.CRITICAL, ErrorCategory.AUTH, {
            action: 'token_refresh_failed',
            retries,
          });

          // Clear tokens on final failure
          await this.clearTokens();
          return false;
        }

        // Exponential backoff
        errorService.logWarning(`Token refresh attempt ${retries} failed, retrying in ${delay}ms`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        await this.delay(delay);
        delay *= 2; // Exponential backoff
      }
    }

    return false;
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (!this.expiresAt) {
      return;
    }

    // Calculate when to refresh (before expiry with buffer)
    const now = Date.now();
    const refreshAt = this.expiresAt - this.REFRESH_BUFFER_MS;
    const timeUntilRefresh = Math.max(refreshAt - now, 0);

    // Don't schedule if token is already expired or about to expire
    if (timeUntilRefresh < this.MIN_TOKEN_VALIDITY_MS) {
      // Refresh immediately
      this.refreshAccessToken().catch(error => {
        errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.AUTH, {
          action: 'scheduled_refresh_failed',
        });
      });
      return;
    }

    // Schedule refresh
    this.refreshTimer = setTimeout(() => {
      this.refreshAccessToken().catch(error => {
        errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.AUTH, {
          action: 'scheduled_refresh_failed',
        });
      });
    }, timeUntilRefresh);

    errorService.logInfo('Token refresh scheduled', {
      refreshAt: new Date(refreshAt).toISOString(),
      timeUntilRefresh: Math.round(timeUntilRefresh / 1000),
    });
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(): boolean {
    if (!this.expiresAt) {
      return true;
    }

    // Add buffer to ensure token is refreshed before actual expiry
    return Date.now() >= (this.expiresAt - this.REFRESH_BUFFER_MS);
  }

  /**
   * Store tokens securely
   */
  private async storeTokens(tokens: TokenPair): Promise<void> {
    const tokenData = JSON.stringify({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      tokenType: tokens.tokenType,
      storedAt: Date.now(),
    });

    if (Platform.OS === 'web') {
      // Use AsyncStorage for web
      await AsyncStorage.setItem(this.TOKEN_STORAGE_KEY, tokenData);
    } else {
      // Use SecureStore for mobile (encrypted storage)
      await SecureStore.setItemAsync(this.TOKEN_STORAGE_KEY, tokenData);
    }
  }

  /**
   * Load tokens from secure storage
   */
  private async loadStoredTokens(): Promise<void> {
    try {
      let tokenData: string | null = null;

      if (Platform.OS === 'web') {
        tokenData = await AsyncStorage.getItem(this.TOKEN_STORAGE_KEY);
      } else {
        tokenData = await SecureStore.getItemAsync(this.TOKEN_STORAGE_KEY);
      }

      if (tokenData) {
        const tokens = JSON.parse(tokenData);

        // Validate stored tokens
        if (tokens.expiresAt && tokens.accessToken) {
          this.accessToken = tokens.accessToken;
          this.refreshToken = tokens.refreshToken;
          this.expiresAt = tokens.expiresAt;
        }
      }
    } catch (error) {
      errorService.logError(error, ErrorSeverity.MEDIUM, ErrorCategory.AUTH, {
        action: 'load_stored_tokens',
      });
    }
  }

  /**
   * Clear all tokens
   */
  async clearTokens(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;

    // Clear refresh timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    // Clear from storage
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(this.TOKEN_STORAGE_KEY);
    } else {
      await SecureStore.deleteItemAsync(this.TOKEN_STORAGE_KEY);
    }

    errorService.logInfo('Tokens cleared');
  }

  /**
   * Get auth endpoint based on environment
   */
  private getAuthEndpoint(): string {
    const baseUrl = __DEV__
      ? 'https://staging-api.okapifind.com'
      : 'https://api.okapifind.com';
    return `${baseUrl}/api/v1/auth`;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Enable/disable token rotation
   */
  setTokenRotation(enabled: boolean): void {
    this.tokenRotationEnabled = enabled;
  }

  /**
   * Get token expiry time
   */
  getTokenExpiry(): Date | null {
    return this.expiresAt ? new Date(this.expiresAt) : null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.accessToken && !this.isTokenExpired();
  }

  /**
   * Get refresh token (for testing/debugging only)
   */
  getRefreshToken(): string | null {
    if (__DEV__) {
      return this.refreshToken;
    }
    return null;
  }
}

export const tokenManager = TokenManager.getInstance();