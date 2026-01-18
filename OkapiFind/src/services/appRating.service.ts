/**
 * App Rating & Review Service
 * CRITICAL: Boost ASO (App Store Optimization) with strategic rating prompts
 * Target: 4.5+ star rating, 1000+ reviews for top rankings
 */

import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { analytics } from './analytics';

interface RatingConfig {
  minSessionsBeforePrompt: number;
  minDaysSinceInstall: number;
  daysBetweenPrompts: number;
  minPositiveActionsRequired: number;
}

interface RatingData {
  promptCount: number;
  lastPromptDate: string | null;
  installDate: string;
  sessionCount: number;
  positiveActions: number;
  hasRated: boolean;
  declinedCount: number;
}

class AppRatingService {
  private readonly STORAGE_KEY = 'app_rating_data';

  private config: RatingConfig = {
    minSessionsBeforePrompt: 5,
    minDaysSinceInstall: 3,
    daysBetweenPrompts: 30,
    minPositiveActionsRequired: 3,
  };

  private positiveActionTypes = [
    'parking_saved',
    'navigation_completed',
    'car_found_successfully',
    'subscription_purchased',
    'referral_completed',
  ];

  /**
   * Initialize rating service
   */
  async initialize(): Promise<void> {
    try {
      const data = await this.getRatingData();

      if (!data.installDate) {
        await this.saveRatingData({
          ...data,
          installDate: new Date().toISOString(),
        });
      }

      console.log('App rating service initialized');
    } catch (error) {
      console.error('Error initializing app rating service:', error);
    }
  }

  /**
   * Increment session count
   */
  async incrementSession(): Promise<void> {
    try {
      const data = await this.getRatingData();
      await this.saveRatingData({
        ...data,
        sessionCount: data.sessionCount + 1,
      });
    } catch (error) {
      console.error('Error incrementing session:', error);
    }
  }

  /**
   * Track positive action
   */
  async trackPositiveAction(actionType: string): Promise<void> {
    try {
      if (!this.positiveActionTypes.includes(actionType)) {
        return;
      }

      const data = await this.getRatingData();
      await this.saveRatingData({
        ...data,
        positiveActions: data.positiveActions + 1,
      });

      analytics.logEvent('positive_action_tracked', {
        action_type: actionType,
        total_positive_actions: data.positiveActions + 1,
      });

      // Check if we should prompt
      await this.checkAndPromptIfEligible();
    } catch (error) {
      console.error('Error tracking positive action:', error);
    }
  }

  /**
   * Check if user is eligible for rating prompt
   */
  async isEligibleForPrompt(): Promise<boolean> {
    try {
      const data = await this.getRatingData();

      // Already rated
      if (data.hasRated) {
        return false;
      }

      // Too many declines
      if (data.declinedCount >= 3) {
        return false;
      }

      // Check if store review is available
      const available = await StoreReview.hasAction();
      if (!available) {
        return false;
      }

      // Check minimum sessions
      if (data.sessionCount < this.config.minSessionsBeforePrompt) {
        return false;
      }

      // Check minimum days since install
      const daysSinceInstall = this.getDaysSince(new Date(data.installDate));
      if (daysSinceInstall < this.config.minDaysSinceInstall) {
        return false;
      }

      // Check days since last prompt
      if (data.lastPromptDate) {
        const daysSinceLastPrompt = this.getDaysSince(new Date(data.lastPromptDate));
        if (daysSinceLastPrompt < this.config.daysBetweenPrompts) {
          return false;
        }
      }

      // Check positive actions
      if (data.positiveActions < this.config.minPositiveActionsRequired) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking eligibility:', error);
      return false;
    }
  }

  /**
   * Check eligibility and prompt if ready
   */
  private async checkAndPromptIfEligible(): Promise<void> {
    const eligible = await this.isEligibleForPrompt();

    if (eligible) {
      await this.promptForRating();
    }
  }

