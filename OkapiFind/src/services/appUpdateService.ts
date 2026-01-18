// @ts-nocheck
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

interface UpdateInfo {
  version: string;
  buildNumber: string;
  isForceUpdate: boolean;
  updateUrl?: string;
  releaseNotes?: string;
  minimumVersion?: string;
}

interface UpdateCheckResult {
  hasUpdate: boolean;
  isForceUpdate: boolean;
  updateInfo?: UpdateInfo;
}

class AppUpdateService {
  private static instance: AppUpdateService;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastCheckTime: number = 0;
  private readonly CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
  private readonly STORAGE_KEYS = {
    LAST_CHECK: '@AppUpdate:lastCheck',
    POSTPONED_UPDATES: '@AppUpdate:postponed',
    UPDATE_REMINDER_COUNT: '@AppUpdate:reminderCount',
  };

  public static getInstance(): AppUpdateService {
    if (!AppUpdateService.instance) {
      AppUpdateService.instance = new AppUpdateService();
    }
    return AppUpdateService.instance;
  }

  /**
   * Initialize the update service
   */
  public async initialize(): Promise<void> {
    try {
      await this.loadLastCheckTime();
      this.startPeriodicChecks();

      // Check for updates on app start
      await this.checkForUpdates(false);
    } catch (error) {
      console.error('Failed to initialize AppUpdateService:', error);
    }
  }

  /**
   * Check for app updates
   */
  public async checkForUpdates(showNoUpdateAlert: boolean = false): Promise<UpdateCheckResult> {
    try {
      const currentVersion = Constants.expoConfig?.version || '1.0.0';
      const currentBuildNumber = Constants.expoConfig?.ios?.buildNumber ||
                                Constants.expoConfig?.android?.versionCode?.toString() || '1';

      // Simulate API call to your backend
      const updateInfo = await this.fetchUpdateInfo();

      if (!updateInfo) {
        if (showNoUpdateAlert) {
          Alert.alert('No Updates', 'You are using the latest version of the app.');
        }
        return { hasUpdate: false, isForceUpdate: false };
      }

      const hasUpdate = this.compareVersions(updateInfo.version, currentVersion) > 0;
      const isForceUpdate = updateInfo.isForceUpdate ||
                           (updateInfo.minimumVersion &&
                            this.compareVersions(currentVersion, updateInfo.minimumVersion) < 0);

      if (hasUpdate) {
        await this.saveLastCheckTime();

        if (isForceUpdate) {
          this.showForceUpdateAlert(updateInfo);
        } else {
          await this.showOptionalUpdateAlert(updateInfo);
        }
      } else if (showNoUpdateAlert) {
        Alert.alert('No Updates', 'You are using the latest version of the app.');
      }

      return {
        hasUpdate,
        isForceUpdate,
        updateInfo: hasUpdate ? updateInfo : undefined,
      };
    } catch (error) {
      console.error('Error checking for updates:', error);
      return { hasUpdate: false, isForceUpdate: false };
    }
  }

