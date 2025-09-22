import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';

interface RatingPromptRecord {
  timestamp: number;
  version: string;
  action: 'prompted' | 'rated' | 'declined' | 'dismissed';
  source: string; // Where the prompt was triggered from
}

interface RatingConfig {
  minUsageDays: number;
  minAppOpens: number;
  minFeatureUsage: number;
  maxPromptsPerYear: number;
  cooldownPeriodDays: number;
  minimumVersionsBeforePrompt: number;
}

interface AppUsageMetrics {
  totalOpens: number;
  firstOpenDate: number;
  lastOpenDate: number;
  featuresUsed: string[];
  crashCount: number;
  version: string;
  consecutiveDaysUsed: number;
  positiveFeedbackCount: number;
}

class RatingService {
  private static instance: RatingService;

  private readonly STORAGE_KEYS = {
    RATING_HISTORY: '@Rating:history',
    APP_USAGE: '@Rating:usage',
    CONFIG: '@Rating:config',
    LAST_PROMPT: '@Rating:lastPrompt',
    USER_OPTED_OUT: '@Rating:optedOut',
  };

  private readonly DEFAULT_CONFIG: RatingConfig = {
    minUsageDays: 7,
    minAppOpens: 15,
    minFeatureUsage: 5,
    maxPromptsPerYear: 3,
    cooldownPeriodDays: 120, // 4 months
    minimumVersionsBeforePrompt: 2,
  };

  private constructor() {}

  public static getInstance(): RatingService {
    if (!RatingService.instance) {
      RatingService.instance = new RatingService();
    }
    return RatingService.instance;
  }

  /**
   * Initialize the rating service
   */
  public async initialize(): Promise<void> {
    try {
      // Track app open
      await this.trackAppOpen();

      console.log('RatingService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize RatingService:', error);
    }
  }

  /**
   * Check if we should show rating prompt and show it if conditions are met
   */
  public async checkAndPromptForRating(source: string = 'automatic'): Promise<boolean> {
    try {
      if (!(await this.shouldShowRatingPrompt())) {
        return false;
      }

      return await this.showRatingPrompt(source);
    } catch (error) {
      console.error('Error checking/prompting for rating:', error);
      return false;
    }
  }

