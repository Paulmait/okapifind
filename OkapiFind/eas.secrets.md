# EAS Secrets Configuration

**DO NOT COMMIT THIS FILE - FOR REFERENCE ONLY**

## Required EAS Secrets to Configure

Run these commands to set up all required secrets for EAS builds:

```bash
# Firebase Configuration
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value "YOUR_VALUE"
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value "YOUR_VALUE"
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value "YOUR_VALUE"
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET --value "YOUR_VALUE"
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --value "YOUR_VALUE"
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_APP_ID --value "YOUR_VALUE"

# Supabase Configuration
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "YOUR_VALUE"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_VALUE"

# Google Services
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value "YOUR_VALUE"
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value "YOUR_VALUE"
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value "YOUR_VALUE"
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value "YOUR_VALUE"
eas secret:create --scope project --name EXPO_PUBLIC_GEMINI_API_KEY --value "YOUR_VALUE"

# RevenueCat
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_API_KEY_IOS --value "YOUR_VALUE"
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID --value "YOUR_VALUE"

# Stripe
eas secret:create --scope project --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value "YOUR_VALUE"

# Sentry
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "YOUR_VALUE"
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value "YOUR_VALUE"
eas secret:create --scope project --name SENTRY_ORG --value "YOUR_VALUE"
eas secret:create --scope project --name SENTRY_PROJECT --value "YOUR_VALUE"

# EAS Project
eas secret:create --scope project --name EAS_PROJECT_ID --value "YOUR_VALUE"
```

## Verify Secrets

```bash
# List all configured secrets
eas secret:list

# Update a secret
eas secret:update SECRET_NAME --value "NEW_VALUE"

# Delete a secret
eas secret:delete SECRET_NAME
```

## Environment-Specific Secrets

For different environments, prefix with environment:

```bash
# Development only
eas secret:create --scope project --name DEV_API_URL --value "http://localhost:3000"

# Staging only
eas secret:create --scope project --name STAGING_API_URL --value "https://staging-api.okapifind.com"

# Production only
eas secret:create --scope project --name PROD_API_URL --value "https://api.okapifind.com"
```

## Notes
- Secrets are encrypted and stored securely by Expo
- They are injected at build time
- Never commit actual values to git
- Use different API keys for dev/staging/prod when possible