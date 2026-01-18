// @ts-nocheck
/**
 * Enhanced Data Tracking Service
 * Comprehensive user analytics with GDPR/CCPA compliance
 * Tracks all legally permitted user interactions while respecting privacy
 */

import { Platform } from 'react-native';
import CryptoJS from 'crypto-js';
import { supabase } from '../config/supabase';
import { analytics } from './analytics';

// Data types
interface UserSession {
  sessionId: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  appVersion: string;
  platform: string;
  osVersion: string;
  deviceModel: string;
  networkType: string;
  isAnonymized: boolean;
}

interface ClickEvent {
  eventId: string;
  sessionId: string;
  userId?: string;
  elementId: string;
  elementType: string;
  screen: string;
  coordinates: { x: number; y: number };
  timestamp: Date;
  isAnonymized: boolean;
}

interface UserJourney {
  journeyId: string;
  sessionId: string;
  userId?: string;
  screens: Array<{
    screen: string;
    entryTime: Date;
    exitTime?: Date;
    actions: string[];
  }>;
  funnelStage: string;
  conversionGoal?: string;
  isCompleted: boolean;
  isAnonymized: boolean;
}

interface ErrorEvent {
  errorId: string;
  sessionId: string;
  userId?: string;
  errorMessage: string;
  stackTrace: string;
  screen: string;
  errorType: 'crash' | 'api' | 'network' | 'payment' | 'location' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  deviceInfo: any;
  isAnonymized: boolean;
}

interface PerformanceMetrics {
  metricId: string;
  sessionId: string;
  userId?: string;
  screenName: string;
  loadTime: number;
  renderTime: number;
  jsHeapSize: number;
  frameDrop: number;
  apiResponseTimes: Array<{ endpoint: string; responseTime: number }>;
  timestamp: Date;
  isAnonymized: boolean;
}

interface ABTestResult {
  testId: string;
  variant: string;
  userId?: string;
  sessionId: string;
  conversionEvent?: string;
  timestamp: Date;
  isAnonymized: boolean;
}

interface UserFeedback {
  feedbackId: string;
  userId?: string;
  sessionId: string;
  type: 'rating' | 'bug_report' | 'feature_request' | 'support';
  rating?: number;
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  timestamp: Date;
  isAnonymized: boolean;
}

// Consent types
interface UserConsent {
  userId?: string;
  analyticsConsent: boolean;
  performanceConsent: boolean;
  crashReportingConsent: boolean;
  personalizedAdsConsent: boolean;
  consentTimestamp: Date;
  consentVersion: string;
}

class EnhancedDataTrackingService {
  private static instance: EnhancedDataTrackingService;
  private currentSession: UserSession | null = null;
  private userConsent: UserConsent | null = null;
  private encryptionKey: string;
  private isInitialized = false;
  private eventQueue: any[] = [];
  private isOffline = false;

  constructor() {
    this.encryptionKey = this.generateEncryptionKey();
  }

  static getInstance(): EnhancedDataTrackingService {
    if (!EnhancedDataTrackingService.instance) {
      EnhancedDataTrackingService.instance = new EnhancedDataTrackingService();
    }
    return EnhancedDataTrackingService.instance;
  }

  /**
   * Initialize tracking with user consent
   */
  async initialize(consent: UserConsent): Promise<void> {
    try {
      this.userConsent = consent;
      this.isInitialized = true;

      // Start session tracking if consent given
      if (consent.analyticsConsent) {
        await this.startSession();
      }

      // Store consent in secure storage
      await this.storeConsent(consent);

      console.log('[DataTracking] Initialized with consent:', consent);
    } catch (error) {
      console.error('[DataTracking] Initialization error:', error);
    }
  }

  /**
   * Update user consent
   */
  async updateConsent(consent: UserConsent): Promise<void> {
    const oldConsent = this.userConsent;
    this.userConsent = consent;

    // If analytics consent was revoked, anonymize existing data
    if (oldConsent?.analyticsConsent && !consent.analyticsConsent) {
      await this.anonymizeUserData(consent.userId);
    }

    // If consent was granted, start tracking
    if (!oldConsent?.analyticsConsent && consent.analyticsConsent) {
      await this.startSession();
    }

    await this.storeConsent(consent);
  }

  /**
   * Start new user session
   */
  async startSession(userId?: string): Promise<void> {
    if (!this.canTrack('analytics')) return;

    try {
      const sessionId = this.generateSessionId();

      this.currentSession = {
        sessionId,
        userId: this.shouldAnonymize() ? undefined : userId,
        startTime: new Date(),
        appVersion: '1.0.0', // Get from app config
        platform: Platform.OS,
        osVersion: Platform.Version.toString(),
        deviceModel: await this.getDeviceModel(),
        networkType: await this.getNetworkType(),
        isAnonymized: this.shouldAnonymize(),
      };

      await this.storeEvent('user_sessions', this.currentSession);

      // Track session start in analytics
      analytics.logEvent('session_started', {
        session_id: sessionId,
        is_anonymized: this.shouldAnonymize(),
      });

    } catch (error) {
      console.error('[DataTracking] Session start error:', error);
    }
  }

