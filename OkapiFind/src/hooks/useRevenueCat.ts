import { useState, useEffect } from 'react';
import Purchases, {
  CustomerInfo,
  PurchasesEntitlementInfo,
  LOG_LEVEL,
  PurchasesOfferings,
} from 'react-native-purchases';
import { Platform, Alert } from 'react-native';

const REVENUCAT_API_KEY_IOS = 'your_ios_api_key_here';
const REVENUCAT_API_KEY_ANDROID = 'your_android_api_key_here';

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

  const restorePurchases = async (): Promise<boolean> => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      const isPremium = customerInfo.entitlements.active['premium'] !== undefined;

      setState(prev => ({
        ...prev,
        customerInfo,
        isPremium,
      }));

      if (!isPremium) {
        Alert.alert('No Purchases Found', 'No previous purchases were found to restore.');
      }

      return isPremium;
    } catch (error) {
      Alert.alert('Restore Failed', 'Unable to restore purchases. Please try again.');
      return false;
    }
  };

  const checkSubscriptionStatus = async () => {
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

  return {
    ...state,
    purchasePackage,
    restorePurchases,
    checkSubscriptionStatus,
    getEntitlement,
    logOut,
    setUserId,
  };
};

export const initializeRevenueCat = async () => {
  try {
    const apiKey = Platform.OS === 'ios' ? REVENUCAT_API_KEY_IOS : REVENUCAT_API_KEY_ANDROID;

    if (apiKey === 'your_ios_api_key_here' || apiKey === 'your_android_api_key_here') {
      console.warn('RevenueCat API keys not configured. Please add your API keys to useRevenueCat.ts');
      return;
    }

    await Purchases.configure({ apiKey });
    console.log('RevenueCat initialized successfully');
  } catch (error) {
    console.error('Failed to initialize RevenueCat:', error);
  }
};