import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import { Colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { analytics } from '../services/analytics';

type SignInScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SignIn'>;

export default function SignInScreen() {
  const navigation = useNavigation<SignInScreenNavigationProp>();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const { signInWithGoogle, signInWithApple, appleSignInAvailable, isLoading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setSigningIn(true);
      analytics.logEvent('sign_in_button_pressed', { provider: 'google' });

      const user = await signInWithGoogle();
      if (user) {
        analytics.logEvent('sign_in_success', { provider: 'google', user_id: user.uid });
        navigation.goBack();
      }
    } catch (error: any) {
      Alert.alert('Sign In Failed', error.message || 'Please try again');
    } finally {
      setSigningIn(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setSigningIn(true);
      analytics.logEvent('sign_in_button_pressed', { provider: 'apple' });

      const user = await signInWithApple();
      if (user) {
        analytics.logEvent('sign_in_success', { provider: 'apple', user_id: user.uid });
        navigation.goBack();
      }
    } catch (error: any) {
      Alert.alert('Sign In Failed', error.message || 'Please try again');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSkip = () => {
    analytics.logEvent('sign_in_skipped');
    navigation.goBack();
  };

  const styles = getStyles(isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>🚗</Text>
            <Text style={styles.logoArrow}>↑</Text>
          </View>
          <Text style={styles.title}>Sign In to OkapiFind</Text>
          <Text style={styles.subtitle}>
            Sync your parking locations across all your devices
          </Text>
        </View>

        <View style={styles.benefitsSection}>
          <BenefitItem
            icon="☁️"
            text="Cloud backup of all your parking locations"
            isDarkMode={isDarkMode}
          />
          <BenefitItem
            icon="📱"
            text="Sync across all your devices"
            isDarkMode={isDarkMode}
          />
          <BenefitItem
            icon="🔒"
            text="Secure and private"
            isDarkMode={isDarkMode}
          />
          <BenefitItem
            icon="👥"
            text="Share parking spots with family"
            isDarkMode={isDarkMode}
          />
        </View>

        <View style={styles.buttonsSection}>
          {signingIn || isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Signing in...</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                disabled={signingIn}
              >
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </TouchableOpacity>

              {Platform.OS === 'ios' && appleSignInAvailable && (
                <TouchableOpacity
                  style={styles.appleButton}
                  onPress={handleAppleSignIn}
                  disabled={signingIn}
                >
                  <Text style={styles.appleIcon}></Text>
                  <Text style={styles.appleButtonText}>Continue with Apple</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
                disabled={signingIn}
              >
                <Text style={styles.skipButtonText}>Skip for now</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.disclaimer}>
          Your data is secure and will never be shared with third parties.
          Sign in is optional but recommended for the best experience.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const BenefitItem = ({ icon, text, isDarkMode }: { icon: string; text: string; isDarkMode: boolean }) => (
  <View style={getStyles(isDarkMode).benefitItem}>
    <Text style={getStyles(isDarkMode).benefitIcon}>{icon}</Text>
    <Text style={getStyles(isDarkMode).benefitText}>{text}</Text>
  </View>
);

const getStyles = (isDarkMode: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? Colors.background : '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: isDarkMode ? Colors.textSecondary : '#666',
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  logo: {
    fontSize: 40,
    color: Colors.background,
  },
  logoArrow: {
    fontSize: 20,
    color: Colors.background,
    position: 'absolute',
    top: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: isDarkMode ? Colors.textPrimary : '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: isDarkMode ? Colors.textSecondary : '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  benefitsSection: {
    marginBottom: 40,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  benefitIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  benefitText: {
    fontSize: 15,
    color: isDarkMode ? Colors.textPrimary : '#333',
    flex: 1,
  },
  buttonsSection: {
    marginBottom: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: isDarkMode ? Colors.textSecondary : '#666',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 12,
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3C4043',
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
  },
  appleIcon: {
    fontSize: 18,
    marginRight: 12,
    color: '#FFFFFF',
  },
  appleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.primary,
  },
  disclaimer: {
    fontSize: 12,
    color: isDarkMode ? '#999' : '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 'auto',
    marginBottom: 20,
  },
});