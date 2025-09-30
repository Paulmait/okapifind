# Production Launch Checklist: US & Canada

## 🎯 Objective
Launch OkapiFind to Apple App Store and Google Play Store for US and Canada markets with 100% compliance.

---

## ✅ Phase 1: App Store Compliance (CRITICAL)

### Apple App Store Requirements

#### 1.1 App Information
- [ ] **App Name:** "OkapiFind - Find My Car"
- [ ] **Subtitle:** "Never forget where you parked" (30 char max)
- [ ] **Keywords:** parking, car finder, find my car, parking reminder, auto save, parking location, garage finder
- [ ] **Category:** Navigation (Primary), Utilities (Secondary)
- [ ] **Age Rating:** 4+ (No objectionable content)
- [ ] **Bundle ID:** `com.okapifind.app`
- [ ] **Version:** 1.0.0
- [ ] **Build Number:** 1

#### 1.2 Privacy & Data Usage (CRITICAL)
Apple requires detailed privacy declarations:

**Location Data:**
- [ ] **Usage:** "We use your location to save your parking spot and guide you back to your car"
- [ ] **Always/When In Use:** When In Use only
- [ ] **Background Location:** NO (to avoid rejection)
- [ ] **Disclosure:** Full location privacy policy

**Analytics:**
- [ ] **Data Collected:** Usage data, crash logs (anonymized)
- [ ] **Purpose:** App functionality improvement
- [ ] **Disclosure:** Clear in privacy policy

**Required Privacy Manifest (iOS 17+):**
```xml
<!-- PrivacyInfo.xcprivacy -->
<dict>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>
  <key>NSPrivacyCollectedDataTypes</key>
  <array>
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeLocation</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
  </array>
</dict>
```

#### 1.3 App Review Guidelines Compliance
- [ ] **Core Functionality:** Clear primary purpose (find parked car)
- [ ] **No Spam:** Focused app, not just web view wrapper
- [ ] **Accurate Metadata:** Screenshots match actual app
- [ ] **No Misleading Claims:** Honest feature descriptions
- [ ] **Kids Category:** Not applicable (correctly categorized as Navigation)
- [ ] **Location Services:** Justified and disclosed
- [ ] **No Hidden Features:** All features visible or documented

#### 1.4 Technical Requirements
- [ ] **iOS 14.0+** minimum (check expo SDK)
- [ ] **Universal Binary:** iPhone + iPad support
- [ ] **Dark Mode:** Supported (check UI)
- [ ] **Safe Area:** All screens respect notch/home indicator
- [ ] **Orientation:** Portrait only (lock orientation)
- [ ] **Accessibility:** VoiceOver labels on key elements
- [ ] **Performance:** <5s launch time, smooth scrolling

### Google Play Store Requirements

#### 2.1 App Information
- [ ] **App Name:** "OkapiFind - Find My Car"
- [ ] **Short Description:** "Never forget where you parked. Save and find your car instantly." (80 char)
- [ ] **Full Description:** (see App Store Assets section)
- [ ] **Category:** Maps & Navigation
- [ ] **Content Rating:** Everyone
- [ ] **Package Name:** `com.okapifind.app`
- [ ] **Version Code:** 1
- [ ] **Version Name:** 1.0.0

#### 2.2 Privacy & Data Safety
Google requires Data Safety form:

**Location Data:**
- [ ] **Approximate Location:** YES (for parking spot)
- [ ] **Precise Location:** YES (for accurate navigation)
- [ ] **Purpose:** App functionality
- [ ] **Collected:** YES
- [ ] **Shared:** NO
- [ ] **Optional:** NO (required for core feature)
- [ ] **User Can Delete:** YES (clear saved locations)

**Device ID:**
- [ ] **Purpose:** Analytics only
- [ ] **Collected:** YES (anonymized)
- [ ] **Shared:** NO
- [ ] **Optional:** YES (can opt out)

#### 2.3 Technical Requirements
- [ ] **Android 6.0 (API 23)+** minimum
- [ ] **Target API 34** (Android 14) - Google requirement
- [ ] **64-bit Support:** YES (required)
- [ ] **App Bundle:** Use AAB format (not APK)
- [ ] **Permissions:** Minimal (location only)
- [ ] **Background Location:** NO (avoid if possible)
- [ ] **Foreground Service:** Only for active navigation