  /**
   * End current session
   */
  async endSession(): Promise<void> {
    if (!this.currentSession) return;

    try {
      this.currentSession.endTime = new Date();

      await this.updateEvent('user_sessions', this.currentSession.sessionId, {
        endTime: this.currentSession.endTime,
      });

      // Track session duration
      const duration = this.currentSession.endTime.getTime() - this.currentSession.startTime.getTime();
      analytics.logEvent('session_ended', {
        session_id: this.currentSession.sessionId,
        duration_ms: duration,
      });

      this.currentSession = null;
    } catch (error) {
      console.error('[DataTracking] Session end error:', error);
    }
  }

  /**
   * Track click/tap events
   */
  async trackClick(
    elementId: string,
    elementType: string,
    screen: string,
    coordinates: { x: number; y: number }
  ): Promise<void> {
    if (!this.canTrack('analytics') || !this.currentSession) return;

    try {
      const clickEvent: ClickEvent = {
        eventId: this.generateEventId(),
        sessionId: this.currentSession.sessionId,
        userId: this.shouldAnonymize() ? undefined : this.currentSession.userId,
        elementId,
        elementType,
        screen,
        coordinates,
        timestamp: new Date(),
        isAnonymized: this.shouldAnonymize(),
      };

      await this.storeEvent('click_events', clickEvent);

      // Also track in general analytics
      analytics.logEvent('ui_interaction', {
        element_id: elementId,
        element_type: elementType,
        screen,
      });

    } catch (error) {
      console.error('[DataTracking] Click tracking error:', error);
    }
  }

  /**
   * Track user journey through app
   */
  async trackUserJourney(
    screen: string,
    action?: string,
    funnelStage?: string
  ): Promise<void> {
    if (!this.canTrack('analytics') || !this.currentSession) return;

    try {
      // Get or create journey for this session
      let journey = await this.getCurrentJourney();

      if (!journey) {
        journey = {
          journeyId: this.generateEventId(),
          sessionId: this.currentSession.sessionId,
          userId: this.shouldAnonymize() ? undefined : this.currentSession.userId,
          screens: [],
          funnelStage: funnelStage || 'discovery',
          isCompleted: false,
          isAnonymized: this.shouldAnonymize(),
        };
      }

      // Update current screen exit time
      if (journey.screens.length > 0) {
        const lastScreen = journey.screens[journey.screens.length - 1];
        if (!lastScreen.exitTime) {
          lastScreen.exitTime = new Date();
        }
      }

      // Add new screen
      journey.screens.push({
        screen,
        entryTime: new Date(),
        actions: action ? [action] : [],
      });

      if (funnelStage) {
        journey.funnelStage = funnelStage;
      }

      await this.storeEvent('user_journeys', journey);

    } catch (error) {
      console.error('[DataTracking] Journey tracking error:', error);
    }
  }

  /**
   * Track errors with detailed context
   */
  async trackError(
    error: Error,
    screen: string,
    errorType: ErrorEvent['errorType'] = 'other',
    severity: ErrorEvent['severity'] = 'medium'
  ): Promise<void> {
    if (!this.canTrack('crashReporting')) return;

    try {
      const errorEvent: ErrorEvent = {
        errorId: this.generateEventId(),
        sessionId: this.currentSession?.sessionId || 'no-session',
        userId: this.shouldAnonymize() ? undefined : this.currentSession?.userId,
        errorMessage: error.message,
        stackTrace: error.stack || '',
        screen,
        errorType,
        severity,
        timestamp: new Date(),
        deviceInfo: await this.getDeviceInfo(),
        isAnonymized: this.shouldAnonymize(),
      };

      await this.storeEvent('error_events', errorEvent);

      // Also track in general analytics
      analytics.logError(errorType, error.message, screen);

    } catch (trackingError) {
      console.error('[DataTracking] Error tracking failed:', trackingError);
    }
  }

