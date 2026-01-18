// @ts-nocheck
/**
 * Payment Processing Service with RevenueCat
 * Handles subscriptions, in-app purchases, and payment validation
 */

import Purchases, {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
  PurchasesEntitlementInfo,
  PURCHASES_ERROR_CODE,
  PurchasesError,
} from 'react-native-purchases';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase-client';
import { logger, LogCategory } from './logger';
import { userProfileManager } from './userProfileManager';
import Config from '../config/appConfig';

export enum SubscriptionTier {
  FREE = 'free',
  PLUS = 'plus',
  PRO = 'pro',
  FAMILY = 'family',
}

export interface SubscriptionProduct {
  identifier: string;
  product: PurchasesPackage;
  title: string;
  description: string;
  price: string;
  pricePerMonth?: string;
  features: string[];
  recommended?: boolean;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'apple_pay' | 'google_pay';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

interface SubscriptionStatus {
  tier: SubscriptionTier;
  isActive: boolean;
  expiresAt?: Date;
  willRenew: boolean;
  isTrial: boolean;
  trialExpiresAt?: Date;
  entitlements: string[];
}

class PaymentService {
  private static instance: PaymentService;
  private isInitialized: boolean = false;
  private currentOffering: PurchasesOffering | null = null;
  private customerInfo: CustomerInfo | null = null;
  private products: Map<string, SubscriptionProduct> = new Map();

  // Product IDs (match these with App Store Connect and Google Play Console)
  private readonly PRODUCT_IDS = {
    ios: {
      plus_monthly: 'com.okapifind.plus.monthly',
      plus_yearly: 'com.okapifind.plus.yearly',
      pro_monthly: 'com.okapifind.pro.monthly',
      pro_yearly: 'com.okapifind.pro.yearly',
      family_monthly: 'com.okapifind.family.monthly',
      family_yearly: 'com.okapifind.family.yearly',
    },
    android: {
      plus_monthly: 'plus_monthly',
      plus_yearly: 'plus_yearly',
      pro_monthly: 'pro_monthly',
      pro_yearly: 'pro_yearly',
      family_monthly: 'family_monthly',
      family_yearly: 'family_yearly',
    },
  };

  // Entitlement IDs (configured in RevenueCat)
  private readonly ENTITLEMENTS = {
    plus: 'plus_features',
    pro: 'pro_features',
    family: 'family_features',
  };

  private constructor() {}

  static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  /**
   * Initialize RevenueCat
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Configure RevenueCat
      const apiKey = Platform.OS === 'ios'
        ? Config.REVENUECAT_API_KEY_IOS
        : Config.REVENUECAT_API_KEY_ANDROID;

      if (!apiKey) {
        throw new Error('RevenueCat API key not configured');
      }

      Purchases.configure({ apiKey });

      // Enable debug logs in development
      if (__DEV__) {
        Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      }

      // Set user ID if logged in
      const profile = userProfileManager.getCurrentProfile();
      if (profile) {
        await this.loginUser(profile.id);
      }

      // Fetch initial offerings
      await this.fetchOfferings();

      // Get customer info
      await this.refreshCustomerInfo();

      // Listen to customer info updates
      Purchases.addCustomerInfoUpdateListener((info) => {
        this.customerInfo = info;
        this.updateSubscriptionStatus();
      });

      this.isInitialized = true;

      logger.info('Payment service initialized');
    } catch (error) {
      logger.error('Failed to initialize payment service', error as Error);
      throw error;
    }
  }

  /**
   * Login user to RevenueCat
   */
  async loginUser(userId: string): Promise<void> {
    try {
      const { customerInfo } = await Purchases.logIn(userId);
      this.customerInfo = customerInfo;

      logger.info('User logged in to RevenueCat', { userId });
    } catch (error) {
      logger.error('Failed to login user to RevenueCat', error as Error);
    }
  }

  /**
   * Logout user from RevenueCat
   */
  async logoutUser(): Promise<void> {
    try {
      await Purchases.logOut();
      this.customerInfo = null;

      logger.info('User logged out from RevenueCat');
    } catch (error) {
      logger.error('Failed to logout user from RevenueCat', error as Error);
    }
  }

