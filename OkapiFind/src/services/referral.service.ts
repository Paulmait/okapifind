// @ts-nocheck
/**
 * Referral Program Service
 * CRITICAL: Drive viral growth with referral rewards
 * Target: 0.5+ viral coefficient for exponential growth
 */

import { supabase } from '../lib/supabase-client';
import { analytics } from './analytics';
import * as Crypto from 'expo-crypto';

export interface ReferralCode {
  id: string;
  user_id: string;
  code: string;
  uses: number;
  max_uses?: number;
  created_at: string;
  expires_at?: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referee_id: string;
  referral_code: string;
  status: 'pending' | 'completed' | 'rewarded';
  referrer_reward?: string;
  referee_reward?: string;
  created_at: string;
  completed_at?: string;
}

export interface ReferralReward {
  type: 'premium_days' | 'discount' | 'feature_unlock' | 'credits';
  value: number;
  description: string;
}

export interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalRewards: number;
  conversionRate: number;
  viralCoefficient: number;
}

class ReferralService {
  private readonly REFERRER_REWARDS: ReferralReward[] = [
    {
      type: 'premium_days',
      value: 30,
      description: '30 days of Pro subscription',
    },
    {
      type: 'credits',
      value: 100,
      description: '100 parking credits',
    },
  ];

  private readonly REFEREE_REWARDS: ReferralReward[] = [
    {
      type: 'premium_days',
      value: 14,
      description: '14 days free Pro trial',
    },
  ];

  /**
   * Generate unique referral code for user
   */
  async generateReferralCode(userId: string): Promise<ReferralCode> {
    try {
      // Check if user already has a code
      const { data: existing } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (existing) {
        return existing;
      }

      // Generate unique code
      const code = await this.createUniqueCode();

      const { data, error } = await supabase
        .from('referral_codes')
        .insert([{
          user_id: userId,
          code,
          uses: 0,
        }])
        .select()
        .single();

      if (error) throw error;

      analytics.logEvent('referral_code_generated', {
        user_id: userId,
      });

      return data;
    } catch (error) {
      console.error('Error generating referral code:', error);
      throw error;
    }
  }

  /**
   * Create unique referral code
   */
  private async createUniqueCode(): Promise<string> {
    let code: string;
    let isUnique = false;

    while (!isUnique) {
      // Generate 6-character alphanumeric code
      const randomBytes = await Crypto.getRandomBytesAsync(4);
      code = Array.from(randomBytes)
        .map(byte => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          return chars[byte % chars.length];
        })
        .join('')
        .substring(0, 6);

      // Check if code exists
      const { data } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('code', code!)
        .single();

      if (!data) {
        isUnique = true;
      }
    }

