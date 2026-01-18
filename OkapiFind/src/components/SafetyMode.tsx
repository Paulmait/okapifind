// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  Linking,
  Share,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
// TaskManager only works on native platforms
const TaskManager = Platform.OS !== 'web' ? require('expo-task-manager') : null;
import { useAuth } from '../hooks/useAuth';
import { useFeatureGate, PremiumFeature } from '../hooks/useFeatureGate';
import { Colors } from '../constants/colors';
import { analytics } from '../services/analytics';
import { supabase } from '../lib/supabase-client';

const LOCATION_TASK_NAME = 'safety-mode-location-tracking';

interface SafetyModeProps {
  sessionId: string; // Parking session ID
  destination: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  onComplete?: () => void;
  isDarkMode?: boolean;
}

interface ShareSession {
  share_id: string;
  share_token: string;
  share_url: string;
  expires_at: string;
  api_endpoint: string;
}

// Define the background task (only on native platforms)
if (Platform.OS !== 'web' && TaskManager) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Safety Mode location error:', error);
      }
      return;
    }

    if (data) {
      const { locations } = data as any;
      const location = locations[0];

      if (location) {
        // Get the share ID from global state
        const shareId = (global as any).safetyModeShareId;

        if (shareId) {
          try {
            // Insert new location point into Supabase
            const { error: insertError } = await supabase
              .from('share_locations')
              .insert({
                share_id: shareId,
                at_point: `POINT(${location.coords.longitude} ${location.coords.latitude})`,
                speed: location.coords.speed || null,
                heading: location.coords.heading || null,
                accuracy: location.coords.accuracy || null,
                recorded_at: new Date().toISOString(),
              });

            if (insertError && process.env.NODE_ENV === 'development') {
              console.error('Failed to update location:', insertError);
            }
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('Failed to update location:', error);
            }
          }
        }
      }
    }
  });
}

