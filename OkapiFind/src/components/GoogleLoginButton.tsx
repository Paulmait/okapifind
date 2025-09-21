import React, { useEffect, useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  View,
  Platform,
} from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { firebaseAuth, GOOGLE_OAUTH_CONFIG } from '../config/firebase';
import { analytics } from '../services/analytics';
import { Colors } from '../constants/colors';

// Complete auth session for web browsers
WebBrowser.maybeCompleteAuthSession();

interface GoogleLoginButtonProps {
  onSuccess?: (user: any) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
  disabled?: boolean;
  variant?: 'standard' | 'compact';
  theme?: 'light' | 'dark' | 'auto';
}

export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  onSuccess,
  onError,
  onCancel,
  disabled = false,
  variant = 'standard',
  theme = 'auto',
}) => {
  const [isLoading, setIsLoading] = useState(false);

  // Configure Google Auth with proper client IDs for each platform
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: GOOGLE_OAUTH_CONFIG.webClientId,
    iosClientId: GOOGLE_OAUTH_CONFIG.iosClientId,
    androidClientId: GOOGLE_OAUTH_CONFIG.androidClientId,
    webClientId: GOOGLE_OAUTH_CONFIG.webClientId,
    scopes: ['profile', 'email'],
  });

  useEffect(() => {
    handleGoogleResponse();
  }, [response]);

  const handleGoogleResponse = async () => {
    if (response?.type === 'success') {
      const { authentication } = response;

      if (authentication) {
        setIsLoading(true);

        try {
          // Log analytics event
          analytics.logEvent('google_login_token_received');

          // Create Firebase credential using the ID token and access token
          // Note: For Google Sign-In, we primarily use the ID token
          const credential = GoogleAuthProvider.credential(
            authentication.idToken,
            authentication.accessToken
          );

          // Sign in with Firebase
          const userCredential = await signInWithCredential(firebaseAuth, credential);

          // Log success
          analytics.logEvent('google_login_success', {
            user_id: userCredential.user.uid,
          });

          // Call success callback
          onSuccess?.(userCredential.user);
        } catch (error: any) {
          console.error('Firebase sign-in error:', error);
          analytics.logEvent('google_login_firebase_error', {
            error: error.message,
          });

          const errorMessage = error.message || 'Failed to sign in with Google';
          Alert.alert('Sign In Error', errorMessage);
          onError?.(new Error(errorMessage));
        } finally {
          setIsLoading(false);
        }
      }
    } else if (response?.type === 'cancel') {
      analytics.logEvent('google_login_cancelled');
      onCancel?.();
    } else if (response?.type === 'error') {
      analytics.logEvent('google_login_error', {
        error: response.error,
      });
      const error = new Error(response.error || 'Google sign-in failed');
      Alert.alert('Sign In Error', error.message);
      onError?.(error);
    }
  };

  const handlePress = async () => {
    if (!request) {
      Alert.alert('Configuration Error', 'Google Sign-In is not properly configured');
      return;
    }

    try {
      setIsLoading(true);
      analytics.logEvent('google_login_button_pressed');

      // Prompt the user to sign in with Google
      await promptAsync();
    } catch (error: any) {
      console.error('Google sign-in prompt error:', error);
      analytics.logEvent('google_login_prompt_error', {
        error: error.message,
      });
      Alert.alert('Sign In Error', 'Failed to open Google sign-in');
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  const isDark = theme === 'dark' || (theme === 'auto' && Colors.background === Colors.background);

  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === 'compact' && styles.buttonCompact,
        isDark && styles.buttonDark,
        disabled && styles.buttonDisabled,
      ]}
      onPress={handlePress}
      disabled={disabled || isLoading || !request}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={isDark ? '#FFFFFF' : '#4285F4'}
            style={styles.loader}
          />
        ) : (
          <>
            <View style={[styles.iconContainer, isDark && styles.iconContainerDark]}>
              <Text style={styles.googleIcon}>G</Text>
            </View>
            <Text style={[
              styles.text,
              variant === 'compact' && styles.textCompact,
              isDark && styles.textDark,
            ]}>
              {variant === 'compact' ? 'Sign in' : 'Sign in with Google'}
            </Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#DADCE0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  buttonCompact: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 40,
  },
  buttonDark: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 20,
    height: 20,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  iconContainerDark: {
    backgroundColor: '#FFFFFF',
  },
  googleIcon: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3C4043',
  },
  textCompact: {
    fontSize: 14,
  },
  textDark: {
    color: '#FFFFFF',
  },
  loader: {
    marginVertical: 2,
  },
});

export default GoogleLoginButton;