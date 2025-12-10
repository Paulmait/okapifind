/**
 * Feature Flag Configuration
 * STRATEGY: Backend power, frontend simplicity
 *
 * Philosophy:
 * - Free users: Clean, focused "Find My Car" experience
 * - Plus users: Smart contextual alerts
 * - Pro users: Advanced features unlocked
 * - Enterprise: Full API access
 */

export type SubscriptionTier = 'free' | 'plus' | 'pro' | 'enterprise';

export interface FeatureConfig {
  enabled: boolean;
  requiredTier?: SubscriptionTier;
  rolloutPercentage?: number; // 0-100 for gradual rollout
  beta?: boolean;
}

/**
 * Feature flags for all app capabilities
 */
export const FEATURES = {
  // ============================================
  // CORE FEATURES (Always On - Free Tier)
  // ============================================

  // Basic car location
  SAVE_CAR_LOCATION: {
    enabled: true,
    requiredTier: 'free',
    rolloutPercentage: 100,
    beta: false,
  },

  FIND_MY_CAR: {
    enabled: true,
    requiredTier: 'free',
    rolloutPercentage: 100,
    beta: false,
  },

  // Auto-detection
  AUTO_PARKING_DETECTION: {
    enabled: true,
    requiredTier: 'free',
    rolloutPercentage: 100,
    beta: false,
  },

  // Basic navigation
  AR_NAVIGATION: {
    enabled: true,
    requiredTier: 'free',
    rolloutPercentage: 100,
    beta: false,
  },

  COMPASS_GUIDANCE: {
    enabled: true,
    requiredTier: 'free',
    rolloutPercentage: 100,
    beta: false,
  },

  // Basic map
  BASIC_MAP_VIEW: {
    enabled: true,
    requiredTier: 'free',
    rolloutPercentage: 100,
    beta: false,
  },

  // ============================================
  // PLUS FEATURES ($4.99/month)
  // ============================================

  // Smart alerts
  TRAFFIC_ALERTS: {
    enabled: true,
    requiredTier: 'plus',
    rolloutPercentage: 100,
    beta: false,
  },

  PARKING_RESTRICTION_ALERTS: {
    enabled: true,
    requiredTier: 'plus',
    rolloutPercentage: 100,
    beta: false,
  },

  METER_EXPIRATION_ALERTS: {
    enabled: true,
    requiredTier: 'plus',
    rolloutPercentage: 100,
    beta: false,
  },

  STREET_CLEANING_ALERTS: {
    enabled: true,
    requiredTier: 'plus',
    rolloutPercentage: 100,
    beta: false,
  },

  // History
  SEARCH_HISTORY: {
    enabled: true,
    requiredTier: 'plus',
    rolloutPercentage: 100,
    beta: false,
  },

  PARKING_HISTORY: {
    enabled: true,
    requiredTier: 'plus',
    rolloutPercentage: 100,
    beta: false,
  },

  // Basic analytics
  PARKING_STATISTICS: {
    enabled: true,
    requiredTier: 'plus',
    rolloutPercentage: 100,
    beta: false,
  },

  // ============================================
  // PRO FEATURES ($9.99/month)
  // ============================================

  // Advanced search
  PLACE_SEARCH: {
    enabled: true,
    requiredTier: 'pro',
    rolloutPercentage: 100,
    beta: false,
  },

  FAVORITES_SYSTEM: {
    enabled: true,
    requiredTier: 'pro',
    rolloutPercentage: 100,
    beta: false,
  },

  // Offline capability
  OFFLINE_MAPS: {
    enabled: true,
    requiredTier: 'pro',
    rolloutPercentage: 100,
    beta: false,
  },

  OFFLINE_MAP_DOWNLOAD: {
    enabled: true,
    requiredTier: 'pro',
    rolloutPercentage: 100,
    beta: false,
  },

  // Advanced comparison
  MULTI_PARKING_COMPARISON: {
    enabled: true,
    requiredTier: 'pro',
    rolloutPercentage: 100,
    beta: false,
  },

  PARK_AND_WALK_CALCULATOR: {
    enabled: true,
    requiredTier: 'pro',
    rolloutPercentage: 100,
    beta: false,
  },

  OPTIMAL_DEPARTURE_TIME: {
    enabled: true,
    requiredTier: 'pro',
    rolloutPercentage: 100,
    beta: false,
  },

  // Violation management
  VIOLATION_TRACKER: {
    enabled: true,
    requiredTier: 'pro',
    rolloutPercentage: 100,
    beta: false,
  },

  FINE_PAYMENT_REMINDERS: {
    enabled: true,
    requiredTier: 'pro',
    rolloutPercentage: 100,
    beta: false,
  },

  // Advanced features
  NEARBY_PARKING_SEARCH: {
    enabled: true,
    requiredTier: 'pro',
    rolloutPercentage: 100,
    beta: false,
  },

  PARKING_PRICE_COMPARISON: {
    enabled: true,
    requiredTier: 'pro',
    rolloutPercentage: 100,
    beta: false,
  },

  ADVANCED_STATISTICS: {
    enabled: true,
    requiredTier: 'pro',
    rolloutPercentage: 100,
    beta: false,
  },

  // Priority support
  PRIORITY_CUSTOMER_SUPPORT: {
    enabled: true,
    requiredTier: 'pro',
    rolloutPercentage: 100,
    beta: false,
  },

  // Ad-free
  AD_FREE_EXPERIENCE: {
    enabled: true,
    requiredTier: 'pro',
    rolloutPercentage: 100,
    beta: false,
  },

  // ============================================
  // ENTERPRISE FEATURES (B2B)
  // ============================================

  API_ACCESS: {
    enabled: false, // Enable per customer
    requiredTier: 'enterprise',
    rolloutPercentage: 100,
    beta: false,
  },

  WHITE_LABEL_BRANDING: {
    enabled: false,
    requiredTier: 'enterprise',
    rolloutPercentage: 100,
    beta: false,
  },

  WEBHOOK_INTEGRATION: {
    enabled: false,
    requiredTier: 'enterprise',
    rolloutPercentage: 100,
    beta: false,
  },

  FLEET_MANAGEMENT: {
    enabled: false,
    requiredTier: 'enterprise',
    rolloutPercentage: 100,
    beta: false,
  },

  CUSTOM_ANALYTICS: {
    enabled: false,
    requiredTier: 'enterprise',
    rolloutPercentage: 100,
    beta: false,
  },

  DEDICATED_SUPPORT: {
    enabled: false,
    requiredTier: 'enterprise',
    rolloutPercentage: 100,
    beta: false,
  },

  // ============================================
  // BETA FEATURES (Testing)
  // ============================================

  AI_PARKING_PREDICTIONS: {
    enabled: true,
    requiredTier: 'plus',
    rolloutPercentage: 50, // 50% of plus users
    beta: true,
  },

  SOCIAL_PARKING_SHARING: {
    enabled: false,
    requiredTier: 'free',
    rolloutPercentage: 100,
    beta: true,
  },

  CARPLAY_INTEGRATION: {
    enabled: false,
    requiredTier: 'pro',
    rolloutPercentage: 100,
    beta: true,
  },

  ANDROID_AUTO_INTEGRATION: {
    enabled: false,
    requiredTier: 'pro',
    rolloutPercentage: 100,
    beta: true,
  },

  APPLE_WATCH_APP: {
    enabled: false,
    requiredTier: 'plus',
    rolloutPercentage: 100,
    beta: true,
  },

  // ============================================
  // EXPERIMENTAL (Not Released)
  // ============================================

  AR_INDOOR_NAVIGATION: {
    enabled: false,
    requiredTier: 'pro',
    rolloutPercentage: 100,
    beta: true,
  },

  BLOCKCHAIN_PARKING_VERIFICATION: {
    enabled: false,
    requiredTier: 'enterprise',
    rolloutPercentage: 100,
    beta: true,
  },

  AUTONOMOUS_VEHICLE_INTEGRATION: {
    enabled: false,
    requiredTier: 'enterprise',
    rolloutPercentage: 100,
    beta: true,
  },
} as const;

