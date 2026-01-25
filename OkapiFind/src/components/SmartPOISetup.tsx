/**
 * Smart POI Setup Component
 * Allows users to set home, work, and other frequent locations
 * to suppress unnecessary parking notifications
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSmartPOI } from '../hooks/useSmartPOI';
import { SavedPOI, POIType } from '../services/smartPOIService';
import { Colors } from '../constants/colors';

interface SmartPOISetupProps {
  onClose?: () => void;
}

const POI_ICONS: Record<POIType, keyof typeof Ionicons.glyphMap> = {
  home: 'home',
  work: 'briefcase',
  hotel: 'bed',
  second_home: 'home-outline',
  gym: 'fitness',
  school: 'school',
  shopping: 'cart',
  restaurant: 'restaurant',
  friend_family: 'people',
  parking_lot: 'car',
  transit_hub: 'train',
  cruise_ship: 'boat',
  airport: 'airplane',
  custom: 'location',
};

const POI_COLORS: Record<POIType, string> = {
  home: '#4CAF50',
  work: '#2196F3',
  hotel: '#9C27B0',
  second_home: '#8BC34A',
  gym: '#FF5722',
  school: '#673AB7',
  shopping: '#FF9800',
  restaurant: '#E91E63',
  friend_family: '#00BCD4',
  parking_lot: '#607D8B',
  transit_hub: '#795548',
  cruise_ship: '#03A9F4',
  airport: '#3F51B5',
  custom: '#9E9E9E',
};

export function SmartPOISetup({ onClose }: SmartPOISetupProps) {
  const {
    isLoading,
    allPOIs,
    home,
    work,
    settings,
    analytics,
    setHome,
    setWork,
    addPOI,
    deletePOI,
    updateSettings,
  } = useSmartPOI();

  const [isSettingLocation, setIsSettingLocation] = useState<'home' | 'work' | 'custom' | null>(null);
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState<POIType>('custom');
  const [showAddModal, setShowAddModal] = useState(false);

  const handleSetCurrentLocation = async (type: 'home' | 'work' | 'custom') => {
    setIsSettingLocation(type);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to set this location.');
        setIsSettingLocation(null);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Get address
      let address: string | undefined;
      try {
        const [addressResult] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        if (addressResult) {
          address = `${addressResult.street || ''} ${addressResult.name || ''}, ${addressResult.city || ''}`.trim();
        }
      } catch {
        // Address lookup failed, continue without it
      }

      if (type === 'home') {
        await setHome(location.coords.latitude, location.coords.longitude, address);
        Alert.alert('Home Set', 'Your home location has been saved. Parking notifications will be suppressed here.');
      } else if (type === 'work') {
        await setWork(location.coords.latitude, location.coords.longitude, address);
        Alert.alert('Work Set', 'Your work location has been saved. Parking notifications will be suppressed here.');
      } else if (type === 'custom' && customName) {
        await addPOI({
          name: customName,
          type: customType,
          location: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          address,
          radius: 100,
          suppressNavigation: true,
          suppressAutoDetection: true,
        });
        Alert.alert('Location Saved', `${customName} has been added to your saved locations.`);
        setShowAddModal(false);
        setCustomName('');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get your location. Please try again.');
    } finally {
      setIsSettingLocation(null);
    }
  };

  const handleDeletePOI = (poi: SavedPOI) => {
    Alert.alert(
      'Delete Location',
      `Are you sure you want to delete "${poi.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deletePOI(poi.id),
        },
      ]
    );
  };

  const renderPOIItem = (poi: SavedPOI) => (
    <View key={poi.id} style={styles.poiItem}>
      <View style={[styles.poiIcon, { backgroundColor: POI_COLORS[poi.type] }]}>
        <Ionicons name={POI_ICONS[poi.type]} size={20} color="#fff" />
      </View>
      <View style={styles.poiInfo}>
        <Text style={styles.poiName}>{poi.name}</Text>
        {poi.address && <Text style={styles.poiAddress} numberOfLines={1}>{poi.address}</Text>}
        <Text style={styles.poiStats}>
          {poi.visitCount} visit{poi.visitCount !== 1 ? 's' : ''} | {poi.suppressNavigation ? 'Notifications suppressed' : 'Active'}
        </Text>
      </View>
      <TouchableOpacity onPress={() => handleDeletePOI(poi)} style={styles.deleteButton}>
        <Ionicons name="trash-outline" size={20} color={Colors.error} />
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading locations...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Smart Locations</Text>
        <Text style={styles.subtitle}>
          Set your frequent locations to avoid unnecessary parking reminders
        </Text>
      </View>

      {/* Quick Setup Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Setup</Text>

        {/* Home */}
        <TouchableOpacity
          style={[styles.quickSetupButton, home && styles.quickSetupButtonActive]}
          onPress={() => handleSetCurrentLocation('home')}
          disabled={isSettingLocation === 'home'}
        >
          <View style={[styles.quickSetupIcon, { backgroundColor: POI_COLORS.home }]}>
            {isSettingLocation === 'home' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="home" size={24} color="#fff" />
            )}
          </View>
          <View style={styles.quickSetupInfo}>
            <Text style={styles.quickSetupTitle}>
              {home ? 'Home Set' : 'Set Home Location'}
            </Text>
            <Text style={styles.quickSetupDescription}>
              {home ? home.address || 'Tap to update' : "Use your current location as home"}
            </Text>
          </View>
          {home && <Ionicons name="checkmark-circle" size={24} color={POI_COLORS.home} />}
        </TouchableOpacity>

        {/* Work */}
        <TouchableOpacity
          style={[styles.quickSetupButton, work && styles.quickSetupButtonActive]}
          onPress={() => handleSetCurrentLocation('work')}
          disabled={isSettingLocation === 'work'}
        >
          <View style={[styles.quickSetupIcon, { backgroundColor: POI_COLORS.work }]}>
            {isSettingLocation === 'work' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="briefcase" size={24} color="#fff" />
            )}
          </View>
          <View style={styles.quickSetupInfo}>
            <Text style={styles.quickSetupTitle}>
              {work ? 'Work Set' : 'Set Work Location'}
            </Text>
            <Text style={styles.quickSetupDescription}>
              {work ? work.address || 'Tap to update' : "Use your current location as work"}
            </Text>
          </View>
          {work && <Ionicons name="checkmark-circle" size={24} color={POI_COLORS.work} />}
        </TouchableOpacity>

        {/* Add Custom */}
        <TouchableOpacity
          style={styles.quickSetupButton}
          onPress={() => setShowAddModal(true)}
        >
          <View style={[styles.quickSetupIcon, { backgroundColor: Colors.primary }]}>
            <Ionicons name="add" size={24} color="#fff" />
          </View>
          <View style={styles.quickSetupInfo}>
            <Text style={styles.quickSetupTitle}>Add Custom Location</Text>
            <Text style={styles.quickSetupDescription}>
              Gym, school, family, or any frequent spot
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Saved Locations */}
      {allPOIs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Saved Locations</Text>
          {allPOIs.map(renderPOIItem)}
        </View>
      )}

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => updateSettings({ autoLearnEnabled: !settings.autoLearnEnabled })}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Auto-Learn Locations</Text>
            <Text style={styles.settingDescription}>
              Automatically detect frequent locations
            </Text>
          </View>
          <Ionicons
            name={settings.autoLearnEnabled ? 'toggle' : 'toggle-outline'}
            size={40}
            color={settings.autoLearnEnabled ? Colors.primary : Colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => updateSettings({ suppressionEnabled: !settings.suppressionEnabled })}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Smart Suppression</Text>
            <Text style={styles.settingDescription}>
              Hide notifications at saved locations
            </Text>
          </View>
          <Ionicons
            name={settings.suppressionEnabled ? 'toggle' : 'toggle-outline'}
            size={40}
            color={settings.suppressionEnabled ? Colors.primary : Colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Analytics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Smart Location Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{analytics.totalPOIs}</Text>
            <Text style={styles.statLabel}>Locations</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{analytics.totalVisitsTracked}</Text>
            <Text style={styles.statLabel}>Visits</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{analytics.suppressedNotificationsEstimate}</Text>
            <Text style={styles.statLabel}>Suppressed</Text>
          </View>
        </View>
      </View>

      {/* Add Custom Location Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Custom Location</Text>

            <TextInput
              style={styles.input}
              placeholder="Location name (e.g., Mom's House)"
              placeholderTextColor={Colors.textSecondary}
              value={customName}
              onChangeText={setCustomName}
            />

            <Text style={styles.inputLabel}>Location Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelector}>
              {(['gym', 'school', 'shopping', 'restaurant', 'friend_family', 'parking_lot', 'transit_hub', 'custom'] as POIType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeOption,
                    customType === type && styles.typeOptionSelected,
                    { borderColor: POI_COLORS[type] },
                  ]}
                  onPress={() => setCustomType(type)}
                >
                  <Ionicons
                    name={POI_ICONS[type]}
                    size={20}
                    color={customType === type ? '#fff' : POI_COLORS[type]}
                  />
                  <Text style={[
                    styles.typeOptionText,
                    customType === type && styles.typeOptionTextSelected,
                  ]}>
                    {type.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={() => handleSetCurrentLocation('custom')}
                disabled={!customName || isSettingLocation === 'custom'}
              >
                {isSettingLocation === 'custom' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.modalButtonText, styles.modalButtonTextSave]}>
                    Use Current Location
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {onClose && (
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Done</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
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
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontSize: 16,
  },
  header: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  section: {
    padding: 20,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  quickSetupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  quickSetupButtonActive: {
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  quickSetupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  quickSetupInfo: {
    flex: 1,
  },
  quickSetupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  quickSetupDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  poiItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  poiIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  poiInfo: {
    flex: 1,
  },
  poiName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  poiAddress: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  poiStats: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  typeSelector: {
    marginBottom: 20,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    marginRight: 8,
    backgroundColor: 'transparent',
  },
  typeOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeOptionText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    textTransform: 'capitalize',
  },
  typeOptionTextSelected: {
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  modalButtonCancel: {
    backgroundColor: Colors.surface,
  },
  modalButtonSave: {
    backgroundColor: Colors.primary,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  modalButtonTextSave: {
    color: '#fff',
  },
  closeButton: {
    margin: 20,
    padding: 16,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default SmartPOISetup;
