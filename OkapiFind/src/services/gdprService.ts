// @ts-nocheck
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Share } from 'react-native';
import { writeAsStringAsync, documentDirectory, EncodingType } from 'expo-file-system/legacy';
import { auth } from '../config/firebase';

export interface ConsentRecord {
  id: string;
  type: 'analytics' | 'marketing' | 'functional' | 'necessary';
  granted: boolean;
  timestamp: number;
  version: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface DataCategory {
  category: string;
  description: string;
  dataTypes: string[];
  purpose: string;
  retention: string;
  thirdParties?: string[];
}

export interface UserDataExport {
  userId: string;
  exportDate: string;
  version: string;
  personalData: {
    profile: any;
    preferences: any;
    activityLog: any[];
    deviceInfo: any;
  };
  locationData: {
    parkingHistory: any[];
    savedLocations: any[];
  };
  appUsage: {
    sessionHistory: any[];
    featureUsage: any;
    errorLogs: any[];
  };
  consents: ConsentRecord[];
}

export interface DataDeletionRequest {
  id: string;
  userId: string;
  requestDate: number;
  requestType: 'full' | 'partial';
  categories: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completionDate?: number;
  verificationCode?: string;
}

class GDPRService {
  private static instance: GDPRService;
  private consentVersion = '1.0';

  private readonly STORAGE_KEYS = {
    CONSENTS: '@GDPR:consents',
    DATA_CATEGORIES: '@GDPR:dataCategories',
    DELETION_REQUESTS: '@GDPR:deletionRequests',
    PRIVACY_SETTINGS: '@GDPR:privacySettings',
    CONSENT_HISTORY: '@GDPR:consentHistory',
  };

  private readonly DATA_CATEGORIES: DataCategory[] = [
    {
      category: 'profile',
      description: 'Basic user profile information',
      dataTypes: ['name', 'email', 'phone', 'profile_picture'],
      purpose: 'Account management and personalization',
      retention: '2 years after account deletion',
      thirdParties: ['Firebase Auth'],
    },
    {
      category: 'location',
      description: 'Location data and parking history',
      dataTypes: ['gps_coordinates', 'parking_locations', 'search_history'],
      purpose: 'Core app functionality',
      retention: '1 year after collection',
    },
    {
      category: 'device',
      description: 'Device and technical information',
      dataTypes: ['device_id', 'os_version', 'app_version', 'push_tokens'],
      purpose: 'App functionality and support',
      retention: '6 months after last use',
    },
    {
      category: 'usage',
      description: 'App usage analytics',
      dataTypes: ['feature_usage', 'session_duration', 'error_logs'],
      purpose: 'App improvement and analytics',
      retention: '12 months',
      thirdParties: ['Analytics Provider'],
    },
    {
      category: 'preferences',
      description: 'User preferences and settings',
      dataTypes: ['app_settings', 'notification_preferences', 'theme_preferences'],
      purpose: 'Personalization',
      retention: 'Until changed by user',
    },
  ];

  private constructor() {}

  public static getInstance(): GDPRService {
    if (!GDPRService.instance) {
      GDPRService.instance = new GDPRService();
    }
    return GDPRService.instance;
  }

  /**
   * Initialize GDPR service
   */
  public async initialize(): Promise<void> {
    try {
      await this.loadDataCategories();
      console.log('GDPR Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize GDPR Service:', error);
    }
  }

  /**
   * Record user consent
   */
  public async recordConsent(
    type: ConsentRecord['type'],
    granted: boolean,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    try {
      const consent: ConsentRecord = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        granted,
        timestamp: Date.now(),
        version: this.consentVersion,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      };

      const consents = await this.getConsents();
      const updatedConsents = consents.filter(c => c.type !== type);
      updatedConsents.push(consent);

      await AsyncStorage.setItem(this.STORAGE_KEYS.CONSENTS, JSON.stringify(updatedConsents));

      // Also save to consent history
      await this.saveConsentHistory(consent);

      console.log(`Consent recorded: ${type} - ${granted ? 'granted' : 'denied'}`);
    } catch (error) {
      console.error('Error recording consent:', error);
      throw error;
    }
  }

