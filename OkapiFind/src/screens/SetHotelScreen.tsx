/**
 * Set Hotel Screen
 * Allows users to set their hotel location via:
 * - Search (using Places API)
 * - Current location (pin drop)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Colors } from '../constants/colors';
import { useSavedPlaces } from '../hooks/useSavedPlaces';
import { placesService } from '../services/places.service';
import { useTranslation } from 'react-i18next';

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
}

export function SetHotelScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { setHotel, currentHotel } = useSavedPlaces();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await placesService.searchPlaces(searchQuery);
        setSearchResults(
          results.map((r: any) => ({
            placeId: r.place_id || r.placeId,
            name: r.name || r.structured_formatting?.main_text || '',
            address: r.formatted_address || r.structured_formatting?.secondary_text || '',
            lat: r.geometry?.location?.lat,
            lng: r.geometry?.location?.lng,
          }))
        );
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSelectPlace = useCallback(async (place: PlaceResult) => {
    setIsSaving(true);
    try {
      let lat = place.lat;
      let lng = place.lng;

      // If we don't have coordinates, get place details
      if (!lat || !lng) {
        const details = await placesService.getPlaceDetails(place.placeId) as any;
        lat = details?.geometry?.location?.lat || details?.lat;
        lng = details?.geometry?.location?.lng || details?.lng;
      }

      if (!lat || !lng) {
        Alert.alert('Error', 'Could not get location for this place');
        return;
      }

      const hotel = await setHotel({
        label: place.name,
        lat,
        lng,
        address: place.address,
        provider: 'google',
        providerPlaceId: place.placeId,
      });

      if (hotel) {
        navigation.goBack();
      } else {
        Alert.alert('Error', 'Failed to save hotel');
      }
    } catch (error) {
      console.error('Error saving hotel:', error);
      Alert.alert('Error', 'Failed to save hotel');
    } finally {
      setIsSaving(false);
    }
  }, [setHotel, navigation]);

  const handleUseCurrentLocation = useCallback(async () => {
    setIsGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is needed to use your current location.'
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;

      // Try to get address for the location
      let address = '';
      try {
        const [result] = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        if (result) {
          address = [
            result.street,
            result.city,
            result.region,
            result.postalCode,
          ]
            .filter(Boolean)
            .join(', ');
        }
      } catch (e) {
        // Ignore geocoding errors
      }

      // Show confirmation dialog
      Alert.alert(
        'Set as Hotel?',
        address || `Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Set Hotel',
            onPress: async () => {
              setIsSaving(true);
              const hotel = await setHotel({
                label: 'My Hotel',
                lat: latitude,
                lng: longitude,
                address: address || undefined,
                provider: 'manual',
              });

              if (hotel) {
                navigation.goBack();
              } else {
                Alert.alert('Error', 'Failed to save hotel');
              }
              setIsSaving(false);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get current location');
    } finally {
      setIsGettingLocation(false);
    }
  }, [setHotel, navigation]);

  const renderSearchResult = useCallback(({ item }: { item: PlaceResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleSelectPlace(item)}
      disabled={isSaving}
    >
      <Ionicons name="location" size={20} color={Colors.primary} />
      <View style={styles.resultTextContainer}>
        <Text style={styles.resultName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.resultAddress} numberOfLines={1}>
          {item.address}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.gray} />
    </TouchableOpacity>
  ), [handleSelectPlace, isSaving]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
          >
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t('poi.setHotel', 'Set Hotel Location')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Current Hotel Info */}
        {currentHotel && (
          <View style={styles.currentHotelBanner}>
            <Ionicons name="information-circle" size={20} color={Colors.info} />
            <Text style={styles.currentHotelText}>
              Current hotel: {currentHotel.label}
            </Text>
          </View>
        )}

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color={Colors.gray} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for hotel..."
              placeholderTextColor={Colors.gray}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={Colors.gray} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Use Current Location Button */}
        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={handleUseCurrentLocation}
          disabled={isGettingLocation || isSaving}
        >
          {isGettingLocation ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons name="locate" size={24} color={Colors.primary} />
          )}
          <Text style={styles.currentLocationText}>
            Use Current Location
          </Text>
          <Text style={styles.currentLocationSubtext}>
            Set your current position as the hotel
          </Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or search</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Search Results */}
        {isSearching ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.placeId}
            contentContainerStyle={styles.resultsList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              searchQuery.length >= 2 ? (
                <View style={styles.emptyResults}>
                  <Text style={styles.emptyResultsText}>
                    No results found for "{searchQuery}"
                  </Text>
                </View>
              ) : null
            }
          />
        )}

        {/* Saving Overlay */}
        {isSaving && (
          <View style={styles.savingOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.savingText}>Setting hotel...</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.backgroundLight,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  currentHotelBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.info}20`,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  currentHotelText: {
    fontSize: 14,
    color: Colors.info,
    flex: 1,
  },
  searchContainer: {
    padding: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  currentLocationButton: {
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  currentLocationText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 8,
  },
  currentLocationSubtext: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.separator,
  },
  dividerText: {
    fontSize: 13,
    color: Colors.gray,
    paddingHorizontal: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsList: {
    paddingHorizontal: 16,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  resultAddress: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyResults: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyResultsText: {
    fontSize: 14,
    color: Colors.gray,
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  savingText: {
    fontSize: 16,
    color: Colors.white,
    marginTop: 12,
  },
});

export default SetHotelScreen;