  /**
   * Fetch available offerings
   */
  async fetchOfferings(): Promise<void> {
    try {
      const offerings = await Purchases.getOfferings();

      if (offerings.current) {
        this.currentOffering = offerings.current;
        this.processOffering(offerings.current);
      }

      logger.info('Offerings fetched', {
        offeringCount: offerings.all.length,
        currentOffering: offerings.current?.identifier,
      });
    } catch (error) {
      logger.error('Failed to fetch offerings', error as Error);
    }
  }

  /**
   * Process offering into products
   */
  private processOffering(offering: PurchasesOffering): void {
    const packages = offering.availablePackages;

    packages.forEach((pkg) => {
      const product: SubscriptionProduct = {
        identifier: pkg.identifier,
        product: pkg,
        title: this.getProductTitle(pkg.identifier),
        description: this.getProductDescription(pkg.identifier),
        price: pkg.product.priceString,
        pricePerMonth: this.calculateMonthlyPrice(pkg),
        features: this.getProductFeatures(pkg.identifier),
        recommended: pkg.identifier.includes('yearly'),
      };

      this.products.set(pkg.identifier, product);
    });
  }

  /**
   * Get product title
   */
  private getProductTitle(identifier: string): string {
    if (identifier.includes('plus')) return 'OkapiFind Plus';
    if (identifier.includes('pro')) return 'OkapiFind Pro';
    if (identifier.includes('family')) return 'OkapiFind Family';
    return 'OkapiFind';
  }

  /**
   * Get product description
   */
  private getProductDescription(identifier: string): string {
    if (identifier.includes('plus')) {
      return 'Enhanced features for regular drivers';
    }
    if (identifier.includes('pro')) {
      return 'Professional features for power users';
    }
    if (identifier.includes('family')) {
      return 'Share with up to 5 family members';
    }
    return 'Basic parking features';
  }

  /**
   * Get product features
   */
  private getProductFeatures(identifier: string): string[] {
    const baseFeatures = [
      'Save parking locations',
      'Basic reminders',
      'Offline mode',
    ];

    if (identifier.includes('plus')) {
      return [
        ...baseFeatures,
        'Unlimited parking history',
        'Smart notifications',
        'Street cleaning alerts',
        'Export parking data',
        'Priority support',
      ];
    }

    if (identifier.includes('pro')) {
      return [
        ...baseFeatures,
        'Everything in Plus',
        'ML parking predictions',
        'Advanced analytics',
        'Multiple vehicles',
        'API access',
        'Custom integrations',
      ];
    }

    if (identifier.includes('family')) {
      return [
        ...baseFeatures,
        'Everything in Pro',
        'Share with 5 members',
        'Family location sharing',
        'Shared parking history',
        'Family admin controls',
        'Premium support',
      ];
    }

    return baseFeatures;
  }

  /**
   * Calculate monthly price for yearly subscriptions
   */
  private calculateMonthlyPrice(pkg: PurchasesPackage): string | undefined {
    if (!pkg.identifier.includes('yearly')) return undefined;

    const price = pkg.product.price;
    const monthlyPrice = price / 12;

    return pkg.product.currencyCode
      ? `${pkg.product.currencyCode} ${monthlyPrice.toFixed(2)}/mo`
      : `$${monthlyPrice.toFixed(2)}/mo`;
  }

