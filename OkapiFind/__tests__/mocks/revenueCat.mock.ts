/**
 * RevenueCat Mock for Testing
 */

export const mockCustomerInfo = {
  entitlements: {
    active: {},
    all: {},
  },
  activeSubscriptions: [],
  allPurchasedProductIdentifiers: [],
  latestExpirationDate: null,
  originalApplicationVersion: '1.0.0',
  requestDate: new Date().toISOString(),
  firstSeen: new Date().toISOString(),
  originalPurchaseDate: null,
  managementURL: null,
  nonConsumablePurchases: [],
  allExpirationDates: {},
  allPurchaseDates: {},
  originalAppUserId: 'test-user-id',
};

export const mockPremiumCustomerInfo = {
  ...mockCustomerInfo,
  entitlements: {
    active: {
      premium: {
        identifier: 'premium',
        isActive: true,
        willRenew: true,
        periodType: 'NORMAL',
        latestPurchaseDate: new Date().toISOString(),
        originalPurchaseDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        store: 'APP_STORE',
        productIdentifier: 'premium_monthly',
        isSandbox: true,
        unsubscribeDetectedAt: null,
        billingIssueDetectedAt: null,
      },
    },
    all: {
      premium: {
        identifier: 'premium',
        isActive: true,
        willRenew: true,
        periodType: 'NORMAL',
        latestPurchaseDate: new Date().toISOString(),
        originalPurchaseDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        store: 'APP_STORE',
        productIdentifier: 'premium_monthly',
        isSandbox: true,
        unsubscribeDetectedAt: null,
        billingIssueDetectedAt: null,
      },
    },
  },
};

export const mockOfferings = {
  current: {
    identifier: 'default',
    serverDescription: 'Default offering',
    metadata: {},
    availablePackages: [
      {
        identifier: 'premium_monthly',
        packageType: 'MONTHLY',
        product: {
          identifier: 'premium_monthly',
          description: 'Premium Monthly Subscription',
          title: 'Premium Monthly',
          price: 9.99,
          priceString: '$9.99',
          currencyCode: 'USD',
          introPrice: null,
          discounts: [],
        },
        offeringIdentifier: 'default',
      },
      {
        identifier: 'premium_yearly',
        packageType: 'ANNUAL',
        product: {
          identifier: 'premium_yearly',
          description: 'Premium Yearly Subscription',
          title: 'Premium Yearly',
          price: 99.99,
          priceString: '$99.99',
          currencyCode: 'USD',
          introPrice: null,
          discounts: [],
        },
        offeringIdentifier: 'default',
      },
    ],
    lifetime: null,
    annual: {
      identifier: 'premium_yearly',
      packageType: 'ANNUAL',
      product: {
        identifier: 'premium_yearly',
        description: 'Premium Yearly Subscription',
        title: 'Premium Yearly',
        price: 99.99,
        priceString: '$99.99',
        currencyCode: 'USD',
        introPrice: null,
        discounts: [],
      },
      offeringIdentifier: 'default',
    },
    monthly: {
      identifier: 'premium_monthly',
      packageType: 'MONTHLY',
      product: {
        identifier: 'premium_monthly',
        description: 'Premium Monthly Subscription',
        title: 'Premium Monthly',
        price: 9.99,
        priceString: '$9.99',
        currencyCode: 'USD',
        introPrice: null,
        discounts: [],
      },
      offeringIdentifier: 'default',
    },
    weekly: null,
    twoMonth: null,
    threeMonth: null,
    sixMonth: null,
  },
  all: {},
};

export const mockPurchases = {
  configure: jest.fn(),
  getCustomerInfo: jest.fn(() => Promise.resolve(mockCustomerInfo)),
  getOfferings: jest.fn(() => Promise.resolve(mockOfferings)),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
  syncPurchases: jest.fn(),
  setDebugLogsEnabled: jest.fn(),
  setLogLevel: jest.fn(),
  setLogHandler: jest.fn(),
  setAttributes: jest.fn(),
  setEmail: jest.fn(),
  setPhoneNumber: jest.fn(),
  setDisplayName: jest.fn(),
  setPushToken: jest.fn(),
  setAdjustID: jest.fn(),
  setAppsflyerID: jest.fn(),
  setFBAnonymousID: jest.fn(),
  setMparticleID: jest.fn(),
  setOnesignalID: jest.fn(),
  setAirshipChannelID: jest.fn(),
  setCleverTapID: jest.fn(),
  setMixpanelDistinctID: jest.fn(),
  setFirebaseAppInstanceID: jest.fn(),
  collectDeviceIdentifiers: jest.fn(),
  canMakePayments: jest.fn(() => Promise.resolve(true)),
  presentCodeRedemptionSheet: jest.fn(),
  getPromotionalOffer: jest.fn(),
  invalidateCustomerInfoCache: jest.fn(),
  addCustomerInfoUpdateListener: jest.fn(),
  removeCustomerInfoUpdateListener: jest.fn(),
  LOG_LEVEL: {
    VERBOSE: 'VERBOSE',
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
  },
};

// Mock react-native-purchases
jest.mock('react-native-purchases', () => mockPurchases);

export default mockPurchases;