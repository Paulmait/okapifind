/**
 * Onboarding Screen
 * Interactive tutorial showing all features including voice commands
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Image,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Tts from 'react-native-tts';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { analytics } from '../services/analytics';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  backgroundColor: string;
  feature?: 'voice' | 'shake' | 'photo' | 'share' | 'premium';
  action?: () => void;
}

const slides: OnboardingSlide[] = [
  {
    id: 'welcome',
    title: 'Welcome to OkapiFind',
    subtitle: 'Never lose your car again',
    description: 'The smartest way to remember where you parked',
    icon: '🚗',
    backgroundColor: Colors.primary,
  },
  {
    id: 'voice',
    title: 'Voice Commands',
    subtitle: 'Hands-free operation',
    description: 'Say "Hey Siri, where\'s my car?" or "OK Google, save my parking spot"',
    icon: '🗣️',
    backgroundColor: '#4ECDC4',
    feature: 'voice',
  },
  {
    id: 'shake',
    title: 'Shake to Save',
    subtitle: 'Quick save gesture',
    description: 'Just shake your phone to instantly save your parking spot',
    icon: '📱',
    backgroundColor: '#FF6B6B',
    feature: 'shake',
  },
  {
    id: 'photo',
    title: 'Photo Notes',
    subtitle: 'Visual reminders',
    description: 'Take photos of your parking spot, floor signs, or nearby landmarks',
    icon: '📸',
    backgroundColor: '#51CF66',
    feature: 'photo',
  },
  {
    id: 'ocr',
    title: 'Smart Timer',
    subtitle: 'Scan parking signs',
    description: 'Point your camera at parking signs to automatically set timers',
    icon: '⏰',
    backgroundColor: '#845EF7',
    feature: 'photo',
  },
  {
    id: 'safety',
    title: 'Safety Mode',
    subtitle: 'Share your walk',
    description: 'Let loved ones track your walk back to the car for safety',
    icon: '🛡️',
    backgroundColor: '#339AF0',
    feature: 'share',
  },
  {
    id: 'offline',
    title: 'Works Offline',
    subtitle: 'No signal? No problem',
    description: 'Save parking spots even in underground garages. Auto-syncs when connected',
    icon: '📡',
    backgroundColor: '#FF922B',
  },
  {
    id: 'insights',
    title: 'Parking Insights',
    subtitle: 'Learn your patterns',
    description: 'See your most frequent spots, average duration, and parking costs',
    icon: '📊',
    backgroundColor: '#37B24D',
  },
  {
    id: 'premium',
    title: 'Go Premium',
    subtitle: 'Unlock everything',
    description: 'Unlimited saves, AR navigation, family sharing, and more!',
    icon: '👑',
    backgroundColor: Colors.primary,
    feature: 'premium',
  },
];

export default function OnboardingScreen() {
  const navigation = useNavigation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [shakeDetected, setShakeDetected] = useState(false);
  const shakeSubscription = useRef<any>(null);

  useEffect(() => {
    // Animate slide entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    analytics.logEvent('onboarding_started');
  }, []);

  useEffect(() => {
    // Handle feature demonstrations
    const slide = slides[currentSlide];
    if (slide.feature === 'shake') {
      demonstrateShake();
    } else if (slide.feature === 'voice') {
      demonstrateVoice();
    }

    return () => {
      if (shakeSubscription.current) {
        shakeSubscription.current.remove();
      }
    };
  }, [currentSlide]);

  const demonstrateVoice = async () => {
    try {
      // Configure TTS settings
      Tts.setDefaultLanguage('en-US');
      Tts.setDefaultPitch(1.0);
      Tts.setDefaultRate(0.9);

      if (Platform.OS === 'ios') {
        await Tts.speak('Say "Hey Siri, where is my car?" to find your parking spot');
      } else {
        await Tts.speak('Say "OK Google, save my parking spot" to quickly save your location');
      }
    } catch (error) {
      console.error('TTS error in onboarding:', error);
    }
  };

  const demonstrateShake = () => {
    // Start shake detection
    Accelerometer.setUpdateInterval(100);

    shakeSubscription.current = Accelerometer.addListener((data) => {
      const totalForce = Math.abs(data.x) + Math.abs(data.y) + Math.abs(data.z);

      if (totalForce > 2.5 && !shakeDetected) {
        setShakeDetected(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Great! 👏',
          'You just triggered the shake-to-save feature!',
          [{ text: 'Cool!' }]
        );

        analytics.logEvent('onboarding_shake_detected');

        // Reset after animation
        setTimeout(() => setShakeDetected(false), 2000);
      }
    });
  };

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      const nextSlide = currentSlide + 1;
      setCurrentSlide(nextSlide);
      scrollViewRef.current?.scrollTo({
        x: screenWidth * nextSlide,
        animated: true,
      });

      // Animate transition
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: -50,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

      analytics.logEvent('onboarding_slide_viewed', {
        slide_id: slides[nextSlide].id,
        slide_index: nextSlide,
      });
    } else {
      completeOnboarding();
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Tutorial?',
      'You can always access these features from Settings',
      [
        { text: 'Continue Tutorial', style: 'cancel' },
        { text: 'Skip', onPress: completeOnboarding, style: 'destructive' },
      ]
    );
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('@onboarding_completed', 'true');
      await AsyncStorage.setItem('@onboarding_date', new Date().toISOString());

      analytics.logEvent('onboarding_completed', {
        slides_viewed: currentSlide + 1,
        total_slides: slides.length,
      });

      // Navigate to main app
      navigation.reset({
        index: 0,
        routes: [{ name: 'Map' as never }],
      });
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
  };

  const handleDotPress = (index: number) => {
    setCurrentSlide(index);
    scrollViewRef.current?.scrollTo({
      x: screenWidth * index,
      animated: true,
    });
  };

  const renderSlide = (slide: OnboardingSlide, index: number) => {
    const isActive = index === currentSlide;

    return (
      <View
        key={slide.id}
        style={[
          styles.slide,
          { backgroundColor: slide.backgroundColor },
        ]}
      >
        <Animated.View
          style={[
            styles.slideContent,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: isActive ? slideAnim : 0 },
                { scale: isActive ? 1 : 0.9 },
              ],
            },
          ]}
        >
          {/* Icon with animation */}
          <View style={styles.iconContainer}>
            <Animated.Text
              style={[
                styles.icon,
                {
                  transform: [
                    { rotate: slide.feature === 'shake' && shakeDetected ? '15deg' : '0deg' },
                  ],
                },
              ]}
            >
              {slide.icon}
            </Animated.Text>
          </View>

          {/* Title and description */}
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.subtitle}>{slide.subtitle}</Text>
          <Text style={styles.description}>{slide.description}</Text>

          {/* Feature-specific actions */}
          {slide.feature === 'voice' && (
            <TouchableOpacity
              style={styles.tryButton}
              onPress={demonstrateVoice}
            >
              <Text style={styles.tryButtonText}>🔊 Hear Example</Text>
            </TouchableOpacity>
          )}

          {slide.feature === 'shake' && (
            <View style={styles.shakePrompt}>
              <Text style={styles.promptText}>Try shaking your phone now!</Text>
              {shakeDetected && (
                <Text style={styles.successText}>✅ Shake detected!</Text>
              )}
            </View>
          )}

          {slide.feature === 'premium' && (
            <TouchableOpacity
              style={styles.premiumButton}
              onPress={() => {
                analytics.logEvent('onboarding_premium_tap');
                navigation.navigate('Paywall' as never);
              }}
            >
              <Text style={styles.premiumButtonText}>View Premium Features</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip button */}
      {currentSlide < slides.length - 1 && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={styles.scrollView}
      >
        {slides.map(renderSlide)}
      </ScrollView>

      {/* Bottom navigation */}
      <View style={styles.bottomContainer}>
        {/* Dots indicator */}
        <View style={styles.dotsContainer}>
          {slides.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleDotPress(index)}
              style={[
                styles.dot,
                index === currentSlide && styles.activeDot,
              ]}
            />
          ))}
        </View>

        {/* Next/Get Started button */}
        <TouchableOpacity
          style={[
            styles.nextButton,
            { backgroundColor: slides[currentSlide].backgroundColor },
          ]}
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>
            {currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  skipText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width: screenWidth,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  slideContent: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  icon: {
    fontSize: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  tryButton: {
    marginTop: 30,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 25,
  },
  tryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  shakePrompt: {
    marginTop: 30,
    alignItems: 'center',
  },
  promptText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  successText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
  },
  premiumButton: {
    marginTop: 30,
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: '#FFF',
    borderRadius: 25,
  },
  premiumButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 30,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: '#FFF',
    width: 30,
  },
  nextButton: {
    paddingVertical: 16,
    paddingHorizontal: 60,
    borderRadius: 30,
    backgroundColor: '#FFF',
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
});