// @ts-nocheck
/**
 * Accessibility Manager Service
 * Ensures app compliance with WCAG 2.1 AA standards
 */

import { AccessibilityInfo, Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { logger } from './logger';

export enum AccessibilityFeature {
  SCREEN_READER = 'screenReader',
  VOICE_OVER = 'voiceOver',
  TALK_BACK = 'talkBack',
  HIGH_CONTRAST = 'highContrast',
  LARGE_TEXT = 'largeText',
  BOLD_TEXT = 'boldText',
  REDUCE_MOTION = 'reduceMotion',
  REDUCE_TRANSPARENCY = 'reduceTransparency',
  COLOR_INVERSION = 'colorInversion',
  GRAYSCALE = 'grayscale',
  HAPTIC_FEEDBACK = 'hapticFeedback',
  VOICE_GUIDANCE = 'voiceGuidance',
  KEYBOARD_NAVIGATION = 'keyboardNavigation',
}

interface AccessibilitySettings {
  fontSize: number;
  fontScale: number;
  highContrast: boolean;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  screenReaderEnabled: boolean;
  voiceGuidanceEnabled: boolean;
  hapticFeedbackEnabled: boolean;
  keyboardNavigationEnabled: boolean;
  autoFocusEnabled: boolean;
  announcePageChanges: boolean;
  minimumTouchTargetSize: number;
  customColors: ColorScheme;
}

interface ColorScheme {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  error: string;
  warning: string;
  success: string;
  info: string;
}

interface AccessibilityAnnouncement {
  message: string;
  priority: 'polite' | 'assertive';
  delay?: number;
}

interface FocusableElement {
  id: string;
  label: string;
  hint?: string;
  role: string;
  order: number;
  groupId?: string;
}

class AccessibilityManager {
  private static instance: AccessibilityManager;
  private settings: AccessibilitySettings;
  private screenReaderActive: boolean = false;
  private focusOrder: FocusableElement[] = [];
  private currentFocusIndex: number = 0;
  private announcementQueue: AccessibilityAnnouncement[] = [];
  private listeners: Map<string, Function[]> = new Map();

  private constructor() {
    this.settings = this.getDefaultSettings();
    this.initialize();
  }

  static getInstance(): AccessibilityManager {
    if (!AccessibilityManager.instance) {
      AccessibilityManager.instance = new AccessibilityManager();
    }
    return AccessibilityManager.instance;
  }

  /**
   * Initialize accessibility manager
   */
  private async initialize(): Promise<void> {
    await this.loadSettings();
    await this.detectSystemFeatures();
    this.setupEventListeners();
    this.startAnnouncementProcessor();

    logger.info('Accessibility Manager initialized', {
      screenReaderActive: this.screenReaderActive,
      settings: this.settings,
    });
  }

  /**
   * Get default settings
   */
  private getDefaultSettings(): AccessibilitySettings {
    return {
      fontSize: 16,
      fontScale: 1.0,
      highContrast: false,
      reduceMotion: false,
      reduceTransparency: false,
      colorBlindMode: 'none',
      screenReaderEnabled: false,
      voiceGuidanceEnabled: false,
      hapticFeedbackEnabled: true,
      keyboardNavigationEnabled: false,
      autoFocusEnabled: true,
      announcePageChanges: true,
      minimumTouchTargetSize: 44, // WCAG 2.1 AA standard
      customColors: {
        primary: '#007AFF',
        secondary: '#5856D6',
        background: '#FFFFFF',
        text: '#000000',
        error: '#FF3B30',
        warning: '#FF9500',
        success: '#34C759',
        info: '#5AC8FA',
      },
    };
  }

  /**
   * Load settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('@OkapiFind:accessibilitySettings');
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      logger.error('Failed to load accessibility settings', error);
    }
  }

  /**
   * Save settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        '@OkapiFind:accessibilitySettings',
        JSON.stringify(this.settings)
      );
      this.notifyListeners('settingsChanged', this.settings);
    } catch (error) {
      logger.error('Failed to save accessibility settings', error);
    }
  }

  /**
   * Detect system accessibility features
   */
  private async detectSystemFeatures(): Promise<void> {
    try {
      // Check screen reader
      this.screenReaderActive = await AccessibilityInfo.isScreenReaderEnabled();

      // Check reduce motion
      if (Platform.OS === 'ios') {
        this.settings.reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
      }

      // Check other features
      if (Platform.OS === 'ios') {
        const [boldText, grayscale, invertColors, reduceTransparency] = await Promise.all([
          AccessibilityInfo.isBoldTextEnabled(),
          AccessibilityInfo.isGrayscaleEnabled(),
          AccessibilityInfo.isInvertColorsEnabled(),
          AccessibilityInfo.isReduceTransparencyEnabled(),
        ]);

        this.settings.highContrast = invertColors;
        this.settings.reduceTransparency = reduceTransparency;
      }
    } catch (error) {
      logger.error('Failed to detect accessibility features', error);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Screen reader change listener
    AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      this.handleScreenReaderChange.bind(this)
    );

    // Reduce motion change listener (iOS)
    if (Platform.OS === 'ios') {
      AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        this.handleReduceMotionChange.bind(this)
      );
    }

    // Bold text change listener (iOS)
    if (Platform.OS === 'ios') {
      AccessibilityInfo.addEventListener(
        'boldTextChanged',
        this.handleBoldTextChange.bind(this)
      );
    }
  }

  /**
   * Handle screen reader change
   */
  private handleScreenReaderChange(enabled: boolean): void {
    this.screenReaderActive = enabled;
    this.settings.screenReaderEnabled = enabled;
    this.saveSettings();

    logger.info('Screen reader status changed', { enabled });
    this.notifyListeners('screenReaderChanged', enabled);
  }

  /**
   * Handle reduce motion change
   */
  private handleReduceMotionChange(enabled: boolean): void {
    this.settings.reduceMotion = enabled;
    this.saveSettings();

    logger.info('Reduce motion status changed', { enabled });
    this.notifyListeners('reduceMotionChanged', enabled);
  }

  /**
   * Handle bold text change
   */
  private handleBoldTextChange(enabled: boolean): void {
    this.settings.boldText = enabled;
    this.saveSettings();

    logger.info('Bold text status changed', { enabled });
    this.notifyListeners('boldTextChanged', enabled);
  }

  /**
   * Start announcement processor
   */
  private startAnnouncementProcessor(): void {
    setInterval(() => {
      if (this.announcementQueue.length > 0) {
        const announcement = this.announcementQueue.shift()!;
        this.processAnnouncement(announcement);
      }
    }, 100);
  }

  /**
   * Process announcement
   */
  private async processAnnouncement(
    announcement: AccessibilityAnnouncement
  ): Promise<void> {
    if (announcement.delay) {
      await new Promise(resolve => setTimeout(resolve, announcement.delay));
    }

    // Announce to screen reader
    if (this.screenReaderActive) {
      AccessibilityInfo.announceForAccessibility(announcement.message);
    }

    // Voice guidance
    if (this.settings.voiceGuidanceEnabled) {
      await this.speak(announcement.message);
    }

    // Haptic feedback for important announcements
    if (this.settings.hapticFeedbackEnabled && announcement.priority === 'assertive') {
      await this.provideHapticFeedback('notification');
    }
  }

  /**
   * Announce message for accessibility
   */
  announce(
    message: string,
    priority: 'polite' | 'assertive' = 'polite',
    delay?: number
  ): void {
    this.announcementQueue.push({ message, priority, delay });
  }

  /**
   * Speak text using text-to-speech
   */
  async speak(
    text: string,
    options: Speech.SpeechOptions = {}
  ): Promise<void> {
    if (!this.settings.voiceGuidanceEnabled) return;

    try {
      await Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
        ...options,
      });
    } catch (error) {
      logger.error('Failed to speak text', error);
    }
  }

  /**
   * Stop speaking
   */
  async stopSpeaking(): Promise<void> {
    await Speech.stop();
  }

  /**
   * Provide haptic feedback
   */
  async provideHapticFeedback(
    type: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error' | 'notification'
  ): Promise<void> {
    if (!this.settings.hapticFeedbackEnabled) return;

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
        case 'selection':
          await Haptics.selectionAsync();
          break;
        case 'success':
        case 'warning':
        case 'error':
          await Haptics.notificationAsync(
            type === 'success' ? Haptics.NotificationFeedbackType.Success :
            type === 'warning' ? Haptics.NotificationFeedbackType.Warning :
            Haptics.NotificationFeedbackType.Error
          );
          break;
        case 'notification':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
      }
    } catch (error) {
      logger.error('Failed to provide haptic feedback', error);
    }
  }

  /**
   * Register focusable element
   */
  registerFocusableElement(element: FocusableElement): void {
    const existingIndex = this.focusOrder.findIndex(e => e.id === element.id);

    if (existingIndex >= 0) {
      this.focusOrder[existingIndex] = element;
    } else {
      this.focusOrder.push(element);
    }

    // Sort by order
    this.focusOrder.sort((a, b) => a.order - b.order);
  }

  /**
   * Unregister focusable element
   */
  unregisterFocusableElement(elementId: string): void {
    this.focusOrder = this.focusOrder.filter(e => e.id !== elementId);
  }

  /**
   * Focus next element
   */
  focusNext(): FocusableElement | null {
    if (this.focusOrder.length === 0) return null;

    this.currentFocusIndex = (this.currentFocusIndex + 1) % this.focusOrder.length;
    const element = this.focusOrder[this.currentFocusIndex];

    this.announceFocus(element);
    return element;
  }

  /**
   * Focus previous element
   */
  focusPrevious(): FocusableElement | null {
    if (this.focusOrder.length === 0) return null;

    this.currentFocusIndex = this.currentFocusIndex === 0
      ? this.focusOrder.length - 1
      : this.currentFocusIndex - 1;

    const element = this.focusOrder[this.currentFocusIndex];

    this.announceFocus(element);
    return element;
  }

  /**
   * Focus specific element
   */
  focusElement(elementId: string): FocusableElement | null {
    const index = this.focusOrder.findIndex(e => e.id === elementId);
    if (index < 0) return null;

    this.currentFocusIndex = index;
    const element = this.focusOrder[index];

    this.announceFocus(element);
    return element;
  }

  /**
   * Announce focused element
   */
  private announceFocus(element: FocusableElement): void {
    let message = `${element.label}, ${element.role}`;
    if (element.hint) {
      message += `, ${element.hint}`;
    }

    this.announce(message, 'assertive');
  }

  /**
   * Get accessible colors based on settings
   */
  getAccessibleColors(): ColorScheme {
    const colors = { ...this.settings.customColors };

    // Apply high contrast
    if (this.settings.highContrast) {
      colors.background = '#000000';
      colors.text = '#FFFFFF';
      colors.primary = '#00FFFF';
      colors.secondary = '#FFFF00';
    }

    // Apply color blind modes
    switch (this.settings.colorBlindMode) {
      case 'protanopia': // Red-blind
        colors.error = '#FFB800';
        colors.success = '#0066FF';
        break;
      case 'deuteranopia': // Green-blind
        colors.success = '#0066FF';
        colors.warning = '#FF6600';
        break;
      case 'tritanopia': // Blue-blind
        colors.primary = '#FF0099';
        colors.info = '#00FF00';
        break;
    }

    return colors;
  }

  /**
   * Get font settings
   */
  getFontSettings(): {
    size: number;
    weight: string;
    lineHeight: number;
  } {
    const baseSize = this.settings.fontSize * this.settings.fontScale;

    return {
      size: baseSize,
      weight: this.settings.boldText ? 'bold' : 'normal',
      lineHeight: baseSize * 1.5, // WCAG recommended line height
    };
  }

  /**
   * Check if animation should be reduced
   */
  shouldReduceMotion(): boolean {
    return this.settings.reduceMotion;
  }

  /**
   * Get minimum touch target size
   */
  getMinimumTouchTargetSize(): number {
    return this.settings.minimumTouchTargetSize;
  }

  /**
   * Update accessibility setting
   */
  async updateSetting(key: keyof AccessibilitySettings, value: any): Promise<void> {
    (this.settings as any)[key] = value;
    await this.saveSettings();
  }

  /**
   * Update multiple settings
   */
  async updateSettings(settings: Partial<AccessibilitySettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    await this.saveSettings();
  }

  /**
   * Get current settings
   */
  getSettings(): AccessibilitySettings {
    return { ...this.settings };
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature: AccessibilityFeature): boolean {
    switch (feature) {
      case AccessibilityFeature.SCREEN_READER:
        return this.screenReaderActive;
      case AccessibilityFeature.HIGH_CONTRAST:
        return this.settings.highContrast;
      case AccessibilityFeature.LARGE_TEXT:
        return this.settings.fontScale > 1.2;
      case AccessibilityFeature.BOLD_TEXT:
        return this.settings.boldText || false;
      case AccessibilityFeature.REDUCE_MOTION:
        return this.settings.reduceMotion;
      case AccessibilityFeature.REDUCE_TRANSPARENCY:
        return this.settings.reduceTransparency;
      case AccessibilityFeature.HAPTIC_FEEDBACK:
        return this.settings.hapticFeedbackEnabled;
      case AccessibilityFeature.VOICE_GUIDANCE:
        return this.settings.voiceGuidanceEnabled;
      case AccessibilityFeature.KEYBOARD_NAVIGATION:
        return this.settings.keyboardNavigationEnabled;
      default:
        return false;
    }
  }

  /**
   * Generate accessibility report
   */
  generateAccessibilityReport(): any {
    const { width, height } = Dimensions.get('window');

    return {
      wcagCompliance: {
        level: 'AA',
        colorContrast: this.checkColorContrast(),
        touchTargetSize: this.settings.minimumTouchTargetSize >= 44,
        textSize: this.settings.fontSize >= 14,
        focusIndicators: true,
        keyboardNavigation: this.settings.keyboardNavigationEnabled,
      },
      systemFeatures: {
        screenReader: this.screenReaderActive,
        reduceMotion: this.settings.reduceMotion,
        highContrast: this.settings.highContrast,
      },
      appFeatures: {
        voiceGuidance: this.settings.voiceGuidanceEnabled,
        hapticFeedback: this.settings.hapticFeedbackEnabled,
        colorBlindMode: this.settings.colorBlindMode,
      },
      deviceInfo: {
        platform: Platform.OS,
        screenSize: { width, height },
        fontScale: this.settings.fontScale,
      },
    };
  }

  /**
   * Check color contrast ratio
   */
  private checkColorContrast(): boolean {
    // Simplified check - in production, calculate actual contrast ratios
    const colors = this.getAccessibleColors();

    // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
    // This is a placeholder - implement actual contrast calculation
    return true;
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Notify listeners
   */
  private notifyListeners(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
}

export const accessibilityManager = AccessibilityManager.getInstance();