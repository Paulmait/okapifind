// @ts-nocheck
/**
 * Webhook Management Service
 * CRITICAL: Enable third-party integrations and B2B partnerships
 * Supports enterprise clients and platform extensibility
 */

import { supabase } from '../lib/supabase-client';
import { analytics } from './analytics';
import * as Crypto from 'expo-crypto';

export type WebhookEvent =
  | 'parking.saved'
  | 'parking.found'
  | 'user.registered'
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.canceled'
  | 'referral.completed'
  | 'location.shared';

export interface Webhook {
  id: string;
  user_id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  active: boolean;
  created_at: string;
  last_triggered_at?: string;
  failure_count: number;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: WebhookEvent;
  payload: any;
  status: 'pending' | 'delivered' | 'failed';
  response_code?: number;
  response_body?: string;
  error_message?: string;
  delivered_at?: string;
  created_at: string;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: any;
  signature: string;
}

class WebhookService {
  private readonly MAX_RETRIES = 3;
  private readonly TIMEOUT = 10000; // 10 seconds

  /**
   * Register a new webhook
   */
  async registerWebhook(
    userId: string,
    url: string,
    events: WebhookEvent[]
  ): Promise<Webhook> {
    try {
      // Validate URL
      if (!this.isValidUrl(url)) {
        throw new Error('Invalid webhook URL');
      }

      // Generate secret
      const secret = await this.generateSecret();

      const { data, error } = await supabase
        .from('webhooks')
        .insert([{
          user_id: userId,
          url,
          events,
          secret,
          active: true,
          failure_count: 0,
        }])
        .select()
        .single();

      if (error) throw error;

      analytics.logEvent('webhook_registered', {
        user_id: userId,
        events: events.join(','),
      });

      return data;
    } catch (error) {
      console.error('Error registering webhook:', error);
      throw error;
    }
  }

