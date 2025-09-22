/**
 * E2E Test Setup
 */

import { cleanup, init } from 'detox';

const config = require('../.detoxrc.js');

beforeAll(async () => {
  await init(config, { initGlobals: false });
}, 120000);

afterAll(async () => {
  await cleanup();
});

// Global test utilities for E2E
declare global {
  var waitForElementToBeVisible: (elementId: string, timeout?: number) => Promise<void>;
  var waitForElementToBeNotVisible: (elementId: string, timeout?: number) => Promise<void>;
  var takeScreenshot: (name: string) => Promise<void>;
  var resetApp: () => Promise<void>;
  var mockLocationPermissions: (granted: boolean) => Promise<void>;
  var mockNotificationPermissions: (granted: boolean) => Promise<void>;
}

// Helper functions
global.waitForElementToBeVisible = async (elementId: string, timeout: number = 10000) => {
  await waitFor(element(by.id(elementId)))
    .toBeVisible()
    .withTimeout(timeout);
};

global.waitForElementToBeNotVisible = async (elementId: string, timeout: number = 10000) => {
  await waitFor(element(by.id(elementId)))
    .not.toBeVisible()
    .withTimeout(timeout);
};

global.takeScreenshot = async (name: string) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotPath = `./e2e/screenshots/${name}-${timestamp}.png`;

  try {
    await device.takeScreenshot(screenshotPath);
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
  } catch (error) {
    console.warn(`⚠️ Failed to take screenshot: ${error.message}`);
  }
};

global.resetApp = async () => {
  await device.launchApp({
    newInstance: true,
    permissions: {
      location: 'always',
      notifications: 'YES',
      camera: 'YES',
      photos: 'YES',
    },
  });
};

global.mockLocationPermissions = async (granted: boolean) => {
  if (device.getPlatform() === 'ios') {
    await device.launchApp({
      permissions: {
        location: granted ? 'always' : 'never',
      },
    });
  } else {
    // Android permission handling would go here
    // This might involve adb commands or specific Detox APIs
  }
};

global.mockNotificationPermissions = async (granted: boolean) => {
  if (device.getPlatform() === 'ios') {
    await device.launchApp({
      permissions: {
        notifications: granted ? 'YES' : 'NO',
      },
    });
  } else {
    // Android notification permission handling
  }
};

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Take a screenshot on error
  if (global.takeScreenshot) {
    global.takeScreenshot('unhandled-error').catch(() => {});
  }
});

// Setup test data
export const TEST_USER = {
  email: 'test@okapifind.com',
  password: 'TestPassword123!',
  displayName: 'Test User',
};

export const TEST_LOCATION = {
  latitude: 37.7749,
  longitude: -122.4194,
  address: '123 Test Street, San Francisco, CA 94102',
};

export const PARKING_SPOT_DATA = {
  location: TEST_LOCATION,
  notes: 'Test parking spot for E2E tests',
  address: '123 Test Street',
};

// Test timeouts
export const TIMEOUTS = {
  SHORT: 5000,
  MEDIUM: 10000,
  LONG: 30000,
  EXTRA_LONG: 60000,
};

// Common test actions
export const CommonActions = {
  async skipOnboarding() {
    try {
      await element(by.id('skip-onboarding-button')).tap();
    } catch (error) {
      // Onboarding might not be shown
      console.log('Onboarding not found or already completed');
    }
  },

  async navigateToMap() {
    await element(by.id('map-tab')).tap();
    await waitFor(element(by.id('map-view')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },

  async navigateToSettings() {
    await element(by.id('settings-tab')).tap();
    await waitFor(element(by.id('settings-screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },

  async saveCurrentLocation() {
    await element(by.id('save-car-location-button')).tap();
    await waitFor(element(by.id('car-location-marker')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },

  async enableLocationPermissions() {
    try {
      // Handle location permission dialog
      await waitFor(element(by.text('Allow')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.SHORT);
      await element(by.text('Allow')).tap();
    } catch (error) {
      // Permission might already be granted
      console.log('Location permission already granted or not requested');
    }
  },

  async enableNotificationPermissions() {
    try {
      // Handle notification permission dialog
      await waitFor(element(by.text('Allow')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.SHORT);
      await element(by.text('Allow')).tap();
    } catch (error) {
      // Permission might already be granted
      console.log('Notification permission already granted or not requested');
    }
  },

  async dismissAlert() {
    try {
      await element(by.text('OK')).tap();
    } catch (error) {
      // No alert to dismiss
    }
  },

  async waitForLoadingToComplete() {
    try {
      await waitFor(element(by.id('loading-indicator')))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.LONG);
    } catch (error) {
      // Loading indicator might not be present
      console.log('No loading indicator found');
    }
  },
};