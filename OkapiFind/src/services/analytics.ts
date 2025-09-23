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
  APP_FOREGROUNDED = 'app_foregrounded',
  APP_CRASHED = 'app_crashed',

  // Conversion Events
  TRIAL_STARTED = 'trial_started',
  TRIAL_ENDED = 'trial_ended',
  SUBSCRIPTION_STARTED = 'subscription_started',
  SUBSCRIPTION_RENEWED = 'subscription_renewed',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
  SUBSCRIPTION_EXPIRED = 'subscription_expired',
  SUBSCRIPTION_REACTIVATED = 'subscription_reactivated',

  // Parking Events
  PARKING_SAVED = 'parking_saved',
  PARKING_DETECTED = 'parking_detected',
  PARKING_CONFIRMED = 'parking_confirmed',
  PARKING_DISMISSED = 'parking_dismissed',
  NAVIGATION_STARTED = 'navigation_started',
  NAVIGATION_COMPLETED = 'navigation_completed',
  PARKING_TIMER_SET = 'parking_timer_set',
  PARKING_TIMER_EXPIRED = 'parking_timer_expired',
  PARKING_PHOTO_TAKEN = 'parking_photo_taken',
  PARKING_LOCATION_SHARED = 'parking_location_shared',

  // Onboarding Events
  ONBOARDING_STARTED = 'onboarding_started',
  ONBOARDING_STEP_COMPLETED = 'onboarding_step_completed',
  ONBOARDING_COMPLETED = 'onboarding_completed',
  ONBOARDING_SKIPPED = 'onboarding_skipped',
  PERMISSIONS_REQUESTED = 'permissions_requested',
  PERMISSIONS_GRANTED = 'permissions_granted',
  PERMISSIONS_DENIED = 'permissions_denied',

  // Engagement Events
  FEATURE_DISCOVERED = 'feature_discovered',
  FEATURE_USED = 'feature_used',
  TUTORIAL_STARTED = 'tutorial_started',
  TUTORIAL_COMPLETED = 'tutorial_completed',
  HELP_VIEWED = 'help_viewed',
  FEEDBACK_SUBMITTED = 'feedback_submitted',
  RATING_PROMPT_SHOWN = 'rating_prompt_shown',
  RATING_SUBMITTED = 'rating_submitted',

  // Referral Events
  REFERRAL_LINK_GENERATED = 'referral_link_generated',
  REFERRAL_LINK_SHARED = 'referral_link_shared',
  REFERRAL_INVITE_SENT = 'referral_invite_sent',
  REFERRAL_SIGNUP_COMPLETED = 'referral_signup_completed',
  REFERRAL_REWARD_EARNED = 'referral_reward_earned',
  REFERRAL_REWARD_REDEEMED = 'referral_reward_redeemed',

  // Notification Events
  NOTIFICATION_PERMISSION_REQUESTED = 'notification_permission_requested',
  NOTIFICATION_PERMISSION_GRANTED = 'notification_permission_granted',
  NOTIFICATION_PERMISSION_DENIED = 'notification_permission_denied',
  NOTIFICATION_SENT = 'notification_sent',
  NOTIFICATION_RECEIVED = 'notification_received',
  NOTIFICATION_OPENED = 'notification_opened',
  NOTIFICATION_DISMISSED = 'notification_dismissed',

  // Win-back Events
  WINBACK_CAMPAIGN_TRIGGERED = 'winback_campaign_triggered',
  WINBACK_EMAIL_SENT = 'winback_email_sent',
  WINBACK_EMAIL_OPENED = 'winback_email_opened',
  WINBACK_EMAIL_CLICKED = 'winback_email_clicked',
  WINBACK_CONVERSION = 'winback_conversion',

  // Error Events
  ERROR_OCCURRED = 'error_occurred',
  API_ERROR = 'api_error',
  NETWORK_ERROR = 'network_error',
  LOCATION_ERROR = 'location_error',
  PAYMENT_ERROR = 'payment_error',

  // Settings Events
  SETTING_CHANGED = 'setting_changed',
  DATA_CLEARED = 'data_cleared',
  ACCOUNT_DELETED = 'account_deleted',
  PRIVACY_SETTING_CHANGED = 'privacy_setting_changed',

  // Search Events
  SEARCH_PERFORMED = 'search_performed',
  SEARCH_RESULTS_VIEWED = 'search_results_viewed',
  SEARCH_RESULT_SELECTED = 'search_result_selected',
  SEARCH_NO_RESULTS = 'search_no_results',

  // Social Events
  CONTENT_SHARED = 'content_shared',
  SOCIAL_LOGIN_ATTEMPTED = 'social_login_attempted',
  SOCIAL_LOGIN_COMPLETED = 'social_login_completed',
  SOCIAL_LOGIN_FAILED = 'social_login_failed',
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
   * Log subscription conversion events
   */
  logTrialStarted(trialType: string, trialDurationDays: number) {
    this.logEvent(AnalyticsEvent.TRIAL_STARTED, {
      trial_type: trialType,
      trial_duration_days: trialDurationDays,
    });
  }

  logTrialEnded(converted: boolean, trialType: string) {
    this.logEvent(AnalyticsEvent.TRIAL_ENDED, {
      converted,
      trial_type: trialType,
    });
  }

  logSubscriptionStarted(planId: string, price: number, currency: string, billingPeriod: string) {
    this.logEvent(AnalyticsEvent.SUBSCRIPTION_STARTED, {
      plan_id: planId,
      price,
      currency,
      billing_period: billingPeriod,
    });
  }

  logSubscriptionRenewed(planId: string, price: number, currency: string) {
    this.logEvent(AnalyticsEvent.SUBSCRIPTION_RENEWED, {
      plan_id: planId,
      price,
      currency,
    });
  }

  logSubscriptionCancelled(planId: string, reason?: string) {
    this.logEvent(AnalyticsEvent.SUBSCRIPTION_CANCELLED, {
      plan_id: planId,
      reason,
    });
  }

  logSubscriptionExpired(planId: string) {
    this.logEvent(AnalyticsEvent.SUBSCRIPTION_EXPIRED, {
      plan_id: planId,
    });
  }

  logSubscriptionReactivated(planId: string) {
    this.logEvent(AnalyticsEvent.SUBSCRIPTION_REACTIVATED, {
      plan_id: planId,
    });
  }

  /**
   * Log onboarding events
   */
  logOnboardingStarted() {
    this.logEvent(AnalyticsEvent.ONBOARDING_STARTED);
  }

  logOnboardingStepCompleted(step: number, stepName: string) {
    this.logEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
      step,
      step_name: stepName,
    });
  }

  logOnboardingCompleted(totalSteps: number, completionTimeSeconds: number) {
    this.logEvent(AnalyticsEvent.ONBOARDING_COMPLETED, {
      total_steps: totalSteps,
      completion_time_seconds: completionTimeSeconds,
    });
  }

  logOnboardingSkipped(atStep: number, stepName: string) {
    this.logEvent(AnalyticsEvent.ONBOARDING_SKIPPED, {
      at_step: atStep,
      step_name: stepName,
    });
  }

  /**
   * Log permission events
   */
  logPermissionsRequested(permissionType: string) {
    this.logEvent(AnalyticsEvent.PERMISSIONS_REQUESTED, {
      permission_type: permissionType,
    });
  }

  logPermissionsGranted(permissionType: string) {
    this.logEvent(AnalyticsEvent.PERMISSIONS_GRANTED, {
      permission_type: permissionType,
    });
  }

  logPermissionsDenied(permissionType: string) {
    this.logEvent(AnalyticsEvent.PERMISSIONS_DENIED, {
      permission_type: permissionType,
    });
  }

  /**
   * Log engagement events
   */
  logFeatureDiscovered(featureName: string, discoveryMethod: string) {
    this.logEvent(AnalyticsEvent.FEATURE_DISCOVERED, {
      feature_name: featureName,
      discovery_method: discoveryMethod,
    });
  }

  logFeatureUsed(featureName: string, usageContext?: string) {
    this.logEvent(AnalyticsEvent.FEATURE_USED, {
      feature_name: featureName,
      usage_context: usageContext,
    });
  }

  logTutorialStarted(tutorialName: string) {
    this.logEvent(AnalyticsEvent.TUTORIAL_STARTED, {
      tutorial_name: tutorialName,
    });
  }

  logTutorialCompleted(tutorialName: string, completionTimeSeconds: number) {
    this.logEvent(AnalyticsEvent.TUTORIAL_COMPLETED, {
      tutorial_name: tutorialName,
      completion_time_seconds: completionTimeSeconds,
    });
  }

  logHelpViewed(helpTopic: string, helpContext?: string) {
    this.logEvent(AnalyticsEvent.HELP_VIEWED, {
      help_topic: helpTopic,
      help_context: helpContext,
    });
  }

  logFeedbackSubmitted(feedbackType: string, rating?: number) {
    this.logEvent(AnalyticsEvent.FEEDBACK_SUBMITTED, {
      feedback_type: feedbackType,
      rating,
    });
  }

  logRatingPromptShown(promptContext: string) {
    this.logEvent(AnalyticsEvent.RATING_PROMPT_SHOWN, {
      prompt_context: promptContext,
    });
  }

  logRatingSubmitted(rating: number, reviewText?: string) {
    this.logEvent(AnalyticsEvent.RATING_SUBMITTED, {
      rating,
      has_review_text: !!reviewText,
    });
  }

  /**
   * Log referral events
   */
  logReferralLinkGenerated(referralCode: string) {
    this.logEvent(AnalyticsEvent.REFERRAL_LINK_GENERATED, {
      referral_code: referralCode,
    });
  }

  logReferralLinkShared(shareMethod: string, referralCode: string) {
    this.logEvent(AnalyticsEvent.REFERRAL_LINK_SHARED, {
      share_method: shareMethod,
      referral_code: referralCode,
    });
  }

  logReferralInviteSent(inviteMethod: string, recipientCount: number) {
    this.logEvent(AnalyticsEvent.REFERRAL_INVITE_SENT, {
      invite_method: inviteMethod,
      recipient_count: recipientCount,
    });
  }

  logReferralSignupCompleted(referralCode: string) {
    this.logEvent(AnalyticsEvent.REFERRAL_SIGNUP_COMPLETED, {
      referral_code: referralCode,
    });
  }

  logReferralRewardEarned(rewardType: string, rewardValue: number, referralCode: string) {
    this.logEvent(AnalyticsEvent.REFERRAL_REWARD_EARNED, {
      reward_type: rewardType,
      reward_value: rewardValue,
      referral_code: referralCode,
    });
  }

  logReferralRewardRedeemed(rewardType: string, rewardValue: number) {
    this.logEvent(AnalyticsEvent.REFERRAL_REWARD_REDEEMED, {
      reward_type: rewardType,
      reward_value: rewardValue,
    });
  }

  /**
   * Log notification events
   */
  logNotificationPermissionRequested() {
    this.logEvent(AnalyticsEvent.NOTIFICATION_PERMISSION_REQUESTED);
  }

  logNotificationPermissionGranted() {
    this.logEvent(AnalyticsEvent.NOTIFICATION_PERMISSION_GRANTED);
  }

  logNotificationPermissionDenied() {
    this.logEvent(AnalyticsEvent.NOTIFICATION_PERMISSION_DENIED);
  }

  logNotificationSent(notificationType: string, notificationId: string) {
    this.logEvent(AnalyticsEvent.NOTIFICATION_SENT, {
      notification_type: notificationType,
      notification_id: notificationId,
    });
  }

  logNotificationReceived(notificationType: string, notificationId: string) {
    this.logEvent(AnalyticsEvent.NOTIFICATION_RECEIVED, {
      notification_type: notificationType,
      notification_id: notificationId,
    });
  }

  logNotificationOpened(notificationType: string, notificationId: string) {
    this.logEvent(AnalyticsEvent.NOTIFICATION_OPENED, {
      notification_type: notificationType,
      notification_id: notificationId,
    });
  }

  logNotificationDismissed(notificationType: string, notificationId: string) {
    this.logEvent(AnalyticsEvent.NOTIFICATION_DISMISSED, {
      notification_type: notificationType,
      notification_id: notificationId,
    });
  }

  /**
   * Log win-back campaign events
   */
  logWinbackCampaignTriggered(campaignType: string, userId: string, daysSinceLastUse: number) {
    this.logEvent(AnalyticsEvent.WINBACK_CAMPAIGN_TRIGGERED, {
      campaign_type: campaignType,
      user_id: userId,
      days_since_last_use: daysSinceLastUse,
    });
  }

  logWinbackEmailSent(campaignType: string, emailTemplate: string) {
    this.logEvent(AnalyticsEvent.WINBACK_EMAIL_SENT, {
      campaign_type: campaignType,
      email_template: emailTemplate,
    });
  }

  logWinbackEmailOpened(campaignType: string, emailTemplate: string) {
    this.logEvent(AnalyticsEvent.WINBACK_EMAIL_OPENED, {
      campaign_type: campaignType,
      email_template: emailTemplate,
    });
  }

  logWinbackEmailClicked(campaignType: string, linkType: string) {
    this.logEvent(AnalyticsEvent.WINBACK_EMAIL_CLICKED, {
      campaign_type: campaignType,
      link_type: linkType,
    });
  }

  logWinbackConversion(campaignType: string, conversionType: string) {
    this.logEvent(AnalyticsEvent.WINBACK_CONVERSION, {
      campaign_type: campaignType,
      conversion_type: conversionType,
    });
  }

  /**
   * Log error events
   */
  logError(errorType: string, errorMessage: string, errorContext?: string) {
    this.logEvent(AnalyticsEvent.ERROR_OCCURRED, {
      error_type: errorType,
      error_message: errorMessage,
      error_context: errorContext,
    });
  }

  logApiError(endpoint: string, statusCode: number, errorMessage: string) {
    this.logEvent(AnalyticsEvent.API_ERROR, {
      endpoint,
      status_code: statusCode,
      error_message: errorMessage,
    });
  }

  logNetworkError(errorType: string, errorMessage: string) {
    this.logEvent(AnalyticsEvent.NETWORK_ERROR, {
      error_type: errorType,
      error_message: errorMessage,
    });
  }

  logLocationError(errorType: string, errorMessage: string) {
    this.logEvent(AnalyticsEvent.LOCATION_ERROR, {
      error_type: errorType,
      error_message: errorMessage,
    });
  }

  logPaymentError(errorType: string, errorMessage: string, productId?: string) {
    this.logEvent(AnalyticsEvent.PAYMENT_ERROR, {
      error_type: errorType,
      error_message: errorMessage,
      product_id: productId,
    });
  }

  /**
   * Log search events
   */
  logSearchPerformed(query: string, searchContext: string) {
    this.logEvent(AnalyticsEvent.SEARCH_PERFORMED, {
      query: query.length > 50 ? query.substring(0, 50) + '...' : query,
      search_context: searchContext,
      query_length: query.length,
    });
  }

  logSearchResultsViewed(query: string, resultCount: number) {
    this.logEvent(AnalyticsEvent.SEARCH_RESULTS_VIEWED, {
      query: query.length > 50 ? query.substring(0, 50) + '...' : query,
      result_count: resultCount,
    });
  }

  logSearchResultSelected(query: string, resultIndex: number, resultType: string) {
    this.logEvent(AnalyticsEvent.SEARCH_RESULT_SELECTED, {
      query: query.length > 50 ? query.substring(0, 50) + '...' : query,
      result_index: resultIndex,
      result_type: resultType,
    });
  }

  logSearchNoResults(query: string) {
    this.logEvent(AnalyticsEvent.SEARCH_NO_RESULTS, {
      query: query.length > 50 ? query.substring(0, 50) + '...' : query,
    });
  }

  /**
   * Log social events
   */
  logContentShared(contentType: string, shareMethod: string) {
    this.logEvent(AnalyticsEvent.CONTENT_SHARED, {
      content_type: contentType,
      share_method: shareMethod,
    });
  }

  logSocialLoginAttempted(provider: string) {
    this.logEvent(AnalyticsEvent.SOCIAL_LOGIN_ATTEMPTED, {
      provider,
    });
  }

  logSocialLoginCompleted(provider: string) {
    this.logEvent(AnalyticsEvent.SOCIAL_LOGIN_COMPLETED, {
      provider,
    });
  }

  logSocialLoginFailed(provider: string, errorMessage: string) {
    this.logEvent(AnalyticsEvent.SOCIAL_LOGIN_FAILED, {
      provider,
      error_message: errorMessage,
    });
  }

  /**
   * Log additional parking events
   */
  logParkingTimerSet(durationMinutes: number) {
    this.logEvent(AnalyticsEvent.PARKING_TIMER_SET, {
      duration_minutes: durationMinutes,
    });
  }

  logParkingTimerExpired(durationMinutes: number) {
    this.logEvent(AnalyticsEvent.PARKING_TIMER_EXPIRED, {
      duration_minutes: durationMinutes,
    });
  }

  logParkingPhotoTaken(photoCount: number) {
    this.logEvent(AnalyticsEvent.PARKING_PHOTO_TAKEN, {
      photo_count: photoCount,
    });
  }

  logParkingLocationShared(shareMethod: string) {
    this.logEvent(AnalyticsEvent.PARKING_LOCATION_SHARED, {
      share_method: shareMethod,
    });
  }

  /**
   * Log app lifecycle events
   */
  logAppForegrounded(timeInBackgroundSeconds?: number) {
    this.logEvent(AnalyticsEvent.APP_FOREGROUNDED, {
      time_in_background_seconds: timeInBackgroundSeconds,
    });
  }

  logAppCrashed(errorMessage: string, stackTrace?: string) {
    this.logEvent(AnalyticsEvent.APP_CRASHED, {
      error_message: errorMessage,
      has_stack_trace: !!stackTrace,
    });
  }

  /**
   * Log privacy and settings events
   */
  logAccountDeleted(reason?: string) {
    this.logEvent(AnalyticsEvent.ACCOUNT_DELETED, {
      reason,
    });
  }

  logPrivacySettingChanged(setting: string, newValue: boolean) {
    this.logEvent(AnalyticsEvent.PRIVACY_SETTING_CHANGED, {
      setting,
      new_value: newValue,
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