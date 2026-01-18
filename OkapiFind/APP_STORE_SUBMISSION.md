# OkapiFind - App Store Submission Guide

## Production Readiness Status

| Component | Status | Notes |
|-----------|--------|-------|
| App loads without errors | Ready | Firebase configured |
| Authentication | Ready | Firebase Auth + Apple Sign-In |
| Database | Ready | Supabase with RLS policies |
| Analytics | Ready | Firebase Analytics |
| Crash Reporting | Ready | Sentry configured |
| In-App Purchases | Needs Setup | RevenueCat configured, products need metadata |
| Privacy Policy | Ready | GitHub Pages URL |
| Terms of Service | Ready | GitHub Pages URL |

---

## Part 1: App Store Connect - App Information

### Basic Info
| Field | Value |
|-------|-------|
| **App Name** | OkapiFind - Find My Car |
| **Subtitle** | Never forget where you parked |
| **Bundle ID** | com.okapi.find |
| **SKU** | okapifind-ios-001 |
| **Primary Language** | English (U.S.) |
| **Category** | Navigation |
| **Secondary Category** | Utilities |
| **Content Rights** | Does not contain third-party content |

### Age Rating Questionnaire
| Question | Answer |
|----------|--------|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Prolonged Graphic or Sadistic Violence | None |
| Profanity or Crude Humor | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes | None |
| Medical/Treatment Information | None |
| Alcohol, Tobacco, or Drug Use | None |
| Simulated Gambling | None |
| Sexual Content or Nudity | None |
| Unrestricted Web Access | No |
| Gambling with Real Currency | No |

**Result: Age 4+**

---

## Part 2: App Store Listing Text

### Promotional Text (170 chars)
```
One tap to save your parking spot. Turn-by-turn navigation back to your car. Works offline in parking garages. Never get lost again!
```

### Description
```
Never forget where you parked again!

OkapiFind is the simplest way to remember your parking spot and navigate back to your car. Perfect for busy parking lots, multi-level garages, and unfamiliar areas.

KEY FEATURES:

ONE-TAP SAVE
Mark your parking spot with a single tap. It's that simple.

TURN-BY-TURN NAVIGATION
Get accurate directions back to your car using Apple Maps or your preferred navigation app.

OFFLINE MODE
Works in underground parking garages where cell signal is weak or unavailable.

PHOTO NOTES
Take a picture of your parking spot, level number, or nearby landmarks.

TIME TRACKING
See how long you've been parked. Perfect for metered parking.

SAFETY SHARING
Share your live location with trusted contacts when walking to your car at night.

SIMPLE & CLEAN:
Unlike other navigation apps, OkapiFind does ONE thing perfectly: help you find your car. No clutter, no confusion, just a clean interface focused on getting you back to your vehicle.

PRIVACY FIRST:
- Your location data stays on your device
- We don't track where you go
- No ads, no data selling
- GDPR & CCPA compliant

PERFECT FOR:
- Shopping malls & retail centers
- Airport parking lots
- Sporting events & concerts
- Downtown street parking
- Multi-level parking garages
- Hospital & university campuses

SUBSCRIPTION OPTIONS:
- Free: 5 parking saves per month, basic navigation
- Premium Monthly: $2.99/month - Unlimited saves, photo notes, history
- Premium Annual: $19.99/year - Same features, save 44%
- Lifetime: $39.99 one-time - All premium features forever

Download OkapiFind today and never waste time searching for your car again!

---
Support: https://github.com/Paulmait/okapifind/issues
Privacy Policy: https://github.com/Paulmait/okapifind/blob/main/PRIVACY_POLICY.md
Terms of Service: https://github.com/Paulmait/okapifind/blob/main/TERMS_OF_SERVICE.md
```

### Keywords (100 chars max)
```
find car,parking,navigate,car finder,parking lot,garage,gps,location,parked car,where did i park
```

### What's New (Version 1.0.0)
```
Welcome to OkapiFind!

- Save your parking location with one tap
- Navigate back to your car with turn-by-turn directions
- Take photo notes of your parking spot
- Share your location with trusted contacts for safety
- Works offline in parking garages
```

---

## Part 3: URLs & Contact

| Field | Value |
|-------|-------|
| **Support URL** | https://github.com/Paulmait/okapifind/issues |
| **Marketing URL** | https://github.com/Paulmait/okapifind |
| **Privacy Policy URL** | https://github.com/Paulmait/okapifind/blob/main/PRIVACY_POLICY.md |
| **Copyright** | 2026 OkapiFind |

---

## Part 4: In-App Purchases (Subscriptions)

### Subscription Group Name
```
OkapiFind Premium
```

### Product 1: Premium Monthly

| Field | Value |
|-------|-------|
| **Reference Name** | Premium Monthly |
| **Product ID** | com.okapi.find.premium.monthly |
| **Type** | Auto-Renewable Subscription |
| **Price** | $2.99 USD |
| **Duration** | 1 Month |
| **Subscription Group** | OkapiFind Premium |

**Display Name:**
```
Premium Monthly
```

**Description:**
```
Unlimited parking saves, photo notes, full parking history, and safety sharing. Cancel anytime.
```

---

### Product 2: Premium Annual

| Field | Value |
|-------|-------|
| **Reference Name** | Premium Annual |
| **Product ID** | com.okapi.find.premium.annual |
| **Type** | Auto-Renewable Subscription |
| **Price** | $19.99 USD |
| **Duration** | 1 Year |
| **Subscription Group** | OkapiFind Premium |

**Display Name:**
```
Premium Annual
```

**Description:**
```
Unlimited parking saves, photo notes, full parking history, and safety sharing. Best value - save 44% vs monthly!
```

