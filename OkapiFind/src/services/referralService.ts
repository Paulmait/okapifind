import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share, Alert } from 'react-native';
import { analytics, AnalyticsEvent } from './analytics';
import * as Linking from 'expo-linking';

export interface ReferralConfig {
  referrerRewardMonths: number;
  refereeRewardMonths: number;
  minimumSubscriptionDays: number;
  maxReferralsPerUser: number;
  rewardExpirationDays: number;
}

export interface ReferralState {
  referralCode: string | null;
  referredBy: string | null;
  referralCount: number;
  pendingRewards: ReferralReward[];
  redeemedRewards: ReferralReward[];
  totalRewardsEarned: number;
  shareCount: number;
  lastShareDate: string | null;
  signupDate: string | null;
}

export interface ReferralReward {
  id: string;
  referralCode: string;
  rewardType: 'referrer' | 'referee';
  rewardMonths: number;
  status: 'pending' | 'redeemed' | 'expired';
  earnedDate: string;
  redeemedDate?: string;
  expirationDate: string;
}

export interface ReferralStats {
  totalReferrals: number;
  successfulReferrals: number;
  pendingRewards: number;
  totalRewardMonths: number;
}

/**
 * Referral Program Service - "Give a month, get a month"
 * Implements a comprehensive referral system with tracking and rewards
 */
class ReferralService {
  private static readonly STORAGE_KEY = 'referralState';
  private static readonly DEFAULT_CONFIG: ReferralConfig = {
    referrerRewardMonths: 1, // Person who refers gets 1 month
    refereeRewardMonths: 1,  // Person who signs up gets 1 month
    minimumSubscriptionDays: 7, // Must be subscribed for 7 days before rewards are granted
    maxReferralsPerUser: 50, // Maximum referrals per user
    rewardExpirationDays: 365, // Rewards expire after 1 year
  };

  private config: ReferralConfig;
  private state: ReferralState;

  constructor(config: Partial<ReferralConfig> = {}) {
    this.config = { ...ReferralService.DEFAULT_CONFIG, ...config };
    this.state = {
      referralCode: null,
      referredBy: null,
      referralCount: 0,
      pendingRewards: [],
      redeemedRewards: [],
      totalRewardsEarned: 0,
      shareCount: 0,
      lastShareDate: null,
      signupDate: null,
    };
  }

