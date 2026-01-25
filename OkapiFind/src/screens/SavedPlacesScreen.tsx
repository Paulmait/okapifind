/**
 * Saved Places Screen
 * Displays list of saved places (hotel, favorites, custom)
 * with ability to navigate, edit, and delete
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { useSavedPlaces } from '../hooks/useSavedPlaces';
import { SavedPlace, SavedPlaceType } from '../types/savedPlaces.types';
import { SetHotelButton, TakeToHotelButton } from '../components/BaseCampComponents';
import { useTranslation } from 'react-i18next';

// Icon mapping for place types
const PLACE_ICONS: Record<SavedPlaceType, keyof typeof Ionicons.glyphMap> = {
  HOTEL: 'bed',
  FAVORITE: 'star',
  CUSTOM: 'location',
  CAR: 'car',
};

const PLACE_COLORS: Record<SavedPlaceType, string> = {
  HOTEL: '#9C27B0',
  FAVORITE: '#FFD700',
  CUSTOM: '#607D8B',
  CAR: '#2196F3',
};

export function SavedPlacesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const {
    activePlaces,
    currentHotel,
    hasHotel,
    isLoading,
    refresh,
    removePlace,
  } = useSavedPlaces();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleNavigate = useCallback((place: SavedPlace) => {
    (navigation as any).navigate('Guidance', {
      destination: {
        latitude: place.lat,
        longitude: place.lng,
        label: place.label,
        type: place.type.toLowerCase(),
      },
    });
  }, [navigation]);

  const handleSetHotel = useCallback(() => {
    (navigation as any).navigate('SetHotel');
  }, [navigation]);

  const handleDelete = useCallback((place: SavedPlace) => {
    const isHotel = place.type === 'HOTEL';
    const title = isHotel ? 'Remove Hotel?' : `Delete ${place.label}?`;
    const message = isHotel
      ? 'You can set a new hotel anytime.'
      : 'This place will be removed from your saved places.';

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => removePlace(place.id),
      },
    ]);
  }, [removePlace]);

  const renderPlaceItem = useCallback(({ item }: { item: SavedPlace }) => {
    const isHotel = item.type === 'HOTEL';
    const icon = PLACE_ICONS[item.type];
    const color = PLACE_COLORS[item.type];

    return (
      <View style={[styles.placeItem, isHotel && styles.hotelItem]}>
        <View style={[styles.placeIconContainer, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>

        <View style={styles.placeInfo}>
          <Text style={styles.placeLabel} numberOfLines={1}>
            {item.label}
          </Text>
          {item.address && (
            <Text style={styles.placeAddress} numberOfLines={1}>
              {item.address}
            </Text>
          )}
          <View style={styles.placeMeta}>
            <Text style={[styles.placeType, { color }]}>
              {item.type}
            </Text>
            {item.checkOutDate && (
              <Text style={styles.placeCheckout}>
                Checkout: {new Date(item.checkOutDate).toLocaleDateString()}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.placeActions}>
          <TouchableOpacity
            style={styles.placeActionButton}
            onPress={() => handleNavigate(item)}
            accessibilityLabel={`Navigate to ${item.label}`}
          >
            <Ionicons name="navigate" size={20} color={Colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.placeActionButton}
            onPress={() => handleDelete(item)}
            accessibilityLabel={`Delete ${item.label}`}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [handleNavigate, handleDelete]);

  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      {/* Hotel Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t('poi.hotel', 'Hotel (Base Camp)')}
        </Text>

        {hasHotel && currentHotel ? (
          <View style={styles.hotelSection}>
            <TakeToHotelButton onNavigate={() => handleNavigate(currentHotel)} />
            <TouchableOpacity
              style={styles.changeHotelButton}
              onPress={handleSetHotel}
            >
              <Ionicons name="swap-horizontal" size={16} color={Colors.primary} />
              <Text style={styles.changeHotelText}>Change Hotel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <SetHotelButton onPress={handleSetHotel} />
        )}
      </View>

      {/* Other Places Section Header */}
      {activePlaces.filter(p => p.type !== 'HOTEL').length > 0 && (
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            {t('poi.title', 'Saved Places')}
          </Text>
        </View>
      )}
    </View>
  ), [hasHotel, currentHotel, activePlaces, handleSetHotel, handleNavigate, t]);

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <Ionicons name="bookmark-outline" size={64} color={Colors.gray} />
      <Text style={styles.emptyTitle}>No Saved Places</Text>
      <Text style={styles.emptySubtitle}>
        Save your hotel and favorite locations for quick navigation
      </Text>
    </View>
  ), []);

  // Filter out hotel from the list (it's shown in header)
  const nonHotelPlaces = activePlaces.filter(p => p.type !== 'HOTEL');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.screenHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Saved Places</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={nonHotelPlaces}
          renderItem={renderPlaceItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={!hasHotel ? renderEmptyState : null}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screenHeader: {
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
  screenTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  hotelSection: {
    gap: 12,
  },
  changeHotelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  changeHotelText: {
    fontSize: 14,
    color: Colors.primary,
    marginLeft: 6,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
  },
  hotelItem: {
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  placeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  placeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  placeAddress: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  placeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  placeType: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  placeCheckout: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginLeft: 8,
  },
  placeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  placeActionButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default SavedPlacesScreen;
