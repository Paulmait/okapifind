/**
 * Feedback Service
 * Collects user feedback and feature requests
 */

import { Alert, Linking, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import * as MailComposer from 'expo-mail-composer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase-client';
import { analytics } from './analytics';

interface FeedbackData {
  type: 'bug' | 'feature' | 'general' | 'compliment';
  rating?: number;
  message: string;
  category?: string;
  metadata?: {
    appVersion?: string;
    platform?: string;
    deviceModel?: string;
    sessionCount?: number;
    isPremium?: boolean;
  };
}

interface FeedbackPrompt {
  id: string;
  triggerAfterSessions: number;
  triggerAfterDays: number;
  lastShown?: Date;
  dismissed?: boolean;
}

class FeedbackService {
  private sessionCount: number = 0;
  private installDate: Date | null = null;
  private lastPromptDate: Date | null = null;
  private feedbackPrompts: FeedbackPrompt[] = [
    {
      id: 'initial_review',
      triggerAfterSessions: 5,
      triggerAfterDays: 3,
    },
    {
      id: 'regular_review',
      triggerAfterSessions: 20,
      triggerAfterDays: 14,
    },
    {
      id: 'power_user_review',
      triggerAfterSessions: 50,
      triggerAfterDays: 30,
    },
  ];

  constructor() {
    this.loadFeedbackState();
  }

  /**
   * Load feedback state from storage
   */
  private async loadFeedbackState() {
    try {
      const [sessionData, installData, promptData] = await Promise.all([
        AsyncStorage.getItem('@feedback_sessions'),
        AsyncStorage.getItem('@install_date'),
        AsyncStorage.getItem('@last_prompt'),
      ]);

      this.sessionCount = sessionData ? parseInt(sessionData, 10) : 0;
      this.installDate = installData ? new Date(installData) : new Date();
      this.lastPromptDate = promptData ? new Date(promptData) : null;

      // Save install date if first time
      if (!installData) {
        await AsyncStorage.setItem('@install_date', this.installDate.toISOString());
      }
    } catch (error) {
      console.error('Failed to load feedback state:', error);
    }
  }

  /**
   * Increment session count and check for feedback prompt
   */
  async incrementSession(): Promise<void> {
    try {
      this.sessionCount++;
      await AsyncStorage.setItem('@feedback_sessions', this.sessionCount.toString());

      // Check if should show feedback prompt
      await this.checkFeedbackPrompt();

      analytics.logEvent('session_incremented', {
        count: this.sessionCount,
      });
    } catch (error) {
      console.error('Failed to increment session:', error);
    }
  }

  /**
   * Check if should show feedback prompt
   */
  private async checkFeedbackPrompt(): Promise<void> {
    if (!this.installDate) return;

    const daysSinceInstall = Math.floor(
      (Date.now() - this.installDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const daysSinceLastPrompt = this.lastPromptDate
      ? Math.floor(
          (Date.now() - this.lastPromptDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      : daysSinceInstall;

    // Don't show if prompted recently (within 7 days)
    if (daysSinceLastPrompt < 7) return;

    // Check each prompt condition
    for (const prompt of this.feedbackPrompts) {
      if (
        this.sessionCount >= prompt.triggerAfterSessions &&
        daysSinceInstall >= prompt.triggerAfterDays
      ) {
        const dismissed = await this.isPromptDismissed(prompt.id);
        if (!dismissed) {
          await this.showRatingPrompt(prompt);
          break;
        }
      }
    }
  }

  /**
   * Check if prompt was dismissed
   */
  private async isPromptDismissed(promptId: string): Promise<boolean> {
    try {
      const dismissed = await AsyncStorage.getItem(`@prompt_dismissed_${promptId}`);
      return dismissed === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Show rating prompt
   */
  private async showRatingPrompt(prompt: FeedbackPrompt): Promise<void> {
    Alert.alert(
      '🌟 Enjoying OkapiFind?',
      'Your feedback helps us improve the app for everyone!',
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: () => this.handlePromptDismiss(prompt.id, 'not_now'),
        },
        {
          text: 'Give Feedback',
          onPress: () => this.showFeedbackOptions(),
        },
        {
          text: 'Rate App ⭐',
          onPress: () => this.requestStoreReview(),
        },
      ]
    );

    this.lastPromptDate = new Date();
    await AsyncStorage.setItem('@last_prompt', this.lastPromptDate.toISOString());

    analytics.logEvent('feedback_prompt_shown', {
      prompt_id: prompt.id,
      session_count: this.sessionCount,
    });
  }

  /**
   * Handle prompt dismissal
   */
  private async handlePromptDismiss(promptId: string, reason: string): Promise<void> {
    if (reason === 'never') {
      await AsyncStorage.setItem(`@prompt_dismissed_${promptId}`, 'true');
    }

    analytics.logEvent('feedback_prompt_dismissed', {
      prompt_id: promptId,
      reason,
    });
  }

  /**
   * Show feedback options
   */
  showFeedbackOptions(): void {
    Alert.alert(
      'How can we help?',
      'Choose the type of feedback you want to share',
      [
        {
          text: '🐛 Report Bug',
          onPress: () => this.collectFeedback('bug'),
        },
        {
          text: '💡 Request Feature',
          onPress: () => this.collectFeedback('feature'),
        },
        {
          text: '💬 General Feedback',
          onPress: () => this.collectFeedback('general'),
        },
        {
          text: '❤️ Send Compliment',
          onPress: () => this.collectFeedback('compliment'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  }

  /**
   * Collect feedback from user
   */
  async collectFeedback(type: FeedbackData['type']): Promise<void> {
    // In production, show a modal with text input
    // For now, open email composer

    const { data: { user } } = await supabase.auth.getUser();
    const { data: settings } = user
      ? await supabase.from('user_settings').select('premium').eq('user_id', user.id).single()
      : { data: null };

    const metadata = {
      appVersion: '1.0.0',
      platform: Platform.OS,
      deviceModel: Platform.OS === 'ios' ? 'iPhone' : 'Android',
      sessionCount: this.sessionCount,
      isPremium: settings?.premium || false,
    };

    if (await MailComposer.isAvailableAsync()) {
      const typeEmojis = {
        bug: '🐛',
        feature: '💡',
        general: '💬',
        compliment: '❤️',
      };

      await MailComposer.composeAsync({
        recipients: ['feedback@okapifind.com'],
        subject: `${typeEmojis[type]} ${type.charAt(0).toUpperCase() + type.slice(1)} Feedback - OkapiFind`,
        body: this.generateEmailTemplate(type, metadata),
      });

      analytics.logEvent('feedback_email_opened', {
        type,
        ...metadata,
      });
    } else {
      // Fallback to mailto link
      const subject = `${type} Feedback - OkapiFind`;
      const body = this.generateEmailTemplate(type, metadata);
      const mailto = `mailto:feedback@okapifind.com?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(body)}`;

      await Linking.openURL(mailto);
    }
  }

  /**
   * Generate email template
   */
  private generateEmailTemplate(
    type: FeedbackData['type'],
    metadata: any
  ): string {
    const templates = {
      bug: `Hi OkapiFind Team,

I found a bug in the app:

[Describe the issue here]

Steps to reproduce:
1.
2.
3.

Expected behavior:


Actual behavior:


`,
      feature: `Hi OkapiFind Team,

I have a feature suggestion:

[Describe your idea here]

How it would help:


`,
      general: `Hi OkapiFind Team,

I wanted to share some feedback:

[Your feedback here]


`,
      compliment: `Hi OkapiFind Team,

I love OkapiFind because:

[Share what you love about the app]


`,
    };

    const debugInfo = `
---
App Version: ${metadata.appVersion}
Platform: ${metadata.platform}
Premium User: ${metadata.isPremium ? 'Yes' : 'No'}
Sessions: ${metadata.sessionCount}
---`;

    return templates[type] + debugInfo;
  }

  /**
   * Request store review
   */
  async requestStoreReview(): Promise<void> {
    try {
      const isAvailable = await StoreReview.isAvailableAsync();

      if (isAvailable) {
        await StoreReview.requestReview();

        analytics.logEvent('store_review_requested', {
          session_count: this.sessionCount,
        });
      } else {
        // Fallback to store URL
        this.openStorePage();
      }
    } catch (error) {
      console.error('Failed to request store review:', error);
      this.openStorePage();
    }
  }

  /**
   * Open store page
   */
  private openStorePage(): void {
    const storeUrl =
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/app/okapifind/id1234567890'
        : 'https://play.google.com/store/apps/details?id=com.okapi.find';

    Linking.openURL(storeUrl);

    analytics.logEvent('store_page_opened', {
      platform: Platform.OS,
    });
  }

  /**
   * Submit feedback to backend
   */
  async submitFeedback(feedback: FeedbackData): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('feedback').insert({
        user_id: user?.id,
        type: feedback.type,
        rating: feedback.rating,
        message: feedback.message,
        category: feedback.category,
        metadata: feedback.metadata,
        platform: Platform.OS,
        app_version: '1.0.0',
      });

      if (error) throw error;

      Alert.alert('Thank You!', 'Your feedback has been submitted successfully.');

      analytics.logEvent('feedback_submitted', {
        type: feedback.type,
        rating: feedback.rating,
        has_message: !!feedback.message,
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    }
  }

  /**
   * Show NPS survey
   */
  async showNPSSurvey(): Promise<void> {
    Alert.alert(
      'Quick Question',
      'How likely are you to recommend OkapiFind to a friend?',
      [
        { text: '0', onPress: () => this.submitNPS(0) },
        { text: '5', onPress: () => this.submitNPS(5) },
        { text: '7', onPress: () => this.submitNPS(7) },
        { text: '9', onPress: () => this.submitNPS(9) },
        { text: '10 ⭐', onPress: () => this.submitNPS(10) },
      ]
    );
  }

  /**
   * Submit NPS score
   */
  private async submitNPS(score: number): Promise<void> {
    analytics.logEvent('nps_score_submitted', {
      score,
      category: score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor',
    });

    if (score >= 9) {
      // Promoter - ask for review
      await this.requestStoreReview();
    } else if (score < 7) {
      // Detractor - ask for feedback
      this.collectFeedback('general');
    }
  }

  /**
   * Report a problem
   */
  async reportProblem(
    problem: string,
    screenshot?: string,
    logs?: string[]
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('bug_reports').insert({
        user_id: user?.id,
        description: problem,
        screenshot_url: screenshot,
        logs: logs,
        platform: Platform.OS,
        app_version: '1.0.0',
        device_info: {
          os_version: Platform.Version,
        },
      });

      if (error) throw error;

      Alert.alert('Report Sent', 'Thank you for reporting this issue. We\'ll look into it.');

      analytics.logEvent('problem_reported', {
        has_screenshot: !!screenshot,
        has_logs: !!logs,
      });
    } catch (error) {
      console.error('Failed to report problem:', error);
      Alert.alert('Error', 'Failed to send report. Please try again.');
    }
  }

  /**
   * Get support
   */
  getSupport(): void {
    Alert.alert(
      'Need Help?',
      'Choose how you\'d like to get support',
      [
        {
          text: '📧 Email Support',
          onPress: () => Linking.openURL('mailto:support@okapifind.com'),
        },
        {
          text: '📚 Help Center',
          onPress: () => Linking.openURL('https://okapifind.com/help'),
        },
        {
          text: '💬 Live Chat',
          onPress: () => Linking.openURL('https://okapifind.com/chat'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );

    analytics.logEvent('support_requested');
  }
}

export const feedbackService = new FeedbackService();
export default feedbackService;