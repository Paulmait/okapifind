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
  ScrollView,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useCarLocation } from '../hooks/useCarLocation';
import { useParkingDetection } from '../hooks/useParkingDetection';
import { calculateDistance, formatDistance } from '../utils';
import { RootStackParamList } from '../types/navigation';
import { parkingDetection } from '../services/ParkingDetectionService';
import { Colors } from '../constants/colors';
import { performance, withPerformanceMonitoring } from '../services/performance';

type MapScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Map'>;

const MapScreen: React.FC = () => {
  const navigation = useNavigation<MapScreenNavigationProp>();
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState(false);
  const [showDetectionCard, setShowDetectionCard] = useState(false);

  // Performance monitoring
  useEffect(() => {
    performance.startTimer('MapScreen_mount');
    performance.logMemoryUsage('MapScreen');

    return () => {
      performance.endTimer('MapScreen_mount');
    };
  }, []);

  // Use the car location hook
  const {
    carLocation,
    saveCarLocation,
    getFormattedTime,
    isLoading: carLocationLoading,
  } = useCarLocation();

  // Use parking detection hook
  const {
    isTracking,
    settings,
    lastDetectedParking,
    frequentLocations,
    startDetection,
    stopDetection,
    updateSettings,
    confirmParking,
    dismissParking,
  } = useParkingDetection();

  useEffect(() => {
    (async () => {
      try {
        // Request location permissions
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          Alert.alert(
            'Permission Denied',
            'Location permission is required to use this feature.',
            [{ text: 'OK' }]
          );
          setLoading(false);
          return;
        }

        setLocationPermission(true);

        // Get current location with optimized settings
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, // Changed from High to Balanced for better battery life
        });

        setUserLocation(location);
        setLoading(false);

        // Set up location tracking with optimized intervals
        const locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced, // Optimized for battery
            timeInterval: 10000, // Increased from 5000ms to 10000ms
            distanceInterval: 20, // Increased from 10m to 20m
          },
          (newLocation) => {
            // Only update if significant change
            setUserLocation(prevLocation => {
              if (!prevLocation) return newLocation;
              const distance = calculateDistance(
                prevLocation.coords.latitude,
                prevLocation.coords.longitude,
                newLocation.coords.latitude,
                newLocation.coords.longitude
              );
              // Only update if moved more than 5 meters
              return distance > 5 ? newLocation : prevLocation;
            });
          }
        );

        // Initialize parking detection if enabled
        if (settings.enabled) {
          await parkingDetection.initialize();
        }

        // Cleanup subscription on unmount
        return () => {
          locationSubscription.remove();
        };
      } catch (error) {
        console.error('Error getting location:', error);
        Alert.alert('Error', 'Failed to get your location. Please try again.');
        setLoading(false);
      }
    })();
  }, []);

  // Handle detected parking notification
  useEffect(() => {
    if (lastDetectedParking && !showDetectionCard) {
      setShowDetectionCard(true);
    }
  }, [lastDetectedParking]);

  const handleSaveCarLocation = useCallback(async () => {
    if (!userLocation) {
      Alert.alert('Location Not Available', 'Please wait for your location to be determined.');
      return;
    }

    try {
      await performance.measureAsync('save_car_location', async () => {
        await saveCarLocation(
          userLocation.coords.latitude,
          userLocation.coords.longitude,
          {
            notes: 'Manually saved',
          }
        );

        // Also save to parking detection service
        await parkingDetection.manualSaveParking(
          {
            latitude: userLocation.coords.latitude,
            longitude: userLocation.coords.longitude,
          },
          'Manually saved from map'
        );
      });

      // Haptic feedback on save
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Location Saved',
        'Your car location has been saved successfully.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save car location. Please try again.');
    }
  }, [userLocation, saveCarLocation]);

  const handleGuideMe = useCallback(() => {
    if (!userLocation) {
      Alert.alert('Location Not Available', 'Please wait for your location to be determined.');
      return;
    }

    if (!carLocation) {
      Alert.alert('No Car Location', 'Please set your car location first.');
      return;
    }

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
  }, [navigation, userLocation, carLocation]);

  const toggleAutoDetection = useCallback(async () => {
    try {
      await performance.measureAsync('toggle_auto_detection', async () => {
        if (isTracking) {
          await stopDetection();
        } else {
          await startDetection();
        }
      });
    } catch (error) {
      console.error('Error toggling auto detection:', error);
    }
  }, [isTracking, startDetection, stopDetection]);

  const handleConfirmDetectedParking = useCallback(async () => {
    if (lastDetectedParking) {
      await confirmParking(lastDetectedParking);
      setShowDetectionCard(false);
    }
  }, [lastDetectedParking, confirmParking]);

  const handleDismissDetectedParking = useCallback(async () => {
    if (lastDetectedParking) {
      await dismissParking(lastDetectedParking.id);
      setShowDetectionCard(false);
    }
  }, [lastDetectedParking, dismissParking]);

  if (loading || carLocationLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  if (!locationPermission) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Location permission is required</Text>
        <Text style={styles.subText}>Please enable location services in settings</Text>
      </View>
    );
  }

  // Memoized calculations
  const initialRegion = useMemo(() => {
    if (userLocation) {
      return {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    if (carLocation) {
      return {
        latitude: carLocation.latitude,
        longitude: carLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    return {
      latitude: 37.78825,
      longitude: -122.4324,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }, [userLocation, carLocation]);

  const distance = useMemo(() => {
    if (!userLocation || !carLocation) return 0;

    return performance.measureSync('calculate_distance', () =>
      calculateDistance(
        userLocation.coords.latitude,
        userLocation.coords.longitude,
        carLocation.latitude,
        carLocation.longitude
      )
    );
  }, [userLocation, carLocation]);

  const formattedDistance = useMemo(() => {
    return formatDistance(distance, false);
  }, [distance]);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        followsUserLocation={true}
      >
        {/* Car Location Marker */}
        {carLocation && (
          <Marker
            coordinate={{
              latitude: carLocation.latitude,
              longitude: carLocation.longitude,
            }}
            title="Your Car"
            description={carLocation.notes || getFormattedTime()}
            pinColor="red"
          />
        )}

        {/* Detected Parking Marker */}
        {lastDetectedParking && showDetectionCard && (
          <>
            <Marker
              coordinate={{
              latitude: lastDetectedParking.location.latitude,
              longitude: lastDetectedParking.location.longitude,
            }}
            title="Detected Parking"
            description={`Confidence: ${Math.round(lastDetectedParking.confidence * 100)}%`}
            pinColor="orange"
          />
            <Circle
              center={{
                latitude: lastDetectedParking.location.latitude,
                longitude: lastDetectedParking.location.longitude,
              }}
              radius={50}
              fillColor="rgba(255, 165, 0, 0.2)"
              strokeColor="rgba(255, 165, 0, 0.5)"
              strokeWidth={2}
            />
          </>
        )}

        {/* Frequent Location Markers */}
        {frequentLocations.map((location) => (
          <Marker
            key={location.id}
            coordinate={{
              latitude: location.location.latitude,
              longitude: location.location.longitude,
            }}
            title={location.name || 'Frequent Parking'}
            description={`Visited ${location.visitCount} times`}
            pinColor="green"
            opacity={0.7}
          />
        ))}

        {/* User Location Marker (custom, in addition to showsUserLocation) */}
        {userLocation && (
          <Marker
            coordinate={{
              latitude: userLocation.coords.latitude,
              longitude: userLocation.coords.longitude,
            }}
            title="You are here"
            pinColor="blue"
          />
        )}
      </MapView>

      {/* Auto Detection Toggle */}
      <View style={styles.detectionToggle}>
        <Text style={styles.detectionLabel}>Auto-Detect Parking</Text>
        <Switch
          value={isTracking}
          onValueChange={toggleAutoDetection}
          trackColor={{ false: '#767577', true: '#007AFF' }}
          thumbColor={isTracking ? '#fff' : '#f4f3f4'}
        />
      </View>

      {/* Detected Parking Card */}
      {showDetectionCard && lastDetectedParking && (
        <View style={styles.detectionCard}>
          <Text style={styles.detectionTitle}>🚗 Parking Detected!</Text>
          <Text style={styles.detectionSubtitle}>
            Confidence: {Math.round(lastDetectedParking.confidence * 100)}%
          </Text>
          {lastDetectedParking.address && (
            <Text style={styles.detectionAddress}>{lastDetectedParking.address}</Text>
          )}
          <View style={styles.detectionButtons}>
            <TouchableOpacity
              style={[styles.detectionButton, styles.dismissButton]}
              onPress={handleDismissDetectedParking}
            >
              <Text style={styles.dismissButtonText}>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.detectionButton, styles.confirmButton]}
              onPress={handleConfirmDetectedParking}
            >
              <Text style={styles.confirmButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bottom Card with Actions */}
      <View style={styles.bottomCard}>
        {carLocation ? (
          <>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Your Car</Text>
              <Text style={styles.cardSubtitle}>Parked {getFormattedTime()}</Text>
              {userLocation && (
                <Text style={styles.distanceText}>
                  {formattedDistance}
                </Text>
              )}
            </View>
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={handleSaveCarLocation}
              >
                <Text style={styles.saveButtonText}>Update Location</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.guideButton]}
                onPress={handleGuideMe}
              >
                <Text style={styles.guideButtonText}>Guide Me</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>No Car Location Set</Text>
              <Text style={styles.cardSubtitle}>
                {isTracking ? 'Auto-detection is active' : 'Save your car\'s current location'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.fullWidthButton}
              onPress={handleSaveCarLocation}
            >
              <Text style={styles.guideButtonText}>Set Car Location</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  subText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  detectionToggle: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
    color: '#333',
  },
  detectionCard: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 90,
    left: 20,
    right: 20,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  detectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  detectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  detectionAddress: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  detectionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  detectionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dismissButton: {
    backgroundColor: '#f0f0f0',
  },
  dismissButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: Colors.primary,
  },
  confirmButtonText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '600',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  cardContent: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  distanceText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#f0f0f0',
  },
  saveButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  guideButton: {
    backgroundColor: Colors.primary,
  },
  guideButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  fullWidthButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
});

export default withPerformanceMonitoring(React.memo(MapScreen), 'MapScreen');