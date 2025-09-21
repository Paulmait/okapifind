import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Platform,
  TouchableOpacity,
  Text,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { OAuthProvider, signInWithCredential } from 'firebase/auth';
import { firebaseAuth } from '../config/firebase';
import { analytics } from '../services/analytics';

interface AppleLoginButtonProps {
  onSuccess?: (user: any) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
  disabled?: boolean;
  style?: 'white' | 'whiteOutline' | 'black';
  type?: 'signIn' | 'continue' | 'signUp';
  cornerRadius?: number;
}

export const AppleLoginButton: React.FC<AppleLoginButtonProps> = ({
  onSuccess,
  onError,
  onCancel,
  disabled = false,
  style = 'black',
  type = 'signIn',
  cornerRadius = 8,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  // Check if Apple Sign-In is available
  const [isAvailable, setIsAvailable] = useState(false);

  React.useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setIsAvailable);
    }
  }, []);

  const handleAppleSignIn = async () => {
    if (!isAvailable) {
      Alert.alert('Not Available', 'Apple Sign-In is not available on this device');
      return;
    }

    try {
      setIsLoading(true);
      analytics.logEvent('apple_login_button_pressed');

      // Generate a nonce for security
      const nonce = Math.random().toString(36).substring(2, 10);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce
      );

      // Request Apple authentication
      const appleCredentialResponse = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      // Check if we got the identity token
      if (!appleCredentialResponse.identityToken) {
        throw new Error('No identity token received from Apple');
      }

      analytics.logEvent('apple_login_token_received');

      // Create OAuth provider credential
      const oauthProvider = new OAuthProvider('apple.com');
      const credential = oauthProvider.credential({
        idToken: appleCredentialResponse.identityToken,
        rawNonce: nonce,
      });

      // Sign in with Firebase
      const userCredential = await signInWithCredential(firebaseAuth, credential);

      // If this is the first sign-in and we have name data, you might want to update the user profile
      if (appleCredentialResponse.fullName?.givenName || appleCredentialResponse.fullName?.familyName) {
        const displayName = `${appleCredentialResponse.fullName.givenName || ''} ${appleCredentialResponse.fullName.familyName || ''}`.trim();

        // Store the display name in your user database if needed
        // You could use Firestore or update the Firebase Auth profile
        if (__DEV__) {
          console.log('Apple user display name:', displayName);
        }
      }

      analytics.logEvent('apple_login_success', {
        user_id: userCredential.user.uid,
      });

      // Call success callback
      onSuccess?.(userCredential.user);
    } catch (error: any) {
      setIsLoading(false);

      // Handle cancellation
      if (error.code === 'ERR_CANCELED') {
        analytics.logEvent('apple_login_cancelled');
        onCancel?.();
        return;
      }

      // Handle other errors
      console.error('Apple Sign-In error:', error);
      analytics.logEvent('apple_login_error', {
        error: error.message,
        code: error.code,
      });

      const errorMessage = error.message || 'Failed to sign in with Apple';
      Alert.alert('Sign In Error', errorMessage);
      onError?.(new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };

  // Render nothing on non-iOS platforms
  if (Platform.OS !== 'ios') {
    return null;
  }

  // Show loading state or unavailable state
  if (!isAvailable) {
    if (__DEV__) {
      // In development, show a fallback button for testing
      return (
        <TouchableOpacity
          style={[styles.fallbackButton, disabled && styles.buttonDisabled]}
          onPress={() => Alert.alert('Apple Sign-In', 'Not available in development')}
          disabled={disabled}
        >
          <Text style={styles.fallbackText}> Sign in with Apple (Dev)</Text>
        </TouchableOpacity>
      );
    }
    return null;
  }

  // Map button type to AppleAuthentication button type
  const getButtonType = () => {
    switch (type) {
      case 'signUp':
        return AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP;
      case 'continue':
        return AppleAuthentication.AppleAuthenticationButtonType.CONTINUE;
      default:
        return AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN;
    }
  };

  // Map style to AppleAuthentication button style
  const getButtonStyle = () => {
    switch (style) {
      case 'white':
        return AppleAuthentication.AppleAuthenticationButtonStyle.WHITE;
      case 'whiteOutline':
        return AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE;
      default:
        return AppleAuthentication.AppleAuthenticationButtonStyle.BLACK;
    }
  };

  return (
    <View style={[styles.container, disabled && styles.buttonDisabled]}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={getButtonType()}
        buttonStyle={getButtonStyle()}
        cornerRadius={cornerRadius}
        style={styles.appleButton}
        onPress={handleAppleSignIn}
      />
      {/* Disable overlay when button is disabled or loading */}
      {(disabled || isLoading) && (
        <View style={styles.disabledOverlay} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },
  appleButton: {
    width: '100%',
    height: 48,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  disabledOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  fallbackButton: {
    backgroundColor: '#000000',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  fallbackText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AppleLoginButton;