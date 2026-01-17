import { useState, useEffect } from 'react';
import Purchases, {
  CustomerInfo,
  PurchasesEntitlementInfo,
  LOG_LEVEL,
  PurchasesOfferings,
} from 'react-native-purchases';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';

// Load API keys from environment variables via Expo Constants
const REVENUCAT_API_KEY_IOS = Constants.expoConfig?.extra?.revenueCatApiKeyIos ||
                              process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || '';
const REVENUCAT_API_KEY_ANDROID = Constants.expoConfig?.extra?.revenueCatApiKeyAndroid ||
                                   process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || '';

interface RevenueCatState {
  isInitialized: boolean;
  isPremium: boolean;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOfferings | null;
  loading: boolean;
  error: string | null;
}

export const useRevenueCat = () => {
  const [state, setState] = useState<RevenueCatState>({
    isInitialized: false,
    isPremium: false,
    customerInfo: null,
    offerings: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    initializeRevenueCat();
  }, []);

  const initializeRevenueCat = async () => {
    try {
      // Web doesn't support RevenueCat - skip initialization
      if (Platform.OS === 'web') {
        setState({
          isInitialized: true,
          isPremium: false,
          customerInfo: null,
          offerings: null,
          loading: false,
          error: null,
        });
        return;
      }

      if (Platform.OS === 'android' && __DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
      }

      const apiKey = Platform.OS === 'ios' ? REVENUCAT_API_KEY_IOS : REVENUCAT_API_KEY_ANDROID;

      await Purchases.configure({ apiKey });

      const customerInfo = await Purchases.getCustomerInfo();
      const offerings = await Purchases.getOfferings();

      const isPremium = customerInfo.entitlements.active['premium'] !== undefined;

      setState({
        isInitialized: true,
        isPremium,
        customerInfo,
        offerings,
        loading: false,
        error: null,
      });

      Purchases.addCustomerInfoUpdateListener((info) => {
        const isPremium = info.entitlements.active['premium'] !== undefined;
        setState(prev => ({
          ...prev,
          customerInfo: info,
          isPremium,
        }));
      });

    } catch (error) {
      console.error('Error initializing RevenueCat:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to initialize subscription service',
      }));
    }
  };

  const purchasePackage = async (packageId: string) => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'In-app purchases are not available on web. Please use the mobile app.');
      return false;
    }

    if (!state.offerings?.current) {
      Alert.alert('Error', 'No packages available');
      return false;
    }

    const selectedPackage = state.offerings.current.availablePackages.find(
      pkg => pkg.identifier === packageId
    );

    if (!selectedPackage) {
      Alert.alert('Error', 'Package not found');
      return false;
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
      const isPremium = customerInfo.entitlements.active['premium'] !== undefined;

      setState(prev => ({
        ...prev,
        customerInfo,
        isPremium,
      }));

      return isPremium;
    } catch (error: any) {
      if (!error.userCancelled) {
        Alert.alert('Purchase Failed', error.message || 'Unknown error occurred');
      }
      return false;
    }
  };

  const restorePurchases = async (showSuccessAlert: boolean = true): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return false;
    }

    try {
      setState(prev => ({ ...prev, loading: true }));

      // First, try to get the latest customer info
      const customerInfo = await Purchases.restorePurchases();

      // Check all possible entitlements, not just 'premium'
      const activeEntitlements = Object.keys(customerInfo.entitlements.active);
      const isPremium = activeEntitlements.includes('premium') ||
                       activeEntitlements.includes('pro') ||
                       activeEntitlements.length > 0;

      setState(prev => ({
        ...prev,
        customerInfo,
        isPremium,
        loading: false,
        error: null,
      }));

      if (isPremium && showSuccessAlert) {
        Alert.alert(
          'Purchases Restored',
          'Your previous purchases have been successfully restored.',
          [{ text: 'OK' }]
        );
      } else if (!isPremium) {
        Alert.alert(
          'No Purchases Found',
          'No previous purchases were found to restore. If you believe this is an error, please contact support.',
          [
            { text: 'OK', style: 'default' },
            {
              text: 'Contact Support',
              onPress: () => {
                // You can implement support contact here
                console.log('Contact support requested');
              }
            }
          ]
        );
      }

      return isPremium;
    } catch (error: any) {
      console.error('Restore purchases error:', error);

      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to restore purchases',
      }));

      // Provide more specific error messages
      let errorMessage = 'Unable to restore purchases. Please try again.';

      if (error.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.code === 'INVALID_CREDENTIALS') {
        errorMessage = 'Authentication error. Please sign in to your app store account.';
      } else if (error.code === 'STORE_PROBLEM') {
        errorMessage = 'App store is temporarily unavailable. Please try again later.';
      }

      Alert.alert('Restore Failed', errorMessage, [
        { text: 'OK', style: 'default' },
        {
          text: 'Try Again',
          onPress: () => restorePurchases(showSuccessAlert)
        }
      ]);

      return false;
    }
  };

  const checkSubscriptionStatus = async () => {
    if (Platform.OS === 'web') return false;

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const isPremium = customerInfo.entitlements.active['premium'] !== undefined;

      setState(prev => ({
        ...prev,
        customerInfo,
        isPremium,
      }));

      return isPremium;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  };

  const getEntitlement = (entitlementId: string): PurchasesEntitlementInfo | undefined => {
    return state.customerInfo?.entitlements.active[entitlementId];
  };

  const logOut = async () => {
    if (Platform.OS === 'web') return;

    try {
      await Purchases.logOut();
      const customerInfo = await Purchases.getCustomerInfo();

      setState(prev => ({
        ...prev,
        customerInfo,
        isPremium: false,
      }));
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const setUserId = async (userId: string) => {
    if (Platform.OS === 'web') return;

    try {
      const { customerInfo } = await Purchases.logIn(userId);
      const isPremium = customerInfo.entitlements.active['premium'] !== undefined;

      setState(prev => ({
        ...prev,
        customerInfo,
        isPremium,
      }));
    } catch (error) {
      console.error('Error setting user ID:', error);
    }
  };

  const getSubscriptionInfo = () => {
    if (!state.customerInfo) return null;

    const entitlements = state.customerInfo.entitlements.active;
    const allSubscriptions = state.customerInfo.allPurchaseDates;

    return {
      hasActiveSubscription: Object.keys(entitlements).length > 0,
      activeEntitlements: Object.keys(entitlements),
      subscriptionHistory: allSubscriptions,
      managementURL: state.customerInfo.managementURL,
      firstSeen: state.customerInfo.firstSeen,
      originalAppUserId: state.customerInfo.originalAppUserId,
    };
  };

  const syncPurchases = async (): Promise<boolean> => {
    if (Platform.OS === 'web') return false;

    try {
      setState(prev => ({ ...prev, loading: true }));

      await Purchases.syncPurchases();
      const customerInfo = await Purchases.getCustomerInfo();
      const isPremium = customerInfo.entitlements.active['premium'] !== undefined;

      setState(prev => ({
        ...prev,
        customerInfo,
        isPremium,
        loading: false,
        error: null,
      }));

      return true;
    } catch (error) {
      console.error('Error syncing purchases:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to sync purchases',
      }));
      return false;
    }
  };

  const validateEntitlement = async (entitlementId: string): Promise<boolean> => {
    if (Platform.OS === 'web') return false;

    try {
      // Force refresh customer info from the server
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo.entitlements.active[entitlementId] !== undefined;
    } catch (error) {
      console.error('Error validating entitlement:', error);
      return false;
    }
  };

  const getReceiptData = () => {
    if (!state.customerInfo) return null;

    return {
      latestExpirationDate: state.customerInfo.latestExpirationDate,
      allExpirationDates: state.customerInfo.allExpirationDates,
      allPurchaseDates: state.customerInfo.allPurchaseDates,
      requestDate: state.customerInfo.requestDate,
    };
  };

  const handleRestoreWithRetry = async (maxRetries: number = 3): Promise<boolean> => {
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        const result = await restorePurchases(attempts === 0);
        return result;
      } catch (error) {
        attempts++;
        console.log(`Restore attempt ${attempts} failed:`, error);

        if (attempts >= maxRetries) {
          Alert.alert(
            'Restore Failed',
            'We tried multiple times but could not restore your purchases. Please try again later or contact support.',
            [{ text: 'OK' }]
          );
          return false;
        }

        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }

    return false;
  };

  return {
    ...state,
    purchasePackage,
    restorePurchases,
    checkSubscriptionStatus,
    getEntitlement,
    logOut,
    setUserId,
    getSubscriptionInfo,
    syncPurchases,
    validateEntitlement,
    getReceiptData,
    handleRestoreWithRetry,
  };
};

export const initializeRevenueCat = async () => {
  if (Platform.OS === 'web') {
    console.log('RevenueCat not available on web');
    return;
  }

  try {
    const apiKey = Platform.OS === 'ios' ? REVENUCAT_API_KEY_IOS : REVENUCAT_API_KEY_ANDROID;

    if (!apiKey || apiKey.length === 0) {
      console.warn('RevenueCat API keys not configured. Please add EXPO_PUBLIC_REVENUECAT_API_KEY_IOS and EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID to your environment variables.');
      return;
    }

    await Purchases.configure({ apiKey });
    console.log('RevenueCat initialized successfully');
  } catch (error) {
    console.error('Failed to initialize RevenueCat:', error);
  }
};