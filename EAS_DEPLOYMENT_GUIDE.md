# 🚀 EAS (Expo Application Services) Complete Deployment Guide

**Your Seamless Path from Development to App Stores**

## 📋 Table of Contents
1. [Initial Setup](#initial-setup)
2. [Environment Configuration](#environment-configuration)
3. [Development Workflow](#development-workflow)
4. [Testing Pipeline](#testing-pipeline)
5. [Production Deployment](#production-deployment)
6. [Continuous Deployment](#continuous-deployment)

---

## 1. Initial Setup

### Install EAS CLI
```bash
# Install globally
npm install -g eas-cli

# Verify installation
eas --version

# Login to your Expo account
eas login
```

### Configure Your Project
```bash
cd OkapiFind

# Initialize EAS in your project
eas build:configure

# This creates/updates eas.json (already configured for you!)
```

### Link to Expo Project
```bash
# Create project on Expo servers
eas init --id YOUR_PROJECT_ID

# Or link to existing project
expo init --id YOUR_EXISTING_PROJECT_ID
```

---

## 2. Environment Configuration

### Set EAS Environment Variables
```bash
# Set secrets that shouldn't be in code
eas secret:create --scope project --name SENTRY_DSN --value "your-sentry-dsn"
eas secret:create --scope project --name FIREBASE_API_KEY --value "your-api-key"
eas secret:create --scope project --name SUPABASE_URL --value "your-supabase-url"
eas secret:create --scope project --name SUPABASE_ANON_KEY --value "your-anon-key"
eas secret:create --scope project --name STRIPE_PUBLISHABLE_KEY --value "pk_live_xxx"
eas secret:create --scope project --name REVENUECAT_API_KEY_IOS --value "appl_xxx"
eas secret:create --scope project --name REVENUECAT_API_KEY_ANDROID --value "goog_xxx"

# List all secrets
eas secret:list
```

### Create Environment Files
```bash
# Create environment-specific files
touch .env.development
touch .env.preview
touch .env.staging
touch .env.production

# Copy template to each
cp .env.template .env.development
cp .env.template .env.preview
cp .env.template .env.staging
cp .env.template .env.production
```

---

## 3. Development Workflow

### Local Development
```bash
# Start local development
npx expo start

# With development build
npx expo start --dev-client

# Clear cache if needed
npx expo start -c
```

### Development Builds (For Team Testing)
```bash
# Build for iOS Simulator
eas build --profile development --platform ios

# Build for Android Emulator
eas build --profile development --platform android

# Build for both platforms
eas build --profile development --platform all

# Download and install on simulator/emulator
eas build:run -p ios --profile development
eas build:run -p android --profile development
```

### Share Development Builds
```bash
# List recent builds
eas build:list --platform ios --limit 5

# Get shareable link
eas build:view BUILD_ID

# Send to team via internal distribution
# Team members install via link sent to their email
```

---

## 4. Testing Pipeline

### Preview Builds (Beta Testing)
```bash
# Create preview build for TestFlight/Internal Testing
eas build --profile preview --platform ios
eas build --profile preview --platform android

# Auto-increment version
eas build --profile preview --platform all --auto-submit
```

### Submit to Test Channels
```bash
# Submit iOS to TestFlight
eas submit -p ios --profile preview

# Submit Android to Internal Testing
eas submit -p android --profile preview

# Check submission status
eas submit:list --platform all
```

### Staging Environment (Pre-Production)
```bash
# Build staging version with production-like config
eas build --profile staging --platform all

# Deploy to staging testers
eas submit --profile staging --platform all

# Monitor staging
eas build:list --profile staging --status finished
```

### Over-the-Air (OTA) Updates
```bash
# Publish OTA update to preview channel
eas update --branch preview --message "Bug fixes and improvements"

# Publish to specific channel
eas update --channel preview --message "v1.0.1 hotfix"

# Check update status
eas update:list --branch preview
```

---

## 5. Production Deployment

### Pre-Launch Checklist
```bash
# 1. Verify all secrets are set
eas secret:list

# 2. Check build configuration
eas build:inspect --platform all --profile production

# 3. Validate credentials
eas credentials

# 4. Run production checks
npm run typecheck
npm run test
npm run lint
```

### Production Builds
```bash
# Build for production (auto-increments version)
eas build --profile production --platform ios
eas build --profile production --platform android

# Or build both
eas build --profile production --platform all

# Monitor build progress
eas build:list --status in-progress
```

### Submit to App Stores
```bash
# Submit iOS to App Store
eas submit -p ios --profile production

# Submit Android to Google Play
eas submit -p android --profile production

# Auto-submit after successful build
eas build --profile production --platform all --auto-submit
```

### Monitor Submissions
```bash
# Check submission status
eas submit:list --platform all

# View specific submission
eas submit:view SUBMISSION_ID
```

---

## 6. Continuous Deployment

### GitHub Actions Integration
Create `.github/workflows/eas-build.yml`:

```yaml
name: EAS Build and Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: 18.x
          cache: npm

      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: npm ci --legacy-peer-deps

      - name: Run tests
        run: npm test

      - name: Build preview on PR
        if: github.event_name == 'pull_request'
        run: eas build --profile preview --platform all --non-interactive

      - name: Build production on merge
        if: github.ref == 'refs/heads/main'
        run: eas build --profile production --platform all --non-interactive --auto-submit
```

### Automated Version Management
```json
// In app.json
{
  "expo": {
    "hooks": {
      "postPublish": [
        {
          "file": "./scripts/version-bump.js"
        }
      ]
    }
  }
}
```

### Create Version Bump Script
```javascript
// scripts/version-bump.js
const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '../package.json');
const package = require(packagePath);

// Increment patch version
const [major, minor, patch] = package.version.split('.');
package.version = `${major}.${minor}.${parseInt(patch) + 1}`;

fs.writeFileSync(packagePath, JSON.stringify(package, null, 2));
console.log(`Version bumped to ${package.version}`);
```

---

## 🎯 Quick Commands Reference

### Daily Development
```bash
# Start local dev
npx expo start

# Build for testing
eas build --profile development --platform all

# Share with team
eas build:list --limit 1
```

### Weekly Beta Release
```bash
# Build and submit to TestFlight/Internal
eas build --profile preview --platform all --auto-submit

# Push OTA update
eas update --channel preview --message "Weekly update"
```

### Production Release
```bash
# Full production deployment
eas build --profile production --platform all --auto-submit

# Monitor
eas build:list --profile production
eas submit:list --platform all
```

---

## 🔧 Troubleshooting

### Common Issues & Solutions

#### Build Fails
```bash
# Clear cache
npx expo prebuild --clear
rm -rf node_modules
npm install --legacy-peer-deps

# Check logs
eas build:view BUILD_ID
```

#### Credentials Issues
```bash
# Reset iOS credentials
eas credentials --platform ios

# Reset Android credentials
eas credentials --platform android
```

#### Environment Variables Not Working
```bash
# Verify secrets
eas secret:list

# Re-create secret
eas secret:delete VARIABLE_NAME
eas secret:create VARIABLE_NAME
```

---

## 📱 Platform-Specific Notes

### iOS Specifics
- **TestFlight**: Builds automatically available to testers
- **App Store**: Manual review required (1-3 days)
- **Certificates**: Managed automatically by EAS

### Android Specifics
- **Internal Testing**: Immediate availability
- **Production**: Staged rollout recommended
- **Signing**: Managed by EAS with upload key

---

## 🚀 Your First Deployment

### Step 1: Setup (One Time)
```bash
npm install -g eas-cli
eas login
cd OkapiFind
eas init
```

### Step 2: Configure Secrets
```bash
# Add all your API keys
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value "xxx"
# ... add all other secrets from .env.template
```

### Step 3: Development Build
```bash
# Test locally first
npx expo start

# Build for device testing
eas build --profile development --platform all
```

### Step 4: Beta Testing
```bash
# Build and submit for beta
eas build --profile preview --platform all --auto-submit
```

### Step 5: Production
```bash
# When ready for production
eas build --profile production --platform all --auto-submit
```

---

## 📊 Monitoring & Analytics

### Build Status Dashboard
```bash
# Open EAS dashboard in browser
eas build:list --platform all --limit 10

# Get build metrics
eas analytics
```

### Crash Reporting
- Integrated with Sentry via EAS
- Automatic sourcemap upload
- Real-time alerts

### Update Analytics
```bash
# View update metrics
eas update:list --limit 10

# Check update adoption
eas update:view UPDATE_GROUP_ID
```

---

## 💡 Best Practices

1. **Always test locally first**: `npx expo start`
2. **Use channels wisely**: development → preview → staging → production
3. **Automate everything**: GitHub Actions for CI/CD
4. **Monitor religiously**: Check crash rates daily
5. **Version carefully**: Semantic versioning (major.minor.patch)
6. **Document changes**: Clear commit messages and changelogs
7. **Rollback plan**: Keep previous build IDs handy

---

## 🎉 Success Metrics

Your EAS deployment is successful when:
- ✅ Builds complete in <20 minutes
- ✅ Zero manual steps for deployment
- ✅ Automatic version incrementing
- ✅ OTA updates reach users in <1 hour
- ✅ Crash-free rate >99.5%
- ✅ Submission to stores is one command

---

## 🔗 Resources

- [EAS Documentation](https://docs.expo.dev/eas/)
- [Build Configuration](https://docs.expo.dev/build/introduction/)
- [Submit to App Stores](https://docs.expo.dev/submit/introduction/)
- [EAS Update](https://docs.expo.dev/eas-update/introduction/)
- [Environment Variables](https://docs.expo.dev/build-reference/variables/)

---

**With EAS properly configured, you can go from code to app stores in minutes, not hours!** 🚀