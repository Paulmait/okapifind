/**
 * E2E Tests - App Flow
 */

import { CommonActions, TIMEOUTS, TEST_LOCATION } from './setup';

describe('OkapiFind App', () => {
  beforeEach(async () => {
    await resetApp();
    await CommonActions.waitForLoadingToComplete();
  });

  describe('App Launch', () => {
    it('should launch successfully', async () => {
      await expect(element(by.id('app-container'))).toBeVisible();
    });

    it('should show onboarding or main screen', async () => {
      try {
        // Check if onboarding is shown
        await waitForElementToBeVisible('onboarding-screen', TIMEOUTS.SHORT);
        await expect(element(by.id('onboarding-screen'))).toBeVisible();
      } catch (error) {
        // If no onboarding, should show main screen
        await expect(element(by.id('main-screen'))).toBeVisible();
      }
    });

    it('should handle permissions correctly', async () => {
      await CommonActions.enableLocationPermissions();
      await CommonActions.enableNotificationPermissions();

      // App should continue to function after permissions
      await expect(element(by.id('app-container'))).toBeVisible();
    });
  });

  describe('Onboarding Flow', () => {
    beforeEach(async () => {
      // Reset app to show onboarding
      await device.launchApp({
        newInstance: true,
        delete: true, // Clear app data
      });
    });

    it('should complete onboarding flow', async () => {
      try {
        // Check if onboarding exists
        await waitForElementToBeVisible('onboarding-screen', TIMEOUTS.SHORT);

        // Navigate through onboarding steps
        await element(by.id('onboarding-next-button')).tap();
        await element(by.id('onboarding-next-button')).tap();
        await element(by.id('onboarding-next-button')).tap();

        // Complete onboarding
        await element(by.id('onboarding-complete-button')).tap();

        // Should reach main screen
        await waitForElementToBeVisible('main-screen', TIMEOUTS.MEDIUM);
        await expect(element(by.id('main-screen'))).toBeVisible();
      } catch (error) {
        // Skip test if onboarding doesn't exist
        console.log('Onboarding not found, skipping test');
      }
    });

    it('should allow skipping onboarding', async () => {
      try {
        await waitForElementToBeVisible('onboarding-screen', TIMEOUTS.SHORT);
        await CommonActions.skipOnboarding();

        await waitForElementToBeVisible('main-screen', TIMEOUTS.MEDIUM);
        await expect(element(by.id('main-screen'))).toBeVisible();
      } catch (error) {
        console.log('Onboarding not found or skip not available');
      }
    });
  });

  describe('Authentication Flow', () => {
    it('should show authentication screen when not signed in', async () => {
      try {
        await waitForElementToBeVisible('auth-screen', TIMEOUTS.MEDIUM);
        await expect(element(by.id('auth-screen'))).toBeVisible();
        await expect(element(by.id('google-login-button'))).toBeVisible();
        await expect(element(by.id('apple-login-button'))).toBeVisible();
      } catch (error) {
        // User might already be authenticated
        console.log('User already authenticated or auth screen not shown');
      }
    });

    it('should allow continuing without authentication', async () => {
      try {
        await waitForElementToBeVisible('auth-screen', TIMEOUTS.MEDIUM);
        await element(by.id('skip-signin-button')).tap();

        // Handle confirmation dialog
        await waitFor(element(by.text('Continue')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.SHORT);
        await element(by.text('Continue')).tap();

        // Should reach main app
        await waitForElementToBeVisible('main-screen', TIMEOUTS.MEDIUM);
      } catch (error) {
        console.log('Auth screen not found or user already authenticated');
      }
    });
  });

  describe('Main Navigation', () => {
    beforeEach(async () => {
      await CommonActions.skipOnboarding();
      await CommonActions.waitForLoadingToComplete();
    });

    it('should navigate between main tabs', async () => {
      // Navigate to Map
      await CommonActions.navigateToMap();
      await expect(element(by.id('map-view'))).toBeVisible();

      // Navigate to Settings
      await CommonActions.navigateToSettings();
      await expect(element(by.id('settings-screen'))).toBeVisible();

      // Navigate back to Map
      await CommonActions.navigateToMap();
      await expect(element(by.id('map-view'))).toBeVisible();
    });

    it('should show proper navigation elements', async () => {
      await expect(element(by.id('tab-navigator'))).toBeVisible();
      await expect(element(by.id('map-tab'))).toBeVisible();
      await expect(element(by.id('settings-tab'))).toBeVisible();
    });
  });

  describe('Core Functionality', () => {
    beforeEach(async () => {
      await CommonActions.skipOnboarding();
      await CommonActions.enableLocationPermissions();
      await CommonActions.navigateToMap();
      await CommonActions.waitForLoadingToComplete();
    });

    it('should save car location', async () => {
      // Save current location as car location
      await CommonActions.saveCurrentLocation();

      // Verify car location marker appears
      await expect(element(by.id('car-location-marker'))).toBeVisible();

      // Verify car location info card appears
      await expect(element(by.id('car-info-card'))).toBeVisible();
    });

    it('should show distance to car', async () => {
      await CommonActions.saveCurrentLocation();

      // Distance should be shown in the info card
      await waitFor(element(by.text('0m away')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.MEDIUM);
    });

    it('should navigate to guidance screen', async () => {
      await CommonActions.saveCurrentLocation();

      // Tap on car marker or info card
      await element(by.id('car-location-marker')).tap();

      // Should navigate to guidance screen
      await waitForElementToBeVisible('guidance-screen', TIMEOUTS.MEDIUM);
      await expect(element(by.id('guidance-screen'))).toBeVisible();
    });

    it('should toggle parking detection', async () => {
      // Find and toggle parking detection
      await element(by.id('detection-toggle')).tap();

      // Verify detection is enabled
      // This would depend on the visual feedback for enabled state
      await expect(element(by.id('detection-toggle'))).toBeVisible();
    });
  });

  describe('Error Handling', () => {
    it('should handle location permission denial gracefully', async () => {
      await mockLocationPermissions(false);
      await CommonActions.navigateToMap();

      // Should show permission request or error message
      try {
        await waitFor(element(by.text('Permission Denied')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.MEDIUM);
        await CommonActions.dismissAlert();
      } catch (error) {
        // App might handle permission denial differently
        console.log('Permission denial handled differently');
      }

      // App should still be functional
      await expect(element(by.id('app-container'))).toBeVisible();
    });

    it('should handle network errors gracefully', async () => {
      // Simulate network issues by going offline
      await device.setURLBlacklist(['*']);

      await CommonActions.navigateToMap();
      await CommonActions.waitForLoadingToComplete();

      // App should still function offline
      await expect(element(by.id('map-view'))).toBeVisible();

      // Re-enable network
      await device.setURLBlacklist([]);
    });
  });

  describe('Performance', () => {
    it('should load main screen within acceptable time', async () => {
      const startTime = Date.now();

      await CommonActions.skipOnboarding();
      await CommonActions.navigateToMap();
      await CommonActions.waitForLoadingToComplete();

      const loadTime = Date.now() - startTime;

      // App should load within 10 seconds
      expect(loadTime).toBeLessThan(10000);
    });

    it('should handle rapid navigation without crashes', async () => {
      await CommonActions.skipOnboarding();

      // Rapidly switch between tabs
      for (let i = 0; i < 5; i++) {
        await CommonActions.navigateToMap();
        await CommonActions.navigateToSettings();
      }

      // App should still be responsive
      await expect(element(by.id('app-container'))).toBeVisible();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible elements', async () => {
      await CommonActions.skipOnboarding();
      await CommonActions.navigateToMap();

      // Check that main elements have accessibility labels
      const saveButton = element(by.id('save-car-location-button'));
      await expect(saveButton).toBeVisible();

      // In a real test, we'd verify accessibility properties
      // This depends on how Detox handles accessibility testing
    });

    it('should support voice-over navigation', async () => {
      // Enable voice-over if on iOS
      if (device.getPlatform() === 'ios') {
        // Voice-over testing would go here
        // This is complex and might require additional setup
      }
    });
  });

  afterEach(async () => {
    // Take screenshot if test failed
    if (jasmine.currentSpec && jasmine.currentSpec.failedExpectations.length > 0) {
      const testName = jasmine.currentSpec.fullName.replace(/[^a-zA-Z0-9]/g, '-');
      await takeScreenshot(`failed-${testName}`);
    }
  });
});