    return code!;
  }

  /**
   * Validate referral code
   */
  async validateCode(code: string): Promise<ReferralCode | null> {
    try {
      const { data, error } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();

      if (error || !data) return null;

      // Check if expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return null;
      }

      // Check if max uses reached
      if (data.max_uses && data.uses >= data.max_uses) {
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error validating referral code:', error);
      return null;
    }
  }

  /**
   * Apply referral code for new user
   */
  async applyReferralCode(
    refereeId: string,
    code: string
  ): Promise<Referral | null> {
    try {
      // Validate code
      const referralCode = await this.validateCode(code);
      if (!referralCode) {
        throw new Error('Invalid or expired referral code');
      }

      // Check if user already used a referral code
      const { data: existing } = await supabase
        .from('referrals')
        .select('*')
        .eq('referee_id', refereeId)
        .single();

      if (existing) {
        throw new Error('User already used a referral code');
      }

      // Create referral
      const { data, error } = await supabase
        .from('referrals')
        .insert([{
          referrer_id: referralCode.user_id,
          referee_id: refereeId,
          referral_code: code.toUpperCase(),
          status: 'pending',
        }])
        .select()
        .single();

      if (error) throw error;

      // Increment code usage
      await supabase
        .from('referral_codes')
        .update({ uses: referralCode.uses + 1 })
        .eq('id', referralCode.id);

      // Grant referee reward immediately
      await this.grantRefereeReward(refereeId);

      analytics.logEvent('referral_code_applied', {
        referrer_id: referralCode.user_id,
        referee_id: refereeId,
        code,
      });

      return data;
    } catch (error) {
      console.error('Error applying referral code:', error);
      throw error;
    }
  }

  /**
   * Complete referral (when referee performs qualifying action)
   */
  async completeReferral(referralId: string): Promise<void> {
    try {
      const { data: referral, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('id', referralId)
        .single();

      if (error || !referral) {
        throw new Error('Referral not found');
      }

      if (referral.status === 'completed') {
        return; // Already completed
      }

      // Update referral status
      await supabase
        .from('referrals')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', referralId);

      // Grant referrer reward
      await this.grantReferrerReward(referral.referrer_id);

      // Mark as rewarded
      await supabase
        .from('referrals')
        .update({ status: 'rewarded' })
        .eq('id', referralId);

      analytics.logEvent('referral_completed', {
        referrer_id: referral.referrer_id,
        referee_id: referral.referee_id,
      });
    } catch (error) {
      console.error('Error completing referral:', error);
      throw error;
    }
  }

  /**
   * Grant reward to referee (new user)
   */
  private async grantRefereeReward(refereeId: string): Promise<void> {
    try {
      const reward = this.REFEREE_REWARDS[0]; // Default reward

      if (reward.type === 'premium_days') {
        // Grant premium trial
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + reward.value);

        await supabase
          .from('subscriptions')
          .upsert({
            user_id: refereeId,
            platform: 'referral',
            product_id: 'referral_trial',
            active_until: expiresAt.toISOString(),
          });
      }

      analytics.logEvent('referral_reward_granted', {
        user_id: refereeId,
        reward_type: reward.type,
        reward_value: reward.value,
        user_type: 'referee',
      });
    } catch (error) {
      console.error('Error granting referee reward:', error);
    }
  }

  /**
   * Grant reward to referrer (existing user)
   */
  private async grantReferrerReward(referrerId: string): Promise<void> {
    try {
      const reward = this.REFERRER_REWARDS[0]; // Default reward

      if (reward.type === 'premium_days') {
        // Extend existing subscription
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', referrerId)
          .single();

        let newExpiryDate: Date;

        if (subscription?.active_until) {
          newExpiryDate = new Date(subscription.active_until);
        } else {
          newExpiryDate = new Date();
        }

        newExpiryDate.setDate(newExpiryDate.getDate() + reward.value);

        await supabase
          .from('subscriptions')
          .upsert({
            user_id: referrerId,
            platform: 'referral',
            product_id: 'referral_bonus',
            active_until: newExpiryDate.toISOString(),
          });
      }

      analytics.logEvent('referral_reward_granted', {
        user_id: referrerId,
        reward_type: reward.type,
        reward_value: reward.value,
        user_type: 'referrer',
      });
    } catch (error) {
      console.error('Error granting referrer reward:', error);
    }
  }

  /**
   * Get user's referral code
   */
  async getUserReferralCode(userId: string): Promise<ReferralCode | null> {
    try {
      const { data, error } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // Generate code if doesn't exist
        return await this.generateReferralCode(userId);
      }

      return data;
    } catch (error) {
      console.error('Error getting user referral code:', error);
      return null;
    }
  }

  /**
   * Get user's referral statistics
   */
  async getUserStats(userId: string): Promise<ReferralStats> {
    try {
      const { data: referrals } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', userId);

      const totalReferrals = referrals?.length || 0;
      const completedReferrals = referrals?.filter(r => r.status === 'completed' || r.status === 'rewarded').length || 0;
      const pendingReferrals = referrals?.filter(r => r.status === 'pending').length || 0;
      const totalRewards = completedReferrals * this.REFERRER_REWARDS[0].value;
      const conversionRate = totalReferrals > 0 ? completedReferrals / totalReferrals : 0;

      // Viral coefficient = avg referrals per user
      // For simplicity, using completion rate as proxy
      const viralCoefficient = conversionRate;

      return {
        totalReferrals,
        completedReferrals,
        pendingReferrals,
        totalRewards,
        conversionRate,
        viralCoefficient,
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {
        totalReferrals: 0,
        completedReferrals: 0,
        pendingReferrals: 0,
        totalRewards: 0,
        conversionRate: 0,
        viralCoefficient: 0,
      };
    }
  }

  /**
   * Get shareable referral link
   */
  async getReferralLink(userId: string): Promise<string> {
    const code = await this.getUserReferralCode(userId);
    if (!code) {
      throw new Error('Failed to get referral code');
    }

    return `https://okapifind.com/r/${code.code}`;
  }

  /**
   * Get referral leaderboard
   */
  async getLeaderboard(limit: number = 10): Promise<Array<{
    user_id: string;
    referral_count: number;
    rank: number;
  }>> {
    try {
      const { data } = await supabase
        .from('referrals')
        .select('referrer_id')
        .eq('status', 'rewarded');

      if (!data) return [];

      // Count referrals per user
      const counts = data.reduce((acc, r) => {
        acc[r.referrer_id] = (acc[r.referrer_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Sort and rank
      const sorted = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([user_id, referral_count], index) => ({
          user_id,
          referral_count,
          rank: index + 1,
        }));

      return sorted;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }
}

// Export singleton instance
export const referralService = new ReferralService();

export default referralService;