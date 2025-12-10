/**
 * Share Location Bottom Sheet Component
 * Beautiful share UI for sending car location via SMS, WhatsApp, Email, or Link
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import shareLocationService from '../services/shareLocationService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ShareLocationSheetProps {
  visible: boolean;
  onClose: () => void;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
    floorLevel?: number;
    parkingSpot?: string;
  } | null;
}

interface ShareOption {
  id: string;
  icon: string;
  label: string;
  color: string;
  action: () => Promise<void>;
}

export const ShareLocationSheet: React.FC<ShareLocationSheetProps> = ({
  visible,
  onClose,
  location,
}) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleShare = useCallback(
    async (method: string, action: () => Promise<void>) => {
      if (!location) return;

      setLoading(method);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        await action();
        if (method === 'copy') {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          onClose();
        }
      } catch (error) {
        Alert.alert('Share Failed', 'Unable to share location. Please try another method.');
      } finally {
        setLoading(null);
      }
    },
    [location, onClose]
  );

  const shareOptions: ShareOption[] = [
    {
      id: 'native',
      icon: '📤',
      label: 'Share',
      color: '#007AFF',
      action: async () => {
        if (location) {
          await shareLocationService.shareViaNative(location);
        }
      },
    },
    {
      id: 'sms',
      icon: '💬',
      label: 'SMS',
      color: '#34C759',
      action: async () => {
        if (location) {
          await shareLocationService.shareViaSMS(location);
        }
      },
    },
    {
      id: 'whatsapp',
      icon: '📱',
      label: 'WhatsApp',
      color: '#25D366',
      action: async () => {
        if (location) {
          await shareLocationService.shareViaWhatsApp(location);
        }
      },
    },
    {
      id: 'email',
      icon: '📧',
      label: 'Email',
      color: '#FF9500',
      action: async () => {
        if (location) {
          await shareLocationService.shareViaEmail(location);
        }
      },
    },
    {
      id: 'copy',
      icon: copied ? '✓' : '🔗',
      label: copied ? 'Copied!' : 'Copy Link',
      color: copied ? '#34C759' : '#8E8E93',
      action: async () => {
        if (location) {
          const result = await shareLocationService.copyToClipboard(location);
          if (result.success) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      },
    },
  ];

  if (!location) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Share Car Location</Text>
            <Text style={styles.subtitle}>
              {location.address || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`}
            </Text>
            {location.floorLevel && (
              <Text style={styles.floorBadge}>Floor {location.floorLevel}</Text>
            )}
          </View>

          {/* Share Options Grid */}
          <View style={styles.optionsGrid}>
            {shareOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={styles.optionButton}
                onPress={() => handleShare(option.id, option.action)}
                disabled={loading !== null}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.optionIconContainer,
                    { backgroundColor: `${option.color}15` },
                  ]}
                >
                  {loading === option.id ? (
                    <ActivityIndicator color={option.color} />
                  ) : (
                    <Text style={styles.optionIcon}>{option.icon}</Text>
                  )}
                </View>
                <Text style={styles.optionLabel}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              Link expires in 24 hours for privacy
            </Text>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Safe area
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  floorBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    backgroundColor: '#007AFF15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 20,
    justifyContent: 'space-around',
  },
  optionButton: {
    alignItems: 'center',
    width: '20%',
    marginBottom: 16,
  },
  optionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  optionIcon: {
    fontSize: 28,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  infoContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  infoText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  cancelButton: {
    marginHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
});

export default ShareLocationSheet;