export const SafetyModeV2: React.FC<SafetyModeProps> = ({
  sessionId,
  destination: _destination, // Reserved for future use
  onComplete,
  isDarkMode = false
}) => {
  const { currentUser } = useAuth();
  const { accessFeature } = useFeatureGate();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareSession, setShareSession] = useState<ShareSession | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (isSharing) {
        stopSharing();
      }
    };
  }, []);

  const handleToggle = async (value: boolean) => {
    if (value) {
      // Check if premium feature using feature gate
      accessFeature(PremiumFeature.SAFETY_MODE, () => {
        setIsEnabled(true);
        startSharing();
      });
    } else {
      setIsEnabled(false);
      analytics.logEvent('safety_mode_disabled');
      stopSharing();
    }
  };

  const startSharing = async () => {
    if (!currentUser) {
      Alert.alert('Sign In Required', 'Please sign in to use Safety Mode');
      return;
    }

    try {
      setIsSharing(true);

      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for Safety Mode');
        setIsEnabled(false);
        setIsSharing(false);
        return;
      }

      // Get current location (optional, server will use parking session location)
      // Reserved for future use - could be used for real-time location updates
      // await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });

      // Get auth token
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) {
        Alert.alert('Authentication Error', 'Please sign in again');
        setIsEnabled(false);
        setIsSharing(false);
        return;
      }

      // Call Supabase Edge Function to start sharing
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/start-share`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authSession.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            session_id: sessionId,
            expires_in: 120, // 2 hours
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        if (response.status === 402) {
          // Premium required - should not happen if feature gate works
          Alert.alert('Premium Required', 'Safety Mode requires a premium subscription');
        } else {
          Alert.alert('Error', errorData?.error || 'Failed to start Safety Mode');
        }

        setIsEnabled(false);
        setIsSharing(false);
        return;
      }

      const shareData: ShareSession = await response.json();
      setShareSession(shareData);

      // Store share ID globally for background task
      (global as any).safetyModeShareId = shareData.share_id;

      // Start background location updates
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Location.requestBackgroundPermissionsAsync();

        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // Update every 10 seconds
          distanceInterval: 10, // Or every 10 meters
          foregroundService: {
            notificationTitle: 'OkapiFind Safety Mode',
            notificationBody: 'Sharing your location with trusted contacts',
            notificationColor: Colors.primary,
          },
        });
      } else {
        // Fallback for web/other platforms
        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000,
            distanceInterval: 10,
          },
          async (newLocation) => {
            // Insert location update to Supabase
            await supabase
              .from('share_locations')
              .insert({
                share_id: shareData.share_id,
                at_point: `POINT(${newLocation.coords.longitude} ${newLocation.coords.latitude})`,
                speed: newLocation.coords.speed || null,
                heading: newLocation.coords.heading || null,
                accuracy: newLocation.coords.accuracy || null,
                recorded_at: new Date().toISOString(),
              });
          }
        );
      }

      analytics.logEvent('safety_mode_session_started', {
        share_id: shareData.share_id,
        has_destination: true,
      });

    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to start safety mode:', error);
      }
      Alert.alert('Error', 'Failed to start Safety Mode. Please try again.');
      setIsEnabled(false);
      setIsSharing(false);
    }
  };

  const stopSharing = async () => {
    try {
      // Stop location updates
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).then(
          async (started) => {
            if (started) {
              await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
            }
          }
        );
      } else if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }

      // Mark share session as inactive in Supabase
      if (shareSession) {
        await supabase
          .from('safety_shares')
          .update({ active: false })
          .eq('id', shareSession.share_id);

        // Clear global share ID
        (global as any).safetyModeShareId = null;

        analytics.logEvent('safety_mode_session_ended', {
          share_id: shareSession.share_id,
        });
      }

      setIsSharing(false);
      setShareSession(null);
      onComplete?.();

    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to stop safety mode:', error);
      }
    }
  };

  const shareViaWhatsApp = () => {
    if (!shareSession) return;

    const message = `I'm walking to my car. Track my location for safety: ${shareSession.share_url}`;
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;

    Linking.openURL(url).catch(() => {
      Alert.alert('WhatsApp not installed', 'Please install WhatsApp to share via this method');
    });

    analytics.logEvent('safety_mode_shared', {
      method: 'whatsapp',
      share_id: shareSession.share_id,
    });
  };

  const shareViaSMS = () => {
    if (!shareSession) return;

    const message = `I'm walking to my car. Track my location for safety: ${shareSession.share_url}`;
    const url = Platform.select({
      ios: `sms:&body=${encodeURIComponent(message)}`,
      android: `sms:?body=${encodeURIComponent(message)}`,
      default: '',
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Unable to open SMS app');
      });
    }

    analytics.logEvent('safety_mode_shared', {
      method: 'sms',
      share_id: shareSession.share_id,
    });
  };

  const shareGeneric = async () => {
    if (!shareSession) return;

    try {
      await Share.share({
        message: `I'm walking to my car. Track my location for safety: ${shareSession.share_url}`,
        title: 'OkapiFind Safety Mode',
      });

      analytics.logEvent('safety_mode_shared', {
        method: 'generic',
        share_id: shareSession.share_id,
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Share failed:', error);
      }
    }
  };

  const styles = getStyles(isDarkMode);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Safety Mode</Text>
        <Switch
          value={isEnabled}
          onValueChange={handleToggle}
          trackColor={{ false: '#767577', true: Colors.primary }}
          thumbColor={isEnabled ? Colors.primaryLight : '#f4f3f4'}
        />
      </View>

      {isEnabled && (
        <View style={styles.content}>
          {isSharing && shareSession ? (
            <>
              <Text style={styles.description}>
                Your location is being shared. Anyone with the link can track your
                journey to your car.
              </Text>

              <View style={styles.linkContainer}>
                <Text style={styles.linkLabel}>Share Link:</Text>
                <Text style={styles.link} numberOfLines={1}>
                  {shareSession.share_url}
                </Text>
              </View>

              <View style={styles.shareButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.whatsappButton]}
                  onPress={shareViaWhatsApp}
                >
                  <Text style={styles.buttonText}>WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.smsButton]}
                  onPress={shareViaSMS}
                >
                  <Text style={styles.buttonText}>SMS</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.genericButton]}
                  onPress={shareGeneric}
                >
                  <Text style={styles.buttonText}>More</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.expiryText}>
                Expires: {new Date(shareSession.expires_at).toLocaleTimeString()}
              </Text>
            </>
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Starting Safety Mode...</Text>
            </View>
          )}
        </View>
      )}

      {!isEnabled && (
        <Text style={styles.infoText}>
          Enable Safety Mode to share your live location with trusted contacts
          while walking to your car.
        </Text>
      )}
    </View>
  );
};

const getStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: isDarkMode ? '#1C1C1E' : '#FFFFFF',
      borderRadius: 12,
      padding: 16,
      marginVertical: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: isDarkMode ? '#FFFFFF' : '#000000',
    },
    content: {
      marginTop: 8,
    },
    description: {
      fontSize: 14,
      color: isDarkMode ? '#EBEBF5' : '#3C3C43',
      marginBottom: 16,
      lineHeight: 20,
    },
    linkContainer: {
      backgroundColor: isDarkMode ? '#2C2C2E' : '#F2F2F7',
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    linkLabel: {
      fontSize: 12,
      color: isDarkMode ? '#EBEBF5' : '#3C3C43',
      marginBottom: 4,
      fontWeight: '500',
    },
    link: {
      fontSize: 14,
      color: Colors.primary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    shareButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    button: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      marginHorizontal: 4,
      alignItems: 'center',
    },
    whatsappButton: {
      backgroundColor: '#25D366',
    },
    smsButton: {
      backgroundColor: Colors.primary,
    },
    genericButton: {
      backgroundColor: '#8E8E93',
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    expiryText: {
      fontSize: 12,
      color: isDarkMode ? '#EBEBF5' : '#8E8E93',
      textAlign: 'center',
    },
    loadingContainer: {
      alignItems: 'center',
      paddingVertical: 24,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: isDarkMode ? '#EBEBF5' : '#8E8E93',
    },
    infoText: {
      fontSize: 14,
      color: isDarkMode ? '#EBEBF5' : '#8E8E93',
      lineHeight: 20,
    },
  });

// Default export for backward compatibility
export default SafetyModeV2;
