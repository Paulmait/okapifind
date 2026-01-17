/**
 * API Quota Service
 * Manages API call quotas based on user subscription tier
 * Prevents API abuse and controls costs
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export enum SubscriptionTier {
  FREE = 'free',
  PREMIUM_MONTHLY = 'premium_monthly',
  PREMIUM_ANNUAL = 'premium_annual',
  LIFETIME = 'lifetime',
}

interface QuotaConfig {
  dailyApiCalls: number;
  dailyParkingSaves: number;
  monthlyParkingSaves: number;
  historyDays: number;
  maxDevices: number;
  googleMapsCallsPerDay: number;
  osrmFallbackEnabled: boolean;
}

interface UsageData {
  apiCalls: number;
  parkingSaves: number;
  lastReset: string;
  monthlyParkingSaves: number;
  monthlyReset: string;
}

const QUOTA_CONFIGS: Record<SubscriptionTier, QuotaConfig> = {
  [SubscriptionTier.FREE]: {
    dailyApiCalls: 50,
    dailyParkingSaves: 3,
    monthlyParkingSaves: 10,
    historyDays: 7,
    maxDevices: 1,
    googleMapsCallsPerDay: 10, // Expensive API - limit heavily
    osrmFallbackEnabled: true, // Use free OSRM instead
  },
  [SubscriptionTier.PREMIUM_MONTHLY]: {
    dailyApiCalls: 500,
    dailyParkingSaves: 50,
    monthlyParkingSaves: -1, // Unlimited
    historyDays: 90,
    maxDevices: 1,
    googleMapsCallsPerDay: 100,
    osrmFallbackEnabled: true,
  },
  [SubscriptionTier.PREMIUM_ANNUAL]: {
    dailyApiCalls: 1000,
    dailyParkingSaves: 100,
    monthlyParkingSaves: -1, // Unlimited
    historyDays: 365,
    maxDevices: 2, // Family sharing
    googleMapsCallsPerDay: 200,
    osrmFallbackEnabled: true,
  },
  [SubscriptionTier.LIFETIME]: {
    dailyApiCalls: 1000,
    dailyParkingSaves: 100,
    monthlyParkingSaves: -1,
    historyDays: -1, // Forever
    maxDevices: 3,
    googleMapsCallsPerDay: 200,
    osrmFallbackEnabled: true,
  },
};

class ApiQuotaService {
  private static instance: ApiQuotaService;
  private currentTier: SubscriptionTier = SubscriptionTier.FREE;
  private usage: UsageData | null = null;

  private constructor() {}

  static getInstance(): ApiQuotaService {
    if (!ApiQuotaService.instance) {
      ApiQuotaService.instance = new ApiQuotaService();
    }
    return ApiQuotaService.instance;
  }

  /**
   * Initialize quota service with user's subscription tier
   */
  async initialize(tier: SubscriptionTier = SubscriptionTier.FREE): Promise<void> {
    this.currentTier = tier;
    await this.loadUsage();
    await this.checkAndResetIfNeeded();
  }

  /**
   * Update subscription tier (called when user subscribes/upgrades)
   */
  async updateTier(tier: SubscriptionTier): Promise<void> {
    this.currentTier = tier;
    await AsyncStorage.setItem('subscription_tier', tier);
  }

  /**
   * Check if user can make an API call
   */
  async canMakeApiCall(): Promise<{ allowed: boolean; remaining: number; message?: string }> {
    await this.checkAndResetIfNeeded();

    const config = this.getConfig();
    const remaining = config.dailyApiCalls - (this.usage?.apiCalls || 0);

    if (remaining <= 0) {
      return {
        allowed: false,
        remaining: 0,
        message: this.currentTier === SubscriptionTier.FREE
          ? 'Daily API limit reached. Upgrade to Premium for more.'
          : 'Daily API limit reached. Resets at midnight.',
      };
    }

    return { allowed: true, remaining };
  }

  /**
   * Check if user can save parking location
   */
  async canSaveParking(): Promise<{ allowed: boolean; remaining: number; message?: string }> {
    await this.checkAndResetIfNeeded();

    const config = this.getConfig();

    // Check monthly limit for free users
    if (config.monthlyParkingSaves !== -1) {
      const monthlyRemaining = config.monthlyParkingSaves - (this.usage?.monthlyParkingSaves || 0);
      if (monthlyRemaining <= 0) {
        return {
          allowed: false,
          remaining: 0,
          message: 'Monthly parking save limit reached. Upgrade to Premium for unlimited saves.',
        };
      }
    }

    // Check daily limit
    const dailyRemaining = config.dailyParkingSaves - (this.usage?.parkingSaves || 0);
    if (dailyRemaining <= 0) {
      return {
        allowed: false,
        remaining: 0,
        message: 'Daily parking save limit reached. Try again tomorrow or upgrade to Premium.',
      };
    }

    return { allowed: true, remaining: dailyRemaining };
  }

  /**
   * Check if should use Google Maps or OSRM fallback
   */
  async shouldUseGoogleMaps(): Promise<boolean> {
    await this.checkAndResetIfNeeded();

    const config = this.getConfig();
    const googleCallsUsed = await this.getGoogleMapsCallsToday();

    // If over Google Maps quota, use OSRM
    if (googleCallsUsed >= config.googleMapsCallsPerDay) {
      console.log('Google Maps quota exceeded, using OSRM fallback');
      return false;
    }

    return true;
  }

  /**
   * Record an API call
   */
  async recordApiCall(): Promise<void> {
    if (!this.usage) await this.loadUsage();
    if (this.usage) {
      this.usage.apiCalls++;
      await this.saveUsage();
    }
  }

  /**
   * Record a parking save
   */
  async recordParkingSave(): Promise<void> {
    if (!this.usage) await this.loadUsage();
    if (this.usage) {
      this.usage.parkingSaves++;
      this.usage.monthlyParkingSaves++;
      await this.saveUsage();
    }
  }

  /**
   * Record a Google Maps API call
   */
  async recordGoogleMapsCall(): Promise<void> {
    const key = `google_maps_calls_${this.getTodayKey()}`;
    const current = parseInt(await AsyncStorage.getItem(key) || '0', 10);
    await AsyncStorage.setItem(key, (current + 1).toString());
  }

  /**
   * Get current quota config
   */
  getConfig(): QuotaConfig {
    return QUOTA_CONFIGS[this.currentTier];
  }

  /**
   * Get current tier
   */
  getTier(): SubscriptionTier {
    return this.currentTier;
  }

  /**
   * Get usage summary for display
   */
  async getUsageSummary(): Promise<{
    tier: SubscriptionTier;
    apiCalls: { used: number; limit: number };
    parkingSaves: { used: number; dailyLimit: number; monthlyLimit: number };
    googleMaps: { used: number; limit: number };
  }> {
    await this.checkAndResetIfNeeded();
    const config = this.getConfig();
    const googleCallsUsed = await this.getGoogleMapsCallsToday();

    return {
      tier: this.currentTier,
      apiCalls: {
        used: this.usage?.apiCalls || 0,
        limit: config.dailyApiCalls,
      },
      parkingSaves: {
        used: this.usage?.parkingSaves || 0,
        dailyLimit: config.dailyParkingSaves,
        monthlyLimit: config.monthlyParkingSaves,
      },
      googleMaps: {
        used: googleCallsUsed,
        limit: config.googleMapsCallsPerDay,
      },
    };
  }

  // Private helpers

  private async loadUsage(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem('api_usage');
      this.usage = data ? JSON.parse(data) : this.getDefaultUsage();
    } catch {
      this.usage = this.getDefaultUsage();
    }
  }

  private async saveUsage(): Promise<void> {
    if (this.usage) {
      await AsyncStorage.setItem('api_usage', JSON.stringify(this.usage));
    }
  }

  private getDefaultUsage(): UsageData {
    const today = this.getTodayKey();
    const month = this.getMonthKey();
    return {
      apiCalls: 0,
      parkingSaves: 0,
      lastReset: today,
      monthlyParkingSaves: 0,
      monthlyReset: month,
    };
  }

  private async checkAndResetIfNeeded(): Promise<void> {
    if (!this.usage) await this.loadUsage();
    if (!this.usage) return;

    const today = this.getTodayKey();
    const month = this.getMonthKey();

    // Daily reset
    if (this.usage.lastReset !== today) {
      this.usage.apiCalls = 0;
      this.usage.parkingSaves = 0;
      this.usage.lastReset = today;
    }

    // Monthly reset
    if (this.usage.monthlyReset !== month) {
      this.usage.monthlyParkingSaves = 0;
      this.usage.monthlyReset = month;
    }

    await this.saveUsage();
  }

  private getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getMonthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private async getGoogleMapsCallsToday(): Promise<number> {
    const key = `google_maps_calls_${this.getTodayKey()}`;
    return parseInt(await AsyncStorage.getItem(key) || '0', 10);
  }
}

export const apiQuotaService = ApiQuotaService.getInstance();
export default apiQuotaService;