  /**
   * Get current consents
   */
  public async getConsents(): Promise<ConsentRecord[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.CONSENTS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting consents:', error);
      return [];
    }
  }

  /**
   * Check if consent is granted for a specific type
   */
  public async hasConsent(type: ConsentRecord['type']): Promise<boolean> {
    try {
      const consents = await this.getConsents();
      const consent = consents.find(c => c.type === type);
      return consent?.granted ?? false;
    } catch (error) {
      console.error('Error checking consent:', error);
      return false;
    }
  }

  /**
   * Get consent history
   */
  public async getConsentHistory(): Promise<ConsentRecord[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.CONSENT_HISTORY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting consent history:', error);
      return [];
    }
  }

  /**
   * Request data deletion
   */
  public async requestDataDeletion(
    requestType: 'full' | 'partial',
    categories: string[] = []
  ): Promise<string> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const request: DataDeletionRequest = {
        id: `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user.uid,
        requestDate: Date.now(),
        requestType,
        categories: requestType === 'full' ? this.DATA_CATEGORIES.map(c => c.category) : categories,
        status: 'pending',
        verificationCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
      };

      const requests = await this.getDeletionRequests();
      requests.push(request);
      await AsyncStorage.setItem(this.STORAGE_KEYS.DELETION_REQUESTS, JSON.stringify(requests));

      // Send verification email/notification
      await this.sendDeletionVerification(request);

      Alert.alert(
        'Data Deletion Requested',
        `Your data deletion request has been submitted. Verification code: ${request.verificationCode}\n\nPlease save this code for your records.`,
        [{ text: 'OK' }]
      );

      return request.id;
    } catch (error) {
      console.error('Error requesting data deletion:', error);
      throw error;
    }
  }

  /**
   * Confirm data deletion with verification code
   */
  public async confirmDataDeletion(requestId: string, verificationCode: string): Promise<boolean> {
    try {
      const requests = await this.getDeletionRequests();
      const request = requests.find(r => r.id === requestId);

      if (!request) {
        throw new Error('Deletion request not found');
      }

      if (request.verificationCode !== verificationCode.toUpperCase()) {
        throw new Error('Invalid verification code');
      }

      // Update request status
      request.status = 'processing';
      await AsyncStorage.setItem(this.STORAGE_KEYS.DELETION_REQUESTS, JSON.stringify(requests));

      // Perform actual deletion
      await this.performDataDeletion(request);

      // Update status to completed
      request.status = 'completed';
      request.completionDate = Date.now();
      await AsyncStorage.setItem(this.STORAGE_KEYS.DELETION_REQUESTS, JSON.stringify(requests));

      Alert.alert(
        'Data Deleted',
        'Your data has been successfully deleted according to your request.',
        [{ text: 'OK' }]
      );

      return true;
    } catch (error) {
      console.error('Error confirming data deletion:', error);
      Alert.alert('Error', error.message || 'Failed to confirm data deletion');
      return false;
    }
  }

  /**
   * Export user data (GDPR Article 20)
   */
  public async exportUserData(): Promise<string> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const exportData: UserDataExport = {
        userId: user.uid,
        exportDate: new Date().toISOString(),
        version: this.consentVersion,
        personalData: await this.collectPersonalData(),
        locationData: await this.collectLocationData(),
        appUsage: await this.collectAppUsageData(),
        consents: await this.getConsentHistory(),
      };

      // Create JSON file
      const fileName = `okapifind_data_export_${Date.now()}.json`;
      const filePath = `${documentDirectory}${fileName}`;

      await writeAsStringAsync(
        filePath,
        JSON.stringify(exportData, null, 2),
        { encoding: EncodingType.UTF8 }
      );

      // Share the file
      await Share.share({
        url: filePath,
        title: 'OkapiFind Data Export',
        message: 'Your personal data export from OkapiFind',
      });

      return filePath;
    } catch (error) {
      console.error('Error exporting user data:', error);
      throw error;
    }
  }

  /**
   * Get data categories and their descriptions
   */
  public getDataCategories(): DataCategory[] {
    return [...this.DATA_CATEGORIES];
  }

  /**
   * Update privacy settings
   */
  public async updatePrivacySettings(settings: {
    dataMinimization?: boolean;
    analyticsOptOut?: boolean;
    marketingOptOut?: boolean;
    dataRetentionPeriod?: number;
  }): Promise<void> {
    try {
      const currentSettings = await this.getPrivacySettings();
      const updatedSettings = { ...currentSettings, ...settings };

      await AsyncStorage.setItem(
        this.STORAGE_KEYS.PRIVACY_SETTINGS,
        JSON.stringify(updatedSettings)
      );

      console.log('Privacy settings updated');
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      throw error;
    }
  }

  /**
   * Get privacy settings
   */
  public async getPrivacySettings(): Promise<any> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.PRIVACY_SETTINGS);
      return stored ? JSON.parse(stored) : {
        dataMinimization: true,
        analyticsOptOut: false,
        marketingOptOut: false,
        dataRetentionPeriod: 365, // days
      };
    } catch (error) {
      console.error('Error getting privacy settings:', error);
      return {};
    }
  }

  /**
   * Get deletion requests
   */
  public async getDeletionRequests(): Promise<DataDeletionRequest[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.DELETION_REQUESTS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting deletion requests:', error);
      return [];
    }
  }

  /**
   * Check if consent is still valid (not expired)
   */
  public async isConsentValid(type: ConsentRecord['type'], maxAgeMonths: number = 12): Promise<boolean> {
    try {
      const consents = await this.getConsents();
      const consent = consents.find(c => c.type === type);

      if (!consent || !consent.granted) {
        return false;
      }

      const maxAge = maxAgeMonths * 30 * 24 * 60 * 60 * 1000; // Convert to milliseconds
      const age = Date.now() - consent.timestamp;

      return age < maxAge;
    } catch (error) {
      console.error('Error checking consent validity:', error);
      return false;
    }
  }

  /**
   * Anonymize user data
   */
  public async anonymizeUserData(): Promise<void> {
    try {
      // Remove PII while keeping anonymized analytics
      const keysToAnonymize = [
        '@User:profile',
        '@User:preferences',
        '@Auth:userCredentials',
        '@Location:savedLocations',
      ];

      await AsyncStorage.multiRemove(keysToAnonymize);

      // Keep anonymized data for analytics
      const anonymizedData = {
        anonymizedAt: Date.now(),
        userId: 'anonymous_' + Math.random().toString(36).substr(2, 9),
        deviceType: 'anonymized',
      };

      await AsyncStorage.setItem('@GDPR:anonymizedData', JSON.stringify(anonymizedData));

      console.log('User data anonymized');
    } catch (error) {
      console.error('Error anonymizing user data:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async collectPersonalData(): Promise<any> {
    try {
      const profile = await AsyncStorage.getItem('@User:profile');
      const preferences = await AsyncStorage.getItem('@User:preferences');
      const deviceInfo = await AsyncStorage.getItem('@Device:info');

      return {
        profile: profile ? JSON.parse(profile) : null,
        preferences: preferences ? JSON.parse(preferences) : null,
        deviceInfo: deviceInfo ? JSON.parse(deviceInfo) : null,
      };
    } catch (error) {
      console.error('Error collecting personal data:', error);
      return {};
    }
  }

  private async collectLocationData(): Promise<any> {
    try {
      const parkingHistory = await AsyncStorage.getItem('@Parking:history');
      const savedLocations = await AsyncStorage.getItem('@Location:saved');

      return {
        parkingHistory: parkingHistory ? JSON.parse(parkingHistory) : [],
        savedLocations: savedLocations ? JSON.parse(savedLocations) : [],
      };
    } catch (error) {
      console.error('Error collecting location data:', error);
      return {};
    }
  }

  private async collectAppUsageData(): Promise<any> {
    try {
      const sessionHistory = await AsyncStorage.getItem('@Analytics:sessions');
      const featureUsage = await AsyncStorage.getItem('@Analytics:features');
      const errorLogs = await AsyncStorage.getItem('@Error:logs');

      return {
        sessionHistory: sessionHistory ? JSON.parse(sessionHistory) : [],
        featureUsage: featureUsage ? JSON.parse(featureUsage) : {},
        errorLogs: errorLogs ? JSON.parse(errorLogs) : [],
      };
    } catch (error) {
      console.error('Error collecting app usage data:', error);
      return {};
    }
  }

  private async performDataDeletion(request: DataDeletionRequest): Promise<void> {
    try {
      if (request.requestType === 'full') {
        // Delete all user data
        await this.deleteAllUserData();
      } else {
        // Delete specific categories
        await this.deleteDataCategories(request.categories);
      }

      console.log(`Data deletion completed for request: ${request.id}`);
    } catch (error) {
      console.error('Error performing data deletion:', error);
      throw error;
    }
  }

  private async deleteAllUserData(): Promise<void> {
    try {
      // Get all keys to delete (excluding GDPR consent records which should be kept for legal reasons)
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToDelete = allKeys.filter(key =>
        !key.startsWith('@GDPR:') &&
        !key.startsWith('@System:')
      );

      await AsyncStorage.multiRemove(keysToDelete);

      // Sign out user
      if (auth.currentUser) {
        await auth.signOut();
      }

      console.log('All user data deleted');
    } catch (error) {
      console.error('Error deleting all user data:', error);
      throw error;
    }
  }

  private async deleteDataCategories(categories: string[]): Promise<void> {
    try {
      const categoryKeyMap: Record<string, string[]> = {
        profile: ['@User:profile', '@Auth:userCredentials'],
        location: ['@Parking:history', '@Location:saved', '@Location:recent'],
        device: ['@Device:info', '@Push:tokens'],
        usage: ['@Analytics:sessions', '@Analytics:features', '@Error:logs'],
        preferences: ['@User:preferences', '@Settings:app'],
      };

      for (const category of categories) {
        const keys = categoryKeyMap[category] || [];
        if (keys.length > 0) {
          await AsyncStorage.multiRemove(keys);
          console.log(`Deleted data for category: ${category}`);
        }
      }
    } catch (error) {
      console.error('Error deleting data categories:', error);
      throw error;
    }
  }

  private async sendDeletionVerification(request: DataDeletionRequest): Promise<void> {
    try {
      // In a real app, this would send an email or SMS
      // For now, we just log it
      console.log(`Deletion verification code for ${request.userId}: ${request.verificationCode}`);

      // You could integrate with your email service here
      // await emailService.sendDeletionVerification(user.email, request.verificationCode);
    } catch (error) {
      console.error('Error sending deletion verification:', error);
    }
  }

  private async saveConsentHistory(consent: ConsentRecord): Promise<void> {
    try {
      const history = await this.getConsentHistory();
      history.push(consent);

      // Keep only last 100 consent records to prevent storage bloat
      const trimmedHistory = history.slice(-100);

      await AsyncStorage.setItem(
        this.STORAGE_KEYS.CONSENT_HISTORY,
        JSON.stringify(trimmedHistory)
      );
    } catch (error) {
      console.error('Error saving consent history:', error);
    }
  }

  private async loadDataCategories(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.DATA_CATEGORIES,
        JSON.stringify(this.DATA_CATEGORIES)
      );
    } catch (error) {
      console.error('Error loading data categories:', error);
    }
  }
}

export const gdprService = GDPRService.getInstance();
export default gdprService;