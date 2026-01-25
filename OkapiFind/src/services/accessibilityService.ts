// @ts-nocheck
/**
 * Accessibility Service for WCAG 2.1 AA Compliance
 * Required for App Store approval and inclusivity
 */

import React from 'react';
import { Platform, AccessibilityInfo, Alert } from 'react-native';
import Tts from 'react-native-tts';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AccessibilitySettings {
  screenReaderEnabled: boolean;
  reduceMotion: boolean;
  boldText: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  voiceGuidance: boolean;
  hapticFeedback: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  autoPlayVideos: boolean;
  captionsEnabled: boolean;
}

class AccessibilityService {
  private settings: AccessibilitySettings = {
    screenReaderEnabled: false,
    reduceMotion: false,
    boldText: false,
    highContrast: false,
    fontSize: 'medium',
    voiceGuidance: true,
    hapticFeedback: true,
    colorBlindMode: 'none',
    autoPlayVideos: false,
    captionsEnabled: true,
  };

  private listeners: Set<(settings: AccessibilitySettings) => void> = new Set();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load saved settings
      const savedSettings = await AsyncStorage.getItem('accessibility_settings');
      if (savedSettings) {
        this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
      }

      // Check system accessibility settings
      const screenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
      const boldText = await AccessibilityInfo.isBoldTextEnabled();

      this.settings = {
        ...this.settings,
        screenReaderEnabled,
        reduceMotion: reduceMotion || false,
        boldText: boldText || false,
      };

      // Set up listeners for system changes
      AccessibilityInfo.addEventListener('screenReaderChanged', this.handleScreenReaderChange);
      AccessibilityInfo.addEventListener('reduceMotionChanged', this.handleReduceMotionChange);

      if (Platform.OS === 'ios') {
        AccessibilityInfo.addEventListener('boldTextChanged', this.handleBoldTextChange);
      }