  /**
   * Manually trigger rating prompt (for settings or after positive action)
   */
  public async promptForRating(source: string = 'manual'): Promise<boolean> {
    try {
      // For manual prompts, we're more lenient with conditions
      if (await this.hasUserOptedOut()) {
        return false;
      }

      if (!(await this.isWithinRateLimit())) {
        Alert.alert(
          'Thanks for your interest!',
          'You can rate our app anytime in the App Store. Would you like to go there now?',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Rate Now', onPress: () => this.openAppStore() },
          ]
        );
        return false;
      }

      return await this.showRatingPrompt(source);
    } catch (error) {
      console.error('Error showing manual rating prompt:', error);
      return false;
    }
  }

  /**
   * Track positive user actions that might indicate satisfaction
   */
  public async trackPositiveAction(action: string): Promise<void> {
    try {
      const usage = await this.getAppUsage();
      usage.positiveFeedbackCount = (usage.positiveFeedbackCount || 0) + 1;

      await this.saveAppUsage(usage);

      // If user has been using the app positively, check for rating
      if (usage.positiveFeedbackCount >= 3) {
        setTimeout(() => {
          this.checkAndPromptForRating(`positive_action_${action}`);
        }, 2000); // Delay to not interrupt the user's flow
      }
    } catch (error) {
      console.error('Error tracking positive action:', error);
    }
  }

  /**
   * Track feature usage
   */
  public async trackFeatureUsage(feature: string): Promise<void> {
    try {
      const usage = await this.getAppUsage();

      if (!usage.featuresUsed.includes(feature)) {
        usage.featuresUsed.push(feature);
        await this.saveAppUsage(usage);
      }
    } catch (error) {
      console.error('Error tracking feature usage:', error);
    }
  }

  /**
   * Track app crashes (to avoid prompting after crashes)
   */
  public async trackAppCrash(): Promise<void> {
    try {
      const usage = await this.getAppUsage();
      usage.crashCount = (usage.crashCount || 0) + 1;
      await this.saveAppUsage(usage);
    } catch (error) {
      console.error('Error tracking app crash:', error);
    }
  }

  /**
   * Allow user to opt out of rating prompts
   */
  public async optOutOfRatingPrompts(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.USER_OPTED_OUT, 'true');
      console.log('User opted out of rating prompts');
    } catch (error) {
      console.error('Error opting out of rating prompts:', error);
    }
  }

  /**
   * Get rating statistics for analytics
   */
  public async getRatingStatistics(): Promise<{
    totalPrompts: number;
    ratingGiven: number;
    optedOut: boolean;
    averageDaysBetweenPrompts: number;
  }> {
    try {
      const history = await this.getRatingHistory();
      const optedOut = await this.hasUserOptedOut();

      const totalPrompts = history.filter(r => r.action === 'prompted').length;
      const ratingGiven = history.filter(r => r.action === 'rated').length;

      let averageDaysBetweenPrompts = 0;
      if (totalPrompts > 1) {
        const prompts = history.filter(r => r.action === 'prompted').sort((a, b) => a.timestamp - b.timestamp);
        const intervals = [];
        for (let i = 1; i < prompts.length; i++) {
          intervals.push((prompts[i].timestamp - prompts[i - 1].timestamp) / (1000 * 60 * 60 * 24));
        }
        averageDaysBetweenPrompts = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      }

      return {
        totalPrompts,
        ratingGiven,
        optedOut,
        averageDaysBetweenPrompts,
      };
    } catch (error) {
      console.error('Error getting rating statistics:', error);
      return {
        totalPrompts: 0,
        ratingGiven: 0,
        optedOut: false,
        averageDaysBetweenPrompts: 0,
      };
    }
  }

  /**
   * Private helper methods
   */
  private async shouldShowRatingPrompt(): Promise<boolean> {
    try {
      // Check if user opted out
      if (await this.hasUserOptedOut()) {
        return false;
      }

      // Check if within rate limit
      if (!(await this.isWithinRateLimit())) {
        return false;
      }

      // Check if enough time has passed since last prompt
      if (!(await this.hasEnoughTimePassed())) {
        return false;
      }

      // Check usage criteria
      if (!(await this.meetsUsageCriteria())) {
        return false;
      }

      // Check if app hasn't crashed recently
      if (await this.hasRecentCrashes()) {
        return false;
      }

      // Check if store review is available
      if (!(await StoreReview.isAvailableAsync())) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking if should show rating prompt:', error);
      return false;
    }
  }

  private async showRatingPrompt(source: string): Promise<boolean> {
    try {
      // Record that we're about to prompt
      await this.recordRatingAction('prompted', source);

      // For iOS, we use the native in-app review prompt
      // For Android or if native is not available, we show a custom dialog
      if (Platform.OS === 'ios' && await StoreReview.isAvailableAsync()) {
        await StoreReview.requestReview();
        // We can't know the user's actual response with native iOS prompt
        // So we just record that we prompted
        return true;
      } else {
        // Custom dialog for Android or fallback
        return new Promise((resolve) => {
          Alert.alert(
            'Enjoying OkapiFind?',
            'Your feedback helps us improve the app. Would you mind taking a moment to rate us?',
            [
              {
                text: 'Not Now',
                onPress: () => {
                  this.recordRatingAction('dismissed', source);
                  resolve(false);
                },
                style: 'cancel',
              },
              {
                text: "Don't Ask Again",
                onPress: () => {
                  this.recordRatingAction('declined', source);
                  this.optOutOfRatingPrompts();
                  resolve(false);
                },
                style: 'destructive',
              },
              {
                text: 'Rate App',
                onPress: () => {
                  this.recordRatingAction('rated', source);
                  this.openAppStore();
                  resolve(true);
                },
              },
            ]
          );
        });
      }
    } catch (error) {
      console.error('Error showing rating prompt:', error);
      return false;
    }
  }

  private async openAppStore(): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        // Replace with your actual App Store ID
        const appStoreUrl = 'https://apps.apple.com/app/id1234567890?action=write-review';
        await Linking.openURL(appStoreUrl);
      } else {
        // Replace with your actual package name
        const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.yourcompany.okapifind&showAllReviews=true';
        await Linking.openURL(playStoreUrl);
      }
    } catch (error) {
      console.error('Error opening app store:', error);
      Alert.alert('Error', 'Unable to open app store. Please try again later.');
    }
  }

  private async trackAppOpen(): Promise<void> {
    try {
      const usage = await this.getAppUsage();
      const now = Date.now();

      usage.totalOpens++;
      usage.lastOpenDate = now;

      if (!usage.firstOpenDate) {
        usage.firstOpenDate = now;
      }

      // Track consecutive days used
      const lastOpenDay = Math.floor(usage.lastOpenDate / (1000 * 60 * 60 * 24));
      const todayDay = Math.floor(now / (1000 * 60 * 60 * 24));

      if (todayDay === lastOpenDay + 1) {
        usage.consecutiveDaysUsed++;
      } else if (todayDay !== lastOpenDay) {
        usage.consecutiveDaysUsed = 1;
      }

      await this.saveAppUsage(usage);
    } catch (error) {
      console.error('Error tracking app open:', error);
    }
  }

  private async hasUserOptedOut(): Promise<boolean> {
    try {
      const optedOut = await AsyncStorage.getItem(this.STORAGE_KEYS.USER_OPTED_OUT);
      return optedOut === 'true';
    } catch (error) {
      console.error('Error checking if user opted out:', error);
      return false;
    }
  }

  private async isWithinRateLimit(): Promise<boolean> {
    try {
      const config = await this.getConfig();
      const history = await this.getRatingHistory();

      const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
      const promptsThisYear = history.filter(
        r => r.action === 'prompted' && r.timestamp > oneYearAgo
      ).length;

      return promptsThisYear < config.maxPromptsPerYear;
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return false;
    }
  }

  private async hasEnoughTimePassed(): Promise<boolean> {
    try {
      const config = await this.getConfig();
      const lastPrompt = await AsyncStorage.getItem(this.STORAGE_KEYS.LAST_PROMPT);

      if (!lastPrompt) {
        return true;
      }

      const lastPromptTime = parseInt(lastPrompt, 10);
      const cooldownPeriod = config.cooldownPeriodDays * 24 * 60 * 60 * 1000;

      return (Date.now() - lastPromptTime) > cooldownPeriod;
    } catch (error) {
      console.error('Error checking if enough time passed:', error);
      return false;
    }
  }

  private async meetsUsageCriteria(): Promise<boolean> {
    try {
      const config = await this.getConfig();
      const usage = await this.getAppUsage();

      // Check minimum usage days
      const usageDays = Math.floor(
        (Date.now() - usage.firstOpenDate) / (1000 * 60 * 60 * 24)
      );

      if (usageDays < config.minUsageDays) {
        return false;
      }

      // Check minimum app opens
      if (usage.totalOpens < config.minAppOpens) {
        return false;
      }

      // Check minimum features used
      if (usage.featuresUsed.length < config.minFeatureUsage) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking usage criteria:', error);
      return false;
    }
  }

  private async hasRecentCrashes(): Promise<boolean> {
    try {
      const usage = await this.getAppUsage();
      const recentCrashThreshold = 3; // Don't prompt if more than 3 crashes

      return (usage.crashCount || 0) > recentCrashThreshold;
    } catch (error) {
      console.error('Error checking recent crashes:', error);
      return false;
    }
  }

  private async recordRatingAction(action: RatingPromptRecord['action'], source: string): Promise<void> {
    try {
      const history = await this.getRatingHistory();
      const usage = await this.getAppUsage();

      const record: RatingPromptRecord = {
        timestamp: Date.now(),
        version: usage.version,
        action,
        source,
      };

      history.push(record);

      // Keep only last 50 records to prevent storage bloat
      const trimmedHistory = history.slice(-50);

      await AsyncStorage.setItem(this.STORAGE_KEYS.RATING_HISTORY, JSON.stringify(trimmedHistory));

      if (action === 'prompted') {
        await AsyncStorage.setItem(this.STORAGE_KEYS.LAST_PROMPT, Date.now().toString());
      }
    } catch (error) {
      console.error('Error recording rating action:', error);
    }
  }

  private async getAppUsage(): Promise<AppUsageMetrics> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.APP_USAGE);
      const defaultUsage: AppUsageMetrics = {
        totalOpens: 0,
        firstOpenDate: Date.now(),
        lastOpenDate: Date.now(),
        featuresUsed: [],
        crashCount: 0,
        version: '1.0.0',
        consecutiveDaysUsed: 1,
        positiveFeedbackCount: 0,
      };

      return stored ? { ...defaultUsage, ...JSON.parse(stored) } : defaultUsage;
    } catch (error) {
      console.error('Error getting app usage:', error);
      return {
        totalOpens: 0,
        firstOpenDate: Date.now(),
        lastOpenDate: Date.now(),
        featuresUsed: [],
        crashCount: 0,
        version: '1.0.0',
        consecutiveDaysUsed: 1,
        positiveFeedbackCount: 0,
      };
    }
  }

  private async saveAppUsage(usage: AppUsageMetrics): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.APP_USAGE, JSON.stringify(usage));
    } catch (error) {
      console.error('Error saving app usage:', error);
    }
  }

  private async getRatingHistory(): Promise<RatingPromptRecord[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.RATING_HISTORY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting rating history:', error);
      return [];
    }
  }

  private async getConfig(): Promise<RatingConfig> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.CONFIG);
      return stored ? { ...this.DEFAULT_CONFIG, ...JSON.parse(stored) } : this.DEFAULT_CONFIG;
    } catch (error) {
      console.error('Error getting config:', error);
      return this.DEFAULT_CONFIG;
    }
  }

  /**
   * Update rating configuration
   */
  public async updateConfig(config: Partial<RatingConfig>): Promise<void> {
    try {
      const currentConfig = await this.getConfig();
      const updatedConfig = { ...currentConfig, ...config };
      await AsyncStorage.setItem(this.STORAGE_KEYS.CONFIG, JSON.stringify(updatedConfig));
    } catch (error) {
      console.error('Error updating config:', error);
    }
  }
}

export const ratingService = RatingService.getInstance();
export default ratingService;