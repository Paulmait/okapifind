import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { analytics, AnalyticsEvent } from './analytics';

export interface ReviewPromptConfig {
  minimumParkingSaves: number;
  daysSinceFirstUse: number;
  daysBetweenPrompts: number;
  maxPromptsPerYear: number;
}

export interface ReviewPromptState {
  parkingSaveCount: number;
  firstUseDate: string | null;
  lastPromptDate: string | null;
  promptCount: number;
  hasReviewed: boolean;
  userDeclinedReview: boolean;
}

/**
 * Smart App Store review prompt service
 * Triggers review prompt after user has saved 3+ parking spots
 * Following Apple's best practices for review prompts
 */
class ReviewPromptService {
  private static readonly STORAGE_KEY = 'reviewPromptState';
  private static readonly DEFAULT_CONFIG: ReviewPromptConfig = {
    minimumParkingSaves: 3,
    daysSinceFirstUse: 7, // Wait at least a week
    daysBetweenPrompts: 120, // 4 months between prompts
    maxPromptsPerYear: 3,
  };

  private config: ReviewPromptConfig;
  private state: ReviewPromptState;

  constructor(config: Partial<ReviewPromptConfig> = {}) {
    this.config = { ...ReviewPromptService.DEFAULT_CONFIG, ...config };
    this.state = {
      parkingSaveCount: 0,
      firstUseDate: null,
      lastPromptDate: null,
      promptCount: 0,
      hasReviewed: false,
      userDeclinedReview: false,
    };
  }

