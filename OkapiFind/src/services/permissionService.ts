/**
 * Permission Service with App Store Compliant Explanations
 * Handles all permission requests with proper user education
 */

import { Platform, Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import * as Camera from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { accessibilityService } from './accessibilityService';

export type PermissionType =
  | 'location'
  | 'backgroundLocation'
  | 'camera'
  | 'mediaLibrary'
  | 'microphone'
  | 'notifications'
  | 'biometric';

export interface PermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  neverAskAgain: boolean;
}

interface PermissionExplanation {
  title: string;
  message: string;
  benefits: string[];
  alternativeMessage?: string;
}

class PermissionService {
  private permissionExplanations: Record<PermissionType, PermissionExplanation> = {
    location: {
      title: '📍 Enable Location Access',
      message: 'OkapiFind needs your location to help you find your parked car quickly.',
      benefits: [
        'Save your parking location automatically',
        'Get walking directions back to your car',
        'Find nearby parking spots',
      ],
      alternativeMessage: 'You can manually save locations, but automatic detection won\'t work.',
    },
    backgroundLocation: {
      title: '🚗 Background Location Access',
      message: 'Allow OkapiFind to detect when you park automatically, even when the app is closed.',
      benefits: [
        'Automatic parking detection',
        'Never forget where you parked',
        'Battery-efficient tracking',
      ],
      alternativeMessage: 'You\'ll need to open the app each time to save your parking location.',
    },
    camera: {
      title: '📸 Camera Access',
      message: 'Take photos of your parking spot or meter for easy reference.',
      benefits: [
        'Photograph parking signs and meters',
        'Visual reminders of your parking spot',
        'Scan parking meter QR codes',
      ],
      alternativeMessage: 'You can still use the app without photos.',
    },
    mediaLibrary: {
      title: '🖼️ Photo Library Access',
      message: 'Choose existing photos to add to your parking notes.',
      benefits: [
        'Add photos from your gallery',
        'Save parking photos to your device',
        'Share parking locations with photos',
      ],
    },
    microphone: {
      title: '🎤 Microphone Access',
      message: 'Use voice commands and record audio notes about your parking.',
      benefits: [
        'Hands-free voice commands',
        'Audio parking notes',
        'Voice-guided navigation',
      ],
      alternativeMessage: 'Voice features will be disabled, but all other features work normally.',
    },
    notifications: {
      title: '🔔 Enable Notifications',
      message: 'Get timely reminders about parking meters and time limits.',
      benefits: [
        'Parking meter expiry alerts',
        'Street cleaning reminders',
        'Move your car notifications',
      ],
      alternativeMessage: 'Without notifications, you\'ll need to check the app for reminders.',
    },
    biometric: {
      title: '🔐 Biometric Authentication',
      message: 'Use Face ID or Touch ID for quick and secure app access.',
      benefits: [
        'Quick app access',
        'Secure your parking history',
        'Protect payment information',
      ],
      alternativeMessage: 'You can use a passcode instead.',
    },
  };

  private permissionHistory: Record<string, number> = {};

  /**
   * Request permission with proper explanation
   */
  async requestPermission(
    type: PermissionType,
    options?: {
      showExplanation?: boolean;
      forceAsk?: boolean;
    }
  ): Promise<PermissionStatus> {
    const { showExplanation = true, forceAsk = false } = options || {};

    // Check if we've asked too many times
    if (!forceAsk && await this.hasAskedTooManyTimes(type)) {
      this.showSettingsPrompt(type);
      return { granted: false, canAskAgain: false, neverAskAgain: true };
    }

    // Show explanation if needed
    if (showExplanation && await this.shouldShowExplanation(type)) {
      const proceed = await this.showPermissionExplanation(type);
      if (!proceed) {
        return { granted: false, canAskAgain: true, neverAskAgain: false };
      }
    }

    // Request the actual permission
    const status = await this.requestActualPermission(type);

    // Track the request
    await this.trackPermissionRequest(type, status.granted);

    // Announce result for accessibility
    if (status.granted) {
      accessibilityService.announceSuccess(`${type} permission granted`);
    } else {
      accessibilityService.announce(`${type} permission denied`);
    }

    return status;
  }

  /**
   * Check current permission status
   */
  async checkPermission(type: PermissionType): Promise<PermissionStatus> {
    switch (type) {
      case 'location':
        return this.checkLocationPermission();
      case 'backgroundLocation':
        return this.checkBackgroundLocationPermission();
      case 'camera':
        return this.checkCameraPermission();
      case 'mediaLibrary':
        return this.checkMediaLibraryPermission();
      case 'microphone':
        return this.checkMicrophonePermission();
      case 'notifications':
        return this.checkNotificationPermission();
      case 'biometric':
        return this.checkBiometricPermission();
      default:
        return { granted: false, canAskAgain: false, neverAskAgain: false };
    }
  }