      this.initialized = true;
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to initialize accessibility service:', error);
    }
  }

  /**
   * Get current accessibility settings
   */
  getSettings(): AccessibilitySettings {
    return { ...this.settings };
  }

  /**
   * Update accessibility settings
   */
  async updateSettings(updates: Partial<AccessibilitySettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
    this.notifyListeners();
  }

  /**
   * Subscribe to accessibility changes
   */
  subscribe(listener: (settings: AccessibilitySettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Announce message for screen readers
   */
  announce(message: string, options?: { delay?: number; queue?: boolean }): void {
    const { delay = 0, queue = false } = options || {};

    setTimeout(() => {
      if (this.settings.screenReaderEnabled) {
        AccessibilityInfo.announceForAccessibility(message);
      }

      if (this.settings.voiceGuidance && !this.settings.screenReaderEnabled) {
        try {
          // Configure TTS settings
          Tts.setDefaultLanguage('en-US');
          Tts.setDefaultPitch(1.0);
          Tts.setDefaultRate(0.9);

          // Speak the message
          if (queue) {
            Tts.speak(message);
          } else {
            Tts.stop();
            Tts.speak(message);
          }
        } catch (error) {
          console.error('TTS error in accessibility service:', error);
        }
      }
    }, delay);
  }

  /**
   * Provide haptic feedback
   */
  async haptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light'): Promise<void> {
    if (!this.settings.hapticFeedback) return;

    try {
      switch (type) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
    } catch (error) {
      // Haptics might not be available on all devices
    }
  }

  /**
   * Get font size multiplier based on settings
   */
  getFontSizeMultiplier(): number {
    switch (this.settings.fontSize) {
      case 'small':
        return 0.85;
      case 'medium':
        return 1;
      case 'large':
        return 1.2;
      case 'extra-large':
        return 1.4;
      default:
        return 1;
    }
  }

  /**
   * Get color adjustments for color blind modes
   * Uses WCAG 2.1 compliant accessible color palettes
   */
  getColorAdjustments(): Record<string, string> {
    switch (this.settings.colorBlindMode) {
      case 'protanopia':
        // Red-blind adjustments - uses blue/yellow distinction
        return {
          success: '#0277BD', // Blue instead of green
          error: '#E5A000', // Amber/orange instead of red
          warning: '#9C27B0', // Purple for warning
          info: '#00BCD4', // Cyan for info
          primary: '#FFD700', // Gold remains visible
          danger: '#E5A000',
        };
      case 'deuteranopia':
        // Green-blind adjustments - uses blue/red distinction
        return {
          success: '#0277BD', // Blue instead of green
          error: '#D32F2F', // Red still visible
          warning: '#E5A000', // Amber for warning
          info: '#00BCD4', // Cyan for info
          primary: '#FFD700', // Gold remains visible
          danger: '#D32F2F',
        };
      case 'tritanopia':
        // Blue-yellow blind adjustments - uses red/cyan distinction
        return {
          success: '#00BFA5', // Teal/cyan instead of green
          error: '#D32F2F', // Red remains visible
          warning: '#FF5722', // Deep orange for warning
          info: '#E91E63', // Pink for info (instead of blue)
          primary: '#FF9800', // Orange instead of gold
          danger: '#D32F2F',
        };
      default:
        return {};
    }
  }

  /**
   * Get high contrast colors for users who need maximum distinguishability
   */
  getHighContrastColors(): Record<string, string> {
    if (!this.settings.highContrast) return {};

    return {
      primary: '#FFFFFF',
      background: '#000000',
      text: '#FFFFFF',
      textSecondary: '#FFFF00',
      success: '#00FF00',
      error: '#FF0000',
      warning: '#FFFF00',
      info: '#00FFFF',
      border: '#FFFFFF',
    };
  }

  /**
   * Check if animations should be reduced
   */
  shouldReduceMotion(): boolean {
    return this.settings.reduceMotion;
  }

  /**
   * Check if high contrast is enabled
   */
  isHighContrastEnabled(): boolean {
    return this.settings.highContrast;
  }

  /**
   * Focus announcement for important UI changes
   */
  announceFocus(elementName: string, elementType: string): void {
    this.announce(`${elementName} ${elementType}, selected`);
  }

  /**
   * Announce navigation changes
   */
  announceNavigation(screenName: string): void {
    this.announce(`Navigated to ${screenName}`);
  }

  /**
   * Announce loading states
   */
  announceLoading(isLoading: boolean, context?: string): void {
    if (isLoading) {
      this.announce(`Loading ${context || 'content'}`);
    } else {
      this.announce(`${context || 'Content'} loaded`);
    }
  }

  /**
   * Announce errors with appropriate urgency
   */
  announceError(error: string): void {
    this.announce(`Error: ${error}`, { delay: 100 });
    this.haptic('error');
  }

  /**
   * Announce success messages
   */
  announceSuccess(message: string): void {
    this.announce(message);
    this.haptic('success');
  }

  /**
   * Show accessible alert
   */
  showAccessibleAlert(
    title: string,
    message: string,
    buttons: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }> = [{ text: 'OK' }]
  ): void {
    // Announce for screen readers
    this.announce(`Alert: ${title}. ${message}`);

    // Show visual alert
    Alert.alert(title, message, buttons, { cancelable: true });
  }

  /**
   * Private methods
   */

  private handleScreenReaderChange = (enabled: boolean): void => {
    this.settings.screenReaderEnabled = enabled;
    this.notifyListeners();
  };

  private handleReduceMotionChange = (enabled: boolean): void => {
    this.settings.reduceMotion = enabled;
    this.notifyListeners();
  };

  private handleBoldTextChange = (enabled: boolean): void => {
    this.settings.boldText = enabled;
    this.notifyListeners();
  };

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem('accessibility_settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save accessibility settings:', error);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.getSettings()));
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    AccessibilityInfo.removeEventListener('screenReaderChanged', this.handleScreenReaderChange);
    AccessibilityInfo.removeEventListener('reduceMotionChanged', this.handleReduceMotionChange);

    if (Platform.OS === 'ios') {
      AccessibilityInfo.removeEventListener('boldTextChanged', this.handleBoldTextChange);
    }

    this.listeners.clear();
  }
}

export const accessibilityService = new AccessibilityService();

/**
 * React Hook for using accessibility settings
 */
export function useAccessibility() {
  const [settings, setSettings] = React.useState<AccessibilitySettings>(
    accessibilityService.getSettings()
  );

  React.useEffect(() => {
    const unsubscribe = accessibilityService.subscribe(setSettings);
    return unsubscribe;
  }, []);

  return {
    settings,
    announce: accessibilityService.announce.bind(accessibilityService),
    haptic: accessibilityService.haptic.bind(accessibilityService),
    updateSettings: accessibilityService.updateSettings.bind(accessibilityService),
  };
}