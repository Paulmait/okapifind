import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { safetyService, SafetySession } from '../services/safetyService';
import { Colors } from '../constants/colors';

type LiveTrackingScreenRouteProp = RouteProp<
  { LiveTracking: { shareId: string } },
  'LiveTracking'
>;

export default function LiveTrackingScreen() {
  const route = useRoute<LiveTrackingScreenRouteProp>();
  const navigation = useNavigation();
  const mapRef = useRef<MapView>(null);

  const [session, setSession] = useState<SafetySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());

  const shareId = route.params?.shareId;

  useEffect(() => {
    if (!shareId) {
      setError('Invalid tracking link');
      setLoading(false);
      return;
    }

    loadSession();
  }, [shareId]);

  useEffect(() => {
    if (!session) return;

    // Subscribe to real-time updates
    const unsubscribe = safetyService.subscribeToShareSession(
      shareId,
      (updatedSession) => {
        if (updatedSession) {
          setSession(updatedSession);
          setLastUpdateTime(new Date());

          // Center map on current location
          if (mapRef.current && updatedSession.currentLocation) {
            mapRef.current.animateToRegion({
              latitude: updatedSession.currentLocation.latitude,
              longitude: updatedSession.currentLocation.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }, 500);
          }

          // Check if session ended
          if (!updatedSession.isActive) {
            Alert.alert(
              'Tracking Ended',
              `${updatedSession.userName || 'User'} has arrived safely at their destination!`,
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          }
        } else {
          setError('Session not found or expired');
        }
      }
    );

    return () => unsubscribe();
  }, [session?.shareId]);

  const loadSession = async () => {
    try {
      const sessionData = await safetyService.getSessionByShareId(shareId);
      if (sessionData) {
        setSession(sessionData);

        // Check if session is expired
        if (new Date(sessionData.expiresAt) < new Date()) {
          setError('This tracking session has expired');
        }
      } else {
        setError('Tracking session not found');
      }
    } catch (err) {
      console.error('Error loading session:', err);
      setError('Failed to load tracking session');
    } finally {
      setLoading(false);
    }
  };

  const getTimeSinceUpdate = (): string => {
    const diff = Date.now() - lastUpdateTime.getTime();
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 120) return '1 minute ago';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    return 'Over an hour ago';
  };

  const getDistanceToDestination = (): string => {
    if (!session) return '';

    const distance = safetyService.calculateDistance(
      session.currentLocation,
      session.destination
    );

    if (distance < 100) {
      return 'Less than 100m';
    } else if (distance < 1000) {
      return `${Math.round(distance / 10) * 10}m`;
    } else {
      return `${(distance / 1000).toFixed(1)}km`;
    }
  };

  const getEstimatedArrival = (): string => {
    if (!session) return '';

    const distance = safetyService.calculateDistance(
      session.currentLocation,
      session.destination
    );

    return safetyService.formatEstimatedArrival(distance);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading tracking session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Unable to Track</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={styles.title}>Live Tracking</Text>
          <Text style={styles.subtitle}>
            {session.userName || 'OkapiFind User'}
          </Text>
        </View>

        <View style={styles.statusIndicator}>
          <View style={[
            styles.statusDot,
            { backgroundColor: session.isActive ? '#4CAF50' : '#999' }
          ]} />
          <Text style={styles.statusText}>
            {session.isActive ? 'Active' : 'Ended'}
          </Text>
        </View>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: session.currentLocation.latitude,
          longitude: session.currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {/* Current location marker */}
        <Marker
          coordinate={{
            latitude: session.currentLocation.latitude,
            longitude: session.currentLocation.longitude,
          }}
          title={session.userName || 'User'}
          description="Current location"
        >
          <View style={styles.currentLocationMarker}>
            <View style={styles.markerPulse} />
            <Text style={styles.markerEmoji}>🚶</Text>
          </View>
        </Marker>

        {/* Destination marker */}
        <Marker
          coordinate={{
            latitude: session.destination.latitude,
            longitude: session.destination.longitude,
          }}
          title="Destination"
          description={session.destination.address || 'Car location'}
        >
          <View style={styles.destinationMarker}>
            <Text style={styles.markerEmoji}>🚗</Text>
          </View>
        </Marker>

        {/* Path line */}
        <Polyline
          coordinates={[
            {
              latitude: session.currentLocation.latitude,
              longitude: session.currentLocation.longitude,
            },
            {
              latitude: session.destination.latitude,
              longitude: session.destination.longitude,
            },
          ]}
          strokeColor={Colors.primary}
          strokeWidth={3}
          lineDashPattern={[5, 5]}
        />

        {/* Safety radius around current location */}
        <Circle
          center={{
            latitude: session.currentLocation.latitude,
            longitude: session.currentLocation.longitude,
          }}
          radius={50}
          fillColor="rgba(255, 215, 0, 0.2)"
          strokeColor="rgba(255, 215, 0, 0.5)"
          strokeWidth={1}
        />
      </MapView>

      <View style={styles.infoPanel}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Distance to car</Text>
            <Text style={styles.infoValue}>{getDistanceToDestination()}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Est. arrival</Text>
            <Text style={styles.infoValue}>{getEstimatedArrival()}</Text>
          </View>
        </View>

        <View style={styles.updateInfo}>
          <Text style={styles.updateText}>
            Last update: {getTimeSinceUpdate()}
          </Text>
        </View>

        {!session.isActive && (
          <View style={styles.arrivedBanner}>
            <Text style={styles.arrivedIcon}>✅</Text>
            <Text style={styles.arrivedText}>Arrived safely!</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: Colors.textPrimary,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  map: {
    flex: 1,
  },
  currentLocationMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
  },
  markerEmoji: {
    fontSize: 32,
  },
  destinationMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoPanel: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.primary,
  },
  updateInfo: {
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  updateText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  arrivedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  arrivedIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  arrivedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
});