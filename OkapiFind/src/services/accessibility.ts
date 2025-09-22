import { AccessibilityInfo, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AccessibilitySettings {
  isScreenReaderEnabled: boolean;
  fontSize: 'small' | 'normal' | 'large' | 'extraLarge';
  highContrast: boolean;
  reduceMotion: boolean;
  boldText: boolean;
  prefersCrossFadeTransitions: boolean;
  isVoiceOverRunning: boolean;
  isTalkBackRunning: boolean;
}

export interface AccessibilityAnnouncement {
  message: string;
  priority?: 'low' | 'medium' | 'high';
  delay?: number;
}

class AccessibilityService {
  private settings: AccessibilitySettings = {
    isScreenReaderEnabled: false,
    fontSize: 'normal',
    highContrast: false,
    reduceMotion: false,
    boldText: false,
    prefersCrossFadeTransitions: false,
    isVoiceOverRunning: false,
    isTalkBackRunning: false,
  };

  private listeners: ((settings: AccessibilitySettings) => void)[] = [];

  constructor() {
    this.initializeAccessibility();
  }

  private async initializeAccessibility() {
    try {
      // Load user preferences
      await this.loadUserPreferences();

      // Detect system accessibility settings
      await this.detectSystemSettings();

      // Set up accessibility event listeners
      this.setupAccessibilityListeners();

    } catch (error) {
      console.error('Failed to initialize accessibility service:', error);
    }
  }

  private async loadUserPreferences() {
    try {
      const saved = await AsyncStorage.getItem('accessibility_settings');
      if (saved) {
        const userSettings = JSON.parse(saved);
        this.settings = { ...this.settings, ...userSettings };
      }
    } catch (error) {
      console.error('Failed to load accessibility preferences:', error);
    }
  }

  private async detectSystemSettings() {
    try {
      // Screen reader detection
      const isScreenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();

      // Platform-specific accessibility detection
      if (Platform.OS === 'ios') {
        const isVoiceOverRunning = await AccessibilityInfo.isScreenReaderEnabled();
        this.settings.isVoiceOverRunning = isVoiceOverRunning;
        this.settings.isScreenReaderEnabled = isVoiceOverRunning;

        // iOS-specific settings
        if (AccessibilityInfo.isBoldTextEnabled) {
          this.settings.boldText = await AccessibilityInfo.isBoldTextEnabled();
        }

        if (AccessibilityInfo.isReduceMotionEnabled) {
          this.settings.reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
        }

      } else if (Platform.OS === 'android') {
        this.settings.isTalkBackRunning = isScreenReaderEnabled;
        this.settings.isScreenReaderEnabled = isScreenReaderEnabled;

        // Android-specific settings
        if (AccessibilityInfo.isReduceMotionEnabled) {
          this.settings.reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
        }
      }

    } catch (error) {
      console.error('Failed to detect system accessibility settings:', error);
    }
  }

  private setupAccessibilityListeners() {
    // Listen for screen reader changes
    AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      this.handleScreenReaderChange.bind(this)
    );

    // Listen for reduce motion changes
    if (AccessibilityInfo.addEventListener && Platform.OS === 'ios') {
      AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        this.handleReduceMotionChange.bind(this)
      );

      AccessibilityInfo.addEventListener(
        'boldTextChanged',
        this.handleBoldTextChange.bind(this)
      );
    }

    // Announce when accessibility is ready
    this.announceToScreenReader('Accessibility features loaded', 'low');
  }

  private handleScreenReaderChange(isEnabled: boolean) {
    this.updateSettings({
      isScreenReaderEnabled: isEnabled,
      isVoiceOverRunning: Platform.OS === 'ios' ? isEnabled : this.settings.isVoiceOverRunning,
      isTalkBackRunning: Platform.OS === 'android' ? isEnabled : this.settings.isTalkBackRunning,
    });
  }

  private handleReduceMotionChange(isEnabled: boolean) {
    this.updateSettings({ reduceMotion: isEnabled });
  }

  private handleBoldTextChange(isEnabled: boolean) {
    this.updateSettings({ boldText: isEnabled });
  }

  public async updateSettings(newSettings: Partial<AccessibilitySettings>) {
    this.settings = { ...this.settings, ...newSettings };

    // Save to storage
    try {
      await AsyncStorage.setItem('accessibility_settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save accessibility settings:', error);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(this.settings));
  }

  public getSettings(): AccessibilitySettings {
    return { ...this.settings };
  }

  public addListener(listener: (settings: AccessibilitySettings) => void) {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Screen reader announcements
  public announceToScreenReader(
    message: string,
    priority: 'low' | 'medium' | 'high' = 'medium',
    delay: number = 0
  ) {
    if (!this.settings.isScreenReaderEnabled) return;

    const announce = () => {
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(message);
      } else if (Platform.OS === 'android') {
        AccessibilityInfo.announceForAccessibility(message);
      }
    };

    if (delay > 0) {
      setTimeout(announce, delay);
    } else {
      announce();
    }
  }

  // Focus management
  public setAccessibilityFocus(reactTag: number | null) {
    if (!this.settings.isScreenReaderEnabled || !reactTag) return;

    try {
      AccessibilityInfo.setAccessibilityFocus(reactTag);
    } catch (error) {
      console.error('Failed to set accessibility focus:', error);
    }
  }

  // Font size calculations
  public getFontScale(): number {
    switch (this.settings.fontSize) {
      case 'small':
        return 0.85;
      case 'normal':
        return 1.0;
      case 'large':
        return 1.15;
      case 'extraLarge':
        return 1.3;
      default:
        return 1.0;
    }
  }

  // Color contrast calculations
  public getContrastColors() {
    if (this.settings.highContrast) {
      return {
        background: '#000000',
        surface: '#1a1a1a',
        text: '#ffffff',
        textSecondary: '#cccccc',
        primary: '#ffffff',
        accent: '#ffff00',
        border: '#ffffff',
        error: '#ff6b6b',
        success: '#51cf66',
        warning: '#ffd43b',
      };
    }

    // Return normal colors (these would come from your theme)
    return {
      background: '#ffffff',
      surface: '#f8f9fa',
      text: '#212529',
      textSecondary: '#6c757d',
      primary: '#007bff',
      accent: '#6f42c1',
      border: '#dee2e6',
      error: '#dc3545',
      success: '#28a745',
      warning: '#ffc107',
    };
  }

  // Animation preferences
  public shouldReduceMotion(): boolean {
    return this.settings.reduceMotion;
  }

  public getAnimationDuration(defaultDuration: number): number {
    return this.settings.reduceMotion ? 0 : defaultDuration;
  }

  // Accessibility helpers
  public getAccessibilityLabel(
    baseLabel: string,
    role?: string,
    state?: { selected?: boolean; expanded?: boolean; disabled?: boolean }
  ): string {
    let label = baseLabel;

    if (role) {
      label += `, ${role}`;
    }

    if (state) {
      if (state.selected) label += ', selected';
      if (state.expanded !== undefined) {
        label += state.expanded ? ', expanded' : ', collapsed';
      }
      if (state.disabled) label += ', disabled';
    }

    return label;
  }

  public getAccessibilityHint(action: string, context?: string): string {
    let hint = `Double tap to ${action}`;
    if (context) {
      hint += ` ${context}`;
    }
    return hint;
  }

  // Voice-over navigation helpers
  public createAccessibilityOrder(elements: Array<{ id: string; priority: number }>) {
    return elements
      .sort((a, b) => a.priority - b.priority)
      .map(el => el.id);
  }

  // Haptic feedback integration
  public provideAccessibilityFeedback(type: 'success' | 'error' | 'warning' | 'selection') {
    if (!this.settings.isScreenReaderEnabled) return;

    // Import haptics when needed
    import('expo-haptics').then(({ Haptics }) => {
      switch (type) {
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'warning':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'selection':
          Haptics.selectionAsync();
          break;
      }
    }).catch(() => {
      // Haptics not available
    });
  }

  // Cleanup
  public cleanup() {
    // Remove event listeners
    AccessibilityInfo.removeEventListener?.('screenReaderChanged', this.handleScreenReaderChange);
    AccessibilityInfo.removeEventListener?.('reduceMotionChanged', this.handleReduceMotionChange);
    AccessibilityInfo.removeEventListener?.('boldTextChanged', this.handleBoldTextChange);

    this.listeners = [];
  }
}

export const accessibilityService = new AccessibilityService();