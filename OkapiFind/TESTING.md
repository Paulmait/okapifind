# Testing Infrastructure for OkapiFind

This document provides a comprehensive overview of the testing infrastructure for the OkapiFind React Native application.

## 📋 Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Test Types](#test-types)
- [Running Tests](#running-tests)
- [Coverage](#coverage)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)
- [Manual Testing](#manual-testing)

## 🎯 Overview

The OkapiFind testing infrastructure is designed to provide comprehensive coverage with multiple layers of testing:

- **Unit Tests**: Test individual functions and components in isolation
- **Integration Tests**: Test interactions between services and external APIs
- **Component Tests**: Test React Native components and screens
- **End-to-End Tests**: Test complete user workflows using Detox

### Key Features

- ✅ 70%+ code coverage requirement
- ✅ Automated CI/CD pipeline with GitHub Actions
- ✅ Multiple test environments (unit, integration, e2e)
- ✅ Comprehensive mocking for external dependencies
- ✅ Performance and security testing
- ✅ Cross-platform testing (iOS/Android)

## 📁 Test Structure

```
OkapiFind/
├── src/
│   └── __tests__/           # Test files organized by type
│       ├── services/        # Service layer tests
│       ├── hooks/          # React hooks tests
│       ├── screens/        # Screen component tests
│       ├── components/     # Component tests
│       ├── utils/          # Utility function tests
│       └── integration/    # Integration tests
├── __tests__/              # Global test configuration
│   ├── mocks/             # Mock implementations
│   ├── utils/             # Test utilities and helpers
│   ├── globalSetup.js     # Jest global setup
│   ├── globalTeardown.js  # Jest global teardown
│   └── testResultsProcessor.js # Custom test reporting
├── e2e/                   # End-to-end tests
│   ├── app.test.ts        # Main app flow tests
│   ├── parking-flow.test.ts # Parking-specific tests
│   ├── setup.ts           # E2E test setup
│   └── jest.config.js     # E2E Jest configuration
├── jest.config.js         # Main Jest configuration
└── .detoxrc.js           # Detox E2E configuration
```

## 🧪 Test Types

### Unit Tests

Located in `src/__tests__/`, these test individual functions and components:

**Services Tests:**
- `auth.service.test.ts` - Authentication service with Firebase
- `pushNotificationService.test.ts` - Push notifications and timers
- `ParkingDetectionService.test.ts` - Location and parking detection

**Hooks Tests:**
- `useRevenueCat.test.ts` - RevenueCat subscription management
- `useCarLocation.test.ts` - Car location management
- `useParkingDetection.test.ts` - Parking detection logic

**Component Tests:**
- `MapScreen.test.tsx` - Main map interface
- `AuthScreen.test.tsx` - Authentication flow

### Integration Tests

Located in `src/__tests__/integration/`:

- `firebase.integration.test.ts` - Firebase Auth and Firestore
- `supabase.integration.test.ts` - Supabase database operations

### End-to-End Tests

Located in `e2e/`:

- `app.test.ts` - Main app flow and navigation
- `parking-flow.test.ts` - Complete parking detection and guidance workflow

## 🚀 Running Tests

### Prerequisites

```bash
npm install
```

### Basic Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test types
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:components    # Component tests only
npm run test:e2e          # End-to-end tests

# Run tests for CI
npm run test:ci
```

### Advanced Test Commands

```bash
# Run tests for specific files
npm test -- auth.service.test.ts

# Debug tests
npm run test:debug

# Update snapshots
npm run test:update-snapshots

# Coverage analysis
npm run coverage:open      # Open coverage report in browser
```

### End-to-End Testing

```bash
# Build app for testing
npm run test:e2e:build

# Run E2E tests
npm run test:e2e

# Run E2E tests on specific platform
detox test --configuration ios.sim.debug
detox test --configuration android.emu.debug
```

## 📊 Coverage

### Coverage Requirements

- **Global**: 70% minimum for lines, functions, branches, and statements
- **Services**: 80% minimum (critical business logic)
- **Hooks**: 75% minimum (important app state)

### Coverage Reports

Coverage reports are generated in multiple formats:

- **HTML**: `coverage/lcov-report/index.html`
- **LCOV**: `coverage/lcov.info`
- **JSON**: `coverage/coverage-final.json`
- **Text**: Console output during test runs

## 🔄 CI/CD Integration

### GitHub Actions Workflows

#### Main Test Workflow (`.github/workflows/test.yml`)

Runs on every push and pull request with comprehensive testing including:
- Unit and integration tests
- E2E tests on iOS and Android
- Security scanning
- Code coverage reporting

#### PR Checks (`.github/workflows/pr-checks.yml`)

Fast feedback for pull requests with focused testing on changed areas only.

#### Nightly Tests (`.github/workflows/nightly.yml`)

Comprehensive testing every night including performance analysis and security scanning.

## 📝 Best Practices

1. **Follow AAA Pattern**: Arrange, Act, Assert
2. **Use Descriptive Names**: Test names should explain what is being tested
3. **Test One Thing**: Each test should verify a single behavior
4. **Mock External Dependencies**: Use provided mock utilities
5. **Test Edge Cases**: Include error scenarios and boundary conditions

### Example Test Structure

```typescript
describe('AuthService', () => {
  describe('signInWithGoogle', () => {
    it('should authenticate user with valid credentials', async () => {
      // Arrange
      const mockCredential = createMockCredential();

      // Act
      const result = await authService.signInWithGoogle(mockCredential);

      // Assert
      expect(result).toEqual(expectedUser);
    });
  });
});
```

## 🧪 Manual Testing

### Prerequisites
- Install Expo Go app on your phone (iOS or Android)
- Make sure your phone and development machine are on the same network

### Start the Development Server

```bash
# Navigate to project directory
cd OkapiFind

# Start development server
npm start
```

### Testing on Your Device

**Using QR Code (Recommended):**
1. After running `npm start`, scan the QR code
2. **iOS**: Use Camera app to scan
3. **Android**: Use Expo Go app to scan

### Testing Core Features

**Map Screen:**
1. Grant location permissions
2. Verify map displays current location
3. Test "Save Car Location" button
4. Verify car marker appears

**Parking Detection:**
1. Enable automatic detection toggle
2. Test manual parking save
3. Verify parking notifications

**Navigation:**
1. Save car location
2. Navigate to guidance screen
3. Test compass and distance display
4. Test voice guidance features

### Troubleshooting

**Network Issues:**
```bash
# Use tunnel connection
npx expo start --tunnel

# Clear cache
npx expo start -c
```

**Location Issues:**
- Check device location settings
- Ensure Expo Go has location permissions

**Performance Issues:**
```bash
# Check for issues
npx expo-doctor

# Update dependencies
npx expo install --check
```

## 🤝 Contributing

When contributing to the codebase:

1. **Write Tests First**: Consider TDD approach
2. **Maintain Coverage**: Ensure new code is tested
3. **Update Documentation**: Keep test documentation current
4. **Follow Conventions**: Use established patterns and naming
5. **Test Locally**: Run tests before pushing changes

### Adding New Tests

1. Create test file in appropriate directory
2. Import necessary mocks and utilities
3. Follow existing test patterns
4. Ensure proper cleanup in `afterEach`
5. Add to CI pipeline if needed

For questions or issues with the testing infrastructure, please create an issue or reach out to the development team.