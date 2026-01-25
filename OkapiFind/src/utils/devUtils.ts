/**
 * Development Utilities
 * Tools for testing premium features, screenshots, and debugging.
 * Only use in development or for App Store screenshot capture.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const DEV_PREMIUM_KEY = '@dev_premium_mode';
const DEV_MODE_KEY = '@dev_mode_enabled';

/**
 * Enable premium mode for testing/screenshots
 * This bypasses RevenueCat and sets local premium flag
 */
export async function enableDevPremium(): Promise<void> {
  try {
    // Set dev premium flag
    await AsyncStorage.setItem(DEV_PREMIUM_KEY, 'true');

    // Also update the premium-storage used by usePremium hook
    const premiumStorage = await AsyncStorage.getItem('premium-storage');
    const data = premiumStorage ? JSON.parse(premiumStorage) : {};
    data.isPremium = true;
    await AsyncStorage.setItem('premium-storage', JSON.stringify(data));

    console.log('[DevUtils] Premium mode enabled for testing');
  } catch (error) {
    console.error('[DevUtils] Failed to enable dev premium:', error);
  }
}

/**
 * Disable development premium mode
 */
export async function disableDevPremium(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DEV_PREMIUM_KEY);

    // Reset premium-storage
    const premiumStorage = await AsyncStorage.getItem('premium-storage');
    const data = premiumStorage ? JSON.parse(premiumStorage) : {};
    data.isPremium = false;
    await AsyncStorage.setItem('premium-storage', JSON.stringify(data));

    console.log('[DevUtils] Premium mode disabled');
  } catch (error) {
    console.error('[DevUtils] Failed to disable dev premium:', error);
  }
}

/**
 * Check if dev premium mode is enabled
 */
export async function isDevPremiumEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(DEV_PREMIUM_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

/**
 * Enable developer mode (shows hidden options)
 */
export async function enableDevMode(): Promise<void> {
  await AsyncStorage.setItem(DEV_MODE_KEY, 'true');
  console.log('[DevUtils] Developer mode enabled');
}

/**
 * Disable developer mode
 */
export async function disableDevMode(): Promise<void> {
  await AsyncStorage.removeItem(DEV_MODE_KEY);
  console.log('[DevUtils] Developer mode disabled');
}

/**
 * Check if developer mode is enabled
 */
export async function isDevModeEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(DEV_MODE_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

/**
 * Toggle dev premium mode
 */
export async function toggleDevPremium(): Promise<boolean> {
  const isEnabled = await isDevPremiumEnabled();
  if (isEnabled) {
    await disableDevPremium();
    return false;
  } else {
    await enableDevPremium();
    return true;
  }
}

/**
 * Get all dev settings for debugging
 */
export async function getDevSettings(): Promise<{
  devMode: boolean;
  devPremium: boolean;
  premiumStorage: any;
}> {
  const [devMode, devPremium, premiumStorage] = await Promise.all([
    isDevModeEnabled(),
    isDevPremiumEnabled(),
    AsyncStorage.getItem('premium-storage'),
  ]);

  return {
    devMode,
    devPremium,
    premiumStorage: premiumStorage ? JSON.parse(premiumStorage) : null,
  };
}

/**
 * Clear all dev settings
 */
export async function clearDevSettings(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(DEV_PREMIUM_KEY),
    AsyncStorage.removeItem(DEV_MODE_KEY),
  ]);
  console.log('[DevUtils] All dev settings cleared');
}
