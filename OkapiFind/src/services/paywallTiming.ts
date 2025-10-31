/**
 * Paywall Timing Service
 * Smart paywall display timing for 3x better conversion
 * Shows paywall after user sees value (3 successful saves)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { analytics } from './analytics';
import { supabase } from '../lib/supabase-client';

export interface PaywallTrigger {
  trigger_type:
    | 'save_milestone' // After 3 successful saves
    | 'feature_locked' // User tries premium feature
    | 'value_demonstrated' // User used app 5+ times
    | 'success_moment' // User found their car successfully
    | 'time_based' // After X days of usage
    | 'manual'; // Manual trigger
  message: string;
  title: string;
  benefits: string[];
  cta: string;
  urgency?: string; // Optional urgency message
}

export interface PaywallState {
  should_show: boolean;
  trigger?: PaywallTrigger;
  cooldown_until?: string; // ISO timestamp
  times_shown: number;
  last_shown_at?: string;
}

const STORAGE_KEYS = {
  SAVES_COUNT: '@okapifind:saves_count',
  APP_OPENS: '@okapifind:app_opens',
  SUCCESSFUL_FINDS: '@okapifind:successful_finds',
  PAYWALL_STATE: '@okapifind:paywall_state',
  FIRST_INSTALL: '@okapifind:first_install',
};

const COOLDOWN_HOURS = 24; // Don't show paywall more than once per day
const MAX_SHOWS_PER_WEEK = 2; // Max 2 times per week

class PaywallTimingService {
  /**
   * Check if paywall should be shown
   */
  async shouldShowPaywall(): Promise<PaywallState> {
    try {
      // Check if user is already premium
      const isPremium = await this.isPremiumUser();
      if (isPremium) {
        return { should_show: false, times_shown: 0 };
      }

      // Check cooldown
      const paywallState = await this.getPaywallState();
      if (paywallState.cooldown_until) {
        const cooldownEnd = new Date(paywallState.cooldown_until);
        if (new Date() < cooldownEnd) {
          return { ...paywallState, should_show: false };
        }
      }

      // Check weekly limit
      if (paywallState.times_shown >= MAX_SHOWS_PER_WEEK) {
        return { ...paywallState, should_show: false };
      }

      // Check triggers
      const trigger = await this.checkTriggers();
      if (trigger) {
        return {
          should_show: true,
          trigger,
          times_shown: paywallState.times_shown,
          last_shown_at: paywallState.last_shown_at,
        };
      }

      return { should_show: false, times_shown: paywallState.times_shown };
    } catch (error) {
      console.error('[PaywallTiming] Error checking paywall:', error);
      return { should_show: false, times_shown: 0 };
    }
  }

  /**
   * Record paywall shown
   */
  async recordPaywallShown(trigger: PaywallTrigger): Promise<void> {
    try {
      const state = await this.getPaywallState();

      const newState: PaywallState = {
        should_show: false,
        trigger,
        cooldown_until: new Date(Date.now() + COOLDOWN_HOURS * 60 * 60 * 1000).toISOString(),
        times_shown: state.times_shown + 1,
        last_shown_at: new Date().toISOString(),
      };

      await AsyncStorage.setItem(STORAGE_KEYS.PAYWALL_STATE, JSON.stringify(newState));

      analytics.logEvent('paywall_shown', {
        trigger_type: trigger.trigger_type,
        times_shown: newState.times_shown,
      });
    } catch (error) {
      console.error('[PaywallTiming] Error recording paywall:', error);
    }
  }

  /**
   * Record successful save (for milestone tracking)
   */
  async recordSuccessfulSave(): Promise<void> {
    try {
      const countStr = await AsyncStorage.getItem(STORAGE_KEYS.SAVES_COUNT);
      const count = countStr ? parseInt(countStr, 10) : 0;
      await AsyncStorage.setItem(STORAGE_KEYS.SAVES_COUNT, (count + 1).toString());

      analytics.logEvent('save_milestone_progress', {
        saves_count: count + 1,
      });
    } catch (error) {
      console.error('[PaywallTiming] Error recording save:', error);
    }
  }

  /**
   * Record app open (for value demonstration tracking)
   */
  async recordAppOpen(): Promise<void> {
    try {
      const countStr = await AsyncStorage.getItem(STORAGE_KEYS.APP_OPENS);
      const count = countStr ? parseInt(countStr, 10) : 0;
      await AsyncStorage.setItem(STORAGE_KEYS.APP_OPENS, (count + 1).toString());

      // Record first install date
      const firstInstall = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_INSTALL);
      if (!firstInstall) {
        await AsyncStorage.setItem(STORAGE_KEYS.FIRST_INSTALL, new Date().toISOString());
      }
    } catch (error) {
      console.error('[PaywallTiming] Error recording app open:', error);
    }
  }

  /**
   * Record successful car find (success moment)
   */
  async recordSuccessfulFind(): Promise<void> {
    try {
      const countStr = await AsyncStorage.getItem(STORAGE_KEYS.SUCCESSFUL_FINDS);
      const count = countStr ? parseInt(countStr, 10) : 0;
      await AsyncStorage.setItem(STORAGE_KEYS.SUCCESSFUL_FINDS, (count + 1).toString());

      analytics.logEvent('find_milestone_progress', {
        finds_count: count + 1,
      });
    } catch (error) {
      console.error('[PaywallTiming] Error recording find:', error);
    }
  }

  /**
   * Get trigger for locked premium feature
   */
  getFeatureLockedTrigger(featureName: string): PaywallTrigger {
    return {
      trigger_type: 'feature_locked',
      title: 'Premium Feature',
      message: `${featureName} is a premium feature. Upgrade to unlock!`,
      benefits: [
        'AR Navigation to your car',
        'Parking spot number detection',
        'Visual breadcrumbs (photos)',
        'Unlimited parking history',
        'Priority support',
      ],
      cta: 'Unlock Premium Features',
    };
  }

  /**
   * Check all triggers
   */
  private async checkTriggers(): Promise<PaywallTrigger | null> {
    // 1. Save milestone (highest priority - user sees value)
    const savesCount = await this.getSavesCount();
    if (savesCount === 3) {
      return {
        trigger_type: 'save_milestone',
        title: "You're getting good at this!",
        message: "You've saved your parking location 3 times. Ready for premium features?",
        benefits: [
          '6x better location accuracy',
          'AR navigation to your car',
          'Photo landmarks & spot numbers',
          'Never lose your car again',
        ],
        cta: 'Upgrade to Premium',
        urgency: 'Limited time: 50% off for early users',
      };
    }

    // 2. Success moment (user found their car)
    const findsCount = await this.getFindsCount();
    if (findsCount === 2) {
      return {
        trigger_type: 'success_moment',
        title: 'Perfect! You found your car!',
        message: 'Want to make finding your car even easier? Try premium AR navigation.',
        benefits: [
          '3D arrows pointing to your car',
          'Floor indicators in garages',
          'Haptic guidance (vibrations)',
          'Works in massive parking lots',
        ],
        cta: 'Try Premium Features',
      };
    }

    // 3. Value demonstrated (used app 5+ times)
    const appOpens = await this.getAppOpens();
    if (appOpens === 5) {
      return {
        trigger_type: 'value_demonstrated',
        title: 'Loving OkapiFind?',
        message: "You've used OkapiFind 5 times! Unlock all premium features now.",
        benefits: [
          'All current features',
          'All future features',
          'Priority support',
          'Ad-free experience',
        ],
        cta: 'Get Premium',
      };
    }

    // 4. Time-based (after 3 days of usage)
    const daysSinceInstall = await this.getDaysSinceInstall();
    if (daysSinceInstall === 3 && savesCount > 0) {
      return {
        trigger_type: 'time_based',
        title: 'Ready for More?',
        message: "You've been using OkapiFind for 3 days. Upgrade for premium features!",
        benefits: [
          'Advanced location features',
          'AR navigation',
          'Photo landmarks',
          'Unlimited history',
        ],
        cta: 'See Premium Features',
      };
    }

    return null;
  }

  /**
   * Get paywall state from storage
   */
  private async getPaywallState(): Promise<PaywallState> {
    try {
      const stateStr = await AsyncStorage.getItem(STORAGE_KEYS.PAYWALL_STATE);
      if (stateStr) {
        return JSON.parse(stateStr);
      }
    } catch (error) {
      console.error('[PaywallTiming] Error getting state:', error);
    }

    return { should_show: false, times_shown: 0 };
  }

  /**
   * Check if user is premium
   */
  private async isPremiumUser(): Promise<boolean> {
    try {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('premium')
        .single();

      return settings?.premium || false;
    } catch (error) {
      // Assume not premium if error
      return false;
    }
  }

  /**
   * Get saves count
   */
  private async getSavesCount(): Promise<number> {
    try {
      const countStr = await AsyncStorage.getItem(STORAGE_KEYS.SAVES_COUNT);
      return countStr ? parseInt(countStr, 10) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get finds count
   */
  private async getFindsCount(): Promise<number> {
    try {
      const countStr = await AsyncStorage.getItem(STORAGE_KEYS.SUCCESSFUL_FINDS);
      return countStr ? parseInt(countStr, 10) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get app opens count
   */
  private async getAppOpens(): Promise<number> {
    try {
      const countStr = await AsyncStorage.getItem(STORAGE_KEYS.APP_OPENS);
      return countStr ? parseInt(countStr, 10) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get days since first install
   */
  private async getDaysSinceInstall(): Promise<number> {
    try {
      const firstInstall = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_INSTALL);
      if (!firstInstall) return 0;

      const installDate = new Date(firstInstall);
      const now = new Date();
      const diffMs = now.getTime() - installDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      return diffDays;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Reset paywall state (for testing)
   */
  async resetPaywallState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PAYWALL_STATE);
    } catch (error) {
      console.error('[PaywallTiming] Error resetting state:', error);
    }
  }

  /**
   * Reset all counters (for testing)
   */
  async resetAllCounters(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.SAVES_COUNT,
        STORAGE_KEYS.APP_OPENS,
        STORAGE_KEYS.SUCCESSFUL_FINDS,
        STORAGE_KEYS.PAYWALL_STATE,
        STORAGE_KEYS.FIRST_INSTALL,
      ]);
    } catch (error) {
      console.error('[PaywallTiming] Error resetting counters:', error);
    }
  }
}

// Export singleton
export const paywallTiming = new PaywallTimingService();
export default paywallTiming;
