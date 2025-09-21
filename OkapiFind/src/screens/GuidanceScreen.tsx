import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Animated,
  Dimensions,
  Switch,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Magnetometer } from 'expo-sensors';
import { Subscription } from 'expo-sensors/build/Pedometer';
import {
  calculateBearing,
  calculateDistance,
  formatDistance,
  getDirectionText,
  calculateRelativeBearing
} from '../utils';
import { RootStackParamList } from '../types/navigation';
import { Colors } from '../constants/colors';
import SafetyMode from '../components/SafetyMode';
import { useAuth } from '../hooks/useAuth';

type GuidanceScreenRouteProp = RouteProp<RootStackParamList, 'Guidance'>;
type GuidanceScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Guidance'>;

const { width } = Dimensions.get('window');
const COMPASS_SIZE = width * 0.6;
const NEAR_THRESHOLD_METERS = 6.096; // 20 feet in meters

const GuidanceScreen: React.FC = () => {
  const route = useRoute<GuidanceScreenRouteProp>();
  const navigation = useNavigation<GuidanceScreenNavigationProp>();
  const { carLocation } = route.params;
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const { isAuthenticated } = useAuth();

  const [currentLocation, setCurrentLocation] = useState(route.params.userLocation);
  const [heading, setHeading] = useState(0);
  const [distance, setDistance] = useState(0);
  const [bearing, setBearing] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [hasTriggeredNearbyHaptic, setHasTriggeredNearbyHaptic] = useState(false);
  const [useMetric, setUseMetric] = useState(true);
  const [showSafetyMode, setShowSafetyMode] = useState(false);

  const arrowRotation = useRef(new Animated.Value(0)).current;
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const magnetometerSubscription = useRef<Subscription | null>(null);
  const lastAnnouncementTime = useRef(0);
  const lastAnnouncedDistance = useRef(0);

  useEffect(() => {
    startLocationTracking();
    startCompassTracking();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      if (magnetometerSubscription.current) {
        magnetometerSubscription.current.remove();
      }
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    const calculatedDistance = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      carLocation.latitude,
      carLocation.longitude
    );
    setDistance(calculatedDistance);

    const calculatedBearing = calculateBearing(
      currentLocation.latitude,
      currentLocation.longitude,
      carLocation.latitude,
      carLocation.longitude
    );
    setBearing(calculatedBearing);

    // Update arrow rotation
    const relativeBearing = (calculatedBearing - heading + 360) % 360;
    Animated.spring(arrowRotation, {
      toValue: relativeBearing,
      useNativeDriver: true,
      tension: 50,
      friction: 10,
    }).start();

    // Haptic feedback when near car
    if (calculatedDistance <= NEAR_THRESHOLD_METERS && !hasTriggeredNearbyHaptic) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setHasTriggeredNearbyHaptic(true);
      if (voiceEnabled) {
        Speech.speak('You are very close to your car!', {
          language: 'en-US',
          pitch: 1.0,
          rate: 1.0,
        });
      }
    } else if (calculatedDistance > NEAR_THRESHOLD_METERS) {
      setHasTriggeredNearbyHaptic(false);
    }

    // Voice announcements
    if (voiceEnabled) {
      announceDirections(calculatedDistance, calculatedBearing);
    }
  }, [currentLocation, heading, voiceEnabled]);

  const startLocationTracking = async () => {
    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (location) => {
          setCurrentLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      );
      locationSubscription.current = subscription;
    } catch (error) {
      console.error('Error starting location tracking:', error);
    }
  };

  const startCompassTracking = () => {
    Magnetometer.setUpdateInterval(100);
    magnetometerSubscription.current = Magnetometer.addListener((data) => {
      let angle = Math.atan2(data.y, data.x);
      angle = angle * (180 / Math.PI);
      angle = angle + 90;
      angle = (angle + 360) % 360;
      setHeading(Math.round(angle));
    });
  };


  const announceDirections = (dist: number, bear: number) => {
    const now = Date.now();
    const timeSinceLastAnnouncement = now - lastAnnouncementTime.current;

    // Only announce every 10 seconds or if distance changed significantly
    if (timeSinceLastAnnouncement < 10000 &&
        Math.abs(dist - lastAnnouncedDistance.current) < 5) {
      return;
    }

    lastAnnouncementTime.current = now;
    lastAnnouncedDistance.current = dist;

    const relativeBearing = calculateRelativeBearing(heading, bear);
    const direction = getDirectionText(relativeBearing);

    let distanceText = '';
    if (useMetric) {
      if (dist < 10) {
        distanceText = `${Math.round(dist)} meters`;
      } else {
        distanceText = `${Math.round(dist)} meters`;
      }
    } else {
      const feet = dist * 3.28084;
      distanceText = `${Math.round(feet)} feet`;
    }

    const message = `Your car is ${distanceText} ${direction}`;
    Speech.speak(message, {
      language: 'en-US',
      pitch: 1.0,
      rate: 0.9,
    });
  };

  const toggleVoiceGuidance = () => {
    const newValue = !voiceEnabled;
    setVoiceEnabled(newValue);

    if (newValue) {
      Speech.speak('Voice guidance enabled', {
        language: 'en-US',
        pitch: 1.0,
        rate: 1.0,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Speech.stop();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };


  const handleBackToMap = () => {
    Speech.stop();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? Colors.background : '#f5f5f5' }]}>
      <View style={[styles.header, { backgroundColor: isDarkMode ? Colors.surface : 'white' }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackToMap}>
          <Text style={styles.backButtonText}>← Back to Map</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Distance Display */}
        <View style={[styles.distanceContainer, { backgroundColor: isDarkMode ? Colors.surface : 'white' }]}>
          <Text style={[styles.distanceLabel, { color: isDarkMode ? Colors.textSecondary : '#666' }]}>Distance to Car</Text>
          <Text style={[styles.distanceValue, { color: Colors.primary }]}>{formatDistance(distance, !useMetric)}</Text>
          <TouchableOpacity onPress={() => setUseMetric(!useMetric)}>
            <Text style={[styles.unitToggle, { color: Colors.primary }]}>
              Switch to {useMetric ? 'Imperial' : 'Metric'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Safety Mode Component */}
        {isAuthenticated && (
          <SafetyMode
            destination={{
              latitude: carLocation.latitude,
              longitude: carLocation.longitude,
              address: carLocation.address,
            }}
            onComplete={() => setShowSafetyMode(false)}
            isDarkMode={isDarkMode}
          />
        )}

        {/* Compass with Arrow */}
        <View style={styles.compassContainer}>
          <View style={[styles.compass, { backgroundColor: isDarkMode ? Colors.surface : 'white', borderColor: Colors.primary }]}>
            <Animated.View
              style={[
                styles.arrow,
                {
                  transform: [
                    {
                      rotate: arrowRotation.interpolate({
                        inputRange: [0, 360],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.arrowShape}>
                <View style={styles.arrowTop} />
                <View style={styles.arrowBottom} />
              </View>
            </Animated.View>

            {/* Compass Cardinal Points */}
            <Text style={[styles.cardinal, styles.north]}>N</Text>
            <Text style={[styles.cardinal, styles.east]}>E</Text>
            <Text style={[styles.cardinal, styles.south]}>S</Text>
            <Text style={[styles.cardinal, styles.west]}>W</Text>
          </View>

          {distance <= NEAR_THRESHOLD_METERS && (
            <View style={styles.nearbyAlert}>
              <Text style={styles.nearbyText}>You're very close!</Text>
            </View>
          )}
        </View>

        {/* Voice Guidance Toggle */}
        <View style={styles.voiceContainer}>
          <View style={styles.voiceToggle}>
            <Text style={styles.voiceLabel}>Voice Guidance</Text>
            <Switch
              value={voiceEnabled}
              onValueChange={toggleVoiceGuidance}
              trackColor={{ false: '#767577', true: '#007AFF' }}
              thumbColor={voiceEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>
          {!voiceEnabled && (
            <TouchableOpacity style={[styles.startVoiceButton, { backgroundColor: Colors.primary }]} onPress={toggleVoiceGuidance}>
              <Text style={[styles.startVoiceButtonText, { color: Colors.background }]}>Start Voice Guide</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <View style={[styles.bottomContainer, { backgroundColor: isDarkMode ? Colors.surface : 'white' }]}>
        <TouchableOpacity style={[styles.stopButton, { backgroundColor: '#DC3545' }]} onPress={handleBackToMap}>
          <Text style={styles.stopButtonText}>Stop Guidance</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 10 : 0,
    paddingBottom: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    paddingVertical: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  distanceContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  distanceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  distanceValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  unitToggle: {
    fontSize: 14,
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  compassContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  compass: {
    width: COMPASS_SIZE,
    height: COMPASS_SIZE,
    borderRadius: COMPASS_SIZE / 2,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  arrow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowShape: {
    width: 0,
    height: COMPASS_SIZE * 0.4,
    alignItems: 'center',
  },
  arrowTop: {
    width: 0,
    height: 0,
    borderLeftWidth: 20,
    borderRightWidth: 20,
    borderBottomWidth: COMPASS_SIZE * 0.3,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FF3B30',
  },
  arrowBottom: {
    width: 6,
    height: COMPASS_SIZE * 0.1,
    backgroundColor: '#FF3B30',
  },
  cardinal: {
    position: 'absolute',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  north: {
    top: 10,
  },
  east: {
    right: 10,
  },
  south: {
    bottom: 10,
  },
  west: {
    left: 10,
  },
  nearbyAlert: {
    marginTop: 20,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  nearbyText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  voiceContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  voiceToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  voiceLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  startVoiceButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  startVoiceButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomContainer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  stopButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default GuidanceScreen;