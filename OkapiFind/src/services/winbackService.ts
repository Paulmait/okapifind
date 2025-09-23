import AsyncStorage from '@react-native-async-storage/async-storage';
import { analytics, AnalyticsEvent } from './analytics';

export interface WinbackConfig {
  triggerAfterDaysInactive: number;
  maxCampaignsPerUser: number;
  daysBetweenCampaigns: number;
  campaignExpirationDays: number;
  emailTemplates: Record<string, WinbackEmailTemplate>;
}

export interface WinbackEmailTemplate {
  subject: string;
  template: string;
  offerType?: 'discount' | 'free_trial' | 'free_month' | 'feature_unlock';
  offerValue?: number;
  ctaText: string;
  ctaUrl: string;
}

export interface WinbackCampaign {
  id: string;
  userId: string;
  campaignType: string;
  status: 'pending' | 'sent' | 'opened' | 'clicked' | 'converted' | 'expired';
  createdDate: string;
  sentDate?: string;
  openedDate?: string;
  clickedDate?: string;
  convertedDate?: string;
  expirationDate: string;
  emailTemplate: string;
  offer?: {
    type: string;
    value: number;
    code: string;
    expirationDate: string;
  };
}

export interface WinbackState {
  lastActiveDate: string | null;
  campaignHistory: WinbackCampaign[];
  totalCampaignsSent: number;
  totalConversions: number;
  isOptedOut: boolean;
  userSegment: string | null;
}

export interface WinbackStats {
  totalCampaigns: number;
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalConverted: number;
  conversionRate: number;
  openRate: number;
  clickRate: number;
}

/**
 * Win-back Campaign Service
 * Automatically triggers email campaigns for churned/inactive users
 * Implements progressive campaign sequences with offers
 */
class WinbackService {
  private static readonly STORAGE_KEY = 'winbackState';
  private static readonly DEFAULT_CONFIG: WinbackConfig = {
    triggerAfterDaysInactive: 7, // Trigger after 7 days of inactivity
    maxCampaignsPerUser: 5, // Maximum 5 campaigns per user
    daysBetweenCampaigns: 14, // 2 weeks between campaigns
    campaignExpirationDays: 30, // Campaigns expire after 30 days
    emailTemplates: {
      'welcome_back': {
        subject: '🅿️ Miss us? Your parking spot is waiting!',
        template: 'welcome_back',
        ctaText: 'Find My Car',
        ctaUrl: '/app',
      },
      'feature_highlight': {
        subject: '✨ New features you haven\'t tried yet',
        template: 'feature_highlight',
        ctaText: 'Explore Features',
        ctaUrl: '/app',
      },
      'discount_offer': {
        subject: '🎁 Come back with 50% off Premium',
        template: 'discount_offer',
        offerType: 'discount',
        offerValue: 50,
        ctaText: 'Claim Discount',
        ctaUrl: '/app?offer=winback50',
      },
      'free_month': {
        subject: '🎉 Free month on us - no strings attached',
        template: 'free_month',
        offerType: 'free_month',
        offerValue: 1,
        ctaText: 'Activate Free Month',
        ctaUrl: '/app?offer=freemonth',
      },
      'final_goodbye': {
        subject: '👋 This is goodbye (unless you change your mind)',
        template: 'final_goodbye',
        ctaText: 'I\'ve Changed My Mind',
        ctaUrl: '/app',
      },
    },
  };

  private config: WinbackConfig;
  private state: WinbackState;

  constructor(config: Partial<WinbackConfig> = {}) {
    this.config = { ...WinbackService.DEFAULT_CONFIG, ...config };
    this.state = {
      lastActiveDate: null,
      campaignHistory: [],
      totalCampaignsSent: 0,
      totalConversions: 0,
      isOptedOut: false,
      userSegment: null,
    };
  }