  /**
   * Prompt user for rating
   */
  async promptForRating(): Promise<void> {
    try {
      const eligible = await this.isEligibleForPrompt();

      if (!eligible) {
        console.log('Not eligible for rating prompt');
        return;
      }

      const data = await this.getRatingData();

      // Update prompt data
      await this.saveRatingData({
        ...data,
        promptCount: data.promptCount + 1,
        lastPromptDate: new Date().toISOString(),
      });

      // Request store review
      await StoreReview.requestReview();

      analytics.logEvent('rating_prompt_shown', {
        session_count: data.sessionCount,
        positive_actions: data.positiveActions,
        prompt_number: data.promptCount + 1,
      });

      // Assume they rated (we can't detect this directly)
      // Wait 2 seconds and mark as rated
      setTimeout(async () => {
        const updatedData = await this.getRatingData();
        await this.saveRatingData({
          ...updatedData,
          hasRated: true,
        });
      }, 2000);
    } catch (error) {
      console.error('Error prompting for rating:', error);

      analytics.logEvent('rating_prompt_error', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * User declined to rate
   */
  async userDeclined(): Promise<void> {
    try {
      const data = await this.getRatingData();
      await this.saveRatingData({
        ...data,
        declinedCount: data.declinedCount + 1,
        lastPromptDate: new Date().toISOString(),
      });

      analytics.logEvent('rating_prompt_declined', {
        decline_count: data.declinedCount + 1,
      });
    } catch (error) {
      console.error('Error recording decline:', error);
    }
  }

  /**
   * User agreed to rate (show store page)
   */
  async userAgreedToRate(): Promise<void> {
    try {
      const data = await this.getRatingData();
      await this.saveRatingData({
        ...data,
        hasRated: true,
      });

      // Open store page
      if (Platform.OS === 'ios') {
        await StoreReview.requestReview();
      } else {
        // For Android, open Play Store
        const url = 'market://details?id=com.okapi.find';
        // Linking.openURL(url);
      }

      analytics.logEvent('user_agreed_to_rate', {
        platform: Platform.OS,
      });
    } catch (error) {
      console.error('Error opening store:', error);
    }
  }

  /**
   * Get rating data from storage
   */
  private async getRatingData(): Promise<RatingData> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEY);

      if (!data) {
        return this.getDefaultRatingData();
      }

      return JSON.parse(data);
    } catch (error) {
      console.error('Error getting rating data:', error);
      return this.getDefaultRatingData();
    }
  }

  /**
   * Save rating data to storage
   */
  private async saveRatingData(data: RatingData): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving rating data:', error);
    }
  }

  /**
   * Get default rating data
   */
  private getDefaultRatingData(): RatingData {
    return {
      promptCount: 0,
      lastPromptDate: null,
      installDate: new Date().toISOString(),
      sessionCount: 0,
      positiveActions: 0,
      hasRated: false,
      declinedCount: 0,
    };
  }

  /**
   * Get days since a date
   */
  private getDaysSince(date: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Get rating statistics
   */
  async getStats(): Promise<RatingData> {
    return await this.getRatingData();
  }

  /**
   * Reset rating data (for testing)
   */
  async reset(): Promise<void> {
    await this.saveRatingData(this.getDefaultRatingData());
  }

  /**
   * Check if store review is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      return await StoreReview.hasAction();
    } catch (error) {
      console.error('Error checking store review availability:', error);
      return false;
    }
  }

  /**
   * Get store URL
   */
  getStoreUrl(): string {
    if (Platform.OS === 'ios') {
      return 'https://apps.apple.com/app/okapifind/id6756395219';
    } else {
      return 'https://play.google.com/store/apps/details?id=com.okapi.find';
    }
  }

  /**
   * Configure rating service
   */
  configure(config: Partial<RatingConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Force show rating prompt (for testing)
   */
  async forcePrompt(): Promise<void> {
    try {
      await StoreReview.requestReview();
      analytics.logEvent('rating_prompt_forced');
    } catch (error) {
      console.error('Error forcing rating prompt:', error);
    }
  }
}

// Export singleton instance
export const appRatingService = new AppRatingService();

// Export positive action types
export const PositiveActions = {
  PARKING_SAVED: 'parking_saved',
  NAVIGATION_COMPLETED: 'navigation_completed',
  CAR_FOUND: 'car_found_successfully',
  SUBSCRIPTION_PURCHASED: 'subscription_purchased',
  REFERRAL_COMPLETED: 'referral_completed',
} as const;

export default appRatingService;