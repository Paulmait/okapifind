// Type declarations for react-native-purchases v9.x
// These types supplement the default exports to ensure TypeScript compatibility

declare module 'react-native-purchases' {
  export interface CustomerInfo {
    entitlements: {
      active: Record<string, PurchasesEntitlementInfo>;
      all: Record<string, PurchasesEntitlementInfo>;
    };
    latestExpirationDate: string | null;
    allExpirationDates: Record<string, string | null>;
    allPurchaseDates: Record<string, string>;
    requestDate: string;
    firstSeen: string;
    originalAppUserId: string;
    managementURL: string | null;
    originalPurchaseDate: string | null;
    nonSubscriptionTransactions: PurchasesStoreTransaction[];
    activeSubscriptions: string[];
    allPurchasedProductIdentifiers: string[];
  }

  export interface PurchasesEntitlementInfo {
    identifier: string;
    isActive: boolean;
    willRenew: boolean;
    periodType: string;
    latestPurchaseDate: string;
    originalPurchaseDate: string;
    expirationDate: string | null;
    store: string;
    productIdentifier: string;
    isSandbox: boolean;
    unsubscribeDetectedAt: string | null;
    billingIssueDetectedAt: string | null;
  }

  export interface PurchasesStoreTransaction {
    productIdentifier: string;
    purchaseDate: string;
    transactionIdentifier: string;
  }

  export interface PurchasesOfferings {
    current: PurchasesOffering | null;
    all: Record<string, PurchasesOffering>;
  }

  export interface PurchasesOffering {
    identifier: string;
    serverDescription: string;
    availablePackages: PurchasesPackage[];
    lifetime: PurchasesPackage | null;
    annual: PurchasesPackage | null;
    sixMonth: PurchasesPackage | null;
    threeMonth: PurchasesPackage | null;
    twoMonth: PurchasesPackage | null;
    monthly: PurchasesPackage | null;
    weekly: PurchasesPackage | null;
  }

  export interface PurchasesPackage {
    identifier: string;
    packageType: string;
    product: PurchasesStoreProduct;
    offeringIdentifier: string;
  }

  export interface PurchasesStoreProduct {
    identifier: string;
    description: string;
    title: string;
    price: number;
    priceString: string;
    currencyCode: string;
    introPrice: PurchasesIntroPrice | null;
    discounts: PurchasesStoreProductDiscount[];
    subscriptionPeriod: string | null;
  }

  export interface PurchasesIntroPrice {
    price: number;
    priceString: string;
    period: string;
    cycles: number;
    periodUnit: string;
    periodNumberOfUnits: number;
  }

  export interface PurchasesStoreProductDiscount {
    identifier: string;
    price: number;
    priceString: string;
    period: string;
    cycles: number;
    periodUnit: string;
    periodNumberOfUnits: number;
  }

  export interface PurchasesError extends Error {
    code: string;
    underlyingErrorMessage: string | null;
    userCancelled?: boolean;
  }

  export const LOG_LEVEL: {
    VERBOSE: number;
    DEBUG: number;
    INFO: number;
    WARN: number;
    ERROR: number;
  };

  export const PURCHASES_ERROR_CODE: {
    UNKNOWN_ERROR: number;
    PURCHASE_CANCELLED_ERROR: number;
    STORE_PROBLEM_ERROR: number;
    PURCHASE_NOT_ALLOWED_ERROR: number;
    PURCHASE_INVALID_ERROR: number;
    PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR: number;
    PRODUCT_ALREADY_PURCHASED_ERROR: number;
    RECEIPT_ALREADY_IN_USE_ERROR: number;
    INVALID_RECEIPT_ERROR: number;
    MISSING_RECEIPT_FILE_ERROR: number;
    NETWORK_ERROR: number;
    INVALID_CREDENTIALS_ERROR: number;
    UNEXPECTED_BACKEND_RESPONSE_ERROR: number;
    CONFIGURATION_ERROR: number;
  };

  interface Purchases {
    configure(options: { apiKey: string; appUserID?: string }): Promise<void>;
    getCustomerInfo(): Promise<CustomerInfo>;
    getOfferings(): Promise<PurchasesOfferings>;
    purchasePackage(packageToPurchase: PurchasesPackage): Promise<{ customerInfo: CustomerInfo }>;
    restorePurchases(): Promise<CustomerInfo>;
    logOut(): Promise<CustomerInfo>;
    logIn(appUserID: string): Promise<{ customerInfo: CustomerInfo; created: boolean }>;
    setLogLevel(level: number): void;
    addCustomerInfoUpdateListener(listener: (customerInfo: CustomerInfo) => void): () => void;
    syncPurchases(): Promise<void>;
  }

  const Purchases: Purchases;
  export default Purchases;
}
