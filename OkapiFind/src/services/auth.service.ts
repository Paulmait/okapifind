import {
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  AuthCredential,
} from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { firebaseAuth, GOOGLE_OAUTH_CONFIG } from '../config/firebase';
import { analytics } from './analytics';


export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerId: string;
}

class AuthService {
  private currentUser: User | null = null;

  constructor() {
    // Listen for auth state changes
    onAuthStateChanged(firebaseAuth, (user) => {
      this.currentUser = user;
      if (user) {
        analytics.setUserId(user.uid);
        analytics.logEvent('auth_state_changed', {
          is_authenticated: true,
          provider: user.providerData[0]?.providerId || 'unknown',
        });
      } else {
        analytics.setUserId(null);
        analytics.logEvent('auth_state_changed', {
          is_authenticated: false,
        });
      }
    });
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): AuthUser | null {
    if (!this.currentUser) return null;

    return {
      uid: this.currentUser.uid,
      email: this.currentUser.email,
      displayName: this.currentUser.displayName,
      photoURL: this.currentUser.photoURL,
      providerId: this.currentUser.providerData[0]?.providerId || 'unknown',
    };
  }

  /**
   * Sign in with Google
   * Note: This method should be called from a component that handles the auth flow
   * The component should pass the credential to this method
   */
  async signInWithGoogleCredential(credential: AuthCredential): Promise<AuthUser | null> {
    try {
      analytics.logEvent('auth_google_started');

      // Sign in with Firebase
      const result = await signInWithCredential(firebaseAuth, credential);

      analytics.logEvent('auth_google_success', {
        user_id: result.user.uid,
      });

      return this.getCurrentUser();
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      analytics.logEvent('auth_google_failed', {
        error: error.message,
      });
      throw new Error(`Google Sign-In failed: ${error.message}`);
    }
  }

  /**
   * Sign in with Apple (iOS only)
   */
  async signInWithApple(): Promise<AuthUser | null> {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS');
    }

    try {
      analytics.logEvent('auth_apple_started');

      // Generate secure nonce for security
      const nonceBytes = await Crypto.getRandomBytesAsync(32);
      const nonce = Array.from(nonceBytes, byte => byte.toString(16).padStart(2, '0')).join('');
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce
      );

      // Request Apple authentication
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      // Create OAuth provider
      const oauthProvider = new OAuthProvider('apple.com');
      const credential = oauthProvider.credential({
        idToken: appleCredential.identityToken!,
        rawNonce: nonce,
      });

      // Sign in with Firebase
      const result = await signInWithCredential(firebaseAuth, credential);

      // Update user profile if name is provided
      if (appleCredential.fullName?.givenName || appleCredential.fullName?.familyName) {
        const displayName = `${appleCredential.fullName.givenName || ''} ${appleCredential.fullName.familyName || ''}`.trim();
        // You might want to update the user profile in Firestore here
      }

      analytics.logEvent('auth_apple_success', {
        user_id: result.user.uid,
      });

      return this.getCurrentUser();
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        analytics.logEvent('auth_apple_cancelled');
        return null;
      }

      console.error('Apple Sign-In Error:', error);
      analytics.logEvent('auth_apple_failed', {
        error: error.message,
      });
      throw new Error(`Apple Sign-In failed: ${error.message}`);
    }
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    try {
      analytics.logEvent('auth_sign_out');
      await signOut(firebaseAuth);
    } catch (error: any) {
      console.error('Sign Out Error:', error);
      throw new Error(`Sign out failed: ${error.message}`);
    }
  }

  /**
   * Check if Apple Sign-In is available
   */
  async isAppleSignInAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;
    return await AppleAuthentication.isAvailableAsync();
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        callback({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          providerId: user.providerData[0]?.providerId || 'unknown',
        });
      } else {
        callback(null);
      }
    });

    return unsubscribe;
  }

  /**
   * Link existing account with Google
   */
  async linkWithGoogle(): Promise<void> {
    // Implementation for linking accounts
    // This would be used to link an anonymous account with Google
  }

  /**
   * Link existing account with Apple
   */
  async linkWithApple(): Promise<void> {
    // Implementation for linking accounts
    // This would be used to link an anonymous account with Apple
  }
}

export const authService = new AuthService();