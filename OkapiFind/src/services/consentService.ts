// @ts-nocheck
/**
 * Consent Management Service
 * Manages user consent for EULA, Privacy Policy, and Terms of Service
 * Required for legal compliance
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export interface ConsentRecord {
  eulaVersion: string;
  eulaAcceptedAt: string;
  privacyPolicyVersion: string;
  privacyPolicyAcceptedAt: string;
  termsVersion: string;
  termsAcceptedAt: string;
  userId?: string;
  deviceId: string;
  ipAddress?: string;
  platform: string;
  appVersion: string;
}

export interface ConsentUpdate {
  type: 'eula' | 'privacy' | 'terms';
  version: string;
  acceptedAt: string;
}

class ConsentService {
  private readonly CONSENT_KEY = '@consent_record';
  private readonly CONSENT_HISTORY_KEY = '@consent_history';
  private readonly CURRENT_VERSIONS = {
    eula: '1.0.0',
    privacy: '1.0.0',
    terms: '1.0.0',
  };

  /**
   * Check if user has accepted all required agreements
   */
  async hasAcceptedAll(): Promise<boolean> {
    const consent = await this.getConsentRecord();
    if (!consent) return false;

    return (
      consent.eulaVersion === this.CURRENT_VERSIONS.eula &&
      consent.privacyPolicyVersion === this.CURRENT_VERSIONS.privacy &&
      consent.termsVersion === this.CURRENT_VERSIONS.terms
    );
  }

  /**
   * Check if user needs to accept updated agreements
   */
  async needsUpdate(): Promise<boolean> {
    const consent = await this.getConsentRecord();
    if (!consent) return true;

    return (
      consent.eulaVersion !== this.CURRENT_VERSIONS.eula ||
      consent.privacyPolicyVersion !== this.CURRENT_VERSIONS.privacy ||
      consent.termsVersion !== this.CURRENT_VERSIONS.terms
    );
  }

  /**
   * Get current consent record
   */
  async getConsentRecord(): Promise<ConsentRecord | null> {
    try {
      const record = await AsyncStorage.getItem(this.CONSENT_KEY);
      return record ? JSON.parse(record) : null;
    } catch (error) {
      console.error('Failed to get consent record:', error);
      return null;
    }
  }

  /**
   * Accept all agreements
   */
  async acceptAll(userId?: string): Promise<void> {
    const now = new Date().toISOString();
    const consent: ConsentRecord = {
      eulaVersion: this.CURRENT_VERSIONS.eula,
      eulaAcceptedAt: now,
      privacyPolicyVersion: this.CURRENT_VERSIONS.privacy,
      privacyPolicyAcceptedAt: now,
      termsVersion: this.CURRENT_VERSIONS.terms,
      termsAcceptedAt: now,
      userId,
      deviceId: await this.getDeviceId(),
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version || '1.0.0',
    };

    await this.saveConsentRecord(consent);
    await this.addToHistory(consent);

    // Send to backend for legal record
    await this.sendConsentToServer(consent);
  }

  /**
   * Accept specific agreement
   */
  async acceptAgreement(
    type: 'eula' | 'privacy' | 'terms',
    userId?: string
  ): Promise<void> {
    const existing = await this.getConsentRecord();
    const now = new Date().toISOString();

    const updated: ConsentRecord = existing || {
      eulaVersion: '',
      eulaAcceptedAt: '',
      privacyPolicyVersion: '',
      privacyPolicyAcceptedAt: '',
      termsVersion: '',
      termsAcceptedAt: '',
      userId,
      deviceId: await this.getDeviceId(),
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version || '1.0.0',
    };

    switch (type) {
      case 'eula':
        updated.eulaVersion = this.CURRENT_VERSIONS.eula;
        updated.eulaAcceptedAt = now;
        break;
      case 'privacy':
        updated.privacyPolicyVersion = this.CURRENT_VERSIONS.privacy;
        updated.privacyPolicyAcceptedAt = now;
        break;
      case 'terms':
        updated.termsVersion = this.CURRENT_VERSIONS.terms;
        updated.termsAcceptedAt = now;
        break;
    }

    await this.saveConsentRecord(updated);
    await this.addToHistory(updated);
    await this.sendConsentToServer(updated);
  }

  /**
   * Revoke consent (for GDPR compliance)
   */
  async revokeConsent(): Promise<void> {
    const consent = await this.getConsentRecord();
    if (consent) {
      // Archive current consent
      await this.addToHistory({
        ...consent,
        revokedAt: new Date().toISOString(),
      });
    }

    // Clear current consent
    await AsyncStorage.removeItem(this.CONSENT_KEY);

    // Notify server
    await this.sendRevocationToServer(consent?.userId);

    // Show confirmation
    Alert.alert(
      'Consent Revoked',
      'Your consent has been revoked. You will need to accept the agreements again to use the app.',
      [{ text: 'OK' }]
    );
  }

  /**
   * Get consent history (for audit trail)
   */
  async getConsentHistory(): Promise<ConsentRecord[]> {
    try {
      const history = await AsyncStorage.getItem(this.CONSENT_HISTORY_KEY);
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Failed to get consent history:', error);
      return [];
    }
  }

  /**
   * Export consent data (GDPR requirement)
   */
  async exportConsentData(): Promise<string> {
    const current = await this.getConsentRecord();
    const history = await this.getConsentHistory();

    return JSON.stringify(
      {
        current,
        history,
        exported_at: new Date().toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Show consent dialog
   */
  async showConsentDialog(
    onAccept: () => void,
    onDecline: () => void
  ): Promise<void> {
    Alert.alert(
      'Legal Agreements',
      'To use OkapiFind, you must accept our End User License Agreement, Privacy Policy, and Terms of Service.\n\nBy tapping "I Agree", you confirm that you have read and accept all agreements.',
      [
        {
          text: 'View Agreements',
          onPress: () => {
            // Navigate to legal screen
            navigation.navigate('Legal');
          },
        },
        {
          text: 'Decline',
          onPress: onDecline,
          style: 'cancel',
        },
        {
          text: 'I Agree',
          onPress: async () => {
            await this.acceptAll();
            onAccept();
          },
          style: 'default',
        },
      ],
      { cancelable: false }
    );
  }

  /**
   * Private helper methods
   */

  private async saveConsentRecord(record: ConsentRecord): Promise<void> {
    try {
      await AsyncStorage.setItem(this.CONSENT_KEY, JSON.stringify(record));
    } catch (error) {
      console.error('Failed to save consent record:', error);
      throw new Error('Unable to save consent. Please try again.');
    }
  }

  private async addToHistory(record: any): Promise<void> {
    try {
      const history = await this.getConsentHistory();
      history.push({
        ...record,
        timestamp: new Date().toISOString(),
      });

      // Keep only last 100 records
      const trimmed = history.slice(-100);
      await AsyncStorage.setItem(
        this.CONSENT_HISTORY_KEY,
        JSON.stringify(trimmed)
      );
    } catch (error) {
      console.error('Failed to update consent history:', error);
    }
  }

  private async getDeviceId(): Promise<string> {
    // Use expo-device or generate a UUID
    try {
      const { getUniqueId } = await import('expo-device');
      return await getUniqueId();
    } catch {
      // Fallback to generated ID
      let deviceId = await AsyncStorage.getItem('@device_id');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await AsyncStorage.setItem('@device_id', deviceId);
      }
      return deviceId;
    }
  }

  private async sendConsentToServer(consent: ConsentRecord): Promise<void> {
    try {
      // Send to your backend for legal record keeping
      // await api.post('/consent/record', consent);
      console.log('Consent recorded:', consent);
    } catch (error) {
      console.error('Failed to send consent to server:', error);
      // Store locally for retry
      const pending = await AsyncStorage.getItem('@pending_consent');
      const pendingList = pending ? JSON.parse(pending) : [];
      pendingList.push(consent);
      await AsyncStorage.setItem('@pending_consent', JSON.stringify(pendingList));
    }
  }

  private async sendRevocationToServer(userId?: string): Promise<void> {
    try {
      // await api.post('/consent/revoke', { userId });
      console.log('Consent revocation sent for user:', userId);
    } catch (error) {
      console.error('Failed to send revocation to server:', error);
    }
  }

  /**
   * Check and enforce consent on app launch
   */
  async enforceConsent(): Promise<boolean> {
    const hasAccepted = await this.hasAcceptedAll();

    if (!hasAccepted) {
      return new Promise((resolve) => {
        this.showConsentDialog(
          () => resolve(true),
          () => {
            Alert.alert(
              'Agreement Required',
              'You must accept the legal agreements to use OkapiFind.',
              [{ text: 'OK', onPress: () => resolve(false) }]
            );
          }
        );
      });
    }

    return true;
  }

  /**
   * Get formatted consent text for display
   */
  getConsentText(): string {
    return `By using OkapiFind, you agree to our:

• End User License Agreement (EULA)
• Privacy Policy
• Terms of Service

These agreements explain how we collect, use, and protect your data, as well as your rights and responsibilities when using our service.

You can review these documents at any time in Settings > Legal.

Your continued use of the app constitutes acceptance of these agreements.`;
  }
}

export const consentService = new ConsentService();

// React Hook for consent management
import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export function useConsent() {
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkConsent();
  }, []);

  const checkConsent = async () => {
    setLoading(true);
    try {
      const accepted = await consentService.hasAcceptedAll();
      const updateNeeded = await consentService.needsUpdate();
      setHasConsent(accepted);
      setNeedsUpdate(updateNeeded);
    } catch (error) {
      console.error('Failed to check consent:', error);
      setHasConsent(false);
    } finally {
      setLoading(false);
    }
  };

  const acceptAll = async () => {
    await consentService.acceptAll();
    await checkConsent();
  };

  const revokeConsent = async () => {
    await consentService.revokeConsent();
    await checkConsent();
  };

  return {
    hasConsent,
    needsUpdate,
    loading,
    acceptAll,
    revokeConsent,
    checkConsent,
  };
}