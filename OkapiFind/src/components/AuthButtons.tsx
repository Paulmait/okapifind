import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  Platform,
} from 'react-native';
import GoogleLoginButton from './GoogleLoginButton';
import AppleLoginButton from './AppleLoginButton';
import { User } from 'firebase/auth';
import { Colors } from '../constants/colors';

interface AuthButtonsProps {
  onAuthSuccess?: (user: User) => void;
  onAuthError?: (error: Error) => void;
  onAuthCancel?: () => void;
  showTitle?: boolean;
  disabled?: boolean;
  theme?: 'light' | 'dark' | 'auto';
}

export const AuthButtons: React.FC<AuthButtonsProps> = ({
  onAuthSuccess,
  onAuthError,
  onAuthCancel,
  showTitle = true,
  disabled = false,
  theme = 'auto',
}) => {
  const handleSuccess = (user: User) => {
    console.log('Authentication successful:', user.email);
    onAuthSuccess?.(user);
  };

  const handleError = (error: Error) => {
    console.error('Authentication error:', error);
    onAuthError?.(error);
  };

  const handleCancel = () => {
    console.log('Authentication cancelled');
    onAuthCancel?.();
  };

  return (
    <View style={styles.container}>
      {showTitle && (
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Sign in to sync your data</Text>
          <Text style={styles.subtitle}>
            Access your parking locations from any device
          </Text>
        </View>
      )}

      <View style={styles.buttonsContainer}>
        <GoogleLoginButton
          onSuccess={handleSuccess}
          onError={handleError}
          onCancel={handleCancel}
          disabled={disabled}
          theme={theme}
        />

        {Platform.OS === 'ios' && (
          <View style={styles.buttonSpacing}>
            <AppleLoginButton
              onSuccess={handleSuccess}
              onError={handleError}
              onCancel={handleCancel}
              disabled={disabled}
              style={theme === 'dark' ? 'white' : 'black'}
            />
          </View>
        )}
      </View>

      <View style={styles.dividerContainer}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.divider} />
      </View>

      <Text style={styles.disclaimer}>
        By signing in, you agree to our Terms of Service and Privacy Policy.
        Your data is encrypted and secure.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 20,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary || '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary || '#666',
    textAlign: 'center',
  },
  buttonsContainer: {
    width: '100%',
  },
  buttonSpacing: {
    marginTop: 12,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  disclaimer: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default AuthButtons;