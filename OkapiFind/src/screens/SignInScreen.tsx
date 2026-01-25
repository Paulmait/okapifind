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
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import { Colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { analytics } from '../services/analytics';
import { supabaseAuthService } from '../services/supabaseAuth.service';

type SignInScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SignIn'>;

export default function SignInScreen() {
  const navigation = useNavigation<SignInScreenNavigationProp>();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const { signInWithGoogle, signInWithApple, appleSignInAvailable, isLoading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendMagicLink = async () => {
    setEmailError(null);

    if (!email.trim()) {
      setEmailError('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    try {
      setSigningIn(true);
      analytics.logEvent('sign_in_button_pressed', { provider: 'magic_link' });

      const result = await supabaseAuthService.sendMagicLink(email.trim().toLowerCase());

      if (result.success) {
        setMagicLinkSent(true);
        analytics.logEvent('magic_link_sent', { email_domain: email.split('@')[1] });
      } else {
        setEmailError(result.message);
      }
    } catch (error: any) {
      setEmailError(error.message || 'Failed to send magic link');
    } finally {
      setSigningIn(false);
    }
  };

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

  // Show success screen after magic link is sent
  if (magicLinkSent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.emailIconContainer}>
            <Text style={styles.emailIconText}>✉️</Text>
          </View>
          <Text style={styles.successTitle}>Check Your Email!</Text>
          <Text style={styles.successSubtitle}>
            We've sent a magic sign-in link to:
          </Text>
          <Text style={styles.emailDisplay}>{email}</Text>
          <Text style={styles.successInstructions}>
            Click the link in your email to sign in instantly. No password needed!
          </Text>

          <View style={styles.tipsContainer}>
            <Text style={styles.tipsTitle}>Didn't receive it?</Text>
            <Text style={styles.tipItem}>• Check your spam/junk folder</Text>
            <Text style={styles.tipItem}>• Make sure you entered the correct email</Text>
            <Text style={styles.tipItem}>• Wait a few minutes and try again</Text>
          </View>

          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleSendMagicLink}
            disabled={signingIn}
          >
            {signingIn ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <Text style={styles.resendButtonText}>Resend Magic Link</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tryDifferentButton}
            onPress={() => setMagicLinkSent(false)}
          >
            <Text style={styles.tryDifferentText}>Use a different email</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backToAppButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backToAppText}>Back to App</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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

        {/* Email Magic Link Section */}
        <View style={styles.emailSection}>
          <Text style={styles.sectionTitle}>Sign in with Email</Text>
          <Text style={styles.sectionDescription}>
            No password required - we'll send you a secure link
          </Text>

          {emailError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{emailError}</Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>📧</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email address"
              placeholderTextColor="#999"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setEmailError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!signingIn}
            />
          </View>

          <TouchableOpacity
            style={[styles.magicLinkButton, signingIn && styles.buttonDisabled]}
            onPress={handleSendMagicLink}
            disabled={signingIn}
          >
            {signingIn ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.magicLinkIcon}>✨</Text>
                <Text style={styles.magicLinkButtonText}>Send Magic Link</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.buttonsSection}>
          {signingIn || isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Signing in...</Text>
            </View>
          ) : (
            <>
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
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                disabled={signingIn}
              >
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </TouchableOpacity>

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
        </ScrollView>
      </KeyboardAvoidingView>
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
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
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
  // Email Magic Link Styles
  emailSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: isDarkMode ? Colors.textPrimary : '#333',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: isDarkMode ? Colors.textSecondary : '#666',
    marginBottom: 16,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDarkMode ? '#444' : '#e0e0e0',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  inputIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 16,
    color: isDarkMode ? Colors.textPrimary : '#333',
  },
  magicLinkButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  magicLinkIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  magicLinkButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: isDarkMode ? '#444' : '#e0e0e0',
  },
  dividerText: {
    color: isDarkMode ? Colors.textSecondary : '#999',
    fontSize: 14,
    marginHorizontal: 16,
  },
  // Success Screen Styles
  successContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e8f5e9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emailIconText: {
    fontSize: 48,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: isDarkMode ? Colors.textPrimary : '#333',
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 16,
    color: isDarkMode ? Colors.textSecondary : '#666',
    marginBottom: 8,
  },
  emailDisplay: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 16,
  },
  successInstructions: {
    fontSize: 15,
    color: isDarkMode ? Colors.textSecondary : '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  tipsContainer: {
    backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: isDarkMode ? Colors.textPrimary : '#333',
    marginBottom: 12,
  },
  tipItem: {
    fontSize: 14,
    color: isDarkMode ? Colors.textSecondary : '#666',
    marginBottom: 6,
  },
  resendButton: {
    backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 12,
    height: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  resendButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  tryDifferentButton: {
    padding: 12,
    marginBottom: 16,
  },
  tryDifferentText: {
    color: isDarkMode ? Colors.textSecondary : '#666',
    fontSize: 15,
    textDecorationLine: 'underline',
  },
  backToAppButton: {
    padding: 12,
  },
  backToAppText: {
    color: isDarkMode ? '#999' : '#999',
    fontSize: 14,
  },
});