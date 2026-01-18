// @ts-nocheck
/**
 * AR Navigation Screen
 * Premium feature using ARKit (iOS) and ARCore (Android)
 * Shows floating 3D arrow in camera view pointing to car
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import * as Location from 'expo-location';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Magnetometer } from 'expo-sensors';
import { Subscription } from 'expo-sensors/build/Pedometer';
import { RootStackParamList } from '../types/navigation';
import { Colors } from '../constants/colors';
import { useFeatureGate } from '../hooks/useFeatureGate';
import { analytics } from '../services/analytics';
import { calculateBearing, calculateDistance } from '../utils';

// AR libraries would be imported here
// import { ViroARSceneNavigator } from '@viro-community/react-viro';

type ARNavigationScreenRouteProp = RouteProp<RootStackParamList, 'ARNavigation'>;
type ARNavigationScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ARNavigation'>;

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ARState {
  isARSupported: boolean;
  isLoading: boolean;
  hasPermission: boolean;
  currentLocation: Location.LocationObject | null;
  heading: number;
  distance: number;
  bearing: number;
  arrowRotation: number;
}

export default function ARNavigationScreen() {
  const route = useRoute<ARNavigationScreenRouteProp>();
  const navigation = useNavigation<ARNavigationScreenNavigationProp>();
  const { checkFeature } = useFeatureGate();

  const [arState, setARState] = useState<ARState>({
    isARSupported: false,
    isLoading: true,
    hasPermission: false,
    currentLocation: null,
    heading: 0,
    distance: 0,
    bearing: 0,
    arrowRotation: 0,
  });

  const [showCompassFallback, setShowCompassFallback] = useState(false);
  const cameraRef = useRef<Camera>(null);
  const magnetometerSubscription = useRef<Subscription | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  const carLocation = route.params?.carLocation || {
    latitude: 0,
    longitude: 0,
  };

  useEffect(() => {
    initializeAR();

    return () => {
      // Cleanup subscriptions
      if (magnetometerSubscription.current) {
        magnetometerSubscription.current.remove();
      }
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  /**
   * Initialize AR capabilities
   */
  const initializeAR = async () => {
    try {
      // Check premium access
      const hasAccess = await checkFeature('ar_navigation');
      if (!hasAccess) {
        analytics.logEvent('ar_navigation_premium_required');
        Alert.alert(
          'Premium Feature',
          'AR Navigation requires a premium subscription',
          [
            { text: 'Upgrade', onPress: () => navigation.navigate('Paywall') },
            { text: 'Cancel', onPress: () => navigation.goBack() },
          ]
        );
        return;
      }

      // Check AR support
      const isSupported = await checkARSupport();

      if (!isSupported) {
        setShowCompassFallback(true);
        analytics.logEvent('ar_navigation_fallback');
      }

      // Request camera permissions
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required for AR navigation');
        navigation.goBack();
        return;
      }

      // Request location permissions
      const locationStatus = await Location.requestForegroundPermissionsAsync();
      if (locationStatus.status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for AR navigation');
        navigation.goBack();
        return;
      }

      // Start tracking
      await startTracking();

      setARState(prev => ({
        ...prev,
        isARSupported: isSupported,
        hasPermission: true,
        isLoading: false,
      }));

      analytics.logEvent('ar_navigation_started');
    } catch (error) {
      console.error('Failed to initialize AR:', error);
      setShowCompassFallback(true);
      setARState(prev => ({ ...prev, isLoading: false }));
    }
  };

  /**
   * Check if AR is supported on device
   */
  const checkARSupport = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'ios') {
        // Check for ARKit support (iOS 11+, A9 chip or later)
        // In production, use actual ARKit availability check
        const iosVersion = parseInt(Platform.Version as string, 10);
        return iosVersion >= 11;
      } else if (Platform.OS === 'android') {
        // Check for ARCore support
        // In production, use Google AR Core availability API
        return true; // Assume supported for demo
      }
      return false;
    } catch (error) {
      console.error('AR support check failed:', error);
      return false;
    }
  };

  /**
   * Start location and heading tracking
   */
  const startTracking = async () => {
    // Start location tracking
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (location) => {
        updateNavigation(location);
      }
    );

    // Start magnetometer for heading
    magnetometerSubscription.current = Magnetometer.addListener((data) => {
      const angle = Math.atan2(data.y, data.x);
      const degree = angle * (180 / Math.PI);
      const normalizedDegree = (degree + 360) % 360;

      setARState(prev => ({
        ...prev,
        heading: normalizedDegree,
      }));
    });

    Magnetometer.setUpdateInterval(100);
  };

  /**
   * Update navigation data
   */
  const updateNavigation = (location: Location.LocationObject) => {
    const distance = calculateDistance(
      {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      },
      carLocation
    );

    const bearing = calculateBearing(
      {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      },
      carLocation
    );

    // Calculate relative bearing for arrow
    const relativeBearing = (bearing - arState.heading + 360) % 360;

    setARState(prev => ({
      ...prev,
      currentLocation: location,
      distance,
      bearing,
      arrowRotation: relativeBearing,
    }));
  };

  /**
   * Render AR arrow overlay
   */
  const renderAROverlay = () => {
    if (showCompassFallback) {
      return renderCompassFallback();
    }

    // Calculate arrow position based on bearing
    const horizontalPosition = (arState.arrowRotation / 360) * screenWidth;
    const verticalPosition = screenHeight / 2;

    // Scale arrow based on distance
    const scale = Math.max(0.5, Math.min(2, 100 / arState.distance));

    return (
      <View style={styles.arOverlay}>
        {/* Distance indicator */}
        <View style={styles.distanceContainer}>
          <Text style={styles.distanceText}>
            {arState.distance < 100
              ? `${Math.round(arState.distance)}m`
              : `${(arState.distance / 1000).toFixed(1)}km`}
          </Text>
          <Text style={styles.distanceLabel}>to your car</Text>
        </View>

        {/* AR Arrow */}
        <View
          style={[
            styles.arArrowContainer,
            {
              left: horizontalPosition - 50,
              top: verticalPosition - 50,
              transform: [
                { scale },
                { rotateZ: `${arState.arrowRotation}deg` },
              ],
            },
          ]}
        >
          <Text style={styles.arArrow}>⬆️</Text>
        </View>

        {/* Direction indicator */}
        <View style={styles.directionContainer}>
          <Text style={styles.directionText}>
            {getDirectionText(arState.arrowRotation)}
          </Text>
        </View>
      </View>
    );
  };

  /**
   * Render compass fallback for non-AR devices
   */
  const renderCompassFallback = () => {
    return (
      <View style={styles.compassFallback}>
        <View style={styles.compassCircle}>
          <View
            style={[
              styles.compassArrow,
              {
                transform: [{ rotate: `${arState.arrowRotation}deg` }],
              },
            ]}
          >
            <Text style={styles.compassArrowText}>⬆️</Text>
          </View>
        </View>

        <View style={styles.compassInfo}>
          <Text style={styles.compassDistance}>
            {arState.distance < 100
              ? `${Math.round(arState.distance)}m`
              : `${(arState.distance / 1000).toFixed(1)}km`}
          </Text>
          <Text style={styles.compassDirection}>
            {getDirectionText(arState.arrowRotation)}
          </Text>
        </View>
      </View>
    );
  };

  /**
   * Get direction text from bearing
   */
  const getDirectionText = (bearing: number): string => {
    const directions = ['Ahead', 'Right', 'Behind', 'Left'];
    const index = Math.round(bearing / 90) % 4;
    return directions[index];
  };

  /**
   * Handle close AR navigation
   */
  const handleClose = () => {
    analytics.logEvent('ar_navigation_closed', {
      duration: Date.now() - startTime,
      distance: arState.distance,
    });
    navigation.goBack();
  };

  const startTime = useRef(Date.now()).current;

  if (arState.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Initializing AR Navigation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {arState.hasPermission && !showCompassFallback ? (
        <Camera
          ref={cameraRef}
          style={styles.camera}
          type={CameraType.back}
        >
          {renderAROverlay()}
        </Camera>
      ) : (
        <View style={styles.fallbackContainer}>
          {renderCompassFallback()}
        </View>
      )}

      {/* Controls overlay */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        {showCompassFallback && (
          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => navigation.navigate('Guidance', { carLocation, userLocation: arState.currentLocation })}
          >
            <Text style={styles.switchButtonText}>Switch to Map</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Info panel */}
      <View style={styles.infoPanel}>
        <View style={styles.infoPill}>
          <Text style={styles.infoIcon}>🚗</Text>
          <Text style={styles.infoText}>
            {arState.distance < 20 ? 'Your car is nearby!' : 'Follow the arrow'}
          </Text>
        </View>
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
  camera: {
    flex: 1,
  },
  arOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  distanceContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  distanceLabel: {
    fontSize: 18,
    color: '#FFF',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  arArrowContainer: {
    position: 'absolute',
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arArrow: {
    fontSize: 80,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  directionContainer: {
    position: 'absolute',
    bottom: 150,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  directionText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFF',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  fallbackContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compassFallback: {
    alignItems: 'center',
  },
  compassCircle: {
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  compassArrow: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassArrowText: {
    fontSize: 80,
  },
  compassInfo: {
    marginTop: 32,
    alignItems: 'center',
  },
  compassDistance: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 8,
  },
  compassDirection: {
    fontSize: 20,
    color: Colors.textSecondary,
  },
  controls: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#FFF',
  },
  switchButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  switchButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  infoPanel: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  infoText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
});