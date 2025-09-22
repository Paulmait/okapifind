# OkapiFind Environment Variables Setup Guide

## 🚀 Platform Support

OkapiFind is built with Expo/React Native and supports:

### ✅ **Mobile Platforms**
- **iOS** (iPhone & iPad) - iOS 13.0+
- **Android** (Phones & Tablets) - Android 6.0+ (API 23+)

### ✅ **Web Platform**
- **Yes, web version is supported!**
- Run with: `npm run web`
- Uses React Native Web for browser compatibility
- All core features work on web except:
  - Camera/AR features (limited browser support)
  - Background location tracking
  - Push notifications (requires PWA setup)
  - Biometric authentication

### 📱 **Development Commands**
```bash
# Start development server (opens menu)
npm start

# Run on specific platforms
npm run ios      # iOS Simulator
npm run android  # Android Emulator/Device
npm run web      # Web Browser
```

---

## 🔐 Required Environment Variables

Create a `.env` file in the OkapiFind directory with all these variables:

### 1️⃣ **Firebase Configuration (REQUIRED)**
```env
# Firebase Project Settings (from Firebase Console)
EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123def456
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

**How to get these:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing
3. Go to Project Settings > General
4. Under "Your apps", add a Web app
5. Copy the configuration values

### 2️⃣ **Supabase Configuration (REQUIRED)**
```env
# Supabase Project Settings (from Supabase Dashboard)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**How to get these:**
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Create a new project or select existing
3. Go to Settings > API
4. Copy the Project URL and anon/public key

### 3️⃣ **Google OAuth Configuration (REQUIRED for Google Sign-In)**
```env
# Google OAuth 2.0 Client IDs
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789012-abc.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=123456789012-ios.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=123456789012-android.apps.googleusercontent.com
```

**How to get these:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable Google Sign-In API
4. Go to Credentials > Create Credentials > OAuth 2.0 Client ID
5. Create three client IDs:
   - Web application (for Expo)
   - iOS (for App Store)
   - Android (for Play Store)

### 4️⃣ **RevenueCat Configuration (REQUIRED for In-App Purchases)**
```env
# RevenueCat API Keys (from RevenueCat Dashboard)
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_xxxxxxxxxxxxxxxxxxxx
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_xxxxxxxxxxxxxxxxxxxx
```

**How to get these:**
1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Create a new project
3. Go to Project Settings > API Keys
4. Copy iOS and Android public keys

### 5️⃣ **Sentry Error Monitoring (OPTIONAL but Recommended)**
```env
# Sentry DSN for error tracking
EXPO_PUBLIC_SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/123456
EXPO_PUBLIC_SENTRY_ENVIRONMENT=production
EXPO_PUBLIC_SENTRY_DEBUG=false
```

