// @ts-nocheck
/**
 * Refund Management Service
 * Handles Stripe refunds, chargeback prevention, and customer retention
 */

import Stripe from 'stripe';
import { supabase } from '../config/supabase';
import {
  RefundRequest,
  RefundReason,
  RefundAnalytics,
  AdminUser
} from '../types/admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-08-16',
});

interface RetentionOffer {
  type: 'discount' | 'free_month' | 'plan_downgrade';
  description: string;
  value: number;
  durationMonths?: number;
}

interface RefundDecision {
  action: 'approve' | 'deny' | 'offer_retention';
  reason?: string;
  retentionOffer?: RetentionOffer;
  notes?: string;
}

class RefundManagementService {
  private static instance: RefundManagementService;

  static getInstance(): RefundManagementService {
    if (!RefundManagementService.instance) {
      RefundManagementService.instance = new RefundManagementService();
    }
    return RefundManagementService.instance;
  }

  /**
   * Create a new refund request
   */
  async createRefundRequest(
    userId: string,
    subscriptionId: string,
    paymentIntentId: string,
    reason: RefundReason,
    customerReason?: string,
    amount?: number
  ): Promise<RefundRequest> {
    try {
      // Get user information
      const { data: user } = await supabase
        .from('users')
        .select('email, display_name')
        .eq('id', userId)
        .single();

      // Get payment details from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      const refundRequest: Partial<RefundRequest> = {
        userId,
        user: {
          email: user?.email || '',
          displayName: user?.display_name,
        },
        subscriptionId,
        paymentIntentId,
        amount: amount || paymentIntent.amount,
        currency: paymentIntent.currency,
        reason,
        customerReason,
        status: 'pending',
        requestedAt: new Date(),
        isRetentionOffer: false,
        notes: [],
        attachments: [],
      };

      // Store refund request
      const { data, error } = await supabase
        .from('refund_requests')
        .insert(refundRequest)
        .select()
        .single();

      if (error) throw error;

      // Check for automatic approval conditions
      const shouldAutoApprove = await this.shouldAutoApprove(refundRequest as RefundRequest);

      if (shouldAutoApprove) {
        return await this.processRefund(data.id, {
          action: 'approve',
          reason: 'Automatic approval based on policy',
        }, 'system');
      }

      // Check if retention offer should be made
      const retentionOffer = await this.getRetentionOffer(userId, reason);

      if (retentionOffer) {
        await this.offerRetention(data.id, retentionOffer);
      }

      return data as RefundRequest;

    } catch (error) {
      console.error('[RefundService] Error creating refund request:', error);
      throw error;
    }
  }

  /**
   * Process a refund decision
   */
  async processRefund(
    refundRequestId: string,
    decision: RefundDecision,
    processedBy: string
  ): Promise<RefundRequest> {
    try {
      // Get refund request
      const { data: refundRequest } = await supabase
        .from('refund_requests')
        .select('*')
        .eq('id', refundRequestId)
        .single();

      if (!refundRequest) {
        throw new Error('Refund request not found');
      }

      let updateData: Partial<RefundRequest> = {
        status: decision.action === 'approve' ? 'approved' : 'denied',
        processedAt: new Date(),
        processedBy,
        notes: [
          ...refundRequest.notes,
          `${decision.action.toUpperCase()}: ${decision.reason || 'No reason provided'}`
        ],
      };

      if (decision.action === 'approve') {
        // Process Stripe refund
        const stripeRefund = await this.processStripeRefund(
          refundRequest.paymentIntentId,
          refundRequest.amount,
          refundRequest.reason
        );

        updateData.stripeRefundId = stripeRefund.id;
        updateData.status = 'processed';

        // Cancel subscription if full refund
        if (refundRequest.amount === stripeRefund.amount) {
          await this.cancelSubscription(refundRequest.subscriptionId);
        }

      } else if (decision.action === 'offer_retention' && decision.retentionOffer) {
        // Create retention offer
        await this.createRetentionOffer(refundRequestId, decision.retentionOffer);
        updateData.isRetentionOffer = true;
        updateData.retentionOfferType = decision.retentionOffer.type;
        updateData.status = 'pending'; // Keep pending until customer responds
      }

      // Update refund request
      const { data: updatedRequest, error } = await supabase
        .from('refund_requests')
        .update(updateData)
        .eq('id', refundRequestId)
        .select()
        .single();

      if (error) throw error;

      // Send notification to customer
      await this.sendRefundNotification(updatedRequest, decision);

      // Log analytics event
      await this.logRefundEvent(updatedRequest, decision.action);

      return updatedRequest as RefundRequest;

    } catch (error) {
      console.error('[RefundService] Error processing refund:', error);
      throw error;
    }
  }

  /**
   * Get refund analytics
   */
  async getRefundAnalytics(
    startDate: Date,
    endDate: Date
  ): Promise<RefundAnalytics> {
    try {
      // Get all refunds in date range
      const { data: refunds } = await supabase
        .from('refund_requests')
        .select('*')
        .gte('requested_at', startDate.toISOString())
        .lte('requested_at', endDate.toISOString());

      if (!refunds) {
        throw new Error('Failed to fetch refund data');
      }

      // Calculate metrics
      const totalRefunds = refunds.length;
      const totalRefundAmount = refunds.reduce((sum, refund) => sum + refund.amount, 0);

      // Get total revenue for refund rate calculation
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('status', 'succeeded');

      const totalRevenue = payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
      const refundRate = totalRevenue > 0 ? (totalRefundAmount / totalRevenue) * 100 : 0;

      // Reason breakdown
      const reasonBreakdown: Record<RefundReason, number> = {
        'accidental_purchase': 0,
        'not_as_described': 0,
        'technical_issues': 0,
        'billing_error': 0,
        'duplicate_charge': 0,
        'fraudulent': 0,
        'customer_request': 0,
        'app_not_working': 0,
        'other': 0,
      };

      refunds.forEach(refund => {
        reasonBreakdown[refund.reason as RefundReason]++;
      });

      // Monthly trend
      const monthlyTrend = this.calculateMonthlyTrend(refunds, startDate, endDate);

      // Prevention suggestions
      const preventionSuggestions = this.generatePreventionSuggestions(reasonBreakdown);

      return {
        totalRefunds,
        totalRefundAmount,
        refundRate,
        reasonBreakdown,
        monthlyTrend,
        preventionSuggestions,
      };

    } catch (error) {
      console.error('[RefundService] Error getting analytics:', error);
      throw error;
    }
  }

  /**
   * Get pending refund requests
   */
  async getPendingRefunds(
    page = 1,
    limit = 20,
    sortBy = 'requested_at',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<{ refunds: RefundRequest[]; total: number }> {
    try {
      const offset = (page - 1) * limit;

      const query = supabase
        .from('refund_requests')
        .select('*, users(email, display_name)', { count: 'exact' })
        .eq('status', 'pending')
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        refunds: data as RefundRequest[],
        total: count || 0,
      };

    } catch (error) {
      console.error('[RefundService] Error getting pending refunds:', error);
      throw error;
    }
  }

  /**
   * Get refund request by ID
   */
  async getRefundRequest(id: string): Promise<RefundRequest | null> {
    try {
      const { data, error } = await supabase
        .from('refund_requests')
        .select('*, users(email, display_name)')
        .eq('id', id)
        .single();

      if (error) throw error;

      return data as RefundRequest;

    } catch (error) {
      console.error('[RefundService] Error getting refund request:', error);
      return null;
    }
  }

  /**
   * Handle chargeback notification
   */
  async handleChargeback(
    paymentIntentId: string,
    chargebackReason: string,
    amount: number
  ): Promise<void> {
    try {
      // Check if there's an existing refund request
      const { data: existingRefund } = await supabase
        .from('refund_requests')
        .select('*')
        .eq('payment_intent_id', paymentIntentId)
        .single();

      if (existingRefund) {
        // Update existing refund as chargeback
        await supabase
          .from('refund_requests')
          .update({
            status: 'processed',
            notes: [
              ...existingRefund.notes,
              `CHARGEBACK: ${chargebackReason}`
            ],
          })
          .eq('id', existingRefund.id);
      } else {
        // Create new chargeback record
        await supabase
          .from('chargebacks')
          .insert({
            payment_intent_id: paymentIntentId,
            reason: chargebackReason,
            amount,
            received_at: new Date(),
            status: 'received',
          });
      }

      // Trigger fraud analysis
      await this.triggerFraudAnalysis(paymentIntentId, 'chargeback');

    } catch (error) {
      console.error('[RefundService] Error handling chargeback:', error);
    }
  }

  // Private helper methods

  private async shouldAutoApprove(refundRequest: RefundRequest): Promise<boolean> {
    // Auto-approve conditions
    const autoApprovalReasons: RefundReason[] = [
      'billing_error',
      'duplicate_charge',
      'fraudulent'
    ];

    if (autoApprovalReasons.includes(refundRequest.reason)) {
      return true;
    }

    // Auto-approve if requested within 24 hours of purchase
    const timeSincePurchase = Date.now() - new Date(refundRequest.requestedAt).getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (timeSincePurchase < twentyFourHours && refundRequest.reason === 'accidental_purchase') {
      return true;
    }

    return false;
  }

  private async getRetentionOffer(
    userId: string,
    reason: RefundReason
  ): Promise<RetentionOffer | null> {
    try {
      // Get user subscription details
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (!subscription) return null;

      // Get user engagement metrics
      const { data: analytics } = await supabase
        .from('user_analytics')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Determine retention offer based on reason and engagement
      switch (reason) {
        case 'technical_issues':
        case 'app_not_working':
          return {
            type: 'free_month',
            description: 'We apologize for the technical issues. Here\'s a free month while we fix them.',
            value: 0,
            durationMonths: 1,
          };

        case 'not_as_described':
          if (subscription.plan === 'pro' || subscription.plan === 'family') {
            return {
              type: 'plan_downgrade',
              description: 'Would you like to try our Plus plan at a lower price?',
              value: 2.99,
            };
          }
          break;

        case 'customer_request':
          if (analytics?.engagement_score > 70) {
            return {
              type: 'discount',
              description: 'We value your loyalty! Here\'s 50% off your next 3 months.',
              value: 50,
              durationMonths: 3,
            };
          }
          break;
      }

      return null;

    } catch (error) {
      console.error('[RefundService] Error getting retention offer:', error);
      return null;
    }
  }

  private async processStripeRefund(
    paymentIntentId: string,
    amount: number,
    reason: RefundReason
  ): Promise<Stripe.Refund> {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount,
        reason: this.mapRefundReasonToStripe(reason),
        metadata: {
          okapifind_reason: reason,
          processed_by: 'okapifind_admin',
        },
      });

      return refund;

    } catch (error) {
      console.error('[RefundService] Stripe refund error:', error);
      throw error;
    }
  }

  private mapRefundReasonToStripe(reason: RefundReason): Stripe.RefundCreateParams.Reason {
    switch (reason) {
      case 'fraudulent':
        return 'fraudulent';
      case 'duplicate_charge':
        return 'duplicate';
      default:
        return 'requested_by_customer';
    }
  }

  private async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      await stripe.subscriptions.cancel(subscriptionId);

      // Update local subscription status
      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled', cancelled_at: new Date() })
        .eq('stripe_subscription_id', subscriptionId);

    } catch (error) {
      console.error('[RefundService] Error cancelling subscription:', error);
    }
  }

  private async createRetentionOffer(
    refundRequestId: string,
    offer: RetentionOffer
  ): Promise<void> {
    try {
      await supabase
        .from('retention_offers')
        .insert({
          refund_request_id: refundRequestId,
          type: offer.type,
          description: offer.description,
          value: offer.value,
          duration_months: offer.durationMonths,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });

    } catch (error) {
      console.error('[RefundService] Error creating retention offer:', error);
    }
  }

  private async offerRetention(
    refundRequestId: string,
    offer: RetentionOffer
  ): Promise<void> {
    await this.createRetentionOffer(refundRequestId, offer);
    // Send email with retention offer
    // This would integrate with your email service
  }

  private async sendRefundNotification(
    refundRequest: RefundRequest,
    decision: RefundDecision
  ): Promise<void> {
    try {
      // This would integrate with your email/notification service
      const emailData = {
        to: refundRequest.user.email,
        template: decision.action === 'approve' ? 'refund_approved' : 'refund_denied',
        data: {
          displayName: refundRequest.user.displayName || 'Valued Customer',
          amount: refundRequest.amount / 100, // Convert from cents
          currency: refundRequest.currency.toUpperCase(),
          reason: decision.reason,
          refundId: refundRequest.id,
        },
      };

      // Send email (implement your email service here)
      console.log('[RefundService] Would send email:', emailData);

    } catch (error) {
      console.error('[RefundService] Error sending notification:', error);
    }
  }

  private async logRefundEvent(
    refundRequest: RefundRequest,
    action: string
  ): Promise<void> {
    try {
      await supabase
        .from('analytics_events')
        .insert({
          event: 'refund_processed',
          user_id: refundRequest.userId,
          properties: {
            refund_id: refundRequest.id,
            action,
            reason: refundRequest.reason,
            amount: refundRequest.amount,
            currency: refundRequest.currency,
          },
          timestamp: new Date(),
        });

    } catch (error) {
      console.error('[RefundService] Error logging event:', error);
    }
  }

  private calculateMonthlyTrend(
    refunds: any[],
    startDate: Date,
    endDate: Date
  ): Array<{ month: string; count: number; amount: number }> {
    const months: { [key: string]: { count: number; amount: number } } = {};

    refunds.forEach(refund => {
      const month = new Date(refund.requested_at).toISOString().slice(0, 7); // YYYY-MM
      if (!months[month]) {
        months[month] = { count: 0, amount: 0 };
      }
      months[month].count++;
      months[month].amount += refund.amount;
    });

    return Object.entries(months).map(([month, data]) => ({
      month,
      count: data.count,
      amount: data.amount,
    }));
  }

  private generatePreventionSuggestions(
    reasonBreakdown: Record<RefundReason, number>
  ): string[] {
    const suggestions: string[] = [];
    const total = Object.values(reasonBreakdown).reduce((sum, count) => sum + count, 0);

    if (total === 0) return suggestions;

    // Check for high technical issues
    const techIssues = reasonBreakdown.technical_issues + reasonBreakdown.app_not_working;
    if (techIssues / total > 0.3) {
      suggestions.push('Focus on improving app stability and fixing technical issues');
    }

    // Check for billing confusion
    if (reasonBreakdown.billing_error / total > 0.2) {
      suggestions.push('Improve billing clarity and payment flow UI');
    }

    // Check for feature dissatisfaction
    if (reasonBreakdown.not_as_described / total > 0.25) {
      suggestions.push('Review app store description and onboarding flow');
    }

    // Check for accidental purchases
    if (reasonBreakdown.accidental_purchase / total > 0.2) {
      suggestions.push('Add purchase confirmation dialogs and trial periods');
    }

    if (suggestions.length === 0) {
      suggestions.push('Monitor refund patterns and customer feedback for improvement opportunities');
    }

    return suggestions;
  }

  private async triggerFraudAnalysis(
    paymentIntentId: string,
    trigger: string
  ): Promise<void> {
    try {
      // This would integrate with your fraud detection system
      await supabase
        .from('fraud_analysis_queue')
        .insert({
          payment_intent_id: paymentIntentId,
          trigger,
          status: 'pending',
          created_at: new Date(),
        });

    } catch (error) {
      console.error('[RefundService] Error triggering fraud analysis:', error);
    }
  }
}

export const refundService = RefundManagementService.getInstance();
export default RefundManagementService;