  /**
   * Initialize the win-back service
   */
  async initialize(): Promise<void> {
    try {
      const savedState = await AsyncStorage.getItem(WinbackService.STORAGE_KEY);
      if (savedState) {
        this.state = { ...this.state, ...JSON.parse(savedState) };
      } else {
        // First time user - set last active date
        this.state.lastActiveDate = new Date().toISOString();
        await this.saveState();
      }

      // Clean up expired campaigns
      await this.cleanupExpiredCampaigns();

      analytics.logEvent('winback_service_initialized', {
        total_campaigns: this.state.campaignHistory.length,
        total_conversions: this.state.totalConversions,
        is_opted_out: this.state.isOptedOut,
        user_segment: this.state.userSegment,
      });
    } catch (error) {
      console.error('[WinbackService] Failed to initialize:', error);
      analytics.logEvent('winback_service_init_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update user's last active date
   */
  async updateLastActiveDate(): Promise<void> {
    try {
      this.state.lastActiveDate = new Date().toISOString();
      await this.saveState();
    } catch (error) {
      console.error('[WinbackService] Error updating last active date:', error);
    }
  }

  /**
   * Check if user is eligible for win-back campaign
   */
  async isEligibleForCampaign(): Promise<boolean> {
    try {
      // Don't send if user opted out
      if (this.state.isOptedOut) {
        return false;
      }

      // Check if user has been inactive long enough
      if (!this.state.lastActiveDate) {
        return false;
      }

      const daysSinceLastActive = this.getDaysBetweenDates(
        new Date(this.state.lastActiveDate),
        new Date()
      );

      if (daysSinceLastActive < this.config.triggerAfterDaysInactive) {
        return false;
      }

      // Check if max campaigns reached
      if (this.state.totalCampaignsSent >= this.config.maxCampaignsPerUser) {
        return false;
      }

      // Check if enough time has passed since last campaign
      const lastCampaign = this.getLastCampaign();
      if (lastCampaign) {
        const daysSinceLastCampaign = this.getDaysBetweenDates(
          new Date(lastCampaign.createdDate),
          new Date()
        );

        if (daysSinceLastCampaign < this.config.daysBetweenCampaigns) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('[WinbackService] Error checking campaign eligibility:', error);
      return false;
    }
  }

  /**
   * Trigger win-back campaign
   */
  async triggerCampaign(userId: string, userSegment?: string): Promise<WinbackCampaign | null> {
    try {
      if (!(await this.isEligibleForCampaign())) {
        analytics.logEvent('winback_campaign_not_eligible', {
          user_id: userId,
          reason: 'eligibility_check_failed',
        });
        return null;
      }

      const campaignType = this.selectCampaignType();
      const campaign = this.createCampaign(userId, campaignType);

      // Set user segment if provided
      if (userSegment) {
        this.state.userSegment = userSegment;
      }

      // Add to campaign history
      this.state.campaignHistory.push(campaign);
      this.state.totalCampaignsSent++;

      await this.saveState();

      analytics.logWinbackCampaignTriggered(
        campaignType,
        userId,
        this.getDaysSinceLastActive()
      );

      // Send campaign (integrate with email service)
      await this.sendCampaign(campaign);

      return campaign;
    } catch (error) {
      console.error('[WinbackService] Error triggering campaign:', error);
      analytics.logEvent('winback_campaign_trigger_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        user_id: userId,
      });
      return null;
    }
  }

  /**
   * Mark campaign as opened
   */
  async markCampaignOpened(campaignId: string): Promise<void> {
    try {
      const campaign = this.state.campaignHistory.find(c => c.id === campaignId);
      if (!campaign || campaign.status !== 'sent') {
        return;
      }

      campaign.status = 'opened';
      campaign.openedDate = new Date().toISOString();
      await this.saveState();

      analytics.logWinbackEmailOpened(
        campaign.campaignType,
        campaign.emailTemplate
      );
    } catch (error) {
      console.error('[WinbackService] Error marking campaign as opened:', error);
    }
  }

  /**
   * Mark campaign as clicked
   */
  async markCampaignClicked(campaignId: string, linkType: string = 'cta'): Promise<void> {
    try {
      const campaign = this.state.campaignHistory.find(c => c.id === campaignId);
      if (!campaign || !['sent', 'opened'].includes(campaign.status)) {
        return;
      }

      campaign.status = 'clicked';
      campaign.clickedDate = new Date().toISOString();
      await this.saveState();

      analytics.logWinbackEmailClicked(
        campaign.campaignType,
        linkType
      );
    } catch (error) {
      console.error('[WinbackService] Error marking campaign as clicked:', error);
    }
  }

  /**
   * Mark campaign as converted
   */
  async markCampaignConverted(campaignId: string, conversionType: string = 'subscription'): Promise<void> {
    try {
      const campaign = this.state.campaignHistory.find(c => c.id === campaignId);
      if (!campaign || campaign.status === 'converted') {
        return;
      }

      campaign.status = 'converted';
      campaign.convertedDate = new Date().toISOString();
      this.state.totalConversions++;
      await this.saveState();

      analytics.logWinbackConversion(
        campaign.campaignType,
        conversionType
      );
    } catch (error) {
      console.error('[WinbackService] Error marking campaign as converted:', error);
    }
  }

  /**
   * Opt user out of win-back campaigns
   */
  async optOut(): Promise<void> {
    try {
      this.state.isOptedOut = true;
      await this.saveState();

      analytics.logEvent('winback_opted_out', {
        total_campaigns_received: this.state.totalCampaignsSent,
      });
    } catch (error) {
      console.error('[WinbackService] Error opting out:', error);
    }
  }

  /**
   * Opt user back in to win-back campaigns
   */
  async optIn(): Promise<void> {
    try {
      this.state.isOptedOut = false;
      await this.saveState();

      analytics.logEvent('winback_opted_in');
    } catch (error) {
      console.error('[WinbackService] Error opting in:', error);
    }
  }

  /**
   * Get campaign statistics
   */
  getCampaignStats(): WinbackStats {
    const campaigns = this.state.campaignHistory;
    const totalCampaigns = campaigns.length;
    const totalSent = campaigns.filter(c => ['sent', 'opened', 'clicked', 'converted'].includes(c.status)).length;
    const totalOpened = campaigns.filter(c => ['opened', 'clicked', 'converted'].includes(c.status)).length;
    const totalClicked = campaigns.filter(c => ['clicked', 'converted'].includes(c.status)).length;
    const totalConverted = campaigns.filter(c => c.status === 'converted').length;

    return {
      totalCampaigns,
      totalSent,
      totalOpened,
      totalClicked,
      totalConverted,
      conversionRate: totalSent > 0 ? (totalConverted / totalSent) * 100 : 0,
      openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
      clickRate: totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0,
    };
  }

  /**
   * Get active campaigns
   */
  getActiveCampaigns(): WinbackCampaign[] {
    const now = new Date();
    return this.state.campaignHistory.filter(
      campaign =>
        campaign.status !== 'expired' &&
        new Date(campaign.expirationDate) > now
    );
  }

  /**
   * Reset win-back state (for testing or user data reset)
   */
  async resetState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(WinbackService.STORAGE_KEY);
      this.state = {
        lastActiveDate: new Date().toISOString(),
        campaignHistory: [],
        totalCampaignsSent: 0,
        totalConversions: 0,
        isOptedOut: false,
        userSegment: null,
      };

      analytics.logEvent('winback_state_reset');
    } catch (error) {
      console.error('[WinbackService] Error resetting state:', error);
    }
  }

  /**
   * Get current state for debugging/analytics
   */
  getState(): WinbackState {
    return { ...this.state };
  }

  /**
   * Get current configuration
   */
  getConfig(): WinbackConfig {
    return { ...this.config };
  }

  /**
   * Select appropriate campaign type based on history
   */
  private selectCampaignType(): string {
    const campaignCount = this.state.campaignHistory.length;

    switch (campaignCount) {
      case 0:
        return 'welcome_back';
      case 1:
        return 'feature_highlight';
      case 2:
        return 'discount_offer';
      case 3:
        return 'free_month';
      default:
        return 'final_goodbye';
    }
  }

  /**
   * Create a new campaign
   */
  private createCampaign(userId: string, campaignType: string): WinbackCampaign {
    const now = new Date();
    const expirationDate = new Date(now.getTime() + this.config.campaignExpirationDays * 24 * 60 * 60 * 1000);
    const template = this.config.emailTemplates[campaignType];

    const campaign: WinbackCampaign = {
      id: `winback_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      userId,
      campaignType,
      status: 'pending',
      createdDate: now.toISOString(),
      expirationDate: expirationDate.toISOString(),
      emailTemplate: campaignType,
    };

    // Add offer if template has one
    if (template.offerType && template.offerValue) {
      const offerExpirationDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks
      campaign.offer = {
        type: template.offerType,
        value: template.offerValue,
        code: this.generateOfferCode(),
        expirationDate: offerExpirationDate.toISOString(),
      };
    }

    return campaign;
  }

  /**
   * Send campaign via email service
   */
  private async sendCampaign(campaign: WinbackCampaign): Promise<void> {
    try {
      // This would integrate with your email service (SendGrid, Mailgun, etc.)
      // For now, we'll just track the event and log

      campaign.status = 'sent';
      campaign.sentDate = new Date().toISOString();

      analytics.logWinbackEmailSent(
        campaign.campaignType,
        campaign.emailTemplate
      );

      // In a real implementation, you would:
      // 1. Send API request to your email service
      // 2. Pass campaign data and user info
      // 3. Email service sends templated email
      // 4. Handle webhook responses for opens/clicks

      console.log(`[WinbackService] Would send ${campaign.campaignType} campaign to user ${campaign.userId}`);

      await this.saveState();
    } catch (error) {
      console.error('[WinbackService] Error sending campaign:', error);
      analytics.logEvent('winback_email_send_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        campaign_type: campaign.campaignType,
      });
    }
  }

  /**
   * Generate offer code
   */
  private generateOfferCode(): string {
    return `WINBACK${Date.now().toString().substr(-6)}`;
  }

  /**
   * Get last campaign
   */
  private getLastCampaign(): WinbackCampaign | null {
    if (this.state.campaignHistory.length === 0) {
      return null;
    }

    return this.state.campaignHistory.sort(
      (a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
    )[0];
  }

  /**
   * Get days since last active
   */
  private getDaysSinceLastActive(): number {
    if (!this.state.lastActiveDate) return 0;
    return this.getDaysBetweenDates(new Date(this.state.lastActiveDate), new Date());
  }

  /**
   * Calculate days between two dates
   */
  private getDaysBetweenDates(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Clean up expired campaigns
   */
  private async cleanupExpiredCampaigns(): Promise<void> {
    try {
      const now = new Date();
      let hasExpiredCampaigns = false;

      this.state.campaignHistory = this.state.campaignHistory.map(campaign => {
        if (new Date(campaign.expirationDate) <= now && campaign.status !== 'expired') {
          campaign.status = 'expired';
          hasExpiredCampaigns = true;

          analytics.logEvent('winback_campaign_expired', {
            campaign_id: campaign.id,
            campaign_type: campaign.campaignType,
          });
        }
        return campaign;
      });

      if (hasExpiredCampaigns) {
        await this.saveState();
      }
    } catch (error) {
      console.error('[WinbackService] Error cleaning up expired campaigns:', error);
    }
  }

  /**
   * Save current state to AsyncStorage
   */
  private async saveState(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        WinbackService.STORAGE_KEY,
        JSON.stringify(this.state)
      );
    } catch (error) {
      console.error('[WinbackService] Failed to save state:', error);
      throw error;
    }
  }

  /**
   * Process webhook from email service (for tracking opens/clicks)
   */
  async processEmailWebhook(
    campaignId: string,
    eventType: 'opened' | 'clicked',
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      switch (eventType) {
        case 'opened':
          await this.markCampaignOpened(campaignId);
          break;
        case 'clicked':
          await this.markCampaignClicked(campaignId, metadata?.linkType || 'cta');
          break;
      }
    } catch (error) {
      console.error('[WinbackService] Error processing email webhook:', error);
    }
  }
}

// Export singleton instance
export const winbackService = new WinbackService();

// Export class for custom configurations
export { WinbackService };