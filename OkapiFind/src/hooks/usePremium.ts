import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases, {
  CustomerInfo,
  PurchasesPackage,
  PurchasesOfferings,
  PurchasesError,
  PURCHASES_ERROR_CODE
} from 'react-native-purchases';

interface PremiumState {
  isPremium: boolean;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOfferings | null;
  setPremium: (isPremium: boolean) => void;
  setCustomerInfo: (customerInfo: CustomerInfo | null) => void;
  checkPremiumStatus: () => Promise<boolean>;
  clearPremium: () => void;
  subscribe: (packageId: string) => Promise<{
    success: boolean;
    customerInfo?: CustomerInfo;
    error?: string;
    userCancelled?: boolean;
  }>;
  restorePurchases: () => Promise<{
    success: boolean;
    isPremium: boolean;
    error?: string
  }>;
  loadOfferings: () => Promise<PurchasesOfferings | null>;
}

export const usePremium = create<PremiumState>()(
  persist(
    (set, get) => ({
      isPremium: false,
      customerInfo: null,
      offerings: null,

      setPremium: (isPremium: boolean) => {
        set({ isPremium });
      },

      setCustomerInfo: (customerInfo: CustomerInfo | null) => {
        const isPremium = customerInfo?.entitlements.active['premium'] !== undefined;
        set({ customerInfo, isPremium });
      },

      checkPremiumStatus: async (): Promise<boolean> => {
        try {
          const customerInfo = await Purchases.getCustomerInfo();
          const isPremium = customerInfo.entitlements.active['premium'] !== undefined;

          // Persist premium status when entitlements.active["premium"] exists
          set({ customerInfo, isPremium });
          return isPremium;
        } catch (error) {
          console.error('Error checking premium status:', error);
          return false;
        }
      },

      subscribe: async (packageId: string) => {
        try {
          // Load offerings if not already loaded
          let offerings = get().offerings;
          if (!offerings) {
            offerings = await get().loadOfferings();
          }

          if (!offerings?.current) {
            return {
              success: false,
              error: 'No offerings available. Please try again later.'
            };
          }

          // Find the package by ID
          const selectedPackage = offerings.current.availablePackages.find(
            (pkg: PurchasesPackage) => pkg.identifier === packageId
          );

          if (!selectedPackage) {
            // Try finding by package type as fallback
            const packageType = packageId.toUpperCase();
            const selectedPackageByType = offerings.current.availablePackages.find(
              (pkg: PurchasesPackage) => pkg.packageType === packageType
            );

            if (!selectedPackageByType) {
              return {
                success: false,
                error: `Package "${packageId}" not found`
              };
            }

            // Use the package found by type
            const { customerInfo } = await Purchases.purchasePackage(selectedPackageByType);
            const isPremium = customerInfo.entitlements.active['premium'] !== undefined;

            // Persist premium status when entitlements.active["premium"] exists
            set({ customerInfo, isPremium });

            return {
              success: isPremium,
              customerInfo,
              error: isPremium ? undefined : 'Purchase completed but premium not activated'
            };
          }

          // Purchase the package
          const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
          const isPremium = customerInfo.entitlements.active['premium'] !== undefined;

          // Persist premium status when entitlements.active["premium"] exists
          set({ customerInfo, isPremium });

          return {
            success: isPremium,
            customerInfo,
            error: isPremium ? undefined : 'Purchase completed but premium not activated'
          };

        } catch (error: any) {
          console.error('Purchase error:', error);

          // Check if user cancelled
          if (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
            return {
              success: false,
              error: 'Purchase cancelled',
              userCancelled: true
            };
          }

          return {
            success: false,
            error: error.message || 'Purchase failed. Please try again.'
          };
        }
      },

      restorePurchases: async () => {
        try {
          // Call Purchases.restoreTransactions() (restorePurchases is the method name in the SDK)
          const customerInfo = await Purchases.restorePurchases();
          const isPremium = customerInfo.entitlements.active['premium'] !== undefined;

          // Persist premium status when entitlements.active["premium"] exists
          set({ customerInfo, isPremium });

          return {
            success: true,
            isPremium,
            error: undefined
          };

        } catch (error: any) {
          console.error('Restore purchases error:', error);

          return {
            success: false,
            isPremium: false,
            error: error.message || 'Failed to restore purchases. Please try again.'
          };
        }
      },

      loadOfferings: async (): Promise<PurchasesOfferings | null> => {
        try {
          const offerings = await Purchases.getOfferings();
          set({ offerings });
          return offerings;
        } catch (error) {
          console.error('Error loading offerings:', error);
          return null;
        }
      },

      clearPremium: () => {
        set({ isPremium: false, customerInfo: null, offerings: null });
      },
    }),
    {
      name: 'premium-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ isPremium: state.isPremium }),
    }
  )
);