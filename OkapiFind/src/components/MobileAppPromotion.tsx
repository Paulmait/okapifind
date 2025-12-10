/**
 * Mobile App Promotion Banner for Web Users
 * Encourages web users to download mobile app for full experience
 * Shows when Apple/Google apps are available
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Colors } from '../constants/colors';

interface MobileAppPromotionProps {
  isVisible?: boolean;
  onDismiss?: () => void;
}

export const MobileAppPromotion: React.FC<MobileAppPromotionProps> = ({
  isVisible = true,
  onDismiss,
}) => {
  const [showBanner, setShowBanner] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-100));

  // App Store URLs from config
  const appStoreUrl = Constants.expoConfig?.extra?.appStoreUrl;
  const playStoreUrl = Constants.expoConfig?.extra?.playStoreUrl;

  useEffect(() => {
    checkShouldShowBanner();
  }, []);

  useEffect(() => {
    if (showBanner && isVisible) {
      // Slide in animation
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 8,
      }).start();
    }
  }, [showBanner, isVisible]);

  const checkShouldShowBanner = async () => {
    // Only show on web
    if (Platform.OS !== 'web') {
      return;
    }

    try {
      // Check if user has dismissed the banner
      const dismissed = await AsyncStorage.getItem('mobile_app_banner_dismissed');
      const dismissedDate = dismissed ? parseInt(dismissed, 10) : 0;
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      // Show again after 7 days
      if (now - dismissedDate > sevenDays) {
        setShowBanner(true);
      }
    } catch (error) {
      console.error('Error checking banner status:', error);
    }
  };

  const handleDismiss = async () => {
    // Slide out animation
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowBanner(false);
      onDismiss?.();
    });

    // Save dismissal date
    try {
      await AsyncStorage.setItem('mobile_app_banner_dismissed', Date.now().toString());
    } catch (error) {
      console.error('Error saving banner dismissal:', error);
    }
  };

  const handleDownload = async (store: 'ios' | 'android') => {
    const url = store === 'ios' ? appStoreUrl : playStoreUrl;

    if (!url) {
      console.warn(`${store} app URL not configured`);
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.error('Cannot open URL:', url);
      }
    } catch (error) {
      console.error('Error opening store URL:', error);
    }
  };

  const detectMobileOS = (): 'ios' | 'android' | 'unknown' => {
    if (typeof navigator === 'undefined') return 'unknown';

    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

    // iOS detection
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      return 'ios';
    }

    // Android detection
    if (/android/i.test(userAgent)) {
      return 'android';
    }

    return 'unknown';
  };

  if (!showBanner || !isVisible || Platform.OS !== 'web') {
    return null;
  }

  const mobileOS = detectMobileOS();
  const preferredStore: 'ios' | 'android' | 'unknown' = mobileOS === 'ios' ? 'ios' : mobileOS === 'android' ? 'android' : 'unknown';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.icon}>📱</Text>
          <View style={styles.textContent}>
            <Text style={styles.title}>Get the Full Experience</Text>
            <Text style={styles.subtitle}>
              Download our mobile app for automatic parking detection, offline mode, and more!
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          {/* Smart Download Button - Shows relevant store based on device */}
          {preferredStore !== 'unknown' && (
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => handleDownload(preferredStore)}
              accessibilityLabel={`Download for ${preferredStore === 'ios' ? 'iOS' : 'Android'}`}
              accessibilityRole="button"
            >
              <Text style={styles.downloadButtonText}>
                {preferredStore === 'ios' ? '🍎 App Store' : '🤖 Play Store'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Both store buttons if OS is unknown (desktop) */}
          {preferredStore === 'unknown' && (
            <>
              {appStoreUrl && (
                <TouchableOpacity
                  style={[styles.downloadButton, styles.downloadButtonSmall]}
                  onPress={() => handleDownload('ios')}
                  accessibilityLabel="Download for iOS"
                  accessibilityRole="button"
                >
                  <Text style={styles.downloadButtonText}>🍎 iOS</Text>
                </TouchableOpacity>
              )}

              {playStoreUrl && (
                <TouchableOpacity
                  style={[styles.downloadButton, styles.downloadButtonSmall]}
                  onPress={() => handleDownload('android')}
                  accessibilityLabel="Download for Android"
                  accessibilityRole="button"
                >
                  <Text style={styles.downloadButtonText}>🤖 Android</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Dismiss Button */}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
            accessibilityLabel="Dismiss banner"
            accessibilityRole="button"
          >
            <Text style={styles.dismissButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Feature Highlights */}
      <View style={styles.features}>
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>🚗</Text>
          <Text style={styles.featureText}>Auto-detect parking</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>📍</Text>
          <Text style={styles.featureText}>Background tracking</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>🔔</Text>
          <Text style={styles.featureText}>Smart reminders</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>📶</Text>
          <Text style={styles.featureText}>Offline mode</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    fontSize: 32,
    marginRight: 12,
  },
  textContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadButton: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  downloadButtonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  downloadButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  dismissButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  featureItem: {
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
});

export default MobileAppPromotion;
