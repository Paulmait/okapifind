/**
 * Jest Global Setup
 * Runs once before all tests
 */

module.exports = async () => {
  console.log('🚀 Starting OkapiFind test suite...\n');

  // Set timezone for consistent date testing
  process.env.TZ = 'UTC';

  // Set NODE_ENV to test
  process.env.NODE_ENV = 'test';

  // Mock environment variables for testing
  process.env.FIREBASE_API_KEY = 'test-firebase-key';
  process.env.SUPABASE_URL = 'https://test-supabase.com';
  process.env.SUPABASE_ANON_KEY = 'test-supabase-anon-key';
  process.env.REVENUE_CAT_IOS_KEY = 'test-ios-key';
  process.env.REVENUE_CAT_ANDROID_KEY = 'test-android-key';

  // Global test utilities
  global.testStartTime = Date.now();

  // Suppress console warnings during tests (unless in CI)
  if (!process.env.CI) {
    const originalWarn = console.warn;
    console.warn = (...args) => {
      // Only show warnings that are not from React Native or Expo
      const message = args.join(' ');
      if (
        !message.includes('React Native') &&
        !message.includes('Expo') &&
        !message.includes('VirtualizedLists') &&
        !message.includes('componentWillMount')
      ) {
        originalWarn(...args);
      }
    };
  }

  // Setup test database if needed (for integration tests)
  // This could be used to set up a test database instance

  console.log('✅ Global setup completed\n');
};