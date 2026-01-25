/**
 * Save Place Sheet Component
 * Bottom sheet prompt for Smart Suggestions "Save this place?" feature.
 * Shows when user is detected stationary at an interesting location.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useSavedPlaces } from '../hooks/useSavedPlaces';
import { SavedPlaceType } from '../types/savedPlaces.types';

interface SavePlaceSheetProps {
  visible: boolean;
  lat: number;
  lng: number;
  suggestedName?: string;
  suggestedAddress?: string;
  onSaved: () => void;
  onDismiss: () => void;
  onDontAskAgain: () => void;
}

type PlaceTypeOption = 'HOTEL' | 'FAVORITE' | 'CUSTOM';

const PLACE_TYPE_OPTIONS: { type: PlaceTypeOption; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { type: 'HOTEL', label: 'Hotel', icon: 'bed', color: '#9C27B0' },
  { type: 'FAVORITE', label: 'Favorite', icon: 'star', color: '#FFD700' },
  { type: 'CUSTOM', label: 'Custom', icon: 'location', color: '#607D8B' },
];

export function SavePlaceSheet({
  visible,
  lat,
  lng,
  suggestedName,
  suggestedAddress,
  onSaved,
  onDismiss,
  onDontAskAgain,
}: SavePlaceSheetProps) {
  const { setHotel, addFavorite, addCustomPlace } = useSavedPlaces();

  const [selectedType, setSelectedType] = useState<PlaceTypeOption>('FAVORITE');
  const [placeName, setPlaceName] = useState(suggestedName || '');
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when sheet opens
  React.useEffect(() => {
    if (visible) {
      setPlaceName(suggestedName || '');
      setSelectedType('FAVORITE');
      setIsSaving(false);
    }
  }, [visible, suggestedName]);

  const handleSave = useCallback(async () => {
    if (!placeName.trim()) return;

    setIsSaving(true);

    try {
      const input = {
        label: placeName.trim(),
        lat,
        lng,
        address: suggestedAddress,
        provider: 'manual' as const,
      };

      let success = false;

      switch (selectedType) {
        case 'HOTEL':
          const hotel = await setHotel(input);
          success = !!hotel;
          break;
        case 'FAVORITE':
          const favorite = await addFavorite(input);
          success = !!favorite;
          break;
        case 'CUSTOM':
          const custom = await addCustomPlace(input);
          success = !!custom;
          break;
      }

      if (success) {
        onSaved();
      }
    } catch (error) {
      console.error('Error saving place:', error);
    } finally {
      setIsSaving(false);
    }
  }, [placeName, lat, lng, suggestedAddress, selectedType, setHotel, addFavorite, addCustomPlace, onSaved]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onDismiss}
        />

        <View style={styles.container}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="bookmark" size={28} color={Colors.primary} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Save this place?</Text>
              <Text style={styles.subtitle}>
                {suggestedAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
              </Text>
            </View>
          </View>

          {/* Place Name Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={placeName}
              onChangeText={setPlaceName}
              placeholder="Enter a name for this place"
              placeholderTextColor={Colors.gray}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>

          {/* Place Type Selector */}
          <View style={styles.typeContainer}>
            <Text style={styles.inputLabel}>Save as</Text>
            <View style={styles.typeOptions}>
              {PLACE_TYPE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.type}
                  style={[
                    styles.typeOption,
                    selectedType === option.type && styles.typeOptionSelected,
                    selectedType === option.type && { borderColor: option.color },
                  ]}
                  onPress={() => setSelectedType(option.type)}
                >
                  <Ionicons
                    name={option.icon}
                    size={20}
                    color={selectedType === option.type ? option.color : Colors.gray}
                  />
                  <Text
                    style={[
                      styles.typeOptionText,
                      selectedType === option.type && { color: option.color },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!placeName.trim() || isSaving) && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!placeName.trim() || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.buttonPrimaryText} />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color={Colors.buttonPrimaryText} />
                <Text style={styles.saveButtonText}>Save Place</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Secondary Actions */}
          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onDismiss}
            >
              <Text style={styles.secondaryButtonText}>Not now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onDontAskAgain}
            >
              <Text style={styles.secondaryButtonText}>Don't ask here</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Safe area
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.lightGray,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textDark,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.gray,
    marginTop: 4,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  typeContainer: {
    marginBottom: 20,
  },
  typeOptions: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    backgroundColor: Colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeOptionSelected: {
    backgroundColor: Colors.background,
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.gray,
    marginLeft: 6,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.buttonPrimaryText,
    marginLeft: 8,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: Colors.gray,
  },
});

export default SavePlaceSheet;
