/**
 * Simple Find My Car Screen
 * PHILOSOPHY: One problem solved perfectly. No clutter.
 *
 * User sees:
 * - Simple map
 * - Big "FIND MY CAR" button
 * - Auto-save toggle
 *
 * Backend does (invisibly):
 * - Traffic checking
 * - Restriction monitoring
 * - Optimal routing
 * - Smart alerts (when needed)
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Switch,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useCarLocation } from '../hooks/useCarLocation';
import { useParkingDetection } from '../hooks/useParkingDetection';
import { calculateDistance, formatDistance } from '../utils';
import { RootStackParamList } from '../types/navigation';
import { Colors } from '../constants/colors';
import { performance } from '../services/performance';

// Backend intelligence (works silently)
import { directionsService } from '../services/directions.service';
import { trafficService } from '../services/traffic.service';
import { parkingRulesService } from '../services/parkingRules.service';

type MapScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Map'>;

const SimpleFindMyCarScreen: React.FC = () => {
  const navigation = useNavigation<MapScreenNavigationProp>();

  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [navigationActive, setNavigationActive] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);

  const {
    carLocation,
    saveCarLocation,
    getFormattedTime,
    isLoading: carLocationLoading,
  } = useCarLocation();

  const {
    isTracking,
    startDetection,
    stopDetection,
  } = useParkingDetection();

  // Setup location tracking
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const setupLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          Alert.alert(
            'Location Required',
            'OkapiFind needs location access to help you find your car.',
            [{ text: 'OK' }]
          );
          setLoading(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        setUserLocation(location);
        setLoading(false);

        // Track location changes
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 10000,
            distanceInterval: 20,
          },
          (newLocation) => {
            setUserLocation(newLocation);
          }
        );
      } catch (error) {
        console.error('Error getting location:', error);
        Alert.alert('Error', 'Unable to get your location. Please try again.');
        setLoading(false);
      }
    };

    setupLocation();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // Backend intelligence: Monitor parking restrictions
  useEffect(() => {
    if (!carLocation) return;

    const checkRestrictions = async () => {
      try {
        const restrictions = await parkingRulesService.getParkingRestrictions(
          carLocation.latitude,
          carLocation.longitude
        );

        const check = parkingRulesService.isParkingAllowed(restrictions);

        if (!check.allowed && check.severity === 'tow') {
          Alert.alert(
            '⚠️ Parking Violation Risk',
            check.reason || 'Your car may be at risk. Move it now!',
            [
              { text: 'Dismiss', style: 'cancel' },
              { text: 'Navigate', onPress: handleFindMyCar },
            ]
          );
        }
      } catch (error) {
        console.error('Error checking restrictions:', error);
      }
    };

    // Check immediately and every 30 minutes
    checkRestrictions();
    const interval = setInterval(checkRestrictions, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [carLocation]);

  // Backend intelligence: Check traffic before navigation
  const checkTrafficBeforeNav = async (route: any) => {
    try {
      const summary = await trafficService.getRouteTrafficSummary(route.overviewPolyline);

      if (summary.totalDelayMinutes > 5) {
        Alert.alert(
          '🚦 Traffic Alert',
          `Heavy traffic detected. Expect ${summary.totalDelayMinutes} min delay.`,
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Find Alternate', onPress: () => {/* TODO: Show alternate route */} },
          ]
        );
      }
    } catch (error) {
      console.error('Error checking traffic:', error);
    }
  };

  const handleSaveCarLocation = useCallback(async () => {
    if (!userLocation) {
      Alert.alert('Please wait', 'Getting your location...');
      return;
    }

    try {
      await saveCarLocation(
        userLocation.coords.latitude,
        userLocation.coords.longitude,
        { notes: 'Saved from app' }
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        '✅ Car Location Saved',
        'We\'ll help you find it later!',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save location. Please try again.');
    }
  }, [userLocation, saveCarLocation]);

  const handleFindMyCar = useCallback(async () => {
    if (!userLocation || !carLocation) {
      Alert.alert('Not ready', 'Please wait while we locate you.');
      return;
    }

    try {
      setLoading(true);

      // Get walking directions
      const routes = await directionsService.getDirections({
        origin: {
          latitude: userLocation.coords.latitude,
          longitude: userLocation.coords.longitude,
        },
        destination: {
          latitude: carLocation.latitude,
          longitude: carLocation.longitude,
        },
        mode: 'walking',
      });

      if (routes.length === 0) {
        throw new Error('Unable to get directions');
      }

      const route = routes[0];

      // Decode polyline for display
      const coordinates = directionsService.decodePolyline(route.overviewPolyline);
      setRouteCoordinates(coordinates);

      // Check traffic (backend intelligence)
      await checkTrafficBeforeNav(route);

      // Start turn-by-turn navigation
      await directionsService.startNavigation(route, (state) => {
        // Navigation updates handled in GuidanceScreen
      });

      setNavigationActive(true);

      // Navigate to AR guidance screen
      navigation.navigate('Guidance', {
        userLocation: {
          latitude: userLocation.coords.latitude,
          longitude: userLocation.coords.longitude,
        },
        carLocation: {
          latitude: carLocation.latitude,
          longitude: carLocation.longitude,
        },
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error starting navigation:', error);
      Alert.alert('Error', 'Unable to start navigation. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userLocation, carLocation, navigation]);

  const toggleAutoDetect = useCallback(async () => {
    try {
      if (isTracking) {
        await stopDetection();
      } else {
        await startDetection();
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error toggling auto-detect:', error);
    }
  }, [isTracking, startDetection, stopDetection]);

  // Calculate map region
  const mapRegion = useMemo(() => {
    if (userLocation && carLocation) {
      const midLat = (userLocation.coords.latitude + carLocation.latitude) / 2;
      const midLng = (userLocation.coords.longitude + carLocation.longitude) / 2;

      const latDelta = Math.abs(userLocation.coords.latitude - carLocation.latitude) * 2.5;
      const lngDelta = Math.abs(userLocation.coords.longitude - carLocation.longitude) * 2.5;

      return {
        latitude: midLat,
        longitude: midLng,
        latitudeDelta: Math.max(latDelta, 0.01),
        longitudeDelta: Math.max(lngDelta, 0.01),
      };
    }

    if (userLocation) {
      return {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    return {
      latitude: 38.9072,
      longitude: -77.0369,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [userLocation, carLocation]);

  const distance = useMemo(() => {
    if (!userLocation || !carLocation) return 0;
    return calculateDistance(
      userLocation.coords.latitude,
      userLocation.coords.longitude,
      carLocation.latitude,
      carLocation.longitude
    );
  }, [userLocation, carLocation]);

  if (loading || carLocationLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Simple, clean map */}
      <MapView
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        region={mapRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        zoomControlEnabled={false}
        toolbarEnabled={false}
        loadingEnabled={true}
      >
        {/* Route polyline (only when navigating) */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={Colors.primary}
            strokeWidth={4}
          />
        )}

        {/* Car marker */}
        {carLocation && (
          <Marker
            coordinate={{
              latitude: carLocation.latitude,
              longitude: carLocation.longitude,
            }}
            title="Your Car"
            description={getFormattedTime()}
          >
            <View style={styles.carMarker}>
              <Text style={styles.carMarkerText}>🚗</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Main action button */}
      <View style={styles.actionContainer}>
        {carLocation ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleFindMyCar}
            activeOpacity={0.8}
          >
            <View style={styles.buttonContent}>
              <Text style={styles.buttonIcon}>🚗</Text>
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonTitle}>FIND MY CAR</Text>
                <Text style={styles.buttonSubtitle}>
                  {formatDistance(distance, false)} away
                </Text>
              </View>
              <Text style={styles.buttonArrow}>▶</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSaveCarLocation}
            activeOpacity={0.8}
          >
            <View style={styles.buttonContent}>
              <Text style={styles.buttonIcon}>📍</Text>
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonTitle}>SET CAR LOCATION</Text>
                <Text style={styles.buttonSubtitle}>Tap when you park</Text>
              </View>
              <Text style={styles.buttonArrow}>▶</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Auto-detect toggle */}
        <View style={styles.autoDetectCard}>
          <View style={styles.autoDetectContent}>
            <View>
              <Text style={styles.autoDetectTitle}>Auto-save my location</Text>
              <Text style={styles.autoDetectSubtitle}>
                {isTracking ? 'Automatically saves when you park' : 'Save manually each time'}
              </Text>
            </View>
            <Switch
              value={isTracking}
              onValueChange={toggleAutoDetect}
              trackColor={{ false: '#D1D5DB', true: Colors.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#D1D5DB"
            />
          </View>
        </View>

        {/* Update location button (if car saved) */}
        {carLocation && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleSaveCarLocation}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Update Car Location</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  map: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  carMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  carMarkerText: {
    fontSize: 28,
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  buttonSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  buttonArrow: {
    fontSize: 24,
    color: '#FFFFFF',
    marginLeft: 12,
  },
  autoDetectCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  autoDetectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autoDetectTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  autoDetectSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
});

export default React.memo(SimpleFindMyCarScreen);