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
import * as TaskManager from 'expo-task-manager';
import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  deleteDoc,
  getFirestore
} from 'firebase/firestore';
import { firebaseApp } from '../config/firebase';
import { useAuth } from '../hooks/useAuth';
import { useFeatureGate } from '../hooks/useFeatureGate';
import { Colors } from '../constants/colors';
import { analytics } from '../services/analytics';

const LOCATION_TASK_NAME = 'safety-mode-location-tracking';
const db = getFirestore(firebaseApp);

interface SafetyModeProps {
  destination: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  onComplete?: () => void;
  isDarkMode?: boolean;
}

interface LiveSession {
  userId: string;
  userEmail: string;
  userName?: string;
  startLocation: {
    latitude: number;
    longitude: number;
  };
  destination: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  currentLocation: {
    latitude: number;
    longitude: number;
    timestamp: any;
  };
  shareId: string;
  createdAt: any;
  expiresAt: any;
  isActive: boolean;
  estimatedArrival?: string;
}

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Safety Mode location error:', error);
    return;
  }

  if (data) {
    const { locations } = data as any;
    const location = locations[0];

    if (location) {
      // Get the session ID from AsyncStorage or a global state
      // For now, we'll use a timestamp-based ID stored globally
      const sessionId = global.safetyModeSessionId;

      if (sessionId) {
        try {
          await updateDoc(doc(db, 'safety_sessions', sessionId), {
            currentLocation: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              timestamp: serverTimestamp(),
            },
            lastUpdate: serverTimestamp(),
          });
        } catch (error) {
          console.error('Failed to update location:', error);
        }
      }
    }
  }
});

export const SafetyMode: React.FC<SafetyModeProps> = ({
  destination,
  onComplete,
  isDarkMode = false
}) => {
  const { currentUser, userEmail, userName } = useAuth();
  const { checkFeature } = useFeatureGate();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
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
      // Check if premium feature
      const hasAccess = await checkFeature('safety_mode');
      if (!hasAccess) {
        analytics.logEvent('safety_mode_premium_required');
        return;
      }
    }
    setIsEnabled(value);

    if (value) {
      analytics.logEvent('safety_mode_enabled');
      startSharing();
    } else {
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

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Generate session ID
      const newSessionId = `${currentUser.uid}_${Date.now()}`;
      setSessionId(newSessionId);

      // Store globally for background task
      global.safetyModeSessionId = newSessionId;

      // Create live session in Firestore
      const sessionData: LiveSession = {
        userId: currentUser.uid,
        userEmail: userEmail || '',
        userName: userName || 'OkapiFind User',
        startLocation: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        destination: {
          latitude: destination.latitude,
          longitude: destination.longitude,
          address: destination.address,
        },
        currentLocation: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: serverTimestamp(),
        },
        shareId: newSessionId.substring(newSessionId.length - 8), // Short ID for sharing
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours expiry
        isActive: true,
      };

      await setDoc(doc(db, 'safety_sessions', newSessionId), sessionData);

      // Generate share link
      const link = `https://okapifind.com/track/${sessionData.shareId}`;
      setShareLink(link);

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
            await updateDoc(doc(db, 'safety_sessions', newSessionId), {
              currentLocation: {
                latitude: newLocation.coords.latitude,
                longitude: newLocation.coords.longitude,
                timestamp: serverTimestamp(),
              },
              lastUpdate: serverTimestamp(),
            });
          }
        );
      }

      analytics.logEvent('safety_mode_session_started', {
        session_id: newSessionId,
        has_destination: true,
      });

    } catch (error: any) {
      console.error('Failed to start safety mode:', error);
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

      // Mark session as inactive
      if (sessionId) {
        await updateDoc(doc(db, 'safety_sessions', sessionId), {
          isActive: false,
          endedAt: serverTimestamp(),
        });

        // Clear global session ID
        global.safetyModeSessionId = null;

        analytics.logEvent('safety_mode_session_ended', {
          session_id: sessionId,
        });
      }

      setIsSharing(false);
      setShareLink('');
      setSessionId('');
      onComplete?.();

    } catch (error) {
      console.error('Failed to stop safety mode:', error);
    }
  };

  const shareViaWhatsApp = () => {
    const message = `I'm walking to my car. Track my location for safety: ${shareLink}`;
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;

    Linking.openURL(url).catch(() => {
      Alert.alert('WhatsApp not installed', 'Please install WhatsApp to share via this method');
    });

    analytics.logEvent('safety_mode_shared', {
      method: 'whatsapp',
      session_id: sessionId,
    });
  };

  const shareViaSMS = () => {
    const message = `I'm walking to my car. Track my location for safety: ${shareLink}`;
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
      session_id: sessionId,
    });
  };

  const shareGeneric = async () => {
    try {
      await Share.share({
        message: `I'm walking to my car. Track my location for safety: ${shareLink}`,
        title: 'OkapiFind Safety Mode',
      });

      analytics.logEvent('safety_mode_shared', {
        method: 'generic',
        session_id: sessionId,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const styles = getStyles(isDarkMode);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>🛡️</Text>
          <Text style={styles.title}>Safety Mode</Text>
          <Switch
            value={isEnabled}
            onValueChange={handleToggle}
            trackColor={{
              false: isDarkMode ? '#3A3A3A' : '#767577',
              true: Colors.primary
            }}
            thumbColor={isEnabled ? '#FFF' : '#f4f3f4'}
            ios_backgroundColor={isDarkMode ? '#3A3A3A' : '#767577'}
            style={styles.switch}
          />
        </View>
        <Text style={styles.subtitle}>
          Share your live location with trusted contacts
        </Text>
      </View>

      {isEnabled && (
        <View style={styles.content}>
          {isSharing ? (
            <>
              <View style={styles.activeSession}>
                <View style={styles.pulsingDot} />
                <Text style={styles.activeText}>Live tracking active</Text>
              </View>

              <Text style={styles.sharePrompt}>Share your location:</Text>

              <View style={styles.shareButtons}>
                <TouchableOpacity
                  style={[styles.shareButton, styles.whatsappButton]}
                  onPress={shareViaWhatsApp}
                >
                  <Text style={styles.shareButtonText}>📱 WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.shareButton, styles.smsButton]}
                  onPress={shareViaSMS}
                >
                  <Text style={styles.shareButtonText}>💬 SMS</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.shareButton, styles.moreButton]}
                  onPress={shareGeneric}
                >
                  <Text style={styles.shareButtonText}>📤 More</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.linkContainer}>
                <Text style={styles.linkLabel}>Share link:</Text>
                <Text style={styles.link} selectable>{shareLink}</Text>
              </View>

              <TouchableOpacity
                style={styles.stopButton}
                onPress={() => {
                  setIsEnabled(false);
                  stopSharing();
                }}
              >
                <Text style={styles.stopButtonText}>Stop Sharing</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ActivityIndicator size="large" color={Colors.primary} />
          )}
        </View>
      )}

      {!isEnabled && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            🔒 Premium feature: Share your live location when walking to your car for added safety
          </Text>
        </View>
      )}
    </View>
  );
};

