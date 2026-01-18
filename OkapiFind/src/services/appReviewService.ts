/**
 * App Review Service
 * Smart prompting for App Store / Play Store reviews
 * Follows Apple and Google best practices for review timing
 */

import { Platform, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

// Types
interface ReviewState {
  successfulNavigations: number;
  lastReviewPrompt: string | null;
  hasReviewed: boolean;
  promptCount: number;
  firstUseDate: string;
  lastSessionDate: string;
  sessionCount: number;
}

// Constants
const STORAGE_KEY = '@okapifind/review_state';
const MIN_NAVIGATIONS_BEFORE_PROMPT = 3;
const MIN_SESSIONS_BEFORE_PROMPT = 3;
const MIN_DAYS_SINCE_FIRST_USE = 3;
const MIN_DAYS_BETWEEN_PROMPTS = 60;
const MAX_PROMPT_COUNT = 3;

class AppReviewService {
  private static instance: AppReviewService;
  private state: ReviewState = {
    successfulNavigations: 0,
    lastReviewPrompt: null,
    hasReviewed: false,
    promptCount: 0,
    firstUseDate: new Date().toISOString(),
    lastSessionDate: new Date().toISOString(),
    sessionCount: 1,
  };
  private isInitialized = false;

  private constructor() {}

  static getInstance(): AppReviewService {
    if (!AppReviewService.instance) {
      AppReviewService.instance = new AppReviewService();
    }
    return AppReviewService.instance;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.state = JSON.parse(stored);
      } else {
        // First time user
        this.state.firstUseDate = new Date().toISOString();
      }

      // Track new session
      await this.trackSession();

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize review service:', error);
    }
  }

  /**
   * Track a new app session
   */
  private async trackSession(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const lastSession = this.state.lastSessionDate?.split('T')[0];

    if (today !== lastSession) {
      this.state.sessionCount++;
      this.state.lastSessionDate = new Date().toISOString();
      await this.saveState();
    }
  }

  /**
   * Track a successful navigation to car
   * This is the key "positive moment" to trigger review
   */
  async trackSuccessfulNavigation(): Promise<void> {
    await this.initialize();

    this.state.successfulNavigations++;
    await this.saveState();

    // Check if we should prompt for review
    if (this.shouldPromptForReview()) {
      await this.promptForReview();
    }
  }

  /**
   * Check if conditions are met for review prompt
   */
  private shouldPromptForReview(): boolean {
    // Already reviewed - don't prompt again
    if (this.state.hasReviewed) {
      return false;
    }

    // Max prompts reached
    if (this.state.promptCount >= MAX_PROMPT_COUNT) {
      return false;
    }

    // Not enough successful navigations
    if (this.state.successfulNavigations < MIN_NAVIGATIONS_BEFORE_PROMPT) {
      return false;
    }

    // Not enough sessions
    if (this.state.sessionCount < MIN_SESSIONS_BEFORE_PROMPT) {
      return false;
    }

    // Not enough days since first use
    const daysSinceFirstUse = this.daysSince(this.state.firstUseDate);
    if (daysSinceFirstUse < MIN_DAYS_SINCE_FIRST_USE) {
      return false;
    }

    // Not enough days since last prompt
    if (this.state.lastReviewPrompt) {
      const daysSinceLastPrompt = this.daysSince(this.state.lastReviewPrompt);
      if (daysSinceLastPrompt < MIN_DAYS_BETWEEN_PROMPTS) {
        return false;
      }
    }

    return true;
  }

  /**
   * Prompt user for review
   */
  async promptForReview(): Promise<void> {
    try {
      // Check if native review is available
      const isAvailable = await StoreReview.isAvailableAsync();

      if (isAvailable) {
        // Use native review dialog (iOS/Android)
        await StoreReview.requestReview();
      } else {
        // Fallback: Show custom prompt
        await this.showCustomPrompt();
      }

      // Update state
      this.state.promptCount++;
      this.state.lastReviewPrompt = new Date().toISOString();
      await this.saveState();
    } catch (error) {
      console.error('Failed to prompt for review:', error);
    }
  }

  /**
   * Show custom review prompt with buttons
   */
  private async showCustomPrompt(): Promise<void> {
    return new Promise((resolve) => {
      Alert.alert(
        'Enjoying OkapiFind?',
        "You've successfully found your car multiple times! Would you take a moment to rate us?",
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => resolve(),
          },
          {
            text: 'Never Ask Again',
            style: 'destructive',
            onPress: async () => {
              this.state.hasReviewed = true;
              await this.saveState();
              resolve();
            },
          },
          {
            text: 'Rate App',
            onPress: async () => {
              await this.openStoreReview();
              this.state.hasReviewed = true;
              await this.saveState();
              resolve();
            },
          },
        ],
        { cancelable: true }
      );
    });
  }

  /**
   * Open store page for review
   */
  async openStoreReview(): Promise<void> {
    try {
      // First try native store review
      const canUseNative = await StoreReview.hasAction();
      if (canUseNative) {
        await StoreReview.requestReview();
        return;
      }

      // Fallback to store URL
      const storeUrl = Platform.select({
        ios: 'https://apps.apple.com/app/okapifind/id6756395219',
        android: 'https://play.google.com/store/apps/details?id=com.okapi.find',
        default: 'https://okapifind.com',
      });

      const canOpen = await Linking.canOpenURL(storeUrl);
      if (canOpen) {
        await Linking.openURL(storeUrl);
      }
    } catch (error) {
      console.error('Failed to open store review:', error);
    }
  }

  /**
   * Mark as reviewed (user clicked review button)
   */
  async markAsReviewed(): Promise<void> {
    await this.initialize();
    this.state.hasReviewed = true;
    await this.saveState();
  }

  /**
   * Reset review state (for testing)
   */
  async resetState(): Promise<void> {
    this.state = {
      successfulNavigations: 0,
      lastReviewPrompt: null,
      hasReviewed: false,
      promptCount: 0,
      firstUseDate: new Date().toISOString(),
      lastSessionDate: new Date().toISOString(),
      sessionCount: 1,
    };
    await this.saveState();
  }

  /**
   * Get current review state (for debugging)
   */
  getState(): ReviewState {
    return { ...this.state };
  }

  // Private helpers

  private daysSince(dateString: string): number {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  private async saveState(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Silently fail
    }
  }
}

export const appReviewService = AppReviewService.getInstance();
export default appReviewService;