  /**
   * Fetch update information from your backend
   * Replace this with your actual API endpoint
   */
  private async fetchUpdateInfo(): Promise<UpdateInfo | null> {
    try {
      // This should be replaced with your actual API endpoint
      const response = await fetch('https://your-api.com/app-version-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: Platform.OS,
          currentVersion: Constants.expoConfig?.version,
          buildNumber: Constants.expoConfig?.ios?.buildNumber ||
                      Constants.expoConfig?.android?.versionCode,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Return null if no update is available
      if (!data.hasUpdate) {
        return null;
      }

      return {
        version: data.version,
        buildNumber: data.buildNumber,
        isForceUpdate: data.isForceUpdate || false,
        updateUrl: data.updateUrl,
        releaseNotes: data.releaseNotes,
        minimumVersion: data.minimumVersion,
      };
    } catch (error) {
      console.error('Error fetching update info:', error);
      // Return mock data for development/testing
      if (__DEV__) {
        return null; // No updates in development
      }
      return null;
    }
  }

  /**
   * Show force update alert (cannot be dismissed)
   */
  private showForceUpdateAlert(updateInfo: UpdateInfo): void {
    Alert.alert(
      'Update Required',
      `A critical update is required to continue using the app.\n\n${updateInfo.releaseNotes || 'This update includes important security fixes and improvements.'}`,
      [
        {
          text: 'Update Now',
          onPress: () => this.openAppStore(updateInfo.updateUrl),
          style: 'default',
        },
      ],
      { cancelable: false }
    );
  }

  /**
   * Show optional update alert
   */
  private async showOptionalUpdateAlert(updateInfo: UpdateInfo): Promise<void> {
    try {
      const postponedUpdates = await this.getPostponedUpdates();
      const reminderCount = await this.getReminderCount();

      // Don't show if user has postponed this version
      if (postponedUpdates.includes(updateInfo.version)) {
        return;
      }

      // Limit reminders to prevent spam
      if (reminderCount >= 3) {
        return;
      }

      Alert.alert(
        'Update Available',
        `Version ${updateInfo.version} is now available.\n\n${updateInfo.releaseNotes || 'This update includes new features and improvements.'}`,
        [
          {
            text: 'Later',
            onPress: () => this.incrementReminderCount(),
            style: 'cancel',
          },
          {
            text: 'Skip This Version',
            onPress: () => this.postponeUpdate(updateInfo.version),
            style: 'destructive',
          },
          {
            text: 'Update',
            onPress: () => this.openAppStore(updateInfo.updateUrl),
            style: 'default',
          },
        ]
      );
    } catch (error) {
      console.error('Error showing update alert:', error);
    }
  }

  /**
   * Open app store for update
   */
  private openAppStore(customUrl?: string): void {
    let storeUrl: string;

    if (customUrl) {
      storeUrl = customUrl;
    } else if (Platform.OS === 'ios') {
      // Replace with your actual App Store ID
      storeUrl = 'https://apps.apple.com/app/id1234567890';
    } else {
      // Replace with your actual package name
      storeUrl = 'https://play.google.com/store/apps/details?id=com.yourcompany.okapifind';
    }

    Linking.openURL(storeUrl).catch(error => {
      console.error('Error opening app store:', error);
      Alert.alert('Error', 'Unable to open app store. Please update manually.');
    });
  }

  /**
   * Compare version strings (semantic versioning)
   */
  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    const maxLength = Math.max(v1Parts.length, v2Parts.length);

    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }

    return 0;
  }

  /**
   * Start periodic update checks
   */
  private startPeriodicChecks(): void {
    this.checkInterval = setInterval(() => {
      const now = Date.now();
      if (now - this.lastCheckTime >= this.CHECK_INTERVAL) {
        this.checkForUpdates(false);
      }
    }, this.CHECK_INTERVAL);
  }

  /**
   * Stop periodic update checks
   */
  public stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Storage helpers
   */
  private async loadLastCheckTime(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.LAST_CHECK);
      this.lastCheckTime = stored ? parseInt(stored, 10) : 0;
    } catch (error) {
      console.error('Error loading last check time:', error);
      this.lastCheckTime = 0;
    }
  }

  private async saveLastCheckTime(): Promise<void> {
    try {
      this.lastCheckTime = Date.now();
      await AsyncStorage.setItem(this.STORAGE_KEYS.LAST_CHECK, this.lastCheckTime.toString());
    } catch (error) {
      console.error('Error saving last check time:', error);
    }
  }

  private async getPostponedUpdates(): Promise<string[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.POSTPONED_UPDATES);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting postponed updates:', error);
      return [];
    }
  }

  private async postponeUpdate(version: string): Promise<void> {
    try {
      const postponed = await this.getPostponedUpdates();
      if (!postponed.includes(version)) {
        postponed.push(version);
        await AsyncStorage.setItem(this.STORAGE_KEYS.POSTPONED_UPDATES, JSON.stringify(postponed));
      }
    } catch (error) {
      console.error('Error postponing update:', error);
    }
  }

  private async getReminderCount(): Promise<number> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.UPDATE_REMINDER_COUNT);
      return stored ? parseInt(stored, 10) : 0;
    } catch (error) {
      console.error('Error getting reminder count:', error);
      return 0;
    }
  }

  private async incrementReminderCount(): Promise<void> {
    try {
      const count = await this.getReminderCount();
      await AsyncStorage.setItem(this.STORAGE_KEYS.UPDATE_REMINDER_COUNT, (count + 1).toString());
    } catch (error) {
      console.error('Error incrementing reminder count:', error);
    }
  }

  /**
   * Reset update preferences (useful for testing or user settings)
   */
  public async resetUpdatePreferences(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        this.STORAGE_KEYS.POSTPONED_UPDATES,
        this.STORAGE_KEYS.UPDATE_REMINDER_COUNT,
      ]);
    } catch (error) {
      console.error('Error resetting update preferences:', error);
    }
  }

  /**
   * Get current app version info
   */
  public getCurrentVersionInfo(): { version: string; buildNumber: string } {
    return {
      version: Constants.expoConfig?.version || '1.0.0',
      buildNumber: Constants.expoConfig?.ios?.buildNumber ||
                   Constants.expoConfig?.android?.versionCode?.toString() || '1',
    };
  }
}

export const appUpdateService = AppUpdateService.getInstance();
export default appUpdateService;