---

### Product 3: Premium Lifetime

| Field | Value |
|-------|-------|
| **Reference Name** | Premium Lifetime |
| **Product ID** | com.okapi.find.premium.lifetime |
| **Type** | Non-Consumable |
| **Price** | $39.99 USD |

**Display Name:**
```
Premium Lifetime
```

**Description:**
```
One-time purchase. All premium features forever - unlimited saves, photo notes, history, and safety sharing. No subscription required.
```

---

## Part 5: App Review Information

### Contact Information
| Field | Value |
|-------|-------|
| **First Name** | Paul |
| **Last Name** | Mait |
| **Phone** | (Your phone number) |
| **Email** | (Your email) |

### Demo Account (if needed)
```
Not required - app works without sign-in for basic features.
Users can sign in with Apple ID for cloud sync.
```

### Notes for App Review
```
OkapiFind helps users remember where they parked their car.

HOW TO TEST:
1. Open the app - you'll see the main "Save Parking" screen
2. Tap "Save My Parking" to save your current location
3. Walk away, then tap "Find My Car" to navigate back
4. Test photo notes by tapping the camera icon when saving

LOCATION PERMISSION:
The app requests location access to save parking spots and provide navigation.
Location is only accessed when the user actively saves a parking spot or navigates.
Background location is used only for optional auto-parking detection (user must enable).

IN-APP PURCHASES:
- Free tier: 5 parking saves per month
- Premium: Unlimited saves, photo notes, history
- Test subscriptions with sandbox account

SIGN IN WITH APPLE:
Used for optional cloud sync of parking history across devices.
App works fully without sign-in.
```

---

## Part 6: App Privacy (Data Collection)

### Data Types Collected

#### 1. Location Data
| Question | Answer |
|----------|--------|
| **Collected?** | Yes |
| **Linked to Identity?** | No |
| **Used for Tracking?** | No |
| **Purpose** | App Functionality |
| **Why?** | To save parking location and provide navigation |

#### 2. User Content (Photos)
| Question | Answer |
|----------|--------|
| **Collected?** | Yes |
| **Linked to Identity?** | No |
| **Used for Tracking?** | No |
| **Purpose** | App Functionality |
| **Why?** | Optional photo notes for parking spots (stored on device) |

#### 3. Identifiers (User ID)
| Question | Answer |
|----------|--------|
| **Collected?** | Yes |
| **Linked to Identity?** | Yes |
| **Used for Tracking?** | No |
| **Purpose** | App Functionality |
| **Why?** | For cloud sync when signed in with Apple ID |

#### 4. Usage Data (Analytics)
| Question | Answer |
|----------|--------|
| **Collected?** | Yes |
| **Linked to Identity?** | No |
| **Used for Tracking?** | No |
| **Purpose** | Analytics |
| **Why?** | To improve app performance and features |

#### 5. Diagnostics (Crash Data)
| Question | Answer |
|----------|--------|
| **Collected?** | Yes |
| **Linked to Identity?** | No |
| **Used for Tracking?** | No |
| **Purpose** | App Functionality |
| **Why?** | Crash reporting via Sentry to fix bugs |

---

## Part 7: Export Compliance

| Question | Answer |
|----------|--------|
| **Uses encryption?** | Yes (HTTPS for API calls) |
| **Qualifies for exemption?** | Yes |
| **Exemption type** | Standard encryption (HTTPS/TLS only) |

---

## Part 8: Build & Submit

### Production Build Command
```bash
cd OkapiFind
eas build --platform ios --profile production
```

### Submit to App Store
```bash
eas submit --platform ios --latest
```

Or manually upload the .ipa from Transporter app.

---

## Part 9: Pre-Submission Checklist

### App Store Connect Setup
- [ ] App created with correct Bundle ID (com.okapi.find)
- [ ] App Information filled out
- [ ] Age Rating questionnaire completed
- [ ] App Privacy labels configured
- [ ] Pricing and availability set (free with IAP)

### Screenshots & Media
- [ ] iPhone 6.7" screenshots (1290x2796) - 3-10 images
- [ ] iPhone 6.5" screenshots (1242x2688) - 3-10 images
- [ ] iPhone 5.5" screenshots (1242x2208) - 3-10 images
- [ ] iPad Pro 12.9" screenshots (2048x2732) - optional
- [ ] App icon (1024x1024) - uploaded via build

### In-App Purchases
- [ ] Subscription group created: "OkapiFind Premium"
- [ ] Monthly product created: com.okapi.find.premium.monthly ($2.99)
- [ ] Annual product created: com.okapi.find.premium.annual ($19.99)
- [ ] Lifetime product created: com.okapi.find.premium.lifetime ($39.99)
- [ ] All products have Display Name and Description
- [ ] All products linked to RevenueCat
- [ ] Products status: "Ready to Submit"

### App Review
- [ ] Contact information provided
- [ ] Review notes explain app functionality
- [ ] Demo account provided (if needed)
- [ ] Export compliance answered

### Final Steps
- [ ] Build production iOS app
- [ ] Upload build to App Store Connect
- [ ] Select build for submission
- [ ] Submit for review

---

## Estimated Review Time
- **First submission:** 24-48 hours (can take up to 7 days)
- **Updates:** Usually 24 hours

## Common Rejection Reasons to Avoid
1. **Incomplete metadata** - All fields must be filled
2. **Broken links** - Support/Privacy URLs must work
3. **Missing permissions explanation** - Location usage must be justified
4. **Subscription issues** - Products must be properly configured
5. **Crashes** - Test thoroughly before submission

---

**Last Updated:** January 2026
**App Version:** 1.0.0
**Status:** Ready for submission (pending IAP metadata)