**How to get this:**
1. Go to [Sentry.io](https://sentry.io/)
2. Create a new React Native project
3. Copy the DSN from project settings

### 6️⃣ **Expo & EAS Configuration (REQUIRED for Building)**
```env
# EAS Build Configuration
EAS_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Expo Account (optional, for OTA updates)
EXPO_PUBLIC_PROJECT_SLUG=okapifind
EXPO_PUBLIC_OWNER=your-expo-username
```

**How to get these:**
1. Install EAS CLI: `npm install -g eas-cli`
2. Run: `eas build:configure`
3. Project ID will be in `app.json` after configuration

### 7️⃣ **App Store URLs (OPTIONAL - for app rating/sharing)**
```env
# App Store Links (update after publishing)
EXPO_PUBLIC_APP_STORE_URL=https://apps.apple.com/app/okapifind/id1234567890
EXPO_PUBLIC_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=com.okapi.find
```

### 8️⃣ **API Configuration (OPTIONAL - for custom backend)**
```env
# Custom API Endpoints
EXPO_PUBLIC_API_BASE_URL=https://api.okapifind.com
EXPO_PUBLIC_ENVIRONMENT=production
EXPO_PUBLIC_LOG_LEVEL=error
EXPO_PUBLIC_ENABLE_ANALYTICS=true
```

### 9️⃣ **Feature Flags (OPTIONAL - for feature control)**
```env
# Feature Toggles
EXPO_PUBLIC_ENABLE_SHAKE_TO_SAVE=true
EXPO_PUBLIC_ENABLE_VOICE_COMMANDS=true
EXPO_PUBLIC_ENABLE_OFFLINE_MODE=true
EXPO_PUBLIC_ENABLE_SAFETY_MODE=true
EXPO_PUBLIC_ENABLE_AR_NAVIGATION=true
EXPO_PUBLIC_ENABLE_PHOTO_NOTES=true
```

---

## 📋 Complete .env Example

```env
# Firebase (REQUIRED)
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxx
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=okapifind.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=okapifind
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=okapifind.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123def456ghi789
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=G-ABC123DEF4

# Supabase (REQUIRED)
EXPO_PUBLIC_SUPABASE_URL=https://kmobwbqdtmbzdyysdxjx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imttb2J3YnFkdG1iemR5eXNkeGp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Google OAuth (REQUIRED)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789012-abc123def456ghi789jkl012mno345.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=123456789012-ios123def456ghi789jkl012mno345.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=123456789012-and123def456ghi789jkl012mno345.apps.googleusercontent.com

# RevenueCat (REQUIRED for monetization)
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_ABcdEFghIJklMNopQRstUVwxYZ
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_ABcdEFghIJklMNopQRstUVwxYZ

# Sentry (OPTIONAL but recommended)
EXPO_PUBLIC_SENTRY_DSN=https://abc123def456@o123456.ingest.sentry.io/1234567
EXPO_PUBLIC_SENTRY_ENVIRONMENT=production
EXPO_PUBLIC_SENTRY_DEBUG=false

# EAS Build (REQUIRED for building)
EAS_PROJECT_ID=12345678-1234-1234-1234-123456789012

# App Store URLs (OPTIONAL)
EXPO_PUBLIC_APP_STORE_URL=https://apps.apple.com/app/okapifind/id1234567890
EXPO_PUBLIC_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=com.okapi.find

# API Configuration (OPTIONAL)
EXPO_PUBLIC_API_BASE_URL=https://api.okapifind.com
EXPO_PUBLIC_ENVIRONMENT=production
EXPO_PUBLIC_LOG_LEVEL=error
EXPO_PUBLIC_ENABLE_ANALYTICS=true

# Feature Flags (OPTIONAL)
EXPO_PUBLIC_ENABLE_SHAKE_TO_SAVE=true
EXPO_PUBLIC_ENABLE_VOICE_COMMANDS=true
EXPO_PUBLIC_ENABLE_OFFLINE_MODE=true
EXPO_PUBLIC_ENABLE_SAFETY_MODE=true
EXPO_PUBLIC_ENABLE_AR_NAVIGATION=true
EXPO_PUBLIC_ENABLE_PHOTO_NOTES=true
```

---

## 🔍 Environment Variables Validation

Run this command to validate your environment setup:

```bash
node -e "
const required = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_REVENUECAT_API_KEY_IOS',
  'EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID'
];
require('dotenv').config();
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  console.error('❌ Missing required environment variables:', missing.join(', '));
  process.exit(1);
} else {
  console.log('✅ All required environment variables are set!');
}
"
```

---

## 🚀 Quick Start After Setup

1. **Install dependencies:**
   ```bash
   cd OkapiFind
   npm install
   ```

2. **Create .env file with your values**

3. **Start development:**
   ```bash
   # For all platforms menu
   npm start

   # For specific platform
   npm run ios
   npm run android
   npm run web
   ```

4. **Build for production:**
   ```bash
   # Configure EAS
   eas build:configure

   # Build for iOS
   eas build --platform ios

   # Build for Android
   eas build --platform android

   # Build for both
   eas build --platform all
   ```

---

## 📱 Platform-Specific Notes

### iOS
- Requires Xcode 13+ for development
- Apple Developer account for distribution ($99/year)
- TestFlight for beta testing

### Android
- Android Studio for development (optional)
- Google Play Console account for distribution ($25 one-time)
- Internal testing track available

### Web
- Works in all modern browsers
- Progressive Web App (PWA) capabilities included
- Can be deployed to any static hosting (Vercel, Netlify, etc.)

---

## 🆘 Troubleshooting

### Common Issues:

1. **"Missing Firebase configuration"**
   - Ensure all EXPO_PUBLIC_FIREBASE_* variables are set
   - Check that .env file is in OkapiFind directory

2. **"Supabase connection failed"**
   - Verify SUPABASE_URL doesn't have trailing slash
   - Ensure ANON_KEY is the full JWT token

3. **"Google Sign-In not working"**
   - Web Client ID must be from Web OAuth client
   - Add redirect URIs in Google Console

4. **"RevenueCat initialization failed"**
   - Use public API keys, not secret keys
   - Different keys for iOS and Android

---

## 📞 Support

If you encounter issues:
1. Check all environment variables are set correctly
2. Run `npm run typecheck` to find type issues
3. Check logs with `expo doctor`
4. Clear cache with `expo start -c`

---

Last Updated: 2025-09-22