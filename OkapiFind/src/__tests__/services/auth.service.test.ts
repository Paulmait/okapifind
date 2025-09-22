/**
 * Auth Service Tests
 */

import { AuthService, authService } from '../../services/auth.service';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { mockFirebaseUser } from '../../../__tests__/mocks/firebase.mock';

// Mock the analytics service
jest.mock('../../services/analytics', () => ({
  analytics: {
    setUserId: jest.fn(),
    logEvent: jest.fn(),
  },
}));

// Mock Firebase config
jest.mock('../../config/firebase', () => ({
  firebaseAuth: {},
  GOOGLE_OAUTH_CONFIG: {
    androidClientId: 'mock-android-client-id',
    iosClientId: 'mock-ios-client-id',
  },
}));

describe('AuthService', () => {
  let authService: AuthService;
  let mockSignInWithCredential: jest.MockedFunction<typeof signInWithCredential>;
  let mockSignOut: jest.MockedFunction<typeof signOut>;
  let mockOnAuthStateChanged: jest.MockedFunction<typeof onAuthStateChanged>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Firebase functions
    mockSignInWithCredential = signInWithCredential as jest.MockedFunction<typeof signInWithCredential>;
    mockSignOut = signOut as jest.MockedFunction<typeof signOut>;
    mockOnAuthStateChanged = onAuthStateChanged as jest.MockedFunction<typeof onAuthStateChanged>;

    // Create a new AuthService instance for each test
    authService = new AuthService();
  });

  describe('Constructor', () => {
    it('should set up auth state listener', () => {
      expect(mockOnAuthStateChanged).toHaveBeenCalled();
    });

    it('should handle user authenticated state change', () => {
      const callback = mockOnAuthStateChanged.mock.calls[0][1];

      // Simulate user authenticated
      callback(mockFirebaseUser as any);

      expect(authService.getCurrentUser()).toEqual({
        uid: mockFirebaseUser.uid,
        email: mockFirebaseUser.email,
        displayName: mockFirebaseUser.displayName,
        photoURL: mockFirebaseUser.photoURL,
        providerId: mockFirebaseUser.providerData[0].providerId,
      });
    });

    it('should handle user unauthenticated state change', () => {
      const callback = mockOnAuthStateChanged.mock.calls[0][1];

      // Simulate user unauthenticated
      callback(null);

      expect(authService.getCurrentUser()).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('should return null when no user is authenticated', () => {
      expect(authService.getCurrentUser()).toBeNull();
    });

    it('should return current user when authenticated', () => {
      // Simulate authentication state change
      const callback = mockOnAuthStateChanged.mock.calls[0][1];
      callback(mockFirebaseUser as any);

      const user = authService.getCurrentUser();
      expect(user).toEqual({
        uid: mockFirebaseUser.uid,
        email: mockFirebaseUser.email,
        displayName: mockFirebaseUser.displayName,
        photoURL: mockFirebaseUser.photoURL,
        providerId: mockFirebaseUser.providerData[0].providerId,
      });
    });
  });

  describe('signInWithGoogleCredential', () => {
    it('should successfully sign in with Google credential', async () => {
      const mockCredential = { providerId: 'google.com' } as any;
      const mockResult = { user: mockFirebaseUser };

      mockSignInWithCredential.mockResolvedValue(mockResult as any);

      // Simulate user being set after successful sign-in
      const callback = mockOnAuthStateChanged.mock.calls[0][1];
      callback(mockFirebaseUser as any);

      const result = await authService.signInWithGoogleCredential(mockCredential);

      expect(mockSignInWithCredential).toHaveBeenCalledWith({}, mockCredential);
      expect(result).toEqual({
        uid: mockFirebaseUser.uid,
        email: mockFirebaseUser.email,
        displayName: mockFirebaseUser.displayName,
        photoURL: mockFirebaseUser.photoURL,
        providerId: mockFirebaseUser.providerData[0].providerId,
      });
    });

    it('should handle Google sign-in error', async () => {
      const mockCredential = { providerId: 'google.com' } as any;
      const error = new Error('Network error');

      mockSignInWithCredential.mockRejectedValue(error);

      await expect(authService.signInWithGoogleCredential(mockCredential))
        .rejects.toThrow('Google Sign-In failed: Network error');
    });
  });

  describe('signInWithApple', () => {
    beforeEach(() => {
      // Mock Platform.OS to be iOS
      Object.defineProperty(Platform, 'OS', { value: 'ios' });
    });

    it('should successfully sign in with Apple on iOS', async () => {
      const mockAppleCredential = {
        identityToken: 'mock-identity-token',
        fullName: {
          givenName: 'John',
          familyName: 'Doe',
        },
      };

      const mockOAuthCredential = { providerId: 'apple.com' };
      const mockResult = { user: mockFirebaseUser };

      // Mock crypto functions
      (Crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(new Uint8Array(32));
      (Crypto.digestStringAsync as jest.Mock).mockResolvedValue('hashed-nonce');

      // Mock Apple Authentication
      (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(mockAppleCredential);

      // Mock OAuth provider
      const mockOAuthProvider = {
        credential: jest.fn().mockReturnValue(mockOAuthCredential),
      };
      (OAuthProvider as jest.Mock).mockImplementation(() => mockOAuthProvider);

      mockSignInWithCredential.mockResolvedValue(mockResult as any);

      // Simulate user being set after successful sign-in
      const callback = mockOnAuthStateChanged.mock.calls[0][1];
      callback(mockFirebaseUser as any);

      const result = await authService.signInWithApple();

      expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: 'hashed-nonce',
      });

      expect(result).toEqual({
        uid: mockFirebaseUser.uid,
        email: mockFirebaseUser.email,
        displayName: mockFirebaseUser.displayName,
        photoURL: mockFirebaseUser.photoURL,
        providerId: mockFirebaseUser.providerData[0].providerId,
      });
    });

    it('should throw error on Android', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'android' });

      await expect(authService.signInWithApple())
        .rejects.toThrow('Apple Sign-In is only available on iOS');
    });

    it('should return null when Apple sign-in is cancelled', async () => {
      const error = new Error('User cancelled');
      error.code = 'ERR_CANCELED';

      (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(error);

      const result = await authService.signInWithApple();
      expect(result).toBeNull();
    });

    it('should handle Apple sign-in error', async () => {
      const error = new Error('Network error');

      (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(error);

      await expect(authService.signInWithApple())
        .rejects.toThrow('Apple Sign-In failed: Network error');
    });
  });

  describe('signOut', () => {
    it('should successfully sign out', async () => {
      mockSignOut.mockResolvedValue(undefined);

      await authService.signOut();

      expect(mockSignOut).toHaveBeenCalledWith({});
    });

    it('should handle sign out error', async () => {
      const error = new Error('Sign out error');
      mockSignOut.mockRejectedValue(error);

      await expect(authService.signOut())
        .rejects.toThrow('Sign out failed: Sign out error');
    });
  });

  describe('isAppleSignInAvailable', () => {
    it('should return false on Android', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'android' });

      const result = await authService.isAppleSignInAvailable();
      expect(result).toBe(false);
    });

    it('should check availability on iOS', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios' });
      (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);

      const result = await authService.isAppleSignInAvailable();

      expect(AppleAuthentication.isAvailableAsync).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('onAuthStateChanged', () => {
    it('should call callback with user when authenticated', () => {
      const callback = jest.fn();
      const unsubscribe = authService.onAuthStateChanged(callback);

      // Get the internal Firebase listener
      const firebaseCallback = mockOnAuthStateChanged.mock.calls[mockOnAuthStateChanged.mock.calls.length - 1][1];

      // Simulate user authentication
      firebaseCallback(mockFirebaseUser as any);

      expect(callback).toHaveBeenCalledWith({
        uid: mockFirebaseUser.uid,
        email: mockFirebaseUser.email,
        displayName: mockFirebaseUser.displayName,
        photoURL: mockFirebaseUser.photoURL,
        providerId: mockFirebaseUser.providerData[0].providerId,
      });

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call callback with null when unauthenticated', () => {
      const callback = jest.fn();
      authService.onAuthStateChanged(callback);

      // Get the internal Firebase listener
      const firebaseCallback = mockOnAuthStateChanged.mock.calls[mockOnAuthStateChanged.mock.calls.length - 1][1];

      // Simulate user sign out
      firebaseCallback(null);

      expect(callback).toHaveBeenCalledWith(null);
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with no provider data', () => {
      const userWithoutProvider = {
        ...mockFirebaseUser,
        providerData: [],
      };

      const callback = mockOnAuthStateChanged.mock.calls[0][1];
      callback(userWithoutProvider as any);

      const user = authService.getCurrentUser();
      expect(user?.providerId).toBe('unknown');
    });

    it('should handle crypto operations failure in Apple sign-in', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios' });

      (Crypto.getRandomBytesAsync as jest.Mock).mockRejectedValue(new Error('Crypto error'));

      await expect(authService.signInWithApple())
        .rejects.toThrow('Apple Sign-In failed: Crypto error');
    });
  });

  describe('Analytics Integration', () => {
    it('should log analytics events during Google sign-in', async () => {
      const { analytics } = require('../../services/analytics');
      const mockCredential = { providerId: 'google.com' } as any;
      const mockResult = { user: mockFirebaseUser };

      mockSignInWithCredential.mockResolvedValue(mockResult as any);

      const callback = mockOnAuthStateChanged.mock.calls[0][1];
      callback(mockFirebaseUser as any);

      await authService.signInWithGoogleCredential(mockCredential);

      expect(analytics.logEvent).toHaveBeenCalledWith('auth_google_started');
      expect(analytics.logEvent).toHaveBeenCalledWith('auth_google_success', {
        user_id: mockFirebaseUser.uid,
      });
    });

    it('should log analytics events during sign out', async () => {
      const { analytics } = require('../../services/analytics');
      mockSignOut.mockResolvedValue(undefined);

      await authService.signOut();

      expect(analytics.logEvent).toHaveBeenCalledWith('auth_sign_out');
    });
  });
});