  /**
   * Track performance metrics
   */
  async trackPerformance(
    screenName: string,
    metrics: {
      loadTime: number;
      renderTime: number;
      jsHeapSize?: number;
      frameDrop?: number;
      apiResponseTimes?: Array<{ endpoint: string; responseTime: number }>;
    }
  ): Promise<void> {
    if (!this.canTrack('performance') || !this.currentSession) return;

    try {
      const performanceEvent: PerformanceMetrics = {
        metricId: this.generateEventId(),
        sessionId: this.currentSession.sessionId,
        userId: this.shouldAnonymize() ? undefined : this.currentSession.userId,
        screenName,
        loadTime: metrics.loadTime,
        renderTime: metrics.renderTime,
        jsHeapSize: metrics.jsHeapSize || 0,
        frameDrop: metrics.frameDrop || 0,
        apiResponseTimes: metrics.apiResponseTimes || [],
        timestamp: new Date(),
        isAnonymized: this.shouldAnonymize(),
      };

      await this.storeEvent('performance_metrics', performanceEvent);

    } catch (error) {
      console.error('[DataTracking] Performance tracking error:', error);
    }
  }

  /**
   * Track A/B test results
   */
  async trackABTest(
    testId: string,
    variant: string,
    conversionEvent?: string
  ): Promise<void> {
    if (!this.canTrack('analytics') || !this.currentSession) return;

    try {
      const abTestResult: ABTestResult = {
        testId,
        variant,
        userId: this.shouldAnonymize() ? undefined : this.currentSession.userId,
        sessionId: this.currentSession.sessionId,
        conversionEvent,
        timestamp: new Date(),
        isAnonymized: this.shouldAnonymize(),
      };

      await this.storeEvent('ab_test_results', abTestResult);

    } catch (error) {
      console.error('[DataTracking] A/B test tracking error:', error);
    }
  }

  /**
   * Track user feedback with sentiment analysis
   */
  async trackFeedback(
    type: UserFeedback['type'],
    text: string,
    rating?: number
  ): Promise<void> {
    if (!this.canTrack('analytics')) return;

    try {
      const sentiment = await this.analyzeSentiment(text);

      const feedback: UserFeedback = {
        feedbackId: this.generateEventId(),
        userId: this.shouldAnonymize() ? undefined : this.currentSession?.userId,
        sessionId: this.currentSession?.sessionId || 'no-session',
        type,
        rating,
        text: this.shouldAnonymize() ? this.anonymizeText(text) : text,
        sentiment: sentiment.label,
        sentimentScore: sentiment.score,
        timestamp: new Date(),
        isAnonymized: this.shouldAnonymize(),
      };

      await this.storeEvent('user_feedback', feedback);

      // Track in analytics
      analytics.logFeedbackSubmitted(type, rating);

    } catch (error) {
      console.error('[DataTracking] Feedback tracking error:', error);
    }
  }

  /**
   * Export user data for GDPR compliance
   */
  async exportUserData(userId: string): Promise<any> {
    try {
      const tables = [
        'user_sessions',
        'click_events',
        'user_journeys',
        'error_events',
        'performance_metrics',
        'ab_test_results',
        'user_feedback',
      ];

      const userData: any = {};

      for (const table of tables) {
        const { data } = await supabase
          .from(table)
          .select('*')
          .eq('userId', userId);

        userData[table] = data || [];
      }

      return {
        exportedAt: new Date().toISOString(),
        userId,
        data: userData,
      };

    } catch (error) {
      console.error('[DataTracking] Data export error:', error);
      throw error;
    }
  }

  /**
   * Delete user data for GDPR compliance
   */
  async deleteUserData(userId: string): Promise<void> {
    try {
      const tables = [
        'user_sessions',
        'click_events',
        'user_journeys',
        'error_events',
        'performance_metrics',
        'ab_test_results',
        'user_feedback',
      ];

      for (const table of tables) {
        await supabase
          .from(table)
          .delete()
          .eq('userId', userId);
      }

      console.log(`[DataTracking] Deleted all data for user ${userId}`);

    } catch (error) {
      console.error('[DataTracking] Data deletion error:', error);
      throw error;
    }
  }

  /**
   * Anonymize user data
   */
  async anonymizeUserData(userId?: string): Promise<void> {
    if (!userId) return;

    try {
      const tables = [
        'user_sessions',
        'click_events',
        'user_journeys',
        'error_events',
        'performance_metrics',
        'ab_test_results',
        'user_feedback',
      ];

      for (const table of tables) {
        await supabase
          .from(table)
          .update({
            userId: null,
            isAnonymized: true
          })
          .eq('userId', userId);
      }

      console.log(`[DataTracking] Anonymized data for user ${userId}`);

    } catch (error) {
      console.error('[DataTracking] Data anonymization error:', error);
    }
  }

  // Private helper methods

  private canTrack(type: 'analytics' | 'performance' | 'crashReporting'): boolean {
    if (!this.isInitialized || !this.userConsent) return false;

    switch (type) {
      case 'analytics':
        return this.userConsent.analyticsConsent;
      case 'performance':
        return this.userConsent.performanceConsent;
      case 'crashReporting':
        return this.userConsent.crashReportingConsent;
      default:
        return false;
    }
  }

