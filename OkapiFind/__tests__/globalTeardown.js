/**
 * Jest Global Teardown
 * Runs once after all tests
 */

module.exports = async () => {
  console.log('\n🏁 OkapiFind test suite completed');

  // Calculate total test time
  if (global.testStartTime) {
    const duration = Date.now() - global.testStartTime;
    const seconds = (duration / 1000).toFixed(2);
    console.log(`⏱️  Total test duration: ${seconds}s`);
  }

  // Cleanup test database if needed
  // This could be used to tear down test database instance

  // Clean up any global resources
  console.log('🧹 Cleaning up global resources...');

  // Close any open handles
  if (global.gc) {
    global.gc();
  }

  console.log('✅ Global teardown completed\n');
};