  /**
   * Purchase subscription
   */
  async purchaseSubscription(productId: string): Promise<boolean> {
    try {
      const product = this.products.get(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      // Show loading
      logger.info('Starting purchase', { productId });

      // Make purchase
      const { customerInfo, productIdentifier } = await Purchases.purchasePackage(
        product.product
      );

      this.customerInfo = customerInfo;

      // Update user profile
      await this.updateSubscriptionStatus();

      // Track purchase
      await this.trackPurchase(productIdentifier, product.price);

      logger.info('Purchase successful', { productId, productIdentifier });

      // Show success
      Alert.alert(
        'Success!',
        'Your subscription has been activated. Thank you for supporting OkapiFind!',
        [{ text: 'OK' }]
      );

      return true;
    } catch (error) {
      const purchaseError = error as PurchasesError;

      if (purchaseError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        logger.info('Purchase cancelled by user');
        return false;
      }

      logger.error('Purchase failed', error as Error);

      Alert.alert(
        'Purchase Failed',
        this.getErrorMessage(purchaseError),
        [{ text: 'OK' }]
      );

      return false;
    }
  }

  /**
   * Restore purchases
   */
  async restorePurchases(): Promise<boolean> {
    try {
      logger.info('Restoring purchases');

      const customerInfo = await Purchases.restorePurchases();
      this.customerInfo = customerInfo;

      const hasActiveSubscription = this.hasActiveSubscription();

      if (hasActiveSubscription) {
        await this.updateSubscriptionStatus();

        Alert.alert(
          'Purchases Restored',
          'Your subscription has been restored successfully.',
          [{ text: 'OK' }]
        );

        return true;
      } else {
        Alert.alert(
          'No Purchases Found',
          'No active subscriptions found for this account.',
          [{ text: 'OK' }]
        );

        return false;
      }
    } catch (error) {
      logger.error('Restore purchases failed', error as Error);

      Alert.alert(
        'Restore Failed',
        'Failed to restore purchases. Please try again.',
        [{ text: 'OK' }]
      );

      return false;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(): Promise<void> {
    try {
      // Direct users to subscription management
      const url = Platform.OS === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions';

      Alert.alert(
        'Cancel Subscription',
        'To cancel your subscription, you need to do it through your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => this.openUrl(url) },
        ]
      );
    } catch (error) {
      logger.error('Failed to open subscription settings', error as Error);
    }
  }

  /**
   * Get subscription status
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    await this.refreshCustomerInfo();

    const tier = this.getCurrentTier();
    const activeEntitlements = this.getActiveEntitlements();

    return {
      tier,
      isActive: tier !== SubscriptionTier.FREE,
      expiresAt: this.getExpirationDate(),
      willRenew: this.getWillRenew(),
      isTrial: this.isInTrial(),
      trialExpiresAt: this.getTrialExpirationDate(),
      entitlements: activeEntitlements,
    };
  }

  /**
   * Check if user has active subscription
   */
  hasActiveSubscription(): boolean {
    if (!this.customerInfo) return false;

    return Object.keys(this.customerInfo.entitlements.active).length > 0;
  }

  /**
   * Get current subscription tier
   */
  getCurrentTier(): SubscriptionTier {
    if (!this.customerInfo) return SubscriptionTier.FREE;

    const entitlements = this.customerInfo.entitlements.active;

    if (entitlements[this.ENTITLEMENTS.family]) {
      return SubscriptionTier.FAMILY;
    }
    if (entitlements[this.ENTITLEMENTS.pro]) {
      return SubscriptionTier.PRO;
    }
    if (entitlements[this.ENTITLEMENTS.plus]) {
      return SubscriptionTier.PLUS;
    }

    return SubscriptionTier.FREE;
  }

  /**
   * Get active entitlements
   */
  private getActiveEntitlements(): string[] {
    if (!this.customerInfo) return [];

    return Object.keys(this.customerInfo.entitlements.active);
  }

  /**
   * Get expiration date
   */
  private getExpirationDate(): Date | undefined {
    if (!this.customerInfo) return undefined;

    const entitlements = Object.values(this.customerInfo.entitlements.active);
    if (entitlements.length === 0) return undefined;

    const expirationDate = entitlements[0].expirationDate;
    return expirationDate ? new Date(expirationDate) : undefined;
  }

  /**
   * Get will renew status
   */
  private getWillRenew(): boolean {
    if (!this.customerInfo) return false;

    const entitlements = Object.values(this.customerInfo.entitlements.active);
    if (entitlements.length === 0) return false;

    return entitlements[0].willRenew;
  }

  /**
   * Check if in trial
   */
  private isInTrial(): boolean {
    if (!this.customerInfo) return false;

    const entitlements = Object.values(this.customerInfo.entitlements.active);
    return entitlements.some(e => e.periodType === 'trial');
  }

  /**
   * Get trial expiration date
   */
  private getTrialExpirationDate(): Date | undefined {
    if (!this.customerInfo || !this.isInTrial()) return undefined;

    const trialEntitlement = Object.values(this.customerInfo.entitlements.active)
      .find(e => e.periodType === 'trial');

    return trialEntitlement?.expirationDate
      ? new Date(trialEntitlement.expirationDate)
      : undefined;
  }

  /**
   * Refresh customer info
   */
  private async refreshCustomerInfo(): Promise<void> {
    try {
      this.customerInfo = await Purchases.getCustomerInfo();
    } catch (error) {
      logger.error('Failed to refresh customer info', error as Error);
    }
  }

  /**
   * Update subscription status in user profile
   */
  private async updateSubscriptionStatus(): Promise<void> {
    const status = await this.getSubscriptionStatus();
    const profile = userProfileManager.getCurrentProfile();

    if (profile) {
      await userProfileManager.updateSubscription({
        tier: status.tier,
        status: status.isActive ? 'active' : 'expired',
        endDate: status.expiresAt,
        autoRenew: status.willRenew,
      });

      // Sync with backend
      await this.syncSubscriptionWithBackend(status);
    }
  }

  /**
   * Sync subscription with backend
   */
  private async syncSubscriptionWithBackend(status: SubscriptionStatus): Promise<void> {
    try {
      const profile = userProfileManager.getCurrentProfile();
      if (!profile) return;

      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: profile.id,
          tier: status.tier,
          is_active: status.isActive,
          expires_at: status.expiresAt,
          will_renew: status.willRenew,
          is_trial: status.isTrial,
          trial_expires_at: status.trialExpiresAt,
          entitlements: status.entitlements,
          updated_at: new Date(),
        });

      if (error) throw error;

      logger.info('Subscription synced with backend', { tier: status.tier });
    } catch (error) {
      logger.error('Failed to sync subscription', error as Error);
    }
  }

