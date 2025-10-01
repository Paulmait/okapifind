import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Switch,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useParkingDetection } from '../hooks/useParkingDetection';
import { useCarLocation } from '../hooks/useCarLocation';
import { useFeatureGate, PremiumFeature } from '../hooks/useFeatureGate';
import { usePremium } from '../hooks/usePremium';
import { useAuth } from '../hooks/useAuth';
import { RootStackParamList } from '../types/navigation';
import { PRIVACY_POLICY_LAST_UPDATED } from '../data/privacyPolicy';
import { TERMS_LAST_UPDATED } from '../data/termsOfService';
import { Colors } from '../constants/colors';

type SettingsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Settings'>;

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { clearCarLocation } = useCarLocation();
  const { isPremium } = usePremium();
  const { accessFeature } = useFeatureGate();
  const { signOut, isAuthenticated, currentUser } = useAuth();
  const {
    settings,
    updateSettings,
    clearHistory,
    isTracking,
  } = useParkingDetection();

  const [notificationsEnabled, setNotificationsEnabled] = useState(settings.notifyOnDetection);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(settings.autoSave);
  const [backgroundTrackingEnabled, setBackgroundTrackingEnabled] = useState(settings.backgroundTracking);
  const [geofencingEnabled, setGeofencingEnabled] = useState(settings.useGeofencing);

  const handleToggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    await updateSettings({ notifyOnDetection: value });
  };

  const handleToggleAutoSave = async (value: boolean) => {
    setAutoSaveEnabled(value);
    await updateSettings({ autoSave: value });
  };

  const handleToggleBackgroundTracking = async (value: boolean) => {
    if (value) {
      Alert.alert(
        'Enable Background Tracking',
        'Background tracking uses more battery but provides better parking detection. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: async () => {
              setBackgroundTrackingEnabled(true);
              await updateSettings({ backgroundTracking: true });
            },
          },
        ]
      );
    } else {
      setBackgroundTrackingEnabled(false);
      await updateSettings({ backgroundTracking: false });
    }
  };

  const handleToggleGeofencing = async (value: boolean) => {
    setGeofencingEnabled(value);
    await updateSettings({ useGeofencing: value });
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will clear all saved locations and history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearCarLocation();
            await clearHistory();
            Alert.alert('Success', 'All data has been cleared');
          },
        },
      ]
    );
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@okapifind.com?subject=OkapiFind Support');
  };

  const handleRateApp = () => {
    if (Platform.OS === 'ios') {
      // Replace with your actual App Store ID
      Linking.openURL('https://apps.apple.com/app/okapifind/id1234567890');
    } else {
      // Replace with your actual Play Store package
      Linking.openURL('market://details?id=com.okapi.find');
    }
  };

  const handleOCRTimer = () => {
    accessFeature(PremiumFeature.OCR_TIMER, () => {
      Alert.alert('OCR Timer', 'This feature is coming soon!');
    });
  };

  const handleSafetyMode = () => {
    accessFeature(PremiumFeature.SAFETY_MODE, () => {
      Alert.alert('Safety Mode', 'Enhanced security features coming soon!');
    });
  };

  const handleParkingHistory = () => {
    accessFeature(PremiumFeature.PARKING_HISTORY, () => {
      Alert.alert('Parking History', 'View all your parking history!');
    });
  };

  const handleExportData = () => {
    accessFeature(PremiumFeature.EXPORT_DATA, () => {
      Alert.alert('Export Data', 'Export your parking data!');
    });
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              Alert.alert('Signed Out', 'You have been signed out successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Premium Status */}
        {!isPremium && (
          <TouchableOpacity
            style={styles.premiumBanner}
            onPress={() => navigation.navigate('Paywall')}
          >
            <View style={styles.premiumBannerContent}>
              <Text style={styles.premiumBannerTitle}>🌟 Upgrade to Premium</Text>
              <Text style={styles.premiumBannerSubtitle}>Unlock all features</Text>
            </View>
            <Text style={styles.premiumBannerArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Premium Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Premium Features</Text>

          <TouchableOpacity style={styles.premiumFeatureRow} onPress={handleOCRTimer}>
            <View style={styles.featureInfo}>
              <Text style={styles.featureTitle}>📷 OCR Timer</Text>
              <Text style={styles.featureDescription}>
                Scan parking signs and set automatic reminders
              </Text>
            </View>
            {!isPremium && <Text style={styles.lockIcon}>🔒</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.premiumFeatureRow} onPress={handleSafetyMode}>
            <View style={styles.featureInfo}>
              <Text style={styles.featureTitle}>🛡️ Safety Mode</Text>
              <Text style={styles.featureDescription}>
                Extra security features for night parking
              </Text>
            </View>
            {!isPremium && <Text style={styles.lockIcon}>🔒</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.premiumFeatureRow} onPress={handleParkingHistory}>
            <View style={styles.featureInfo}>
              <Text style={styles.featureTitle}>📊 Parking History</Text>
              <Text style={styles.featureDescription}>
                View all your previous parking locations
              </Text>
            </View>
            {!isPremium && <Text style={styles.lockIcon}>🔒</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.premiumFeatureRow} onPress={handleExportData}>
            <View style={styles.featureInfo}>
              <Text style={styles.featureTitle}>💾 Export Data</Text>
              <Text style={styles.featureDescription}>
                Export your parking data to CSV
              </Text>
            </View>
            {!isPremium && <Text style={styles.lockIcon}>🔒</Text>}
          </TouchableOpacity>
        </View>

        {/* Parking Detection Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parking Detection</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Detection Notifications</Text>
              <Text style={styles.settingDescription}>
                Get notified when parking is detected
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#767577', true: Colors.primary }}
              thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Auto-Save Parking</Text>
              <Text style={styles.settingDescription}>
                Automatically save high-confidence detections
              </Text>
            </View>
            <Switch
              value={autoSaveEnabled}
              onValueChange={handleToggleAutoSave}
              trackColor={{ false: '#767577', true: Colors.primary }}
              thumbColor={autoSaveEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Background Tracking</Text>
              <Text style={styles.settingDescription}>
                Track parking even when app is closed
              </Text>
            </View>
            <Switch
              value={backgroundTrackingEnabled}
              onValueChange={handleToggleBackgroundTracking}
              trackColor={{ false: '#767577', true: Colors.primary }}
              thumbColor={backgroundTrackingEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Geofencing</Text>
              <Text style={styles.settingDescription}>
                Monitor frequent parking locations
              </Text>
            </View>
            <Switch
              value={geofencingEnabled}
              onValueChange={handleToggleGeofencing}
              trackColor={{ false: '#767577', true: Colors.primary }}
              thumbColor={geofencingEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.statusText}>
              Detection is {isTracking ? 'Active' : 'Inactive'}
            </Text>
            {isTracking && (
              <Text style={styles.statusSubtext}>
                Monitoring your parking automatically
              </Text>
            )}
          </View>
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('Legal', { document: 'privacy' })}
          >
            <Text style={styles.linkTitle}>Privacy Policy</Text>
            <Text style={styles.linkSubtitle}>Updated {PRIVACY_POLICY_LAST_UPDATED}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('Legal', { document: 'terms' })}
          >
            <Text style={styles.linkTitle}>Terms of Service</Text>
            <Text style={styles.linkSubtitle}>Updated {TERMS_LAST_UPDATED}</Text>
          </TouchableOpacity>
        </View>

        {/* Data Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>

          <TouchableOpacity style={styles.actionButton} onPress={handleClearAllData}>
            <Text style={styles.actionButtonText}>Clear All Data</Text>
          </TouchableOpacity>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>

          <TouchableOpacity style={styles.linkRow} onPress={handleContactSupport}>
            <Text style={styles.linkTitle}>Contact Support</Text>
            <Text style={styles.linkSubtitle}>support@okapifind.com</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkRow} onPress={handleRateApp}>
            <Text style={styles.linkTitle}>Rate OkapiFind</Text>
            <Text style={styles.linkSubtitle}>Help us improve with your feedback</Text>
          </TouchableOpacity>
        </View>

        {/* Account */}
        {isAuthenticated && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>

            <View style={styles.accountCard}>
              <Text style={styles.accountEmail}>{currentUser?.email || 'No email'}</Text>
              {currentUser?.displayName && (
                <Text style={styles.accountName}>{currentUser.displayName}</Text>
              )}
            </View>

            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          <View style={styles.aboutCard}>
            <Text style={styles.aboutTitle}>OkapiFind</Text>
            <Text style={styles.aboutSubtitle}>Never lose your car</Text>
            <Text style={styles.aboutVersion}>Version 1.0.0</Text>
            <Text style={styles.aboutCopyright}>© 2025 Cien Rios LLC</Text>
            <Text style={styles.aboutCopyright}>All rights reserved</Text>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 1,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#666',
  },
  statusCard: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  statusSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  linkRow: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 1,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.primary,
    marginBottom: 4,
  },
  linkSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  actionButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  aboutCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  aboutTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  aboutSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  aboutVersion: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  aboutCopyright: {
    fontSize: 12,
    color: '#999',
  },
  bottomPadding: {
    height: 40,
  },
  premiumBanner: {
    backgroundColor: Colors.primary,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  premiumBannerContent: {
    flex: 1,
  },
  premiumBannerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.background,
    marginBottom: 2,
  },
  premiumBannerSubtitle: {
    fontSize: 14,
    color: Colors.background,
    opacity: 0.9,
  },
  premiumBannerArrow: {
    fontSize: 20,
    color: Colors.background,
    fontWeight: 'bold',
  },
  premiumFeatureRow: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    color: '#666',
  },
  lockIcon: {
    fontSize: 20,
    marginLeft: 12,
  },
  accountCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  accountEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  accountName: {
    fontSize: 14,
    color: '#666',
  },
  signOutButton: {
    backgroundColor: '#ff3b30',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default SettingsScreen;