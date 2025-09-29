/**
 * QuickParkButton Component
 * One-tap parking save with visual feedback and haptic response
 * Implements UI/UX best practice #1: Simplicity First
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useParkingLocation } from '../hooks/useParkingLocation';
import { useAccessibility } from '../hooks/useAccessibility';

const { width: screenWidth } = Dimensions.get('window');
const BUTTON_SIZE = 80;
const EXPANDED_SIZE = 120;

interface QuickParkButtonProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export const QuickParkButton: React.FC<QuickParkButtonProps> = ({
  onSuccess,
  onError,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const { saveParkingLocation, isParked } = useParkingLocation();
  const { isVoiceOverEnabled, announceForAccessibility } = useAccessibility();

  // Animations
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const successCheckAnim = useRef(new Animated.Value(0)).current;
  const tooltipOpacity = useRef(new Animated.Value(0)).current;

  // Check if first time user
  useEffect(() => {
    const checkFirstTime = async () => {
      const hasUsedBefore = await AsyncStorage.getItem('hasUsedQuickPark');
      if (!hasUsedBefore) {
        setTimeout(() => {
          setShowTooltip(true);
          Animated.timing(tooltipOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();
        }, 2000);
      }
    };
    checkFirstTime();
  }, []);

  // Pulse animation for attention
  useEffect(() => {
    if (!isParked && !isSaving) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }
  }, [isParked, isSaving, pulseAnim]);

  const handlePressIn = () => {
    setIsPressed(true);

    // Haptic feedback
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Scale down animation
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  };

  const handlePressOut = () => {
    setIsPressed(false);

    // Scale back animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  };

  const handlePress = async () => {
    if (isSaving || isParked) return;

    // Hide tooltip if showing
    if (showTooltip) {
      setShowTooltip(false);
      await AsyncStorage.setItem('hasUsedQuickPark', 'true');
    }

    setIsSaving(true);

    // Announce for accessibility
    if (isVoiceOverEnabled) {
      announceForAccessibility('Saving parking location');
    }

    // Strong haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Start rotation animation
    const rotationAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );
    rotationAnimation.start();

    try {
      // Save parking location
      await saveParkingLocation({
        autoDetected: false,
        source: 'quick_park_button',
        timestamp: Date.now(),
      });

      // Stop rotation
      rotationAnimation.stop();

      // Success animation
      setIsSuccess(true);
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.2,
          useNativeDriver: true,
          friction: 4,
        }),
        Animated.timing(successCheckAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 4,
          delay: 500,
        }),
      ]).start();

      // Success haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Announce success
      if (isVoiceOverEnabled) {
        announceForAccessibility('Parking location saved successfully');
      }

      onSuccess?.();

      // Reset after delay
      setTimeout(() => {
        setIsSuccess(false);
        setIsSaving(false);
        successCheckAnim.setValue(0);
      }, 2000);

    } catch (error) {
      // Error handling
      rotationAnimation.stop();
      setIsSaving(false);

      // Error haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Error animation (shake)
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 50,
          useNativeDriver: true,
        }),
      ]).start();

      if (isVoiceOverEnabled) {
        announceForAccessibility('Failed to save parking location');
      }

      onError?.(error as Error);
    }
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const buttonScale = Animated.multiply(scaleAnim, pulseAnim);

  return (
    <View style={styles.container}>
      {/* Tooltip for first-time users */}
      {showTooltip && (
        <Animated.View
          style={[
            styles.tooltip,
            { opacity: tooltipOpacity }
          ]}
        >
          <Text style={styles.tooltipText}>
            Tap to save your parking location
          </Text>
          <View style={styles.tooltipArrow} />
        </Animated.View>
      )}

      {/* Main Button */}
      <Animated.View
        style={[
          styles.buttonContainer,
          {
            transform: [
              { scale: buttonScale },
              { rotate: isSaving ? rotateInterpolate : '0deg' },
            ],
          },
        ]}
      >
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isSaving || isParked}
          accessible={true}
          accessibilityLabel={
            isParked
              ? "Parking location already saved"
              : "Save parking location"
          }
          accessibilityRole="button"
          accessibilityHint="Double tap to save your current location as your parking spot"
          style={styles.touchable}
        >
          <LinearGradient
            colors={
              isSuccess
                ? ['#4CAF50', '#45A049']
                : isParked
                ? ['#9E9E9E', '#757575']
                : ['#2196F3', '#1976D2']
            }
            style={styles.button}
          >
            {/* Icon Container */}
            <View style={styles.iconContainer}>
              {isSuccess ? (
                <Animated.View
                  style={{
                    opacity: successCheckAnim,
                    transform: [{ scale: successCheckAnim }],
                  }}
                >
                  <Ionicons name="checkmark-circle" size={50} color="white" />
                </Animated.View>
              ) : (
                <Ionicons
                  name={isParked ? "car" : "location"}
                  size={40}
                  color="white"
                />
              )}
            </View>

            {/* Ripple Effect for Press */}
            {isPressed && (
              <Animated.View
                style={[
                  styles.ripple,
                  {
                    transform: [{ scale: scaleAnim }],
                  },
                ]}
              />
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Status Text */}
      <Text
        style={styles.statusText}
        accessible={true}
        accessibilityRole="text"
      >
        {isSuccess
          ? "Saved!"
          : isParked
          ? "Parked"
          : isSaving
          ? "Saving..."
          : "Park Here"}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  buttonContainer: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    marginBottom: 10,
  },
  touchable: {
    width: '100%',
    height: '100%',
  },
  button: {
    width: '100%',
    height: '100%',
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ripple: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  tooltip: {
    position: 'absolute',
    top: -60,
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 1000,
  },
  tooltipText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#333',
  },
});

export default QuickParkButton;