  /**
   * Request all necessary permissions for onboarding
   */
  async requestOnboardingPermissions(): Promise<Record<PermissionType, boolean>> {
    const results: Record<string, boolean> = {};

    // Priority order for permissions
    const permissions: PermissionType[] = [
      'location',
      'notifications',
      'camera',
      'backgroundLocation',
    ];

    for (const permission of permissions) {
      const status = await this.requestPermission(permission, { showExplanation: true });
      results[permission] = status.granted;

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results as Record<PermissionType, boolean>;
  }

  /**
   * Private methods
   */

  private async requestActualPermission(type: PermissionType): Promise<PermissionStatus> {
    try {
      switch (type) {
        case 'location':
          const { status } = await Location.requestForegroundPermissionsAsync();
          return this.mapStatus(status);

        case 'backgroundLocation':
          const bgStatus = await Location.requestBackgroundPermissionsAsync();
          return this.mapStatus(bgStatus.status);

        case 'camera':
          const cameraStatus = await Camera.requestCameraPermissionsAsync();
          return this.mapStatus(cameraStatus.status);

        case 'mediaLibrary':
          const mediaStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
          return this.mapStatus(mediaStatus.status);

        case 'microphone':
          const audioStatus = await Audio.requestPermissionsAsync();
          return this.mapStatus(audioStatus.status);

        case 'notifications':
          const notifStatus = await Notifications.requestPermissionsAsync();
          return this.mapStatus(notifStatus.status);

        case 'biometric':
          const biometricStatus = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Authenticate to enable biometric login',
            fallbackLabel: 'Use Passcode',
          });
          return {
            granted: biometricStatus.success,
            canAskAgain: !biometricStatus.success,
            neverAskAgain: false,
          };

        default:
          return { granted: false, canAskAgain: false, neverAskAgain: false };
      }
    } catch (error) {
      console.error(`Failed to request ${type} permission:`, error);
      return { granted: false, canAskAgain: true, neverAskAgain: false };
    }
  }

  private async checkLocationPermission(): Promise<PermissionStatus> {
    const { status } = await Location.getForegroundPermissionsAsync();
    return this.mapStatus(status);
  }

  private async checkBackgroundLocationPermission(): Promise<PermissionStatus> {
    const { status } = await Location.getBackgroundPermissionsAsync();
    return this.mapStatus(status);
  }

  private async checkCameraPermission(): Promise<PermissionStatus> {
    const { status } = await Camera.getCameraPermissionsAsync();
    return this.mapStatus(status);
  }

  private async checkMediaLibraryPermission(): Promise<PermissionStatus> {
    const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
    return this.mapStatus(status);
  }

  private async checkMicrophonePermission(): Promise<PermissionStatus> {
    const { status } = await Audio.getPermissionsAsync();
    return this.mapStatus(status);
  }

  private async checkNotificationPermission(): Promise<PermissionStatus> {
    const { status } = await Notifications.getPermissionsAsync();
    return this.mapStatus(status);
  }

  private async checkBiometricPermission(): Promise<PermissionStatus> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    return {
      granted: hasHardware && isEnrolled,
      canAskAgain: hasHardware && !isEnrolled,
      neverAskAgain: !hasHardware,
    };
  }

  private mapStatus(status: string): PermissionStatus {
    return {
      granted: status === 'granted',
      canAskAgain: status === 'undetermined',
      neverAskAgain: status === 'denied',
    };
  }

  private async shouldShowExplanation(type: PermissionType): Promise<boolean> {
    const history = await this.getPermissionHistory(type);
    // Show explanation on first ask or after denial
    return history.askCount === 0 || history.lastDenied;
  }

  private async showPermissionExplanation(type: PermissionType): Promise<boolean> {
    const explanation = this.permissionExplanations[type];

    return new Promise((resolve) => {
      const benefitsList = explanation.benefits.map(b => `  • ${b}`).join('\n');

      Alert.alert(
        explanation.title,
        `${explanation.message}\n\nBenefits:\n${benefitsList}\n\n${explanation.alternativeMessage || ''}`,
        [
          {
            text: 'Not Now',
            onPress: () => resolve(false),
            style: 'cancel',
          },
          {
            text: 'Enable',
            onPress: () => resolve(true),
            style: 'default',
          },
        ],
        { cancelable: false }
      );
    });
  }

  private showSettingsPrompt(type: PermissionType): void {
    const explanation = this.permissionExplanations[type];

    Alert.alert(
      'Permission Required',
      `${explanation.message}\n\nPlease enable ${type} permission in Settings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => Linking.openSettings(),
          style: 'default',
        },
      ]
    );
  }

  private async getPermissionHistory(type: PermissionType): Promise<{ askCount: number; lastDenied: boolean }> {
    try {
      const history = await AsyncStorage.getItem(`permission_history_${type}`);
      return history ? JSON.parse(history) : { askCount: 0, lastDenied: false };
    } catch {
      return { askCount: 0, lastDenied: false };
    }
  }

  private async trackPermissionRequest(type: PermissionType, granted: boolean): Promise<void> {
    try {
      const history = await this.getPermissionHistory(type);
      history.askCount++;
      history.lastDenied = !granted;
      await AsyncStorage.setItem(`permission_history_${type}`, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to track permission request:', error);
    }
  }

  private async hasAskedTooManyTimes(type: PermissionType): Promise<boolean> {
    const history = await this.getPermissionHistory(type);
    return history.askCount >= 3 && history.lastDenied;
  }

  /**
   * Reset permission tracking (useful for testing)
   */
  async resetPermissionHistory(): Promise<void> {
    const permissions: PermissionType[] = [
      'location', 'backgroundLocation', 'camera',
      'mediaLibrary', 'microphone', 'notifications', 'biometric'
    ];

    for (const permission of permissions) {
      await AsyncStorage.removeItem(`permission_history_${permission}`);
    }
  }
}

export const permissionService = new PermissionService();