  /**
   * Update webhook
   */
  async updateWebhook(
    webhookId: string,
    updates: Partial<Pick<Webhook, 'url' | 'events' | 'active'>>
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('webhooks')
        .update(updates)
        .eq('id', webhookId);

      if (error) throw error;

      analytics.logEvent('webhook_updated', {
        webhook_id: webhookId,
      });
    } catch (error) {
      console.error('Error updating webhook:', error);
      throw error;
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', webhookId);

      if (error) throw error;

      analytics.logEvent('webhook_deleted', {
        webhook_id: webhookId,
      });
    } catch (error) {
      console.error('Error deleting webhook:', error);
      throw error;
    }
  }

  /**
   * Get user's webhooks
   */
  async getUserWebhooks(userId: string): Promise<Webhook[]> {
    try {
      const { data, error } = await supabase
        .from('webhooks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      return [];
    }
  }

  /**
   * Trigger webhook event
   */
  async triggerEvent(
    event: WebhookEvent,
    data: any,
    userId?: string
  ): Promise<void> {
    try {
      // Get all webhooks subscribed to this event
      let query = supabase
        .from('webhooks')
        .select('*')
        .contains('events', [event])
        .eq('active', true);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: webhooks, error } = await query;

      if (error) throw error;

      if (!webhooks || webhooks.length === 0) {
        return;
      }

      // Trigger all webhooks
      const deliveryPromises = webhooks.map(webhook =>
        this.deliverWebhook(webhook, event, data)
      );

      await Promise.allSettled(deliveryPromises);
    } catch (error) {
      console.error('Error triggering webhook event:', error);
    }
  }

  /**
   * Deliver webhook to endpoint
   */
  private async deliverWebhook(
    webhook: Webhook,
    event: WebhookEvent,
    data: any
  ): Promise<void> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < this.MAX_RETRIES) {
      try {
        const payload = await this.buildPayload(webhook, event, data);

        // Create delivery record
        const { data: delivery, error: insertError } = await supabase
          .from('webhook_deliveries')
          .insert([{
            webhook_id: webhook.id,
            event_type: event,
            payload: data,
            status: 'pending',
          }])
          .select()
          .single();

        if (insertError) throw insertError;

        // Send webhook
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.TIMEOUT);

        try {
          const response = await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': payload.signature,
              'X-Webhook-Event': event,
              'X-Webhook-Timestamp': payload.timestamp,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          clearTimeout(timeout);

          const responseBody = await response.text();

          if (response.ok) {
            // Success
            await this.markDeliverySuccess(delivery.id, response.status, responseBody);
            await this.resetFailureCount(webhook.id);

            analytics.logEvent('webhook_delivered', {
              webhook_id: webhook.id,
              event,
              attempt: attempt + 1,
            });

            return;
          } else {
            throw new Error(`HTTP ${response.status}: ${responseBody}`);
          }
        } catch (fetchError) {
          clearTimeout(timeout);
          throw fetchError;
        }
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt >= this.MAX_RETRIES) {
          // Final failure
          await this.markDeliveryFailed(webhook.id, event, data, lastError.message);
          await this.incrementFailureCount(webhook.id);

          analytics.logEvent('webhook_delivery_failed', {
            webhook_id: webhook.id,
            event,
            error: lastError.message,
            attempts: this.MAX_RETRIES,
          });
        } else {
          // Retry with exponential backoff
          await new Promise(resolve =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }
  }

  /**
   * Build webhook payload with signature
   */
  private async buildPayload(
    webhook: Webhook,
    event: WebhookEvent,
    data: any
  ): Promise<WebhookPayload> {
    const timestamp = new Date().toISOString();
    const payloadString = JSON.stringify({ event, timestamp, data });

    // Generate HMAC signature
    const signature = await this.generateSignature(payloadString, webhook.secret);

    return {
      event,
      timestamp,
      data,
      signature,
    };
  }

  /**
   * Generate HMAC signature
   */
  private async generateSignature(payload: string, secret: string): Promise<string> {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      payload + secret
    );

    return digest;
  }

  /**
   * Generate webhook secret
   */
  private async generateSecret(): Promise<string> {
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate URL
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Mark delivery as successful
   */
  private async markDeliverySuccess(
    deliveryId: string,
    responseCode: number,
    responseBody: string
  ): Promise<void> {
    await supabase
      .from('webhook_deliveries')
      .update({
        status: 'delivered',
        response_code: responseCode,
        response_body: responseBody.substring(0, 1000), // Limit size
        delivered_at: new Date().toISOString(),
      })
      .eq('id', deliveryId);
  }

  /**
   * Mark delivery as failed
   */
  private async markDeliveryFailed(
    webhookId: string,
    event: WebhookEvent,
    payload: any,
    errorMessage: string
  ): Promise<void> {
    await supabase
      .from('webhook_deliveries')
      .insert([{
        webhook_id: webhookId,
        event_type: event,
        payload,
        status: 'failed',
        error_message: errorMessage.substring(0, 500),
      }]);
  }

  /**
   * Reset failure count
   */
  private async resetFailureCount(webhookId: string): Promise<void> {
    await supabase
      .from('webhooks')
      .update({
        failure_count: 0,
        last_triggered_at: new Date().toISOString(),
      })
      .eq('id', webhookId);
  }

  /**
   * Increment failure count
   */
  private async incrementFailureCount(webhookId: string): Promise<void> {
    const { data: webhook } = await supabase
      .from('webhooks')
      .select('failure_count')
      .eq('id', webhookId)
      .single();

    if (!webhook) return;

    const newCount = webhook.failure_count + 1;

    // Disable webhook after 10 failures
    const updates: any = {
      failure_count: newCount,
      last_triggered_at: new Date().toISOString(),
    };

    if (newCount >= 10) {
      updates.active = false;
    }

    await supabase
      .from('webhooks')
      .update(updates)
      .eq('id', webhookId);
  }

  /**
   * Get webhook deliveries
   */
  async getDeliveries(
    webhookId: string,
    limit: number = 50
  ): Promise<WebhookDelivery[]> {
    try {
      const { data, error } = await supabase
        .from('webhook_deliveries')
        .select('*')
        .eq('webhook_id', webhookId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      return [];
    }
  }

  /**
   * Verify webhook signature (for incoming webhooks)
   */
  async verifySignature(
    payload: string,
    signature: string,
    secret: string
  ): Promise<boolean> {
    const expectedSignature = await this.generateSignature(payload, secret);
    return signature === expectedSignature;
  }

  /**
   * Test webhook
   */
  async testWebhook(webhookId: string): Promise<boolean> {
    try {
      const { data: webhook, error } = await supabase
        .from('webhooks')
        .select('*')
        .eq('id', webhookId)
        .single();

      if (error || !webhook) throw new Error('Webhook not found');

      await this.deliverWebhook(webhook, 'parking.saved', {
        test: true,
        message: 'This is a test webhook delivery',
      });

      return true;
    } catch (error) {
      console.error('Error testing webhook:', error);
      return false;
    }
  }
}

// Export singleton instance
export const webhookService = new WebhookService();

// Export webhook event types
export const WebhookEvents: Record<string, WebhookEvent> = {
  PARKING_SAVED: 'parking.saved',
  PARKING_FOUND: 'parking.found',
  USER_REGISTERED: 'user.registered',
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_UPDATED: 'subscription.updated',
  SUBSCRIPTION_CANCELED: 'subscription.canceled',
  REFERRAL_COMPLETED: 'referral.completed',
  LOCATION_SHARED: 'location.shared',
} as const;

export default webhookService;