  /**
   * Initialize the referral service
   */
  async initialize(userId?: string): Promise<void> {
    try {
      const savedState = await AsyncStorage.getItem(ReferralService.STORAGE_KEY);
      if (savedState) {
        this.state = { ...this.state, ...JSON.parse(savedState) };
      } else {
        // First time user - generate referral code and set signup date
        this.state.referralCode = this.generateReferralCode(userId);
        this.state.signupDate = new Date().toISOString();
        await this.saveState();
      }

      // Clean up expired rewards
      await this.cleanupExpiredRewards();

      analytics.logEvent('referral_service_initialized', {
        has_referral_code: !!this.state.referralCode,
        referral_count: this.state.referralCount,
        pending_rewards: this.state.pendingRewards.length,
        total_rewards_earned: this.state.totalRewardsEarned,
      });
    } catch (error) {
      console.error('[ReferralService] Failed to initialize:', error);
      analytics.logEvent('referral_service_init_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get user's referral code
   */
  getReferralCode(): string | null {
    return this.state.referralCode;
  }

  /**
   * Generate a referral link
   */
  generateReferralLink(): string {
    if (!this.state.referralCode) {
      throw new Error('No referral code available');
    }

    const baseUrl = Linking.createURL('/');
    return `${baseUrl}?ref=${this.state.referralCode}`;
  }

  /**
   * Share referral link via native share dialog
   */
  async shareReferralLink(customMessage?: string): Promise<boolean> {
    try {
      if (!this.state.referralCode) {
        throw new Error('No referral code available');
      }

      const referralLink = this.generateReferralLink();
      const defaultMessage = `🅿️ Join me on OkapiFind - the smartest parking app! Use my code ${this.state.referralCode} and we both get a free month of premium features! ${referralLink}`;

      const message = customMessage || defaultMessage;

      analytics.logReferralLinkGenerated(this.state.referralCode);

      const result = await Share.share({
        message,
        url: referralLink,
        title: 'Join OkapiFind',
      });

      if (result.action === Share.sharedAction) {
        this.state.shareCount++;
        this.state.lastShareDate = new Date().toISOString();
        await this.saveState();

        analytics.logReferralLinkShared(
          result.activityType || 'unknown',
          this.state.referralCode
        );

        return true;
      }

      return false;
    } catch (error) {
      console.error('[ReferralService] Error sharing referral link:', error);
      analytics.logEvent('referral_share_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Process a referral signup (call when new user signs up with referral code)
   */
  async processReferralSignup(referralCode: string, newUserId: string): Promise<boolean> {
    try {
      // Validate referral code
      if (!this.isValidReferralCode(referralCode)) {
        analytics.logEvent('referral_signup_invalid_code', {
          referral_code: referralCode,
        });
        return false;
      }

      // Check if user was already referred
      if (this.state.referredBy) {
        analytics.logEvent('referral_signup_already_referred', {
          existing_referrer: this.state.referredBy,
          attempted_referrer: referralCode,
        });
        return false;
      }

      // Set referred by
      this.state.referredBy = referralCode;
      await this.saveState();

      // Create pending reward for referee (new user)
      const refereeReward = this.createReward(
        'referee',
        this.config.refereeRewardMonths,
        referralCode
      );
      this.state.pendingRewards.push(refereeReward);

      analytics.logReferralSignupCompleted(referralCode);

      // Note: Referrer reward will be created when this user maintains subscription
      // This should be called by the subscription service after minimum subscription period

      await this.saveState();
      return true;
    } catch (error) {
      console.error('[ReferralService] Error processing referral signup:', error);
      analytics.logEvent('referral_signup_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referral_code: referralCode,
      });
      return false;
    }
  }

  /**
   * Process successful referral (call after referred user maintains subscription)
   */
  async processSuccessfulReferral(referredUserId: string): Promise<void> {
    try {
      if (!this.state.referredBy) {
        return;
      }

      // Create reward for referrer
      const referrerReward = this.createReward(
        'referrer',
        this.config.referrerRewardMonths,
        this.state.referredBy
      );

      // This reward should be added to the referrer's account
      // In a real implementation, you'd call your backend API here

      analytics.logReferralRewardEarned(
        'referrer',
        this.config.referrerRewardMonths,
        this.state.referredBy
      );

      // Also mark referee reward as ready for redemption
      const refereeReward = this.state.pendingRewards.find(
        reward => reward.rewardType === 'referee' && reward.referralCode === this.state.referredBy
      );

      if (refereeReward) {
        refereeReward.status = 'pending'; // Ready for redemption
      }

      await this.saveState();
    } catch (error) {
      console.error('[ReferralService] Error processing successful referral:', error);
    }
  }

  /**
   * Check if user can make more referrals
   */
  canMakeReferrals(): boolean {
    return this.state.referralCount < this.config.maxReferralsPerUser;
  }

  /**
   * Get referral statistics
   */
  getReferralStats(): ReferralStats {
    const pendingRewards = this.state.pendingRewards.filter(
      reward => reward.status === 'pending'
    ).length;

    const totalRewardMonths = [
      ...this.state.pendingRewards,
      ...this.state.redeemedRewards
    ].reduce((total, reward) => total + reward.rewardMonths, 0);

    return {
      totalReferrals: this.state.referralCount,
      successfulReferrals: this.state.redeemedRewards.length,
      pendingRewards,
      totalRewardMonths,
    };
  }

  /**
   * Get available rewards for redemption
   */
  getAvailableRewards(): ReferralReward[] {
    return this.state.pendingRewards.filter(
      reward => reward.status === 'pending' && new Date(reward.expirationDate) > new Date()
    );
  }

  /**
   * Redeem a specific reward
   */
  async redeemReward(rewardId: string): Promise<boolean> {
    try {
      const reward = this.state.pendingRewards.find(r => r.id === rewardId);
      if (!reward || reward.status !== 'pending') {
        return false;
      }

      // Check if reward is expired
      if (new Date(reward.expirationDate) <= new Date()) {
        reward.status = 'expired';
        await this.saveState();
        return false;
      }

      // Mark as redeemed
      reward.status = 'redeemed';
      reward.redeemedDate = new Date().toISOString();

      // Move to redeemed rewards
      this.state.redeemedRewards.push(reward);
      this.state.pendingRewards = this.state.pendingRewards.filter(r => r.id !== rewardId);
      this.state.totalRewardsEarned += reward.rewardMonths;

      await this.saveState();

      analytics.logReferralRewardRedeemed(
        reward.rewardType,
        reward.rewardMonths
      );

      return true;
    } catch (error) {
      console.error('[ReferralService] Error redeeming reward:', error);
      return false;
    }
  }

  /**
   * Show referral program information
   */
  async showReferralInfo(): Promise<void> {
    const stats = this.getReferralStats();
    const availableRewards = this.getAvailableRewards();

    let message = `🎁 Referral Program\n\n`;
    message += `Your referral code: ${this.state.referralCode}\n`;
    message += `Total referrals: ${stats.totalReferrals}\n`;
    message += `Available rewards: ${availableRewards.length}\n`;
    message += `Total months earned: ${stats.totalRewardMonths}\n\n`;
    message += `Invite friends and you both get a free month!`;

    Alert.alert('Referral Program', message, [
      { text: 'Share Code', onPress: () => this.shareReferralLink() },
      { text: 'Close', style: 'cancel' },
    ]);

    analytics.logEvent('referral_info_viewed', {
      total_referrals: stats.totalReferrals,
      available_rewards: availableRewards.length,
    });
  }

  /**
   * Reset referral state (for testing or user data reset)
   */
  async resetState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ReferralService.STORAGE_KEY);
      this.state = {
        referralCode: null,
        referredBy: null,
        referralCount: 0,
        pendingRewards: [],
        redeemedRewards: [],
        totalRewardsEarned: 0,
        shareCount: 0,
        lastShareDate: null,
        signupDate: null,
      };

      analytics.logEvent('referral_state_reset');
    } catch (error) {
      console.error('[ReferralService] Error resetting state:', error);
    }
  }

  /**
   * Get current state for debugging/analytics
   */
  getState(): ReferralState {
    return { ...this.state };
  }

  /**
   * Get current configuration
   */
  getConfig(): ReferralConfig {
    return { ...this.config };
  }

  /**
   * Check if a referral code is valid format
   */
  private isValidReferralCode(code: string): boolean {
    // Basic validation - alphanumeric, 6-12 characters
    return /^[A-Z0-9]{6,12}$/.test(code);
  }

  /**
   * Generate a unique referral code
   */
  private generateReferralCode(userId?: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    const userPart = userId ? userId.substr(0, 2).toUpperCase() : 'OK';

    return `${userPart}${timestamp}${random}`.substr(0, 8);
  }

  /**
   * Create a new reward
   */
  private createReward(
    rewardType: 'referrer' | 'referee',
    rewardMonths: number,
    referralCode: string
  ): ReferralReward {
    const now = new Date();
    const expirationDate = new Date(now.getTime() + this.config.rewardExpirationDays * 24 * 60 * 60 * 1000);

    return {
      id: `reward_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      referralCode,
      rewardType,
      rewardMonths,
      status: 'pending',
      earnedDate: now.toISOString(),
      expirationDate: expirationDate.toISOString(),
    };
  }

  /**
   * Clean up expired rewards
   */
  private async cleanupExpiredRewards(): Promise<void> {
    try {
      const now = new Date();
      let hasExpiredRewards = false;

      this.state.pendingRewards = this.state.pendingRewards.map(reward => {
        if (new Date(reward.expirationDate) <= now && reward.status === 'pending') {
          reward.status = 'expired';
          hasExpiredRewards = true;

          analytics.logEvent('referral_reward_expired', {
            reward_id: reward.id,
            reward_type: reward.rewardType,
            reward_months: reward.rewardMonths,
          });
        }
        return reward;
      });

      if (hasExpiredRewards) {
        await this.saveState();
      }
    } catch (error) {
      console.error('[ReferralService] Error cleaning up expired rewards:', error);
    }
  }

  /**
   * Save current state to AsyncStorage
   */
  private async saveState(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        ReferralService.STORAGE_KEY,
        JSON.stringify(this.state)
      );
    } catch (error) {
      console.error('[ReferralService] Failed to save state:', error);
      throw error;
    }
  }

  /**
   * Send invitation via email (requires backend integration)
   */
  async sendEmailInvitation(email: string, customMessage?: string): Promise<boolean> {
    try {
      if (!this.state.referralCode) {
        throw new Error('No referral code available');
      }

      // This would integrate with your email service (SendGrid, Mailgun, etc.)
      // For now, we'll just track the event

      analytics.logReferralInviteSent('email', 1);

      // In a real implementation, you would:
      // 1. Send API request to your backend
      // 2. Backend sends email with referral link
      // 3. Return success/failure status

      console.log(`[ReferralService] Would send email invitation to ${email} with code ${this.state.referralCode}`);

      return true;
    } catch (error) {
      console.error('[ReferralService] Error sending email invitation:', error);
      analytics.logEvent('referral_email_invitation_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Track when user opens app via referral link
   */
  async trackReferralLink(referralCode: string): Promise<void> {
    try {
      analytics.logEvent('referral_link_opened', {
        referral_code: referralCode,
      });

      // Store the referral code for later processing during signup
      await AsyncStorage.setItem('pending_referral_code', referralCode);
    } catch (error) {
      console.error('[ReferralService] Error tracking referral link:', error);
    }
  }

  /**
   * Get pending referral code (from deep link)
   */
  async getPendingReferralCode(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('pending_referral_code');
    } catch (error) {
      console.error('[ReferralService] Error getting pending referral code:', error);
      return null;
    }
  }

  /**
   * Clear pending referral code
   */
  async clearPendingReferralCode(): Promise<void> {
    try {
      await AsyncStorage.removeItem('pending_referral_code');
    } catch (error) {
      console.error('[ReferralService] Error clearing pending referral code:', error);
    }
  }
}

// Export singleton instance
export const referralService = new ReferralService();

// Export class for custom configurations
export { ReferralService };