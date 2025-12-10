import 'dotenv/config';

export default {
  expo: {
    name: "OkapiFind",
    slug: "okapifind",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0F1B2A"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.okapi.find",
      usesAppleSignIn: true,
      associatedDomains: [
        "applinks:okapifind.com",
        "applinks:okapifind.vercel.app"
      ],
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "OkapiFind needs access to your location to help you find items.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "OkapiFind needs access to your location to help you find items.",
        NSLocationAlwaysUsageDescription: "OkapiFind needs background location access to detect when you park your car.",
        NSMicrophoneUsageDescription: "OkapiFind needs access to your microphone for voice directions.",
        NSMotionUsageDescription: "OkapiFind uses motion detection to help detect when you park.",
        NSCameraUsageDescription: "OkapiFind needs camera access to scan parking signs and meters.",
        UIBackgroundModes: ["location", "fetch", "processing"]
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0F1B2A"
      },
      package: "com.okapi.find",
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "RECORD_AUDIO",
        "VIBRATE",
        "CAMERA",
        "ACTIVITY_RECOGNITION"
      ],
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "okapifind.com",
              pathPrefix: "/"
            },
            {
              scheme: "https",
              host: "*.okapifind.vercel.app"
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
      // Deep linking for web
      config: {
        // Allow opening the app from custom URLs
        linkingEnabled: true
      }
    },
    scheme: "okapifind",
    plugins: [
      "expo-location",
      "expo-web-browser",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#FFD700"
        }
      ]
    ],
    extra: {
      // URLs - Using GitHub Pages for legal documents
      privacyPolicyUrl: 'https://github.com/Paulmait/okapifind/blob/main/PRIVACY_POLICY.md',
      termsOfServiceUrl: 'https://github.com/Paulmait/okapifind/blob/main/TERMS_OF_SERVICE.md',
      supportUrl: 'https://github.com/Paulmait/okapifind/issues',
      websiteUrl: 'https://github.com/Paulmait/okapifind',

      // App Store URLs
      appStoreUrl: 'https://apps.apple.com/app/okapifind/id1234567890',
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.okapi.find',

      // Firebase Configuration
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      firebaseMeasurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,

      // Supabase Configuration
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,

      // Google OAuth Configuration
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,

      // RevenueCat Configuration
      revenueCatApiKeyIos: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS,
      revenueCatApiKeyAndroid: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID,

      // Sentry Configuration
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      sentryDebug: process.env.NODE_ENV !== 'production',

      // EAS Configuration
      eas: {
        projectId: "9218d954-2ca6-4eb1-8f1e-4b4fd81d4812"
      },

      // Feature Flags
      enableShakeToSave: true,
      enableVoiceCommands: true,
      enableOfflineMode: true,
      enableSafetyMode: true,
      enableARNavigation: true,
      enablePhotoNotes: true
    }
  }
};