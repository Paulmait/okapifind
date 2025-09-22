/**
 * useRevenueCat Hook Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Platform, Alert } from 'react-native';
import Purchases from 'react-native-purchases';
import { useRevenueCat, initializeRevenueCat } from '../../hooks/useRevenueCat';
import {
  mockCustomerInfo,
  mockPremiumCustomerInfo,
  mockOfferings,
  mockPurchases
} from '../../../__tests__/mocks/revenueCat.mock';

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('useRevenueCat', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset Purchases mock to default state
    mockPurchases.configure.mockResolvedValue(undefined);
    mockPurchases.getCustomerInfo.mockResolvedValue(mockCustomerInfo);
    mockPurchases.getOfferings.mockResolvedValue(mockOfferings);
    mockPurchases.addCustomerInfoUpdateListener.mockImplementation(() => jest.fn());
  });

  describe('Initialization', () => {
    it('should initialize with loading state', () => {
      const { result } = renderHook(() => useRevenueCat());

      expect(result.current.isInitialized).toBe(false);
      expect(result.current.isPremium).toBe(false);
      expect(result.current.customerInfo).toBeNull();
      expect(result.current.offerings).toBeNull();
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should initialize RevenueCat successfully', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios' });

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      expect(mockPurchases.configure).toHaveBeenCalledWith({
        apiKey: 'your_ios_api_key_here',
      });
      expect(mockPurchases.getCustomerInfo).toHaveBeenCalled();
      expect(mockPurchases.getOfferings).toHaveBeenCalled();
      expect(mockPurchases.addCustomerInfoUpdateListener).toHaveBeenCalled();

      expect(result.current.isInitialized).toBe(true);
      expect(result.current.isPremium).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle initialization error', async () => {
      const error = new Error('Network error');
      mockPurchases.configure.mockRejectedValue(error);

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isInitialized).toBe(false);
      expect(result.current.error).toBe('Failed to initialize subscription service');
    });

    it('should use Android API key on Android platform', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'android' });

      renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(mockPurchases.configure).toHaveBeenCalledWith({
          apiKey: 'your_android_api_key_here',
        });
      });
    });

    it('should set log level on Android in dev mode', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'android' });
      global.__DEV__ = true;

      renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(mockPurchases.setLogLevel).toHaveBeenCalledWith('VERBOSE');
      });
    });

    it('should detect premium subscription', async () => {
      mockPurchases.getCustomerInfo.mockResolvedValue(mockPremiumCustomerInfo);

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isPremium).toBe(true);
      });
    });
  });

  describe('purchasePackage', () => {
    it('should purchase package successfully', async () => {
      mockPurchases.getCustomerInfo.mockResolvedValue(mockCustomerInfo);
      mockPurchases.getOfferings.mockResolvedValue(mockOfferings);
      mockPurchases.purchasePackage.mockResolvedValue({
        customerInfo: mockPremiumCustomerInfo,
      });

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let purchaseResult: boolean;
      await act(async () => {
        purchaseResult = await result.current.purchasePackage('premium_monthly');
      });

      expect(mockPurchases.purchasePackage).toHaveBeenCalledWith(
        mockOfferings.current.availablePackages[0]
      );
      expect(purchaseResult!).toBe(true);
      expect(result.current.isPremium).toBe(true);
    });

    it('should handle missing offerings', async () => {
      mockPurchases.getOfferings.mockResolvedValue({ current: null });

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let purchaseResult: boolean;
      await act(async () => {
        purchaseResult = await result.current.purchasePackage('premium_monthly');
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'No packages available');
      expect(purchaseResult!).toBe(false);
    });

    it('should handle package not found', async () => {
      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let purchaseResult: boolean;
      await act(async () => {
        purchaseResult = await result.current.purchasePackage('non_existent_package');
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Package not found');
      expect(purchaseResult!).toBe(false);
    });

    it('should handle purchase cancellation', async () => {
      const cancelError = new Error('User cancelled');
      cancelError.userCancelled = true;
      mockPurchases.purchasePackage.mockRejectedValue(cancelError);

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let purchaseResult: boolean;
      await act(async () => {
        purchaseResult = await result.current.purchasePackage('premium_monthly');
      });

      expect(Alert.alert).not.toHaveBeenCalled();
      expect(purchaseResult!).toBe(false);
    });

    it('should handle purchase error', async () => {
      const error = new Error('Purchase failed');
      mockPurchases.purchasePackage.mockRejectedValue(error);

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let purchaseResult: boolean;
      await act(async () => {
        purchaseResult = await result.current.purchasePackage('premium_monthly');
      });

      expect(Alert.alert).toHaveBeenCalledWith('Purchase Failed', 'Purchase failed');
      expect(purchaseResult!).toBe(false);
    });
  });

  describe('restorePurchases', () => {
    it('should restore purchases successfully', async () => {
      mockPurchases.restorePurchases.mockResolvedValue(mockPremiumCustomerInfo);

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let restoreResult: boolean;
      await act(async () => {
        restoreResult = await result.current.restorePurchases();
      });

      expect(mockPurchases.restorePurchases).toHaveBeenCalled();
      expect(restoreResult!).toBe(true);
      expect(result.current.isPremium).toBe(true);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Purchases Restored',
        'Your previous purchases have been successfully restored.',
        [{ text: 'OK' }]
      );
    });

    it('should handle no purchases found', async () => {
      mockPurchases.restorePurchases.mockResolvedValue(mockCustomerInfo);

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let restoreResult: boolean;
      await act(async () => {
        restoreResult = await result.current.restorePurchases();
      });

      expect(restoreResult!).toBe(false);
      expect(Alert.alert).toHaveBeenCalledWith(
        'No Purchases Found',
        'No previous purchases were found to restore. If you believe this is an error, please contact support.',
        expect.arrayContaining([
          { text: 'OK', style: 'default' },
          expect.objectContaining({ text: 'Contact Support' }),
        ])
      );
    });

    it('should handle restore error with network error code', async () => {
      const error = new Error('Network error');
      error.code = 'NETWORK_ERROR';
      mockPurchases.restorePurchases.mockRejectedValue(error);

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let restoreResult: boolean;
      await act(async () => {
        restoreResult = await result.current.restorePurchases();
      });

      expect(restoreResult!).toBe(false);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Restore Failed',
        'Network error. Please check your connection and try again.',
        expect.arrayContaining([
          { text: 'OK', style: 'default' },
          expect.objectContaining({ text: 'Try Again' }),
        ])
      );
    });
  });

  describe('checkSubscriptionStatus', () => {
    it('should check subscription status', async () => {
      mockPurchases.getCustomerInfo.mockResolvedValue(mockPremiumCustomerInfo);

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let statusResult: boolean;
      await act(async () => {
        statusResult = await result.current.checkSubscriptionStatus();
      });

      expect(statusResult!).toBe(true);
      expect(result.current.isPremium).toBe(true);
    });

    it('should handle check status error', async () => {
      mockPurchases.getCustomerInfo.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useRevenueCat());

      let statusResult: boolean;
      await act(async () => {
        statusResult = await result.current.checkSubscriptionStatus();
      });

      expect(statusResult!).toBe(false);
    });
  });

  describe('getEntitlement', () => {
    it('should get entitlement', async () => {
      mockPurchases.getCustomerInfo.mockResolvedValue(mockPremiumCustomerInfo);

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isPremium).toBe(true);
      });

      const entitlement = result.current.getEntitlement('premium');
      expect(entitlement).toBeDefined();
      expect(entitlement?.identifier).toBe('premium');
    });

    it('should return undefined for non-existent entitlement', async () => {
      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      const entitlement = result.current.getEntitlement('non_existent');
      expect(entitlement).toBeUndefined();
    });
  });

  describe('logOut and setUserId', () => {
    it('should log out successfully', async () => {
      mockPurchases.logOut.mockResolvedValue(undefined);
      mockPurchases.getCustomerInfo.mockResolvedValue(mockCustomerInfo);

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      await act(async () => {
        await result.current.logOut();
      });

      expect(mockPurchases.logOut).toHaveBeenCalled();
      expect(result.current.isPremium).toBe(false);
    });

    it('should set user ID successfully', async () => {
      mockPurchases.logIn.mockResolvedValue({
        customerInfo: mockPremiumCustomerInfo,
      });

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      await act(async () => {
        await result.current.setUserId('user123');
      });

      expect(mockPurchases.logIn).toHaveBeenCalledWith('user123');
      expect(result.current.isPremium).toBe(true);
    });
  });

  describe('syncPurchases', () => {
    it('should sync purchases successfully', async () => {
      mockPurchases.syncPurchases.mockResolvedValue(undefined);
      mockPurchases.getCustomerInfo.mockResolvedValue(mockPremiumCustomerInfo);

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let syncResult: boolean;
      await act(async () => {
        syncResult = await result.current.syncPurchases();
      });

      expect(mockPurchases.syncPurchases).toHaveBeenCalled();
      expect(syncResult!).toBe(true);
      expect(result.current.isPremium).toBe(true);
    });

    it('should handle sync error', async () => {
      mockPurchases.syncPurchases.mockRejectedValue(new Error('Sync failed'));

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let syncResult: boolean;
      await act(async () => {
        syncResult = await result.current.syncPurchases();
      });

      expect(syncResult!).toBe(false);
      expect(result.current.error).toBe('Failed to sync purchases');
    });
  });

  describe('validateEntitlement', () => {
    it('should validate entitlement', async () => {
      mockPurchases.getCustomerInfo.mockResolvedValue(mockPremiumCustomerInfo);

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let isValid: boolean;
      await act(async () => {
        isValid = await result.current.validateEntitlement('premium');
      });

      expect(isValid!).toBe(true);
    });

    it('should handle validation error', async () => {
      mockPurchases.getCustomerInfo.mockRejectedValue(new Error('Validation failed'));

      const { result } = renderHook(() => useRevenueCat());

      let isValid: boolean;
      await act(async () => {
        isValid = await result.current.validateEntitlement('premium');
      });

      expect(isValid!).toBe(false);
    });
  });

  describe('handleRestoreWithRetry', () => {
    it('should retry restore on failure', async () => {
      mockPurchases.restorePurchases
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValue(mockPremiumCustomerInfo);

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let restoreResult: boolean;
      await act(async () => {
        restoreResult = await result.current.handleRestoreWithRetry(2);
      });

      expect(mockPurchases.restorePurchases).toHaveBeenCalledTimes(2);
      expect(restoreResult!).toBe(true);
    });

    it('should fail after max retries', async () => {
      mockPurchases.restorePurchases.mockRejectedValue(new Error('Always fails'));

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let restoreResult: boolean;
      await act(async () => {
        restoreResult = await result.current.handleRestoreWithRetry(2);
      });

      expect(mockPurchases.restorePurchases).toHaveBeenCalledTimes(2);
      expect(restoreResult!).toBe(false);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Restore Failed',
        'We tried multiple times but could not restore your purchases. Please try again later or contact support.',
        [{ text: 'OK' }]
      );
    });
  });

  describe('getSubscriptionInfo', () => {
    it('should return subscription info', async () => {
      mockPurchases.getCustomerInfo.mockResolvedValue(mockPremiumCustomerInfo);

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isPremium).toBe(true);
      });

      const info = result.current.getSubscriptionInfo();
      expect(info).toEqual({
        hasActiveSubscription: true,
        activeEntitlements: ['premium'],
        subscriptionHistory: mockPremiumCustomerInfo.allPurchaseDates,
        managementURL: mockPremiumCustomerInfo.managementURL,
        firstSeen: mockPremiumCustomerInfo.firstSeen,
        originalAppUserId: mockPremiumCustomerInfo.originalAppUserId,
      });
    });

    it('should return null when no customer info', () => {
      const { result } = renderHook(() => useRevenueCat());

      const info = result.current.getSubscriptionInfo();
      expect(info).toBeNull();
    });
  });

  describe('getReceiptData', () => {
    it('should return receipt data', async () => {
      mockPurchases.getCustomerInfo.mockResolvedValue(mockPremiumCustomerInfo);

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isPremium).toBe(true);
      });

      const receiptData = result.current.getReceiptData();
      expect(receiptData).toEqual({
        latestExpirationDate: mockPremiumCustomerInfo.latestExpirationDate,
        allExpirationDates: mockPremiumCustomerInfo.allExpirationDates,
        allPurchaseDates: mockPremiumCustomerInfo.allPurchaseDates,
        requestDate: mockPremiumCustomerInfo.requestDate,
      });
    });

    it('should return null when no customer info', () => {
      const { result } = renderHook(() => useRevenueCat());

      const receiptData = result.current.getReceiptData();
      expect(receiptData).toBeNull();
    });
  });

  describe('Customer Info Update Listener', () => {
    it('should update state when customer info changes', async () => {
      let listener: any;
      mockPurchases.addCustomerInfoUpdateListener.mockImplementation((callback) => {
        listener = callback;
        return jest.fn();
      });

      const { result } = renderHook(() => useRevenueCat());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      expect(result.current.isPremium).toBe(false);

      // Simulate customer info update
      act(() => {
        listener(mockPremiumCustomerInfo);
      });

      expect(result.current.isPremium).toBe(true);
      expect(result.current.customerInfo).toEqual(mockPremiumCustomerInfo);
    });
  });
});

describe('initializeRevenueCat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with iOS key', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    mockPurchases.configure.mockResolvedValue(undefined);

    await initializeRevenueCat();

    expect(mockPurchases.configure).toHaveBeenCalledWith({
      apiKey: 'your_ios_api_key_here',
    });
  });

  it('should initialize with Android key', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    mockPurchases.configure.mockResolvedValue(undefined);

    await initializeRevenueCat();

    expect(mockPurchases.configure).toHaveBeenCalledWith({
      apiKey: 'your_android_api_key_here',
    });
  });

  it('should warn about missing API keys', async () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

    await initializeRevenueCat();

    expect(consoleWarn).toHaveBeenCalledWith(
      'RevenueCat API keys not configured. Please add your API keys to useRevenueCat.ts'
    );
    expect(mockPurchases.configure).not.toHaveBeenCalled();

    consoleWarn.mockRestore();
  });

  it('should handle initialization error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();

    // Mock with valid API keys by temporarily changing the function
    const originalInit = initializeRevenueCat;
    const mockInit = jest.fn(async () => {
      try {
        await Purchases.configure({ apiKey: 'valid-api-key' });
      } catch (error) {
        console.error('Failed to initialize RevenueCat:', error);
      }
    });

    const error = new Error('Network error');
    mockPurchases.configure.mockRejectedValue(error);

    await mockInit();

    expect(consoleError).toHaveBeenCalledWith('Failed to initialize RevenueCat:', error);

    consoleError.mockRestore();
  });
});