  private shouldAnonymize(): boolean {
    return !this.userConsent?.analyticsConsent ||
           !this.userConsent?.personalizedAdsConsent;
  }

  private async storeEvent(table: string, data: any): Promise<void> {
    try {
      // Encrypt sensitive data
      const encryptedData = this.encryptSensitiveData(data);

      if (this.isOffline) {
        this.eventQueue.push({ table, data: encryptedData });
        return;
      }

      const { error } = await supabase
        .from(table)
        .insert(encryptedData);

      if (error) {
        console.error(`[DataTracking] Storage error for ${table}:`, error);
        // Queue for retry
        this.eventQueue.push({ table, data: encryptedData });
      }

    } catch (error) {
      console.error('[DataTracking] Event storage error:', error);
      this.eventQueue.push({ table, data });
    }
  }

  private async updateEvent(table: string, id: string, updates: any): Promise<void> {
    try {
      const { error } = await supabase
        .from(table)
        .update(updates)
        .eq('sessionId', id);

      if (error) {
        console.error(`[DataTracking] Update error for ${table}:`, error);
      }

    } catch (error) {
      console.error('[DataTracking] Event update error:', error);
    }
  }

  private async getCurrentJourney(): Promise<UserJourney | null> {
    if (!this.currentSession) return null;

    try {
      const { data } = await supabase
        .from('user_journeys')
        .select('*')
        .eq('sessionId', this.currentSession.sessionId)
        .eq('isCompleted', false)
        .single();

      return data;
    } catch {
      return null;
    }
  }

  private async storeConsent(consent: UserConsent): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_consent')
        .upsert(consent);

      if (error) {
        console.error('[DataTracking] Consent storage error:', error);
      }
    } catch (error) {
      console.error('[DataTracking] Consent storage error:', error);
    }
  }

  private encryptSensitiveData(data: any): any {
    const sensitiveFields = ['userId', 'text', 'errorMessage', 'stackTrace'];
    const encrypted = { ...data };

    for (const field of sensitiveFields) {
      if (encrypted[field] && !encrypted.isAnonymized) {
        encrypted[field] = this.encrypt(encrypted[field]);
      }
    }

    return encrypted;
  }

  private encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, this.encryptionKey).toString();
  }

  private decrypt(encryptedText: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedText, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  private anonymizeText(text: string): string {
    // Replace email addresses, phone numbers, etc.
    return text
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]')
      .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD]');
  }

  private async analyzeSentiment(text: string): Promise<{ label: 'positive' | 'negative' | 'neutral'; score: number }> {
    // Simple sentiment analysis - in production, use ML service
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'perfect', 'awesome'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'stupid'];

    const words = text.toLowerCase().split(/\s+/);
    let score = 0;

    words.forEach(word => {
      if (positiveWords.includes(word)) score += 1;
      if (negativeWords.includes(word)) score -= 1;
    });

    const normalizedScore = Math.max(-1, Math.min(1, score / words.length));

    return {
      label: normalizedScore > 0.1 ? 'positive' : normalizedScore < -0.1 ? 'negative' : 'neutral',
      score: normalizedScore,
    };
  }

  private async getDeviceModel(): Promise<string> {
    // In production, use react-native-device-info
    return Platform.OS === 'ios' ? 'iPhone' : 'Android Device';
  }

  private async getNetworkType(): Promise<string> {
    // In production, use @react-native-community/netinfo
    return 'wifi';
  }

  private async getDeviceInfo(): Promise<any> {
    return {
      platform: Platform.OS,
      version: Platform.Version,
      // Add more device info as needed
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEncryptionKey(): string {
    // In production, use secure key management
    return 'okapifind_tracking_key_' + Date.now();
  }

  /**
   * Flush queued events when back online
   */
  async flushEventQueue(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    console.log(`[DataTracking] Flushing ${this.eventQueue.length} queued events`);

    const queue = [...this.eventQueue];
    this.eventQueue = [];

    for (const event of queue) {
      try {
        await this.storeEvent(event.table, event.data);
      } catch (error) {
        console.error('[DataTracking] Failed to flush event:', error);
        this.eventQueue.push(event); // Re-queue failed events
      }
    }
  }

  /**
   * Set network status
   */
  setNetworkStatus(isOnline: boolean): void {
    const wasOffline = this.isOffline;
    this.isOffline = !isOnline;

    // Flush queue when coming back online
    if (wasOffline && isOnline) {
      this.flushEventQueue();
    }
  }
}

export const dataTracking = EnhancedDataTrackingService.getInstance();
export default EnhancedDataTrackingService;