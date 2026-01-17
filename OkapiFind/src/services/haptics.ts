/**
 * Haptics Service
 * Wrapper around expo-haptics for consistent haptic feedback
 */

import * as ExpoHaptics from 'expo-haptics';
import { Platform } from 'react-native';

export const haptics = {
  /**
   * Success haptic feedback
   */
  success: async (): Promise<void> => {
    if (Platform.OS === 'web') return;
    try {
      await ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  },

  /**
   * Error haptic feedback
   */
  error: async (): Promise<void> => {
    if (Platform.OS === 'web') return;
    try {
      await ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error);
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  },

  /**
   * Warning haptic feedback
   */
  warning: async (): Promise<void> => {
    if (Platform.OS === 'web') return;
    try {
      await ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning);
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  },

  /**
   * Light impact haptic feedback
   */
  impact: async (style: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> => {
    if (Platform.OS === 'web') return;
    try {
      const impactStyle = {
        light: ExpoHaptics.ImpactFeedbackStyle.Light,
        medium: ExpoHaptics.ImpactFeedbackStyle.Medium,
        heavy: ExpoHaptics.ImpactFeedbackStyle.Heavy,
      }[style];
      await ExpoHaptics.impactAsync(impactStyle);
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  },

  /**
   * Selection haptic feedback
   */
  selection: async (): Promise<void> => {
    if (Platform.OS === 'web') return;
    try {
      await ExpoHaptics.selectionAsync();
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  },
};

export default haptics;
