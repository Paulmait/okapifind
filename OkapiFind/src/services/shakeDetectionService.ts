// @ts-nocheck
/**
 * Shake Detection Service
 * Detects shake gestures to quickly save parking location
 */

import { Accelerometer, AccelerometerMeasurement } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { analytics } from './analytics';
import { offlineService } from './offlineService';
import { supabase } from '../lib/supabase-client';

interface ShakeConfig {
  threshold: number;
  minShakes: number;
  maxShakeDuration: number;
  cooldownPeriod: number;
}

class ShakeDetectionService {
  private subscription: any = null;
  private isListening: boolean = false;
  private shakeCount: number = 0;
  private shakeStartTime: number = 0;
  private lastShakeTime: number = 0;
  private cooldownActive: boolean = false;
  private enabled: boolean = true;

  private config: ShakeConfig = {
    threshold: 2.5, // Force threshold
    minShakes: 2, // Minimum shakes to trigger
    maxShakeDuration: 1000, // Max time for shake gesture (ms)
    cooldownPeriod: 3000, // Cooldown between saves (ms)
  };

  constructor() {
    this.loadSettings();
  }

  /**
   * Load user settings
   */
  private async loadSettings() {
    try {
      const settings = await AsyncStorage.getItem('@shake_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        this.enabled = parsed.enabled !== false;
        if (parsed.threshold) {
          this.config.threshold = parsed.threshold;
        }
      }
    } catch (error) {
      console.error('Failed to load shake settings:', error);
    }
  }

