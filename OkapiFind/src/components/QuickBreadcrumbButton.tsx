/**
 * Quick Breadcrumb Button
 * One-tap landmark photo capture
 * "Red pillar near elevator" - helps users remember parking location
 */

import React, { useState } from 'react';
import { TouchableOpacity, View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { visualBreadcrumbs, VisualBreadcrumb } from '../services/visualBreadcrumbs';

interface QuickBreadcrumbButtonProps {
  sessionId: string;
  onCapture?: (breadcrumb: VisualBreadcrumb) => void;
  style?: object;
  compact?: boolean; // Compact mode for space-constrained UIs
}

export const QuickBreadcrumbButton: React.FC<QuickBreadcrumbButtonProps> = ({
  sessionId,
  onCapture,
  style,
  compact = false,
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [breadcrumbCount, setBreadcrumbCount] = useState(
    visualBreadcrumbs.getBreadcrumbs(sessionId).length
  );

  const handleQuickCapture = async () => {
    if (isCapturing) return;

    try {
      setIsCapturing(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const breadcrumb = await visualBreadcrumbs.captureQuickPhoto(sessionId, {
        autoDetectLandmark: true,
        generateThumbnail: true,
        compressImage: true,
      });

      if (breadcrumb) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setBreadcrumbCount((prev) => prev + 1);
        onCapture?.(breadcrumb);
      }
    } catch (error) {
      console.error('[QuickBreadcrumbButton] Capture error:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      const message =
        error instanceof Error ? error.message : 'Failed to capture landmark photo';

      Alert.alert('Capture Failed', message, [{ text: 'OK' }]);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleLongPress = async () => {
    // Long press shows option to select from library
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    Alert.alert(
      'Add Landmark Photo',
      'Choose how to add a landmark photo',
      [
        {
          text: 'Take Photo',
          onPress: handleQuickCapture,
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            try {
              setIsCapturing(true);
              const breadcrumb = await visualBreadcrumbs.selectFromLibrary(sessionId, {
                autoDetectLandmark: true,
                generateThumbnail: true,
              });

              if (breadcrumb) {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setBreadcrumbCount((prev) => prev + 1);
                onCapture?.(breadcrumb);
              }
            } catch (error) {
              console.error('[QuickBreadcrumbButton] Library error:', error);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to select photo from library');
            } finally {
              setIsCapturing(false);
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  if (compact) {
    return (
      <TouchableOpacity
        onPress={handleQuickCapture}
        onLongPress={handleLongPress}
        disabled={isCapturing}
        style={[styles.compactButton, style]}
        accessible={true}
        accessibilityLabel="Add landmark photo"
        accessibilityHint="Tap to take a photo, long press for more options"
      >
        {isCapturing ? (
          <ActivityIndicator size="small" color="#4A90E2" />
        ) : (
          <View style={styles.compactContent}>
            <Ionicons name="camera-outline" size={20} color="#4A90E2" />
            {breadcrumbCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{breadcrumbCount}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handleQuickCapture}
      onLongPress={handleLongPress}
      disabled={isCapturing}
      style={[styles.button, style]}
      accessible={true}
      accessibilityLabel="Add landmark photo"
      accessibilityHint="Tap to take a photo of a nearby landmark to help you remember this location. Long press for more options."
    >
      <View style={styles.buttonContent}>
        {isCapturing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="camera" size={24} color="#FFFFFF" />
            <View style={styles.textContainer}>
              <Text style={styles.buttonText}>
                {breadcrumbCount === 0 ? 'Add Landmark Photo' : `Landmarks (${breadcrumbCount})`}
              </Text>
              <Text style={styles.buttonHint}>
                "Red pillar near elevator"
              </Text>
            </View>
            {breadcrumbCount > 0 && (
              <View style={styles.checkmark}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              </View>
            )}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonHint: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  checkmark: {
    marginLeft: 8,
  },
  compactButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  compactContent: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF5722',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default QuickBreadcrumbButton;