const getStyles = (isDarkMode: boolean) => StyleSheet.create({
  container: {
    backgroundColor: isDarkMode ? Colors.surface : '#FFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  icon: {
    fontSize: 24,
    marginRight: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: isDarkMode ? Colors.textPrimary : '#000',
    flex: 1,
  },
  switch: {
    marginLeft: 'auto',
  },
  subtitle: {
    fontSize: 14,
    color: isDarkMode ? Colors.textSecondary : '#666',
    marginLeft: 32,
  },
  content: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? '#3A3A3A' : '#E0E0E0',
  },
  activeSession: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pulsingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  activeText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '500',
  },
  sharePrompt: {
    fontSize: 16,
    fontWeight: '500',
    color: isDarkMode ? Colors.textPrimary : '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  shareButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  shareButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  smsButton: {
    backgroundColor: '#007AFF',
  },
  moreButton: {
    backgroundColor: isDarkMode ? '#4A4A4A' : '#6C757D',
  },
  shareButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  linkContainer: {
    backgroundColor: isDarkMode ? '#2A2A2A' : '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  linkLabel: {
    fontSize: 12,
    color: isDarkMode ? Colors.textSecondary : '#666',
    marginBottom: 4,
  },
  link: {
    fontSize: 14,
    color: Colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  stopButton: {
    backgroundColor: '#DC3545',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  stopButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: isDarkMode ? '#2A2A2A' : '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isDarkMode ? '#3A3A3A' : '#FFC107',
  },
  infoText: {
    fontSize: 14,
    color: isDarkMode ? Colors.textSecondary : '#856404',
    lineHeight: 20,
  },
});

export default SafetyMode;