  /**
   * Initialize the service and load existing state
   */
  async initialize(): Promise<void> {
    try {
      const savedState = await AsyncStorage.getItem(ReviewPromptService.STORAGE_KEY);
      if (savedState) {
        this.state = { ...this.state, ...JSON.parse(savedState) };
      } else {
        // First time user - set first use date
        this.state.firstUseDate = new Date().toISOString();
        await this.saveState();
      }

      analytics.logEvent('review_prompt_service_initialized', {
        parking_save_count: this.state.parkingSaveCount,
        has_reviewed: this.state.hasReviewed,
        prompt_count: this.state.promptCount,
      });
    } catch (error) {
      console.error('[ReviewPromptService] Failed to initialize:', error);
      analytics.logEvent('review_prompt_service_init_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Increment parking save count and check if review prompt should be shown
   */
  async onParkingSaved(): Promise<void> {
    try {
      this.state.parkingSaveCount++;
      await this.saveState();

      analytics.logEvent('parking_saved_for_review', {
        total_saves: this.state.parkingSaveCount,
        minimum_required: this.config.minimumParkingSaves,
      });

      // Check if we should prompt for review
      if (await this.shouldPromptForReview()) {
        await this.promptForReview();
      }
    } catch (error) {
      console.error('[ReviewPromptService] Error handling parking save:', error);
      analytics.logEvent('review_prompt_parking_save_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Check if conditions are met to show review prompt
   */
  async shouldPromptForReview(): Promise<boolean> {
    try {
      // Don't prompt if user already reviewed or declined
      if (this.state.hasReviewed || this.state.userDeclinedReview) {
        return false;
      }

      // Check if minimum parking saves reached
      if (this.state.parkingSaveCount < this.config.minimumParkingSaves) {
        return false;
      }

      // Check if enough time has passed since first use
      if (this.state.firstUseDate) {
        const daysSinceFirstUse = this.getDaysBetweenDates(
          new Date(this.state.firstUseDate),
          new Date()
        );
        if (daysSinceFirstUse < this.config.daysSinceFirstUse) {
          return false;
        }
      }

      // Check if enough time has passed since last prompt
      if (this.state.lastPromptDate) {
        const daysSinceLastPrompt = this.getDaysBetweenDates(
          new Date(this.state.lastPromptDate),
          new Date()
        );
        if (daysSinceLastPrompt < this.config.daysBetweenPrompts) {
          return false;
        }
      }

      // Check annual prompt limit
      const currentYear = new Date().getFullYear();
      const lastPromptYear = this.state.lastPromptDate
        ? new Date(this.state.lastPromptDate).getFullYear()
        : 0;

      if (currentYear === lastPromptYear && this.state.promptCount >= this.config.maxPromptsPerYear) {
        return false;
      }

      // Check if store review is available on this platform
      const isAvailable = await StoreReview.isAvailableAsync();
      if (!isAvailable) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ReviewPromptService] Error checking review conditions:', error);
      analytics.logEvent('review_prompt_check_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Show the native review prompt
   */
  async promptForReview(): Promise<void> {
    try {
      analytics.logEvent(AnalyticsEvent.APP_OPENED, {
        action: 'review_prompt_triggered',
        parking_saves: this.state.parkingSaveCount,
        days_since_first_use: this.state.firstUseDate
          ? this.getDaysBetweenDates(new Date(this.state.firstUseDate), new Date())
          : 0,
      });

      // Show native review prompt
      await StoreReview.requestReview();

      // Update state
      this.state.lastPromptDate = new Date().toISOString();
      this.state.promptCount++;
      await this.saveState();

      analytics.logEvent('review_prompt_shown', {
        prompt_count: this.state.promptCount,
        parking_saves: this.state.parkingSaveCount,
        platform: Platform.OS,
      });
    } catch (error) {
      console.error('[ReviewPromptService] Error showing review prompt:', error);
      analytics.logEvent('review_prompt_show_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Mark that user has reviewed the app (call this after successful purchase)
   */
  async markAsReviewed(): Promise<void> {
    try {
      this.state.hasReviewed = true;
      await this.saveState();

      analytics.logEvent('review_marked_as_completed', {
        parking_saves: this.state.parkingSaveCount,
        prompt_count: this.state.promptCount,
      });
    } catch (error) {
      console.error('[ReviewPromptService] Error marking as reviewed:', error);
    }
  }

  /**
   * Mark that user declined to review (call this if they express they don't want to review)
   */
  async markAsDeclined(): Promise<void> {
    try {
      this.state.userDeclinedReview = true;
      await this.saveState();

      analytics.logEvent('review_marked_as_declined', {
        parking_saves: this.state.parkingSaveCount,
        prompt_count: this.state.promptCount,
      });
    } catch (error) {
      console.error('[ReviewPromptService] Error marking as declined:', error);
    }
  }

  /**
   * Reset review prompt state (for testing or user data reset)
   */
  async resetState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ReviewPromptService.STORAGE_KEY);
      this.state = {
        parkingSaveCount: 0,
        firstUseDate: new Date().toISOString(),
        lastPromptDate: null,
        promptCount: 0,
        hasReviewed: false,
        userDeclinedReview: false,
      };

      analytics.logEvent('review_prompt_state_reset');
    } catch (error) {
      console.error('[ReviewPromptService] Error resetting state:', error);
    }
  }

  /**
   * Get current state for debugging/analytics
   */
  getState(): ReviewPromptState {
    return { ...this.state };
  }

  /**
   * Get current configuration
   */
  getConfig(): ReviewPromptConfig {
    return { ...this.config };
  }

  /**
   * Save current state to AsyncStorage
   */
  private async saveState(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        ReviewPromptService.STORAGE_KEY,
        JSON.stringify(this.state)
      );
    } catch (error) {
      console.error('[ReviewPromptService] Failed to save state:', error);
      throw error;
    }
  }

  /**
   * Calculate days between two dates
   */
  private getDaysBetweenDates(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if we can show store review on current platform
   */
  async canShowReview(): Promise<boolean> {
    try {
      return await StoreReview.isAvailableAsync();
    } catch (error) {
      console.error('[ReviewPromptService] Error checking review availability:', error);
      return false;
    }
  }

  /**
   * Check if user has reviewed in current app version
   * (iOS only - Android doesn't support this)
   */
  async hasUserReviewedInCurrentVersion(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        return await StoreReview.hasUserReviewedAsync();
      }
      return false;
    } catch (error) {
      console.error('[ReviewPromptService] Error checking review status:', error);
      return false;
    }
  }
}

// Export singleton instance
export const reviewPromptService = new ReviewPromptService();

// Export class for custom configurations
export { ReviewPromptService };