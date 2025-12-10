import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Platform,
  useColorScheme,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GoogleLoginButton from '../components/GoogleLoginButton';
import AppleLoginButton from '../components/AppleLoginButton';
import { Colors } from '../constants/colors';
import { analytics } from '../services/analytics';

export default function AuthScreen() {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const [isLoading, _setIsLoading] = useState(false);

  const handlePrivacyPolicy = () => {
    if (Platform.OS === 'web') {
      window.open('https://okapifind.com/privacy', '_blank');
    } else {
      Linking.openURL('https://okapifind.com/privacy');
    }
  };

  const handleTermsOfService = () => {
    if (Platform.OS === 'web') {
      window.open('https://okapifind.com/terms', '_blank');
    } else {
      Linking.openURL('https://okapifind.com/terms');
    }
  };

  const handleAuthSuccess = (user: any) => {
    analytics.logEvent('auth_success', {
      provider: user.providerId || 'unknown',
      uid: user.uid,
    });
    // Navigation will be handled by App.tsx auth state listener
  };

  const handleAuthError = (error: Error) => {
    analytics.logEvent('auth_error', {
      error: error.message,
    });
    Alert.alert('Sign In Failed', error.message);
  };

  const handleAuthCancel = () => {
    analytics.logEvent('auth_cancelled');
  };

  const handleSkipSignIn = () => {
    analytics.logEvent('auth_skipped');
    Alert.alert(
      'Continue Without Account',
      'You can use OkapiFind without an account, but your data won\'t sync across devices.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            // For now, we'll just log the event
            // You could implement anonymous auth here if needed
            analytics.logEvent('auth_skip_confirmed');
          }
        }
      ]
    );
  };

  const styles = getStyles(isDarkMode);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Logo and Branding */}
          <View style={styles.brandSection}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoIcon}>🚗</Text>
              <Text style={styles.logoArrow}>↑</Text>
            </View>
            <Text style={styles.appName}>OkapiFind</Text>
            <Text style={styles.tagline}>Never lose your car</Text>
          </View>

          {/* Benefits */}
          <View style={styles.benefitsSection}>
            <BenefitItem
              icon="☁️"
              title="Cloud Sync"
              description="Access your parking spots from any device"
              isDarkMode={isDarkMode}
            />
            <BenefitItem
              icon="🔒"
              title="Secure & Private"
              description="Your data is encrypted and protected"
              isDarkMode={isDarkMode}
            />
            <BenefitItem
              icon="👥"
              title="Share Locations"
              description="Share parking spots with family"
              isDarkMode={isDarkMode}
            />
            <BenefitItem
              icon="🎯"
              title="Premium Features"
              description="Unlock advanced features with your account"
              isDarkMode={isDarkMode}
            />
          </View>

          {/* Auth Buttons */}
          <View style={styles.authSection}>
            <Text style={styles.authTitle}>Sign in to get started</Text>

            <View style={styles.buttonsContainer}>
              <GoogleLoginButton
                onSuccess={handleAuthSuccess}
                onError={handleAuthError}
                onCancel={handleAuthCancel}
                disabled={isLoading}
                theme={isDarkMode ? 'dark' : 'light'}
              />

              {Platform.OS === 'ios' && (
                <View style={styles.buttonSpacing}>
                  <AppleLoginButton
                    onSuccess={handleAuthSuccess}
                    onError={handleAuthError}
                    onCancel={handleAuthCancel}
                    disabled={isLoading}
                    style={isDarkMode ? 'white' : 'black'}
                  />
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkipSignIn}
              disabled={isLoading}
            >
              <Text style={styles.skipButtonText}>Continue without account</Text>
            </TouchableOpacity>
          </View>

          {/* Legal */}
          <View style={styles.legalSection}>
            <Text style={styles.legalText}>
              By signing in, you agree to our{'\n'}
              <Text style={styles.legalLink} onPress={handleTermsOfService}>
                Terms of Service
              </Text>
              {' and '}
              <Text style={styles.legalLink} onPress={handlePrivacyPolicy}>
                Privacy Policy
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface BenefitItemProps {
  icon: string;
  title: string;
  description: string;
  isDarkMode: boolean;
}

const BenefitItem: React.FC<BenefitItemProps> = ({ icon, title, description, isDarkMode }) => {
  const styles = getStyles(isDarkMode);
  return (
    <View style={styles.benefitItem}>
      <Text style={styles.benefitIcon}>{icon}</Text>
      <View style={styles.benefitContent}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitDescription}>{description}</Text>
      </View>
    </View>
  );
};

const getStyles = (isDarkMode: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDarkMode ? Colors.background : '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  brandSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  logoIcon: {
    fontSize: 50,
    color: Colors.background,
  },
  logoArrow: {
    fontSize: 25,
    color: Colors.background,
    position: 'absolute',
    top: 15,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: isDarkMode ? Colors.textPrimary : '#000',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    color: isDarkMode ? Colors.textSecondary : '#666',
  },
  benefitsSection: {
    marginVertical: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  benefitIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: isDarkMode ? Colors.textPrimary : '#000',
    marginBottom: 2,
  },
  benefitDescription: {
    fontSize: 14,
    color: isDarkMode ? Colors.textSecondary : '#666',
  },
  authSection: {
    marginVertical: 20,
  },
  authTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: isDarkMode ? Colors.textPrimary : '#000',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonsContainer: {
    marginBottom: 16,
  },
  buttonSpacing: {
    marginTop: 12,
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500',
  },
  legalSection: {
    paddingVertical: 20,
    paddingBottom: 40,
  },
  legalText: {
    fontSize: 12,
    color: isDarkMode ? '#999' : '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
});