/**
 * Check if user can use a feature
 */
export function canUseFeature(
  featureName: keyof typeof FEATURES,
  userTier: SubscriptionTier,
  userId?: string
): boolean {
  const feature = FEATURES[featureName];

  if (!feature.enabled) {
    return false;
  }

  // Check tier requirement
  const tierHierarchy: SubscriptionTier[] = ['free', 'plus', 'pro', 'enterprise'];
  const userTierIndex = tierHierarchy.indexOf(userTier);
  const requiredTierIndex = tierHierarchy.indexOf(feature.requiredTier || 'free');

  if (userTierIndex < requiredTierIndex) {
    return false;
  }

  // Check rollout percentage (for gradual rollouts)
  if (feature.rolloutPercentage !== undefined && feature.rolloutPercentage < 100) {
    if (!userId) return false;

    // Deterministic rollout based on user ID
    const hash = simpleHash(userId);
    const userPercentage = hash % 100;
    return userPercentage < feature.rolloutPercentage;
  }

  return true;
}

/**
 * Get features available for user's tier
 */
export function getFeaturesForTier(tier: SubscriptionTier): string[] {
  const availableFeatures: string[] = [];

  for (const [featureName] of Object.entries(FEATURES)) {
    if (canUseFeature(featureName as keyof typeof FEATURES, tier)) {
      availableFeatures.push(featureName);
    }
  }

  return availableFeatures;
}

