# Google API Setup Guide for OkapiFind

## Overview
This guide explains how to set up Google OAuth 2.0 and enable the necessary APIs for automatic parking location detection using Google Timeline data.

## Required Google APIs

### Core APIs (Must Enable)
1. **Google Maps Timeline API** - Access user's location history
2. **Places API** - Identify parking locations and places
3. **Maps JavaScript API** - For web-based map interactions

### Optional APIs (For Enhanced Features)
1. **Google Calendar API** - Detect parking from calendar events
2. **Gmail API** - Parse parking receipts and confirmations
3. **Google Drive Activity API** - Additional activity tracking

## Setup Instructions

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Create Project" or select an existing project
3. Name your project (e.g., "OkapiFind")
4. Note your Project ID

### 2. Enable Required APIs

1. Navigate to "APIs & Services" → "Library"
2. Search and enable each required API:
   - Places API
   - Maps JavaScript API
   - (Timeline API requires special approval)

### 3. Create OAuth 2.0 Credentials

#### For Development (Expo Go)
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Web application"
4. Name: "OkapiFind Expo Development"
5. Authorized redirect URIs:
   ```
   https://auth.expo.io/@your-expo-username/okapifind
   ```

#### For iOS Production
1. Create new OAuth client ID
2. Choose "iOS"
3. Bundle ID: `com.okapi.find`
4. Add App Store ID when available

#### For Android Production
1. Create new OAuth client ID
2. Choose "Android"
3. Package name: `com.okapi.find`
4. SHA-1 certificate fingerprint (get from EAS build)

### 4. Configure OAuth Consent Screen

1. Go to "OAuth consent screen"
2. Choose "External" user type
3. Fill in app information:
   - App name: OkapiFind
   - User support email
   - App logo
   - App domain (if available)
   - Privacy policy URL
   - Terms of service URL

4. Add scopes:
   ```
   openid
   profile
   email
   https://www.googleapis.com/auth/location.history.read
   https://www.googleapis.com/auth/maps-timeline.read
   ```

5. Add test users (for development)

### 5. Update App Configuration

Create a `.env` file in your project root:
```env
# Google OAuth Client IDs
GOOGLE_CLIENT_ID=your-web-client-id
EXPO_GOOGLE_CLIENT_ID=your-expo-client-id.apps.googleusercontent.com
IOS_GOOGLE_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
ANDROID_GOOGLE_CLIENT_ID=your-android-client-id.apps.googleusercontent.com

# Optional: Google Maps API Key
GOOGLE_MAPS_API_KEY=your-maps-api-key
```

Update `src/utils/googleApi.ts` with your client IDs:
```typescript
export const GOOGLE_CONFIG = {
  CLIENT_ID: 'your-web-client-id',
  EXPO_CLIENT_ID: 'your-expo-client-id.apps.googleusercontent.com',
  IOS_CLIENT_ID: 'your-ios-client-id.apps.googleusercontent.com',
  ANDROID_CLIENT_ID: 'your-android-client-id.apps.googleusercontent.com',
  // ... rest of config
};
```

## OAuth Scopes Explained

### Required Scopes
- `openid` - Basic OpenID authentication
- `profile` - User's basic profile information
- `email` - User's email address
- `https://www.googleapis.com/auth/location.history.read` - Read location history
- `https://www.googleapis.com/auth/maps-timeline.read` - Read Maps timeline data

### Optional Scopes
- `https://www.googleapis.com/auth/calendar.readonly` - Read calendar events
- `https://www.googleapis.com/auth/gmail.readonly` - Read Gmail messages
- `https://www.googleapis.com/auth/drive.activity.readonly` - Read Drive activity

## Implementation Notes

### Timeline API Access
**Important:** The Google Maps Timeline API has restricted access and requires:
1. Special approval from Google
2. Compliance with privacy policies
3. Clear user consent

**Alternative Approaches:**
1. **Semantic Location History API** - More accessible alternative
2. **Places API with Current Location** - Real-time detection
3. **Activity Recognition API** - Detect driving/walking transitions
4. **Manual Save** - Let users manually save parking location

### Privacy Considerations
- Always request minimal necessary permissions
- Clearly explain why each permission is needed
- Allow users to opt-out of automatic detection
- Store location data securely
- Comply with GDPR/CCPA regulations

## Testing OAuth Flow

### In Development (Expo Go)
```bash
# Start dev server
npx expo start

# Test OAuth flow
# The app will redirect to Expo's auth proxy
```

### Test Checklist
- [ ] OAuth consent screen appears
- [ ] User can grant permissions
- [ ] Tokens are received and stored
- [ ] Refresh token works
- [ ] Parking location fetch returns data
- [ ] Sign out clears all tokens

## Production Deployment

### Before Release
1. Submit app for OAuth verification (if using sensitive scopes)
2. Update privacy policy with data usage
3. Set up proper redirect URIs for production
4. Remove test users from OAuth consent
5. Enable domain verification (if applicable)

### Security Best Practices
1. Never commit API keys or client secrets
2. Use environment variables for sensitive data
3. Implement token encryption in storage
4. Add rate limiting for API calls
5. Monitor API usage in Google Cloud Console

## Troubleshooting

### Common Issues

#### "Invalid redirect URI"
- Ensure redirect URI matches exactly in console
- For Expo: Use `expo.auth` redirect
- Check scheme in app.json matches

#### "Access blocked: This app's request is invalid"
- OAuth consent screen not configured
- Missing required scopes
- App not verified (for sensitive scopes)

#### "User rate limit exceeded"
- Implement exponential backoff
- Cache API responses
- Reduce API call frequency

## API Usage Limits

### Free Tier Limits
- Places API: $200 free monthly credit
- Maps JavaScript API: 28,000 loads/month free
- OAuth: No specific limits

### Monitoring Usage
1. Go to Google Cloud Console
2. Navigate to "APIs & Services" → "Metrics"
3. Set up billing alerts
4. Monitor quota usage

## Resources
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Maps Platform](https://developers.google.com/maps)
- [Places API Documentation](https://developers.google.com/maps/documentation/places/web-service)
- [Expo AuthSession](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Google API Console](https://console.cloud.google.com/)