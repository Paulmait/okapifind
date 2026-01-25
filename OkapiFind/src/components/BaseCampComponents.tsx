/**
 * Base Camp UI Components
 * Components for hotel navigation, "Take me to Hotel" CTA,
 * and return-to-hotel suggestions
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { SavedPlace } from '../types/savedPlaces.types';
import { baseCampService } from '../services/baseCampService';
import { useSavedPlaces } from '../hooks/useSavedPlaces';

interface TakeToHotelButtonProps {
  currentLat?: number;
  currentLng?: number;
  onNavigate?: (hotel: SavedPlace) => void;
  style?: object;
  compact?: boolean;
}

/**
 * "Take me to Hotel" Button
 * Main CTA for navigating back to the user's hotel
 */
export function TakeToHotelButton({
  currentLat,
  currentLng,
  onNavigate,
  style,
  compact = false,
}: TakeToHotelButtonProps) {
  const { currentHotel, hasHotel } = useSavedPlaces();
  const navigation = useNavigation();

  const handlePress = useCallback(() => {
    if (!currentHotel) return;

    if (onNavigate) {
      onNavigate(currentHotel);
    } else {
      // Navigate to guidance screen with hotel as destination
      (navigation as any).navigate('Guidance', {
        destination: {
          latitude: currentHotel.lat,
          longitude: currentHotel.lng,
          label: currentHotel.label,
          type: 'hotel',
        },
      });
    }
  }, [currentHotel, onNavigate, navigation]);

  if (!hasHotel) {
    return null; // Don't show button if no hotel is set
  }

  // Calculate distance if we have current location
  let distanceText = '';
  if (currentLat && currentLng && currentHotel) {
    const { distance } = baseCampService.getDirectionsToHotel(
      currentLat,
      currentLng,
      currentHotel
    );
    distanceText = baseCampService.formatDistance(distance);
  }

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactButton, style]}
        onPress={handlePress}
        accessibilityLabel="Navigate to hotel"
        accessibilityRole="button"
      >
        <Ionicons name="bed" size={20} color={Colors.buttonPrimaryText} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.takeToHotelButton, style]}
      onPress={handlePress}
      accessibilityLabel="Navigate to hotel"
      accessibilityRole="button"
    >
      <Ionicons name="bed" size={24} color={Colors.buttonPrimaryText} />
      <View style={styles.buttonTextContainer}>
        <Text style={styles.buttonTitle}>Take me to Hotel</Text>
        {distanceText ? (
          <Text style={styles.buttonSubtitle}>{distanceText}</Text>
        ) : null}
      </View>
      <Ionicons name="navigate" size={20} color={Colors.buttonPrimaryText} />
    </TouchableOpacity>
  );
}

interface HotelPillProps {
  hotel: SavedPlace;
  currentLat?: number;
  currentLng?: number;
  onPress?: () => void;
}

/**
 * Hotel Info Pill
 * Compact display of hotel info, useful for map overlays
 */
