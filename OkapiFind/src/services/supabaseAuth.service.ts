/**
 * Supabase Auth Service
 * Handles email magic link authentication via Supabase
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase-client';
import { analytics } from './analytics';
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

export interface SupabaseUser {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface MagicLinkResult {
  success: boolean;
  message: string;
}

class SupabaseAuthService {
  private initialized = false;

  /**
   * Check if Supabase auth is available
   */
  isAvailable(): boolean {
    return isSupabaseConfigured();
  }

  /**
   * Send magic link email for passwordless sign-in
   */
  async sendMagicLink(email: string): Promise<MagicLinkResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        message: 'Authentication service not available',
      };
    }

    try {
      analytics.logEvent('auth_magic_link_requested', { email_domain: email.split('@')[1] });

      // Get the app scheme for deep linking
      const redirectUrl = this.getRedirectUrl();

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        analytics.logEvent('auth_magic_link_failed', { error: error.message });
        return {
          success: false,
          message: error.message,
        };
      }

      analytics.logEvent('auth_magic_link_sent');
      return {
        success: true,
        message: 'Check your email for the sign-in link!',
      };
    } catch (error: any) {
      console.error('Magic link error:', error);
      analytics.logEvent('auth_magic_link_error', { error: error.message });
      return {
        success: false,
        message: error.message || 'Failed to send magic link',
      };
    }
  }

  /**
   * Get the redirect URL for magic link authentication
   */
  private getRedirectUrl(): string {
    const scheme = Constants.expoConfig?.scheme || 'okapifind';
    // For development, use exp scheme
    if (__DEV__) {
      return `exp://127.0.0.1:8081/--/auth/callback`;
    }
    // For production, use the app scheme
    return `${scheme}://auth/callback`;
  }

  /**
   * Handle the magic link callback (deep link)
   */
  async handleMagicLinkCallback(url: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      // Extract the token from the URL
      const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1]);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('Set session error:', error);
          return false;
        }

        analytics.logEvent('auth_magic_link_success');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Magic link callback error:', error);
      return false;
    }
  }

  /**
   * Get the current Supabase user
   */
  async getCurrentUser(): Promise<SupabaseUser | null> {
    if (!this.isAvailable()) return null;

    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) return null;

      return {
        id: user.id,
        email: user.email || null,
        phone: user.phone || null,
        created_at: user.created_at,
        updated_at: user.updated_at || user.created_at,
      };
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  /**
   * Sign out from Supabase
   */
  async signOut(): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      analytics.logEvent('auth_supabase_sign_out');
      await supabase.auth.signOut();
    } catch (error: any) {
      console.error('Supabase sign out error:', error);
      throw new Error(`Sign out failed: ${error.message}`);
    }
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (user: SupabaseUser | null) => void): () => void {
    if (!this.isAvailable()) {
      return () => {};
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Supabase auth event:', event);

        if (session?.user) {
          callback({
            id: session.user.id,
            email: session.user.email || null,
            phone: session.user.phone || null,
            created_at: session.user.created_at,
            updated_at: session.user.updated_at || session.user.created_at,
          });
        } else {
          callback(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }

  /**
   * Get current session
   */
  async getSession() {
    if (!this.isAvailable()) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    } catch (error) {
      console.error('Get session error:', error);
      return null;
    }
  }

  /**
   * Refresh the current session
   */
  async refreshSession() {
    if (!this.isAvailable()) return null;

    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      return session;
    } catch (error) {
      console.error('Refresh session error:', error);
      return null;
    }
  }
}

export const supabaseAuthService = new SupabaseAuthService();