  /**
   * Track purchase for analytics
   */
  private async trackPurchase(productId: string, price: string): Promise<void> {
    try {
      // Track in analytics (implement when analytics service is ready)
      logger.log(LogCategory.PAYMENT, 'Purchase tracked', {
        productId,
        price,
        timestamp: new Date(),
      });

      // Update user statistics
      const profile = userProfileManager.getCurrentProfile();
      if (profile) {
        // Store purchase history
        await supabase.from('purchase_history').insert({
          user_id: profile.id,
          product_id: productId,
          price,
          purchased_at: new Date(),
        });
      }
    } catch (error) {
      logger.error('Failed to track purchase', error as Error);
    }
  }

  /**
   * Get error message
   */
  private getErrorMessage(error: PurchasesError): string {
    switch (error.code) {
      case PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR:
        return 'Purchase was cancelled';
      case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
        return 'Purchase not allowed on this device';
      case PURCHASES_ERROR_CODE.PURCHASE_INVALID_ERROR:
        return 'Purchase is invalid';
      case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
        return 'Product is not available for purchase';
      case PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR:
        return 'Product has already been purchased';
      case PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR:
        return 'Receipt is already in use by another account';
      case PURCHASES_ERROR_CODE.NETWORK_ERROR:
        return 'Network error. Please check your connection and try again.';
      default:
        return 'An error occurred during purchase. Please try again.';
    }
  }

  /**
   * Open URL helper
   */
  private async openUrl(url: string): Promise<void> {
    const { Linking } = await import('react-native');
    await Linking.openURL(url);
  }

  /**
   * Get available products
   */
  getAvailableProducts(): SubscriptionProduct[] {
    return Array.from(this.products.values());
  }

  /**
   * Check feature availability
   */
  isFeatureAvailable(feature: string): boolean {
    const tier = this.getCurrentTier();

    const featureMap: Record<string, SubscriptionTier[]> = {
      unlimited_history: [SubscriptionTier.PLUS, SubscriptionTier.PRO, SubscriptionTier.FAMILY],
      smart_notifications: [SubscriptionTier.PLUS, SubscriptionTier.PRO, SubscriptionTier.FAMILY],
      ml_predictions: [SubscriptionTier.PRO, SubscriptionTier.FAMILY],
      multiple_vehicles: [SubscriptionTier.PRO, SubscriptionTier.FAMILY],
      family_sharing: [SubscriptionTier.FAMILY],
      api_access: [SubscriptionTier.PRO, SubscriptionTier.FAMILY],
      priority_support: [SubscriptionTier.PLUS, SubscriptionTier.PRO, SubscriptionTier.FAMILY],
    };

    const allowedTiers = featureMap[feature] || [];
    return allowedTiers.includes(tier);
  }
}

export const paymentService = PaymentService.getInstance();