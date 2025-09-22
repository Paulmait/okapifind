/**
 * Jest Configuration for E2E Tests
 */

module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.test.{js,ts}'],
  testTimeout: 120000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  setupFilesAfterEnv: ['<rootDir>/e2e/setup.ts'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './e2e/reports',
        filename: 'e2e-report.html',
        expand: true,
      },
    ],
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.stories.{ts,tsx}',
  ],
  coverageDirectory: '<rootDir>/e2e/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};