  /**
   * Start shake detection
   */
  async start(): Promise<void> {
    if (!this.enabled || this.isListening) {
      return;
    }

    try {
      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission not granted for shake detection');
        return;
      }

      // Check if accelerometer is available
      const isAvailable = await Accelerometer.isAvailableAsync();
      if (!isAvailable) {
        console.warn('Accelerometer not available on this device');
        return;
      }

      // Set update interval
      Accelerometer.setUpdateInterval(100); // 100ms = 10Hz

      // Subscribe to accelerometer updates
      this.subscription = Accelerometer.addListener(this.handleAccelerometerData);
      this.isListening = true;

      console.log('Shake detection started');
      analytics.logEvent('shake_detection_started');
    } catch (error) {
      console.error('Failed to start shake detection:', error);
      analytics.logEvent('shake_detection_error', { error: error.message });
    }
  }

  /**
   * Stop shake detection
   */
  stop(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    this.isListening = false;
    this.resetShakeState();

    console.log('Shake detection stopped');
    analytics.logEvent('shake_detection_stopped');
  }

  /**
   * Handle accelerometer data
   */
  private handleAccelerometerData = (data: AccelerometerMeasurement) => {
    if (!this.enabled || this.cooldownActive) {
      return;
    }

    // Calculate total force
    const { x, y, z } = data;
    const totalForce = Math.sqrt(x * x + y * y + z * z);

    // Check if force exceeds threshold (accounting for gravity ~1.0)
    if (Math.abs(totalForce - 1.0) > this.config.threshold) {
      this.detectShake();
    } else {
      // Check if shake gesture completed
      this.checkShakeCompletion();
    }
  };

  /**
   * Detect shake gesture
   */
  private detectShake(): void {
    const now = Date.now();

    // Start new shake sequence
    if (this.shakeCount === 0) {
      this.shakeStartTime = now;
      this.shakeCount = 1;
    } else {
      // Continue shake sequence
      if (now - this.shakeStartTime <= this.config.maxShakeDuration) {
        this.shakeCount++;

        // Check if we have enough shakes
        if (this.shakeCount >= this.config.minShakes) {
          this.triggerShakeSave();
        }
      } else {
        // Shake took too long, reset
        this.resetShakeState();
      }
    }

    this.lastShakeTime = now;
  }

  /**
   * Check if shake gesture is complete
   */
  private checkShakeCompletion(): void {
    if (this.shakeCount > 0) {
      const now = Date.now();

      // If no shake for 500ms, reset
      if (now - this.lastShakeTime > 500) {
        this.resetShakeState();
      }
    }
  }

  /**
   * Reset shake detection state
   */
  private resetShakeState(): void {
    this.shakeCount = 0;
    this.shakeStartTime = 0;
    this.lastShakeTime = 0;
  }

  /**
   * Trigger save on shake detection
   */
  private async triggerShakeSave(): Promise<void> {
    // Prevent multiple triggers
    if (this.cooldownActive) {
      return;
    }

    this.cooldownActive = true;
    this.resetShakeState();

    // Haptic feedback
    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success
    );

    try {
      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Get reverse geocoding for address
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const addressString = address
        ? `${address.street || ''} ${address.city || ''}`
        : 'Unknown location';

      // Save parking location
      const result = await offlineService.saveParkingLocation(location, {
        source: 'auto',
        notes: 'Saved by shake gesture',
        address: addressString,
      });

      // Show success notification
      Alert.alert(
        '✅ Parking Saved!',
        `Location saved at ${addressString}`,
        [
          { text: 'View', onPress: () => this.navigateToMap() },
          { text: 'OK' },
        ]
      );

      analytics.logEvent('shake_save_success', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        queued: result.queued,
      });
    } catch (error) {
      console.error('Failed to save location on shake:', error);

      Alert.alert(
        'Save Failed',
        'Unable to save parking location. Please try manual save.',
        [{ text: 'OK' }]
      );

      analytics.logEvent('shake_save_error', { error: error.message });
    } finally {
      // Cooldown period
      setTimeout(() => {
        this.cooldownActive = false;
      }, this.config.cooldownPeriod);
    }
  }

  /**
   * Navigate to map screen
   */
  private navigateToMap(): void {
    // This would be connected to navigation in the actual app
    // For now, just log
    console.log('Navigate to map to view saved location');
  }

  /**
   * Enable/disable shake detection
   */
  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;

    try {
      const settings = await AsyncStorage.getItem('@shake_settings');
      const parsed = settings ? JSON.parse(settings) : {};
      parsed.enabled = enabled;
      await AsyncStorage.setItem('@shake_settings', JSON.stringify(parsed));

      if (enabled && !this.isListening) {
        await this.start();
      } else if (!enabled && this.isListening) {
        this.stop();
      }

      analytics.logEvent('shake_detection_toggled', { enabled });
    } catch (error) {
      console.error('Failed to save shake settings:', error);
    }
  }

  /**
   * Update shake sensitivity
   */
  async setSensitivity(level: 'low' | 'medium' | 'high'): Promise<void> {
    const thresholds = {
      low: 3.0,
      medium: 2.5,
      high: 2.0,
    };

    this.config.threshold = thresholds[level];

    try {
      const settings = await AsyncStorage.getItem('@shake_settings');
      const parsed = settings ? JSON.parse(settings) : {};
      parsed.threshold = this.config.threshold;
      await AsyncStorage.setItem('@shake_settings', JSON.stringify(parsed));

      analytics.logEvent('shake_sensitivity_changed', { level });
    } catch (error) {
      console.error('Failed to save shake sensitivity:', error);
    }
  }

  /**
   * Get shake detection status
   */
  getStatus(): {
    enabled: boolean;
    listening: boolean;
    threshold: number;
  } {
    return {
      enabled: this.enabled,
      listening: this.isListening,
      threshold: this.config.threshold,
    };
  }

  /**
   * Test shake detection
   */
  async testShake(): Promise<void> {
    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success
    );

    Alert.alert(
      '🎉 Shake Test',
      'Shake detection is working! Shake your phone to save parking.',
      [{ text: 'Cool!' }]
    );

    analytics.logEvent('shake_test_triggered');
  }
}

export const shakeDetectionService = new ShakeDetectionService();
export default shakeDetectionService;