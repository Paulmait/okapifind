// @ts-nocheck
import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { AppleMaps } from 'expo-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { Colors } from '../constants/colors';
// Temporarily disabled for debugging
// import { TakeToHotelButton, HotelPill } from '../components/BaseCampComponents';
// import { SavePlaceSheet } from '../components/SavePlaceSheet';
// import { useSavedPlaces } from '../hooks/useSavedPlaces';
// import { useSmartSuggestions } from '../hooks/useSmartSuggestions';

type MapScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Map'>;

// Floor/Level options for parking garages
const FLOOR_OPTIONS = [
  { label: 'Street Level', value: 'street' },
  { label: 'Rooftop', value: 'rooftop' },
  { label: 'Level 1', value: 'L1' },
  { label: 'Level 2', value: 'L2' },
  { label: 'Level 3', value: 'L3' },
  { label: 'Level 4', value: 'L4' },
  { label: 'Level 5', value: 'L5' },
  { label: 'P1 (Underground 1)', value: 'P1' },
  { label: 'P2 (Underground 2)', value: 'P2' },
  { label: 'P3 (Underground 3)', value: 'P3' },
  { label: 'P4 (Underground 4)', value: 'P4' },
];

interface CarLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
  floor?: string;
  notes?: string;
}

const MapScreen: React.FC = () => {
  const navigation = useNavigation<MapScreenNavigationProp>();
  const isFocused = useIsFocused();
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState(false);
  const [carLocation, setCarLocation] = useState<CarLocation | null>(null);

  // Save location modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState<string>('street');
  const [customNotes, setCustomNotes] = useState<string>('');

  // Saved Places hook - temporarily disabled for debugging
  // const { currentHotel, hasHotel } = useSavedPlaces();
  const currentHotel = null;
  const hasHotel = false;

  // Smart Suggestions - temporarily disabled for debugging
  // const {
  //   currentSuggestion,
  //   dismissSuggestion,
  //   dismissWithDontAskAgain,
  //   clearSuggestion,
  // } = useSmartSuggestions();
  const currentSuggestion = null;
  const dismissSuggestion = () => {};
  const dismissWithDontAskAgain = () => {};
  const clearSuggestion = () => {};

  useEffect(() => {
    let isMounted = true;

    const setupLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (!isMounted) return;

        if (status !== 'granted') {
          setLoading(false);
          return;
        }

        setLocationPermission(true);

        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          if (isMounted) {
            setUserLocation(location);
          }
        } catch (locError: any) {
          console.warn('Error getting current position:', locError);
        }
      } catch (err: any) {
        console.error('Error in location setup:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    setupLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  // Open save modal
  const handleSaveCarLocation = useCallback(() => {
    if (!userLocation) {
      Alert.alert('Location Not Available', 'Please wait for your location to be determined.');
      return;
    }
    setShowSaveModal(true);
  }, [userLocation]);

  // Confirm save with floor and notes
  const confirmSaveLocation = useCallback(async () => {
    if (!userLocation) return;

    try {
      const floorLabel = FLOOR_OPTIONS.find(f => f.value === selectedFloor)?.label || selectedFloor;
      const newCarLocation: CarLocation = {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        timestamp: Date.now(),
        floor: selectedFloor,
        notes: customNotes || `Parked at ${floorLabel}`,
      };

      setCarLocation(newCarLocation);
      setShowSaveModal(false);
      setCustomNotes('');

      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
          // Ignore haptic errors
        }
      }

      Alert.alert('Location Saved', `Your car location has been saved at ${floorLabel}.`);
    } catch (err) {
      console.error('Error saving location:', err);
      Alert.alert('Error', 'Failed to save car location.');
    }
  }, [userLocation, selectedFloor, customNotes]);

  const handleGuideMe = useCallback(() => {
    if (!userLocation || !carLocation) {
      Alert.alert('Missing Location', 'Please save your car location first.');
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

  const formatTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
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

  // Build markers array for expo-maps
  const markers: AppleMaps.Marker[] = [];

  if (carLocation) {
    const floorLabel = carLocation.floor
      ? FLOOR_OPTIONS.find(f => f.value === carLocation.floor)?.label || carLocation.floor
      : '';
    markers.push({
      id: 'car',
      coordinates: {
        latitude: carLocation.latitude,
        longitude: carLocation.longitude,
      },
      title: 'Your Car',
      snippet: floorLabel ? `${floorLabel} - ${formatTime(carLocation.timestamp)}` : `Saved ${formatTime(carLocation.timestamp)}`,
      color: 'red',
    });
  }

  // Initial camera position
  const cameraPosition = userLocation ? {
    coordinates: {
      latitude: userLocation.coords.latitude,
      longitude: userLocation.coords.longitude,
    },
    zoom: 15,
  } : {
    coordinates: {
      latitude: 37.78825,
      longitude: -122.4324,
    },
    zoom: 15,
  };

  return (
    <View style={styles.container}>
      {Platform.OS === 'ios' ? (
        <AppleMaps.View
          style={styles.map}
          cameraPosition={cameraPosition}
          markers={markers}
          properties={{
            isMyLocationEnabled: true,
            showsCompass: true,
          }}
        />
      ) : (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.placeholderText}>Map view</Text>
          <Text style={styles.placeholderSubtext}>
            {userLocation ?
              `${userLocation.coords.latitude.toFixed(4)}, ${userLocation.coords.longitude.toFixed(4)}` :
              'Getting location...'}
          </Text>
        </View>
      )}

      {/* Bottom Card */}
      <View style={styles.bottomCard}>
        {carLocation ? (
          <>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Your Car</Text>
              <Text style={styles.cardSubtitle}>
                {carLocation.floor && FLOOR_OPTIONS.find(f => f.value === carLocation.floor)?.label}
                {carLocation.floor ? ' - ' : ''}Parked {formatTime(carLocation.timestamp)}
              </Text>
              {carLocation.notes && carLocation.notes !== `Parked at ${FLOOR_OPTIONS.find(f => f.value === carLocation.floor)?.label}` && (
                <Text style={styles.cardNotes}>{carLocation.notes}</Text>
              )}
            </View>
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={handleSaveCarLocation}
              >
                <Text style={styles.saveButtonText}>Update</Text>
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
              <Text style={styles.cardSubtitle}>Save your car's current location</Text>
            </View>
            <TouchableOpacity
              style={styles.fullWidthButton}
              onPress={handleSaveCarLocation}
            >
              <Text style={styles.guideButtonText}>Save Car Location</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Hotel Quick Access Button */}
      {hasHotel && (
        <View style={styles.hotelQuickAccess}>
          <TouchableOpacity
            style={styles.savedPlacesButton}
            onPress={() => navigation.navigate('SavedPlaces')}
            accessibilityLabel="View saved places"
          >
            <Ionicons name="bookmark" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <TakeToHotelButton
            currentLat={userLocation?.coords.latitude}
            currentLng={userLocation?.coords.longitude}
            compact
          />
        </View>
      )}

      {/* Hotel Pill on Map */}
      {hasHotel && currentHotel && userLocation && (
        <View style={styles.hotelPillContainer}>
          <HotelPill
            hotel={currentHotel}
            currentLat={userLocation.coords.latitude}
            currentLng={userLocation.coords.longitude}
            onPress={() => navigation.navigate('SavedPlaces')}
          />
        </View>
      )}

      {/* Smart Suggestions - Save Place Sheet */}
      {currentSuggestion?.shouldSuggest && currentSuggestion.location && (
        <SavePlaceSheet
          visible={true}
          lat={currentSuggestion.location.lat}
          lng={currentSuggestion.location.lng}
          suggestedName={currentSuggestion.nearbyPlaceName}
          suggestedAddress={currentSuggestion.nearbyPlaceAddress}
          onSaved={() => {
            clearSuggestion();
            Alert.alert('Saved!', 'Place has been saved to your favorites.');
          }}
          onDismiss={dismissSuggestion}
          onDontAskAgain={dismissWithDontAskAgain}
        />
      )}

      {/* Save Location Modal with Floor Selector */}
      <Modal
        visible={showSaveModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Save Car Location</Text>
            <Text style={styles.modalSubtitle}>Select the floor/level where you parked</Text>

            <ScrollView style={styles.floorList} showsVerticalScrollIndicator={false}>
              {FLOOR_OPTIONS.map((floor) => (
                <TouchableOpacity
                  key={floor.value}
                  style={[
                    styles.floorOption,
                    selectedFloor === floor.value && styles.floorOptionSelected,
                  ]}
                  onPress={() => setSelectedFloor(floor.value)}
                >
                  <Text
                    style={[
                      styles.floorOptionText,
                      selectedFloor === floor.value && styles.floorOptionTextSelected,
                    ]}
                  >
                    {floor.label}
                  </Text>
                  {selectedFloor === floor.value && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={styles.notesInput}
              placeholder="Add notes (optional) - e.g., 'Near elevator', 'Section B'"
              placeholderTextColor="#999"
              value={customNotes}
              onChangeText={setCustomNotes}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowSaveModal(false);
                  setCustomNotes('');
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={confirmSaveLocation}
              >
                <Text style={styles.modalSaveButtonText}>Save Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a2a3a',
  },
  placeholderText: {
    fontSize: 24,
    color: Colors.primary,
    fontWeight: '600',
  },
  placeholderSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
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
    shadowOffset: { width: 0, height: -2 },
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
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
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
  cardNotes: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  floorList: {
    maxHeight: 250,
    marginBottom: 16,
  },
  floorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  floorOptionSelected: {
    backgroundColor: Colors.primary,
  },
  floorOptionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  floorOptionTextSelected: {
    color: Colors.background,
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: Colors.background,
    fontWeight: 'bold',
  },
  notesInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#333',
    marginBottom: 20,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.background,
  },
  // Hotel Quick Access styles
  hotelQuickAccess: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    right: 16,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  savedPlacesButton: {
    backgroundColor: Colors.cardBackground,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  hotelPillContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 80,
    alignSelf: 'center',
  },
});

export default React.memo(MapScreen);