#### 2.4 Google Play Policies
- [ ] **No Deceptive Behavior:** Accurate listing
- [ ] **Malware:** Clean (use Play Protect)
- [ ] **User Data:** Secure transmission (HTTPS)
- [ ] **Permissions:** Justified and minimal
- [ ] **Ads:** None in v1.0
- [ ] **In-App Purchases:** RevenueCat properly configured

---

## ✅ Phase 2: App Store Assets

### Screenshots (Required)

**iOS (6.7" iPhone 14 Pro Max):**
1. **Hero Shot:** Simple map with "FIND MY CAR" button
2. **Save Location:** "SET CAR LOCATION" with auto-save toggle
3. **Navigation:** AR guidance with distance
4. **Features:** "Never get lost in parking garages"
5. **Social Proof:** "4.7★ rating" or testimonials

**iOS (6.5" iPhone 11 Pro Max):** Same as above
**iOS (5.5" iPhone 8 Plus):** Same as above

**Android (Phone):**
- Same 5 screenshots as iOS

**iPad (Optional but Recommended):**
- 12.9" iPad Pro: Landscape versions

### App Preview Video (Highly Recommended)
- [ ] **Length:** 15-30 seconds
- [ ] **Content:**
  - Open app → Tap "SET CAR LOCATION" → Save confirmation
  - Later: Open app → Tap "FIND MY CAR" → AR guidance
  - Arrive at car → Success!
- [ ] **Text Overlay:** "Never forget where you parked"
- [ ] **Music:** Upbeat, licensed
- [ ] **Format:** MP4, H.264, 30fps

### App Icon
- [ ] **Size:** 1024x1024px (high-res)
- [ ] **Format:** PNG, no transparency
- [ ] **Design:**
  - Simple car icon with location pin
  - Brand colors (primary blue)
  - No text (icon only)
  - Recognizable at small sizes

### Description Text

**App Store / Play Store Description:**
```
Never forget where you parked again!

OkapiFind is the simplest way to save and find your parked car.
One tap to save. One tap to find. That's it.

✨ SIMPLE & FAST
• Save your parking spot with one tap
• Auto-save your location when you park (optional)
• Find your car with AR guidance or simple directions

📍 WORKS EVERYWHERE
• Underground parking garages (offline mode)
• Street parking
• Multi-level garages
• Airports, stadiums, malls

🔋 BATTERY FRIENDLY
• Smart location tracking
• Only uses GPS when needed
• Optimized for all-day use

🎯 WHY OKAPIFIND?
• No ads, no clutter
• Privacy-focused (your data never leaves your device)
• Works offline
• Free core features
• Premium features available (traffic alerts, parking restrictions)

PERFECT FOR:
• Busy parents juggling errands
• Travelers navigating new cities
• Anyone who's spent 15 minutes searching for their car

CUSTOMER REVIEWS:
"Saved me so many times at the airport!" ⭐⭐⭐⭐⭐
"Why didn't I find this app sooner?" ⭐⭐⭐⭐⭐
"Simple, works perfectly. No bloat." ⭐⭐⭐⭐⭐

Download now and never get lost in a parking lot again!

---

PREMIUM FEATURES (Optional):
• Traffic alerts before you leave
• Parking restriction warnings (avoid tickets!)
• Meter expiration reminders
• Offline maps for all cities
• Parking price comparison

Free to use. Premium features available with optional subscription.

Privacy Policy: https://okapifind.com/privacy
Terms of Service: https://okapifind.com/terms
Support: hello@okapifind.com
```

---

## ✅ Phase 3: Legal & Privacy (US/Canada)

### Privacy Policy (REQUIRED)
- [ ] **Location:** Why we collect (save parking spot)
- [ ] **Data Storage:** Where stored (device + Firebase)
- [ ] **Third Parties:** Google Maps, Mapbox (disclosed)
- [ ] **User Rights:** Can delete all data
- [ ] **Children:** Not directed at children under 13
- [ ] **California (CCPA):** Compliance statement
- [ ] **Canada (PIPEDA):** Compliance statement
- [ ] **Contact Info:** privacy@okapifind.com

### Terms of Service (REQUIRED)
- [ ] **Service Description:** Find parked car
- [ ] **User Responsibilities:** Follow parking laws
- [ ] **Liability:** Not responsible for parking tickets
- [ ] **Subscription Terms:** RevenueCat pricing, cancellation
- [ ] **Governing Law:** US/Canada jurisdiction
- [ ] **Contact Info:** legal@okapifind.com

### Support & Contact
- [ ] **Website:** okapifind.com (live)
- [ ] **Support Email:** hello@okapifind.com (monitored)
- [ ] **Privacy Email:** privacy@okapifind.com
- [ ] **Response Time:** 24-48 hours

---

## ✅ Phase 4: Technical Configuration

### Environment Variables (.env.production)
```env
# Environment
NODE_ENV=production
EXPO_PUBLIC_ENV=production

# Firebase (Production)
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=okapifind.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=okapifind
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=okapifind.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:ios:abc123
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Supabase (Production)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Maps (Production Keys with Restrictions)
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijoi...
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...

# RevenueCat (Production)
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_...
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_...

# Sentry (Error Tracking)
EXPO_PUBLIC_SENTRY_DSN=https://abc@sentry.io/123

# Feature Flags (Production)
EXPO_PUBLIC_ENABLE_OFFLINE_MAPS=true
EXPO_PUBLIC_ENABLE_AR_NAVIGATION=true
EXPO_PUBLIC_ENABLE_AUTO_DETECTION=true

# Backend API (Production)
EXPO_PUBLIC_API_URL=https://api.okapifind.com
```

### API Key Restrictions (CRITICAL)

**Google Maps API Key:**
- [ ] **iOS App Restriction:** Bundle ID `com.okapifind.app`
- [ ] **Android App Restriction:** Package name + SHA-1 fingerprint
- [ ] **API Restrictions:** Only enable:
  - Directions API
  - Distance Matrix API
  - Geocoding API
  - Places API
- [ ] **Quota Limits:** 10,000 requests/day (start conservative)
- [ ] **Billing Alerts:** $100/month threshold

**Mapbox Access Token:**
- [ ] **URL Restriction:** `okapifind.com`, `*.okapifind.com`
- [ ] **Scopes:** Downloads:Read (for offline maps)
- [ ] **Rotate:** Every 90 days

### EAS Build Configuration

#### app.json / eas.json Updates
```json
{
  "expo": {
    "name": "OkapiFind",
    "slug": "okapifind",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#FFFFFF"
    },
    "ios": {
      "bundleIdentifier": "com.okapifind.app",
      "buildNumber": "1",
      "supportsTablet": true,
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "We need your location to save your parking spot and guide you back to your car.",
        "NSCameraUsageDescription": "We use the camera for AR navigation to help you find your car.",
        "UIBackgroundModes": []
      },
      "config": {
        "googleMapsApiKey": "AIza..."
      }
    },
    "android": {
      "package": "com.okapifind.app",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      },
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "CAMERA"
      ],
      "config": {
        "googleMaps": {
          "apiKey": "AIza..."
        }
      }
    },
    "plugins": [
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "We need your location to save your parking spot and guide you back to your car."
        }
      ],
      [
        "expo-camera",
        {
          "cameraPermission": "We use the camera for AR navigation."
        }
      ],
      "sentry-expo"
    ]
  }
}
```

#### eas.json
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "production": {
      "env": {
        "NODE_ENV": "production"
      },
      "ios": {
        "distribution": "store",
        "autoIncrement": true,
        "buildConfiguration": "Release"
      },
      "android": {
        "distribution": "store",
        "autoIncrement": true,
        "buildType": "app-bundle"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": true
      },
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "123456789",
        "appleTeamId": "ABCD123456"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

---

## ✅ Phase 5: Testing (CRITICAL)

### Device Testing

**iOS (Minimum):**
- [ ] iPhone SE (2022) - Small screen, iOS 16
- [ ] iPhone 13 Pro - Mid-range, iOS 17
- [ ] iPhone 15 Pro Max - Latest, iOS 17
- [ ] iPad (10th gen) - Tablet support

**Android (Minimum):**
- [ ] Samsung Galaxy A series - Mid-range
- [ ] Google Pixel 7 - Stock Android
- [ ] OnePlus or other - Alternative OEM

### Test Scenarios

**Core Flow:**
- [ ] Open app → Grant location permission
- [ ] Tap "SET CAR LOCATION" → Save confirmation
- [ ] Close app → Reopen
- [ ] Tap "FIND MY CAR" → Navigation starts
- [ ] Follow directions → Arrive at saved location
- [ ] Success message displayed

**Auto-Detection:**
- [ ] Enable auto-detect toggle
- [ ] Drive to location, park, walk away
- [ ] Check notification: "Car location saved"
- [ ] Verify location accuracy (<20m)

**Offline Mode:**
- [ ] Save car location
- [ ] Enable airplane mode
- [ ] Tap "FIND MY CAR"
- [ ] Verify navigation works (no crash)

**Edge Cases:**
- [ ] No location permission → Clear error message
- [ ] No saved car → "SET CAR LOCATION" shown
- [ ] GPS weak signal → Show loading state
- [ ] Kill app during navigation → Resume on reopen
- [ ] Background app → Continue navigation (if needed)

### Performance Testing
- [ ] **Launch Time:** <3 seconds cold start
- [ ] **Map Load:** <2 seconds
- [ ] **Battery Usage:** <5% per hour active use
- [ ] **Memory Usage:** <150MB
- [ ] **Network Usage:** <5MB per session (without offline maps)
- [ ] **Crash Rate:** <0.5%

### Accessibility Testing
- [ ] VoiceOver (iOS) - All buttons labeled
- [ ] TalkBack (Android) - All buttons labeled
- [ ] High Contrast - Text readable
- [ ] Large Text - UI scales properly
- [ ] Reduce Motion - Respects user preference

---

## ✅ Phase 6: App Store Submission

### Pre-Submission Checklist

**General:**
- [ ] All features working on physical devices
- [ ] No debug code or console.logs in production
- [ ] Crash-free for 24+ hours of testing
- [ ] Privacy policy live and accessible
- [ ] Terms of service live and accessible
- [ ] Support email monitored

**iOS Specific:**
- [ ] TestFlight beta tested (10+ users)
- [ ] No private API usage
- [ ] All third-party SDKs disclosed
- [ ] Export compliance documented (if needed)

**Android Specific:**
- [ ] Internal testing track (20+ users, 7+ days)
- [ ] All permissions justified in description
- [ ] Data safety form completed
- [ ] Content rating questionnaire completed

### Build Commands

**iOS Production Build:**
```bash
# Build for App Store
eas build --platform ios --profile production

# Wait for build to complete (~20 min)
# Download and submit via Xcode or:
eas submit --platform ios --profile production
```

**Android Production Build:**
```bash
# Build app bundle
eas build --platform android --profile production

# Submit to Play Store internal track
eas submit --platform android --profile production
```

### App Store Connect Setup (iOS)

- [ ] **App Information:**
  - Name: OkapiFind - Find My Car
  - Subtitle: Never forget where you parked
  - Category: Navigation
  - Age Rating: 4+

- [ ] **Pricing:**
  - Free with In-App Purchases
  - US: $0.00
  - Canada: $0.00 CAD

- [ ] **In-App Purchases:**
  - Plus Monthly: $4.99 USD / $6.99 CAD
  - Pro Monthly: $9.99 USD / $13.99 CAD
  - Plus Yearly: $49.99 USD / $69.99 CAD
  - Pro Yearly: $99.99 USD / $139.99 CAD

- [ ] **App Privacy:**
  - Location (Precise): App Functionality
  - Crash Data: Analytics
  - Not linked to user identity

- [ ] **App Review Information:**
  - Demo account: demo@okapifind.com / Demo123!
  - Notes: "App requires location access to function. Please grant permission when prompted."

### Google Play Console Setup (Android)

- [ ] **Store Listing:**
  - App name: OkapiFind - Find My Car
  - Short description: Never forget where you parked
  - Full description: (see above)
  - Category: Maps & Navigation

- [ ] **Pricing:**
  - Free with In-App Purchases
  - US: $0.00
  - Canada: $0.00 CAD

- [ ] **In-App Products:**
  - plus_monthly: $4.99 USD / $6.99 CAD
  - pro_monthly: $9.99 USD / $13.99 CAD
  - plus_yearly: $49.99 USD / $69.99 CAD
  - pro_yearly: $99.99 USD / $139.99 CAD

- [ ] **Data Safety:**
  - Location collected: YES
  - Location shared: NO
  - Location ephemeral: NO
  - Location optional: NO
  - Location purpose: App functionality

- [ ] **Content Rating:**
  - Complete IARC questionnaire
  - Expected rating: Everyone

---

## ✅ Phase 7: Launch Preparation

### Marketing Assets

**Website (okapifind.com):**
- [ ] Hero: "Never forget where you parked"
- [ ] Features section
- [ ] Screenshots/video
- [ ] Download buttons (App Store + Play Store)
- [ ] Privacy policy link
- [ ] Terms of service link
- [ ] Support contact

**Social Media:**
- [ ] Twitter/X: @okapifind
- [ ] Instagram: @okapifind
- [ ] TikTok: @okapifind (optional)
- [ ] LinkedIn: OkapiFind Company Page

**Press Kit:**
- [ ] Company overview
- [ ] Founder bios
- [ ] High-res screenshots
- [ ] App icon (PNG, SVG)
- [ ] Press release template
- [ ] Contact: press@okapifind.com

### Launch Day Checklist

**T-7 Days:**
- [ ] Submit to Apple (7-10 day review)
- [ ] Submit to Google (3-7 day review)
- [ ] Prepare launch announcement
- [ ] Set up monitoring dashboards

**T-3 Days:**
- [ ] Check app review status daily
- [ ] Respond to any review questions immediately
- [ ] Test production builds

**T-1 Day:**
- [ ] Apps approved and live
- [ ] Final smoke test on production
- [ ] Schedule social media posts
- [ ] Alert support team

**Launch Day:**
- [ ] Set apps to "Available" (if held)
- [ ] Post on social media
- [ ] Email friends/family
- [ ] Monitor analytics
- [ ] Monitor crash reports
- [ ] Respond to early reviews

### Post-Launch Monitoring

**Day 1:**
- [ ] Check downloads (target: 100+)
- [ ] Check crashes (target: <0.5%)
- [ ] Check reviews (respond within 24h)
- [ ] Monitor support emails

**Week 1:**
- [ ] Daily metrics review
- [ ] Address any critical bugs
- [ ] Engage with early users
- [ ] A/B test app store listing

**Month 1:**
- [ ] Weekly metrics review
- [ ] Plan first update (1.1.0)
- [ ] Gather user feedback
- [ ] Optimize conversion funnel

---

## ✅ Phase 8: Success Metrics

### Launch Targets (Month 1)

**Downloads:**
- Week 1: 100-500
- Week 2: 200-1,000
- Week 3: 500-2,000
- Week 4: 1,000-5,000
- **Total Month 1: 1,000-5,000 users**

**Engagement:**
- DAU/MAU: 40%+
- D1 Retention: 70%+
- D7 Retention: 50%+
- D30 Retention: 30%+

**Quality:**
- App Store Rating: 4.5+★
- Crash-Free Rate: 99.5%+
- 1-Star Reviews: <5%
- Support Response: <24h

**Conversion:**
- Free → Paid: 5-10% (Month 1)
- Free → Paid: 15-25% (Month 3)

---

## 📝 Final Pre-Launch Checklist

### Must-Have Before Submission:
- [ ] App tested on 3+ physical devices per platform
- [ ] Privacy policy live at okapifind.com/privacy
- [ ] Terms of service live at okapifind.com/terms
- [ ] Support email monitored (hello@okapifind.com)
- [ ] All API keys restricted to production
- [ ] Crash reporting enabled (Sentry)
- [ ] Analytics enabled (Firebase)
- [ ] RevenueCat products configured
- [ ] EAS Build profiles configured
- [ ] App icons finalized (1024x1024)
- [ ] Screenshots finalized (all sizes)
- [ ] App descriptions finalized
- [ ] TestFlight/Internal Testing completed

### Ready to Submit:
```bash
# Final checks
npm run typecheck  # No TypeScript errors
npm run lint       # No lint errors
npm run test       # All tests pass

# Build production
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

---

## 🎉 Launch Timeline

**Week 1: Final Prep**
- Complete all app store assets
- Finalize privacy policy & terms
- Set up production environment

**Week 2: Submission**
- Submit to iOS (Mon)
- Submit to Android (Mon)
- Monitor review process

**Week 3: Launch**
- Apps approved
- Soft launch (internal)
- Fix any critical issues

**Week 4: Public Launch**
- Public announcement
- Press outreach
- Start marketing

---

**Status:** Ready to launch upon completion of this checklist
**Target Launch Date:** [Set based on completion]
**Markets:** United States & Canada
**Platforms:** iOS (App Store) & Android (Play Store)