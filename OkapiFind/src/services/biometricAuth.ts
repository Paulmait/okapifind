// @ts-nocheck
/**
 * Biometric Authentication Service
 * Provides secure biometric authentication for sensitive operations
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { errorService, ErrorSeverity, ErrorCategory } from './errorService';
import { tokenManager } from './tokenManager';

export enum BiometricType {
  FINGERPRINT = 'fingerprint',
  FACIAL_RECOGNITION = 'facial_recognition',
  IRIS = 'iris',
  NONE = 'none',
}

export interface BiometricResult {
  success: boolean;
  error?: string;
  warning?: string;
  biometricType?: BiometricType;
}

interface BiometricSettings {
  enabled: boolean;
  requireForSensitiveOps: boolean;
  fallbackToPasscode: boolean;
  rememberDecision: boolean;
  lastAuthTime?: number;
  authValidityMs: number;
}

class BiometricAuthService {
  private static instance: BiometricAuthService;
  private isSupported: boolean = false;
  private isEnrolled: boolean = false;
  private biometricType: BiometricType = BiometricType.NONE;
  private lastAuthTime: number | null = null;
  private settings: BiometricSettings = {
    enabled: true,
    requireForSensitiveOps: true,
    fallbackToPasscode: true,
    rememberDecision: false,
    authValidityMs: 5 * 60 * 1000, // 5 minutes
  };

  private readonly SETTINGS_KEY = '@OkapiFind:biometricSettings';
  private readonly SENSITIVE_OPERATIONS = [
    'view_parking_history',
    'share_location',
    'export_data',
    'delete_account',
    'change_password',
    'view_payment_methods',
    'make_purchase',
  ];

  private constructor() {}

  static getInstance(): BiometricAuthService {
    if (!BiometricAuthService.instance) {
      BiometricAuthService.instance = new BiometricAuthService();
    }
    return BiometricAuthService.instance;
  }

  /**
   * Initialize biometric authentication service
   */
  async initialize(): Promise<void> {
    try {
      // Load settings
      await this.loadSettings();

      // Check hardware support
      this.isSupported = await LocalAuthentication.hasHardwareAsync();

      if (this.isSupported) {
        // Check if biometrics are enrolled
        this.isEnrolled = await LocalAuthentication.isEnrolledAsync();

        // Get supported biometric types
        const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
        this.biometricType = this.mapAuthenticationType(supportedTypes);

        errorService.logInfo('Biometric authentication initialized', {
          isSupported: this.isSupported,
          isEnrolled: this.isEnrolled,
          biometricType: this.biometricType,
        });
      } else {
        errorService.logWarning('Biometric authentication not supported on this device');
      }
    } catch (error) {
      errorService.logError(error, ErrorSeverity.MEDIUM, ErrorCategory.AUTH, {
        action: 'biometric_initialization',
      });
    }
  }

  /**
   * Authenticate with biometrics
   */
  async authenticate(
    reason: string = 'Authenticate to access your parking data',
    options?: {
      fallbackLabel?: string;
      cancelLabel?: string;
      disableDeviceFallback?: boolean;
      requireConfirmation?: boolean;
    }
  ): Promise<BiometricResult> {
    try {
      // Check if biometric is available
      if (!this.isSupported) {
        return {
          success: false,
          error: 'Biometric authentication is not supported on this device',
        };
      }

      if (!this.isEnrolled) {
        return {
          success: false,
          error: 'No biometric data is enrolled. Please set up biometrics in your device settings',
          warning: 'You can still use your device passcode',
        };
      }

      if (!this.settings.enabled) {
        return {
          success: true,
          warning: 'Biometric authentication is disabled in settings',
        };
      }

      // Check if recent auth is still valid
      if (this.isRecentAuthValid()) {
        return {
          success: true,
          biometricType: this.biometricType,
        };
      }

      // Perform authentication
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        fallbackLabel: options?.fallbackLabel || 'Use Passcode',
        cancelLabel: options?.cancelLabel || 'Cancel',
        disableDeviceFallback: options?.disableDeviceFallback || !this.settings.fallbackToPasscode,
        requireConfirmation: options?.requireConfirmation || Platform.OS === 'android',
      });

      if (result.success) {
        this.lastAuthTime = Date.now();
        await this.saveLastAuthTime();

        errorService.logInfo('Biometric authentication successful', {
          biometricType: this.biometricType,
        });

        return {
          success: true,
          biometricType: this.biometricType,
        };
      } else {
        const errorMessage = this.getErrorMessage(result.error);

        errorService.logWarning('Biometric authentication failed', {
          error: result.error,
          warning: result.warning,
        });

        return {
          success: false,
          error: errorMessage,
          warning: result.warning,
        };
      }
    } catch (error) {
      errorService.logError(error, ErrorSeverity.HIGH, ErrorCategory.AUTH, {
        action: 'biometric_authentication',
      });

      return {
        success: false,
        error: 'An unexpected error occurred during biometric authentication',
      };
    }
  }

  /**
   * Authenticate for sensitive operations
   */
  async authenticateForOperation(operation: string): Promise<BiometricResult> {
    // Check if operation requires biometric auth
    if (!this.isSensitiveOperation(operation)) {
      return { success: true };
    }

    if (!this.settings.requireForSensitiveOps) {
      return { success: true };
    }

    const reason = this.getOperationReason(operation);
    return this.authenticate(reason, {
      fallbackLabel: 'Use Passcode',
      cancelLabel: 'Cancel Operation',
      requireConfirmation: true,
    });
  }

  /**
   * Request biometric permission and enrollment
   */
  async requestBiometricEnrollment(): Promise<void> {
    if (Platform.OS === 'ios') {
      Alert.alert(
        'Enable Biometric Authentication',
        'To use biometric authentication, please enable Face ID or Touch ID in Settings > Face ID & Passcode',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              // On iOS, we can't directly open specific settings
              // User needs to navigate manually
            },
          },
        ]
      );
    } else if (Platform.OS === 'android') {
      Alert.alert(
        'Enable Biometric Authentication',
        'To use biometric authentication, please set up fingerprint or face unlock in Settings > Security',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              // On Android, we might be able to open security settings
              // Implementation depends on device
            },
          },
        ]
      );
    }
  }

  /**
   * Update biometric settings
   */
  async updateSettings(settings: Partial<BiometricSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    await this.saveSettings();

    errorService.logInfo('Biometric settings updated', settings);
  }

  /**
   * Check if biometric authentication is available
   */
  async checkAvailability(): Promise<{
    isSupported: boolean;
    isEnrolled: boolean;
    biometricType: BiometricType;
  }> {
    await this.initialize();

    return {
      isSupported: this.isSupported,
      isEnrolled: this.isEnrolled,
      biometricType: this.biometricType,
    };
  }

  /**
   * Private helper methods
   */

  private mapAuthenticationType(types: LocalAuthentication.AuthenticationType[]): BiometricType {
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return BiometricType.FACIAL_RECOGNITION;
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return BiometricType.FINGERPRINT;
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return BiometricType.IRIS;
    }
    return BiometricType.NONE;
  }

  private getErrorMessage(error: string): string {
    const errorMessages: Record<string, string> = {
      'UserCancel': 'Authentication was cancelled',
      'UserFallback': 'User chose to use passcode',
      'SystemCancel': 'Authentication was cancelled by the system',
      'PasscodeNotSet': 'Device passcode is not set',
      'BiometryNotAvailable': 'Biometric authentication is not available',
      'BiometryNotEnrolled': 'No biometric data is enrolled',
      'BiometryLockout': 'Too many failed attempts. Please try again later',
      'BiometryTemporaryUnavailable': 'Biometric authentication is temporarily unavailable',
      'BiometryPermanentUnavailable': 'Biometric authentication is not available on this device',
    };

    return errorMessages[error] || `Authentication failed: ${error}`;
  }

  private isSensitiveOperation(operation: string): boolean {
    return this.SENSITIVE_OPERATIONS.includes(operation);
  }

  private getOperationReason(operation: string): string {
    const reasons: Record<string, string> = {
      'view_parking_history': 'Authenticate to view your parking history',
      'share_location': 'Authenticate to share your location',
      'export_data': 'Authenticate to export your data',
      'delete_account': 'Authenticate to delete your account',
      'change_password': 'Authenticate to change your password',
      'view_payment_methods': 'Authenticate to view payment methods',
      'make_purchase': 'Authenticate to complete purchase',
    };

    return reasons[operation] || 'Authenticate to continue';
  }

  private isRecentAuthValid(): boolean {
    if (!this.lastAuthTime || !this.settings.rememberDecision) {
      return false;
    }

    const timeSinceAuth = Date.now() - this.lastAuthTime;
    return timeSinceAuth < this.settings.authValidityMs;
  }

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (error) {
      errorService.logError(error, ErrorSeverity.MEDIUM, ErrorCategory.STORAGE, {
        action: 'save_biometric_settings',
      });
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.SETTINGS_KEY);
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      errorService.logError(error, ErrorSeverity.MEDIUM, ErrorCategory.STORAGE, {
        action: 'load_biometric_settings',
      });
    }
  }

  private async saveLastAuthTime(): Promise<void> {
    if (this.settings.rememberDecision && this.lastAuthTime) {
      try {
        await SecureStore.setItemAsync(
          '@OkapiFind:lastBiometricAuth',
          this.lastAuthTime.toString()
        );
      } catch (error) {
        // Non-critical error
      }
    }
  }

  /**
   * Clear biometric data (for logout)
   */
  async clearBiometricData(): Promise<void> {
    this.lastAuthTime = null;
    await SecureStore.deleteItemAsync('@OkapiFind:lastBiometricAuth');
  }

  /**
   * Get biometric settings
   */
  getSettings(): BiometricSettings {
    return { ...this.settings };
  }

  /**
   * Check if biometric is enabled
   */
  isEnabled(): boolean {
    return this.settings.enabled && this.isSupported && this.isEnrolled;
  }
}

export const biometricAuth = BiometricAuthService.getInstance();