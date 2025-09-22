/**
 * Legal Acceptance Screen
 * Shows EULA, Privacy Policy, and Terms on first launch
 * Required for app store compliance
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/colors';
import { EULA } from '../legal/EULA';
import { privacyPolicy } from '../data/privacyPolicy';
import { termsOfService } from '../data/termsOfService';
import { COPYRIGHT_NOTICE } from '../legal/CopyrightNotice';
import { consentService } from '../services/consentService';
import { analytics } from '../services/analytics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type LegalTab = 'eula' | 'privacy' | 'terms' | 'copyright';

export default function LegalAcceptanceScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<LegalTab>('eula');
  const [scrolledToEnd, setScrolledToEnd] = useState({
    eula: false,
    privacy: false,
    terms: false,
    copyright: false,
  });
  const [acceptedItems, setAcceptedItems] = useState({
    eula: false,
    privacy: false,
    terms: false,
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const tabs: { key: LegalTab; label: string; required: boolean }[] = [
    { key: 'eula', label: 'EULA', required: true },
    { key: 'privacy', label: 'Privacy', required: true },
    { key: 'terms', label: 'Terms', required: true },
    { key: 'copyright', label: 'Copyright', required: false },
  ];

  const getContent = (tab: LegalTab): string => {
    switch (tab) {
      case 'eula':
        return EULA;
      case 'privacy':
        return privacyPolicy;
      case 'terms':
        return termsOfService;
      case 'copyright':
        return COPYRIGHT_NOTICE;
      default:
        return '';
    }
  };

  const handleScroll = (event: any, tab: LegalTab) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

    if (isCloseToBottom && !scrolledToEnd[tab]) {
      setScrolledToEnd((prev) => ({ ...prev, [tab]: true }));

      // Track that user read the document
      analytics.logEvent('legal_document_read', {
        document: tab,
        read_completely: true,
      });
    }
  };

  const handleAcceptItem = (item: 'eula' | 'privacy' | 'terms') => {
    if (!scrolledToEnd[item]) {
      Alert.alert(
        'Please Read First',
        `Please scroll through and read the ${item.toUpperCase()} before accepting.`,
        [{ text: 'OK' }]
      );
      setActiveTab(item);
      return;
    }

    setAcceptedItems((prev) => ({
      ...prev,
      [item]: !prev[item],
    }));

    analytics.logEvent('legal_item_accepted', {
      document: item,
      accepted: !acceptedItems[item],
    });
  };

  const handleAcceptAll = async () => {
    // Check if all documents have been read
    const unreadDocs = [];
    if (!scrolledToEnd.eula) unreadDocs.push('EULA');
    if (!scrolledToEnd.privacy) unreadDocs.push('Privacy Policy');
    if (!scrolledToEnd.terms) unreadDocs.push('Terms of Service');

    if (unreadDocs.length > 0) {
      Alert.alert(
        'Please Read All Documents',
        `Please read the following documents before accepting:\n\n${unreadDocs.join('\n')}`,
        [{ text: 'OK' }]
      );
      return;
    }

    setIsProcessing(true);

    try {
      // Record consent
      await consentService.acceptAll();

      // Track acceptance
      analytics.logEvent('legal_all_accepted', {
        timestamp: new Date().toISOString(),
      });

      // Mark onboarding step complete
      await AsyncStorage.setItem('@legal_accepted', 'true');
      await AsyncStorage.setItem('@legal_accepted_date', new Date().toISOString());

      // Navigate to main app or onboarding
      navigation.reset({
        index: 0,
        routes: [{ name: 'Onboarding' as never }],
      });
    } catch (error) {
      console.error('Failed to record consent:', error);
      Alert.alert(
        'Error',
        'Failed to save your acceptance. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      'Agreements Required',
      'You must accept our legal agreements to use OkapiFind. Are you sure you want to exit?',
      [
        { text: 'Review Again', style: 'cancel' },
        {
          text: 'Exit App',
          style: 'destructive',
          onPress: () => {
            analytics.logEvent('legal_declined');
            // Exit app (only works on Android)
            if (Platform.OS === 'android') {
              require('react-native').BackHandler.exitApp();
            } else {
              Alert.alert(
                'Please Close App',
                'Please close the app manually.',
                [{ text: 'OK' }]
              );
            }
          },
        },
      ]
    );
  };

  const allAccepted =
    acceptedItems.eula && acceptedItems.privacy && acceptedItems.terms;

  const allRead =
    scrolledToEnd.eula && scrolledToEnd.privacy && scrolledToEnd.terms;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Legal Agreements</Text>
        <Text style={styles.headerSubtitle}>
          Please review and accept our legal documents to continue
        </Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key && styles.activeTab,
                scrolledToEnd[tab.key] && styles.readTab,
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.activeTabText,
                ]}
              >
                {tab.label}
                {tab.required && ' *'}
              </Text>
              {scrolledToEnd[tab.key] && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Document Content */}
      <ScrollView
        style={styles.contentContainer}
        onScroll={(e) => handleScroll(e, activeTab)}
        scrollEventThrottle={100}
      >
        <Text style={styles.documentText}>{getContent(activeTab)}</Text>

        {!scrolledToEnd[activeTab] && (
          <View style={styles.scrollIndicator}>
            <Text style={styles.scrollText}>↓ Scroll to read more ↓</Text>
          </View>
        )}
      </ScrollView>

      {/* Acceptance Checkboxes */}
      <View style={styles.acceptanceContainer}>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => handleAcceptItem('eula')}
          disabled={!scrolledToEnd.eula}
        >
          <View style={[
            styles.checkbox,
            acceptedItems.eula && styles.checkboxChecked,
            !scrolledToEnd.eula && styles.checkboxDisabled,
          ]}>
            {acceptedItems.eula && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[
            styles.checkboxLabel,
            !scrolledToEnd.eula && styles.checkboxLabelDisabled,
          ]}>
            I accept the End User License Agreement
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => handleAcceptItem('privacy')}
          disabled={!scrolledToEnd.privacy}
        >
          <View style={[
            styles.checkbox,
            acceptedItems.privacy && styles.checkboxChecked,
            !scrolledToEnd.privacy && styles.checkboxDisabled,
          ]}>
            {acceptedItems.privacy && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[
            styles.checkboxLabel,
            !scrolledToEnd.privacy && styles.checkboxLabelDisabled,
          ]}>
            I accept the Privacy Policy
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => handleAcceptItem('terms')}
          disabled={!scrolledToEnd.terms}
        >
          <View style={[
            styles.checkbox,
            acceptedItems.terms && styles.checkboxChecked,
            !scrolledToEnd.terms && styles.checkboxDisabled,
          ]}>
            {acceptedItems.terms && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[
            styles.checkboxLabel,
            !scrolledToEnd.terms && styles.checkboxLabelDisabled,
          ]}>
            I accept the Terms of Service
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.declineButton}
          onPress={handleDecline}
          disabled={isProcessing}
        >
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.acceptButton,
            (!allAccepted || !allRead) && styles.acceptButtonDisabled,
          ]}
          onPress={handleAcceptAll}
          disabled={!allAccepted || !allRead || isProcessing}
        >
          <Text style={styles.acceptButtonText}>
            {isProcessing ? 'Processing...' : 'Accept All & Continue'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${
                  ((Object.values(scrolledToEnd).filter(Boolean).length / 3) * 100)
                }%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {Object.values(scrolledToEnd).filter(Boolean).length} of 3 documents read
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 20,
    backgroundColor: Colors.primary,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  tabContainer: {
    backgroundColor: Colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: Colors.primary,
  },
  readTab: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  tabText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  checkmark: {
    color: Colors.success,
    marginLeft: 4,
    fontSize: 16,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  documentText: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  scrollIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 10,
    alignItems: 'center',
  },
  scrollText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  acceptanceContainer: {
    padding: 20,
    backgroundColor: Colors.backgroundLight,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
  },
  checkboxDisabled: {
    borderColor: Colors.border,
    opacity: 0.5,
  },
  checkboxLabel: {
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
  },
  checkboxLabelDisabled: {
    color: Colors.textSecondary,
    opacity: 0.5,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    backgroundColor: Colors.background,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 16,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 8,
    alignItems: 'center',
  },
  declineButtonText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 2,
    paddingVertical: 16,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 10,
  },
  acceptButtonDisabled: {
    backgroundColor: Colors.border,
    opacity: 0.6,
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  progressText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});