/**
 * Get feature upgrade requirement
 */
export function getUpgradeRequirement(
  featureName: keyof typeof FEATURES
): SubscriptionTier | null {
  const feature = FEATURES[featureName];
  return feature.requiredTier || null;
}

/**
 * Check if feature is in beta
 */
export function isFeatureBeta(featureName: keyof typeof FEATURES): boolean {
  return FEATURES[featureName].beta || false;
}

/**
 * Simple hash function for deterministic rollout
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Feature descriptions for marketing/upgrade prompts
 */
export const FEATURE_DESCRIPTIONS = {
  TRAFFIC_ALERTS: {
    title: 'Traffic Alerts',
    description: 'Get notified about heavy traffic before you leave',
    icon: '🚦',
    value: 'Save 10-20 min per trip',
  },

  PARKING_RESTRICTION_ALERTS: {
    title: 'Parking Restriction Alerts',
    description: 'Never get a parking ticket again',
    icon: '⚠️',
    value: 'Save $45-150 per ticket',
  },

  OFFLINE_MAPS: {
    title: 'Offline Maps',
    description: 'Find your car even without signal',
    icon: '📡',
    value: 'Works in underground garages',
  },

  MULTI_PARKING_COMPARISON: {
    title: 'Compare Parking Options',
    description: 'Find the fastest and cheapest parking spot',
    icon: '📊',
    value: 'Save $5-10 per trip',
  },

  VIOLATION_TRACKER: {
    title: 'Violation Tracker',
    description: 'Track and manage parking tickets',
    icon: '🎫',
    value: 'Never miss a payment deadline',
  },

  PLACE_SEARCH: {
    title: 'Search Anywhere',
    description: 'Find parking near any destination',
    icon: '🔍',
    value: 'Save 5-10 min per search',
  },
} as const;

/**
 * Upgrade prompts for contextual upsells
 */
export const UPGRADE_PROMPTS = {
  TRAFFIC: {
    trigger: 'user_stuck_in_traffic',
    feature: 'TRAFFIC_ALERTS',
    message: 'Stuck in traffic again? Get alerted before you leave.',
    cta: 'Upgrade to Plus',
    tier: 'plus' as SubscriptionTier,
  },

  PARKING_TICKET: {
    trigger: 'user_got_ticket',
    feature: 'PARKING_RESTRICTION_ALERTS',
    message: 'Never get a parking ticket again. $45-150 saved per ticket!',
    cta: 'Upgrade to Plus - Save $100s',
    tier: 'plus' as SubscriptionTier,
  },

  NO_SIGNAL: {
    trigger: 'signal_lost',
    feature: 'OFFLINE_MAPS',
    message: 'Lost signal in the garage? Offline maps work without internet.',
    cta: 'Upgrade to Pro',
    tier: 'pro' as SubscriptionTier,
  },

  CANT_FIND_CAR: {
    trigger: 'repeated_search_failures',
    feature: 'MULTI_PARKING_COMPARISON',
    message: 'Having trouble finding your car? Try garage parking with comparison tools.',
    cta: 'Upgrade to Pro',
    tier: 'pro' as SubscriptionTier,
  },

  EXPENSIVE_PARKING: {
    trigger: 'expensive_parking_detected',
    feature: 'PARKING_PRICE_COMPARISON',
    message: 'That parking is expensive! Compare options to save $5-10 per trip.',
    cta: 'Upgrade to Pro',
    tier: 'pro' as SubscriptionTier,
  },
} as const;

export default FEATURES;