export function HotelPill({ hotel, currentLat, currentLng, onPress }: HotelPillProps) {
  let distanceText = '';
  let directionText = '';

  if (currentLat && currentLng) {
    const { distance, direction } = baseCampService.getDirectionsToHotel(
      currentLat,
      currentLng,
      hotel
    );
    distanceText = baseCampService.formatDistance(distance);
    directionText = direction;
  }

  return (
    <TouchableOpacity
      style={styles.hotelPill}
      onPress={onPress}
      accessibilityLabel={`Hotel: ${hotel.label}`}
      accessibilityRole="button"
    >
      <Ionicons name="bed" size={16} color={Colors.primary} />
      <Text style={styles.hotelPillText} numberOfLines={1}>
        {hotel.label}
      </Text>
      {distanceText ? (
        <Text style={styles.hotelPillDistance}>
          {distanceText} {directionText}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

interface ReturnToHotelSheetProps {
  visible: boolean;
  hotel: SavedPlace;
  distanceMeters: number;
  showDontAskAgain?: boolean;
  onNavigate: () => void;
  onDismiss: () => void;
  onDontAskAgain?: () => void;
}

/**
 * Return to Hotel Bottom Sheet
 * Shown when auto-suggest triggers
 */
export function ReturnToHotelSheet({
  visible,
  hotel,
  distanceMeters,
  showDontAskAgain = false,
  onNavigate,
  onDismiss,
  onDontAskAgain,
}: ReturnToHotelSheetProps) {
  const distanceText = baseCampService.formatDistance(distanceMeters);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.sheetOverlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <View style={styles.sheetIconContainer}>
              <Ionicons name="bed" size={32} color={Colors.primary} />
            </View>
            <View style={styles.sheetHeaderText}>
              <Text style={styles.sheetTitle}>Head back to Hotel?</Text>
              <Text style={styles.sheetSubtitle}>
                {hotel.label} is {distanceText} away
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.sheetPrimaryButton}
            onPress={onNavigate}
            accessibilityLabel="Start navigation to hotel"
            accessibilityRole="button"
          >
            <Ionicons name="navigate" size={20} color={Colors.buttonPrimaryText} />
            <Text style={styles.sheetPrimaryButtonText}>Start Navigation</Text>
          </TouchableOpacity>

          <View style={styles.sheetSecondaryButtons}>
            <TouchableOpacity
              style={styles.sheetSecondaryButton}
              onPress={onDismiss}
              accessibilityLabel="Not now"
              accessibilityRole="button"
            >
              <Text style={styles.sheetSecondaryButtonText}>Not now</Text>
            </TouchableOpacity>

            {showDontAskAgain && onDontAskAgain && (
              <TouchableOpacity
                style={styles.sheetSecondaryButton}
                onPress={onDontAskAgain}
                accessibilityLabel="Don't ask again"
                accessibilityRole="button"
              >
                <Text style={styles.sheetSecondaryButtonText}>Don't ask again</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface SetHotelButtonProps {
  onPress: () => void;
  style?: object;
}

/**
 * Set Hotel Button
 * CTA for setting a hotel when none is set
 */
export function SetHotelButton({ onPress, style }: SetHotelButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.setHotelButton, style]}
      onPress={onPress}
      accessibilityLabel="Set hotel location"
      accessibilityRole="button"
    >
      <Ionicons name="add-circle" size={24} color={Colors.primary} />
      <Text style={styles.setHotelButtonText}>Set Hotel Location</Text>
    </TouchableOpacity>
  );
}

interface SaveAsHotelButtonProps {
  lat: number;
  lng: number;
  label?: string;
  address?: string;
  onSuccess?: (hotel: SavedPlace) => void;
  onError?: (error: string) => void;
  style?: object;
}

/**
 * Save as Hotel Button
 * Quick action to save current location or POI as hotel
 */
export function SaveAsHotelButton({
  lat,
  lng,
  label = 'My Hotel',
  address,
  onSuccess,
  onError,
  style,
}: SaveAsHotelButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { setHotel } = useSavedPlaces();

  const handlePress = useCallback(async () => {
    setIsLoading(true);
    try {
      const hotel = await setHotel({
        label,
        lat,
        lng,
        address,
        provider: 'manual',
      });

      if (hotel) {
        onSuccess?.(hotel);
      } else {
        onError?.('Failed to save hotel');
      }
    } catch (error) {
      onError?.('Failed to save hotel');
    } finally {
      setIsLoading(false);
    }
  }, [lat, lng, label, address, setHotel, onSuccess, onError]);

  return (
    <TouchableOpacity
      style={[styles.saveAsButton, style]}
      onPress={handlePress}
      disabled={isLoading}
      accessibilityLabel="Save as hotel"
      accessibilityRole="button"
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : (
        <>
          <Ionicons name="bed-outline" size={20} color={Colors.primary} />
          <Text style={styles.saveAsButtonText}>Save as Hotel</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Take to Hotel Button
  takeToHotelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  compactButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.buttonPrimaryText,
  },
  buttonSubtitle: {
    fontSize: 12,
    color: Colors.buttonPrimaryText,
    opacity: 0.8,
    marginTop: 2,
  },

  // Hotel Pill
  hotelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  hotelPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textDark,
    marginLeft: 6,
    maxWidth: 100,
  },
  hotelPillDistance: {
    fontSize: 12,
    color: Colors.gray,
    marginLeft: 8,
  },

  // Return to Hotel Sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Safe area
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.lightGray,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHeaderText: {
    flex: 1,
    marginLeft: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textDark,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: Colors.gray,
    marginTop: 4,
  },
  sheetPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  sheetPrimaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.buttonPrimaryText,
    marginLeft: 8,
  },
  sheetSecondaryButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  sheetSecondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sheetSecondaryButtonText: {
    fontSize: 14,
    color: Colors.gray,
  },

  // Set Hotel Button
  setHotelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundLight,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  setHotelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.primary,
    marginLeft: 8,
  },

  // Save as Button
  saveAsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
  },
  saveAsButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
    marginLeft: 6,
  },
});

export default {
  TakeToHotelButton,
  HotelPill,
  ReturnToHotelSheet,
  SetHotelButton,
  SaveAsHotelButton,
};
