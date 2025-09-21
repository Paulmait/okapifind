import { Platform } from 'react-native';

export enum AnalyticsEvent {
  // Paywall Events
  PAYWALL_VIEW = 'paywall_view',
  PAYWALL_PURCHASE_SUCCESS = 'paywall_purchase_success',
  PAYWALL_PURCHASE_FAILED = 'paywall_purchase_failed',
  PAYWALL_PURCHASE_CANCELLED = 'paywall_purchase_cancelled',
  PAYWALL_RESTORE = 'paywall_restore',
  PAYWALL_RESTORE_SUCCESS = 'paywall_restore_success',
  PAYWALL_RESTORE_FAILED = 'paywall_restore_failed',
  PAYWALL_PACKAGE_SELECTED = 'paywall_package_selected',

  // Feature Gate Events
  FEATURE_GATED = 'feature_gated',
  PREMIUM_FEATURE_ACCESSED = 'premium_feature_accessed',

  // App Events
  APP_OPENED = 'app_opened',
  APP_BACKGROUNDED = 'app_backgrounded',

  // Parking Events
  PARKING_SAVED = 'parking_saved',
  PARKING_DETECTED = 'parking_detected',
  PARKING_CONFIRMED = 'parking_confirmed',
  PARKING_DISMISSED = 'parking_dismissed',
  NAVIGATION_STARTED = 'navigation_started',
  NAVIGATION_COMPLETED = 'navigation_completed',

  // Settings Events
  SETTING_CHANGED = 'setting_changed',
  DATA_CLEARED = 'data_cleared',
}

interface AnalyticsProperties {
  [key: string]: any;
}

class Analytics {
  private userId: string | null = null;
  private sessionId: string;
  private isEnabled: boolean = true;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  /**
   * Initialize analytics with user ID
   */
  initialize(userId?: string) {
    this.userId = userId || null;
    this.logEvent(AnalyticsEvent.APP_OPENED, {
      platform: Platform.OS,
      version: Platform.Version,
    });
  }

  /**
   * Set user ID for analytics tracking
   */
  setUserId(userId: string | null) {
    this.userId = userId;
    console.log('[Analytics] User ID set:', userId ? 'user_' + userId.slice(0, 8) : 'anonymous');
  }

  /**
   * Enable or disable analytics tracking
   */
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  /**
   * Log an analytics event
   */
  logEvent(event: AnalyticsEvent | string, properties?: AnalyticsProperties) {
    if (!this.isEnabled) {
      return;
    }

    const timestamp = new Date().toISOString();
    const eventData = {
      event,
      properties: {
        ...properties,
        platform: Platform.OS,
        session_id: this.sessionId,
        timestamp,
      },
      user_id: this.userId,
    };

    // Log to console in development
    if (__DEV__) {
      console.log('[Analytics]', event, eventData);
    }

    // Here you would send to your analytics service
    // Examples: Firebase Analytics, Amplitude, Mixpanel, etc.
    this.sendToAnalyticsService(eventData);
  }

  /**
   * Log a paywall view event
   */
  logPaywallView(source?: string) {
    this.logEvent(AnalyticsEvent.PAYWALL_VIEW, {
      source: source || 'unknown',
    });
  }

  /**
   * Log a successful purchase event
   */
  logPurchaseSuccess(packageId: string, price?: number, currency?: string) {
    this.logEvent(AnalyticsEvent.PAYWALL_PURCHASE_SUCCESS, {
      package_id: packageId,
      price,
      currency,
    });
  }

  /**
   * Log a failed purchase event
   */
  logPurchaseFailed(packageId: string, error: string) {
    this.logEvent(AnalyticsEvent.PAYWALL_PURCHASE_FAILED, {
      package_id: packageId,
      error,
    });
  }

  /**
   * Log a cancelled purchase event
   */
  logPurchaseCancelled(packageId: string) {
    this.logEvent(AnalyticsEvent.PAYWALL_PURCHASE_CANCELLED, {
      package_id: packageId,
    });
  }

  /**
   * Log a restore purchases event
   */
  logRestorePurchases() {
    this.logEvent(AnalyticsEvent.PAYWALL_RESTORE);
  }

  /**
   * Log a successful restore event
   */
  logRestoreSuccess(hadPremium: boolean) {
    this.logEvent(AnalyticsEvent.PAYWALL_RESTORE_SUCCESS, {
      had_premium: hadPremium,
    });
  }

  /**
   * Log a failed restore event
   */
  logRestoreFailed(error: string) {
    this.logEvent(AnalyticsEvent.PAYWALL_RESTORE_FAILED, {
      error,
    });
  }

  /**
   * Log when a package is selected
   */
  logPackageSelected(packageId: string, packageType: string) {
    this.logEvent(AnalyticsEvent.PAYWALL_PACKAGE_SELECTED, {
      package_id: packageId,
      package_type: packageType,
    });
  }

  /**
   * Log when a feature is gated
   */
  logFeatureGated(feature: string) {
    this.logEvent(AnalyticsEvent.FEATURE_GATED, {
      feature,
    });
  }

  /**
   * Log when a premium feature is accessed
   */
  logPremiumFeatureAccessed(feature: string) {
    this.logEvent(AnalyticsEvent.PREMIUM_FEATURE_ACCESSED, {
      feature,
    });
  }

  /**
   * Log parking saved event
   */
  logParkingSaved(method: 'manual' | 'auto_detection') {
    this.logEvent(AnalyticsEvent.PARKING_SAVED, {
      method,
    });
  }

  /**
   * Log parking detected event
   */
  logParkingDetected(confidence: number) {
    this.logEvent(AnalyticsEvent.PARKING_DETECTED, {
      confidence,
    });
  }

  /**
   * Log navigation started event
   */
  logNavigationStarted(distance: number) {
    this.logEvent(AnalyticsEvent.NAVIGATION_STARTED, {
      distance_meters: distance,
    });
  }

  /**
   * Send event data to analytics service
   */
  private sendToAnalyticsService(eventData: any) {
    // TODO: Implement actual analytics service integration
    // Examples:
    // - Firebase Analytics: firebase.analytics().logEvent(eventData.event, eventData.properties)
    // - Amplitude: amplitude.getInstance().logEvent(eventData.event, eventData.properties)
    // - Mixpanel: mixpanel.track(eventData.event, eventData.properties)

    // For now, we're just logging to console
    // Remove or modify this in production
    if (__DEV__) {
      // In development, you might want to send to a local server or just log
      return;
    }

    // Production analytics service integration would go here
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const analytics = new Analytics();

// Export convenience function
export const logEvent = (event: AnalyticsEvent | string, properties?: AnalyticsProperties) => {
  analytics.logEvent(event, properties);
};