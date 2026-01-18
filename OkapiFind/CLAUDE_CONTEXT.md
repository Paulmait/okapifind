# OkapiFind - Claude Development Context

> **Last Updated:** January 17, 2026
> **Version:** 1.0.0
> **Platform:** iOS (primary), Android (planned), Web (companion)

---

## Project Overview

**OkapiFind** is a premium "Find My Car" mobile app built with React Native + Expo. Users save their parking spot with one tap and get turn-by-turn walking directions back to their car. Features intelligent auto-detection, multi-sensor location fusion, and works offline in parking garages.

### Key Differentiators
- **Auto-Detection:** Detects parking via activity recognition (driving → walking)
- **Multi-Sensor Fusion:** GPS + WiFi + Cell + Barometer for ±5m accuracy
- **Battery Optimized:** 5-tier power management system
- **Smart POI Learning:** Auto-learns frequent locations to reduce notification fatigue
- **Offline-First:** Works in parking garages without signal

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React Native 0.81.4 + Expo SDK 54 |
| **Language** | TypeScript 5.9 |
| **State** | Zustand |
| **Backend** | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) |
| **Auth** | Firebase Auth + Google OAuth + Apple Sign-In |
| **Payments** | RevenueCat |
| **Maps** | react-native-maps (Apple Maps iOS, Google Maps Android) |
| **Build** | EAS Build |
| **Analytics** | Custom (40+ events, ready for Firebase/Amplitude) |

---

## Project Structure

```
OkapiFind/
├── App.tsx                           # Main entry with navigation
├── app.config.js                     # Expo configuration
├── eas.json                          # EAS Build profiles
├── CLAUDE_CONTEXT.md                 # This file
├── src/
│   ├── components/                   # Reusable UI components
│   │   ├── ErrorBoundary.tsx
│   │   ├── FirebaseConfigGuard.tsx
│   │   └── OfflineIndicator.tsx
│   ├── config/
│   │   └── firebase.ts               # Firebase configuration
│   ├── constants/
│   │   └── colors.ts                 # Design system
│   ├── hooks/
│   │   ├── useAuth.ts                # Authentication (Zustand store)
│   │   ├── useCarLocation.ts         # Car location CRUD
│   │   ├── useCompass.ts             # Magnetometer heading
│   │   ├── useParkingDetection.ts    # Auto-detection hook
│   │   ├── useParkingLocation.ts     # Supabase parking sessions
│   │   ├── useRevenueCat.ts          # In-app purchases
│   │   └── useUserLocation.ts        # User GPS tracking
│   ├── i18n/
│   │   ├── index.ts                  # i18next setup
│   │   └── locales/                  # en, es, fr, ar
│   ├── lib/
│   │   └── supabase-client.ts        # Supabase client (with mock fallback)
│   ├── screens/
│   │   ├── MapScreen.tsx             # Main map view
│   │   ├── GuidanceScreen.tsx        # Walking navigation
│   │   ├── SettingsScreen.tsx        # User preferences
│   │   ├── PaywallScreen.tsx         # Subscription UI
│   │   ├── AuthScreen.tsx            # Login/signup
│   │   └── OnboardingScreen.tsx      # First-launch tutorial
│   ├── services/
│   │   ├── analytics.ts              # 40+ event types
│   │   ├── batteryOptimization.ts    # 5-tier power management
│   │   ├── investorAnalytics.ts      # KPIs for investors
│   │   ├── locationFusion.ts         # Multi-sensor accuracy
│   │   ├── ParkingDetectionService.ts # Auto-detection logic
│   │   ├── places.service.ts         # Google Places API
│   │   ├── smartPOIService.ts        # Learned locations
│   │   ├── distanceMatrix.service.ts # Route optimization
│   │   ├── apiQuotaService.ts        # Rate limiting by tier
│   │   └── crossPlatformSync.ts      # Mobile/web sync
│   ├── types/                        # TypeScript interfaces
│   └── utils/
│       ├── calculateDistance.ts      # Haversine formula
│       ├── calculateBearing.ts       # Direction math
│       └── googleApi.ts              # Google OAuth
├── supabase/
│   └── migrations/                   # SQL migrations
└── assets/                           # Icons, splash screens
```

---

## Core Features Implementation

### 1. Manual Parking Save
**Files:** `useCarLocation.ts`, `useParkingLocation.ts`
- One-tap save with haptic feedback
- Address via reverse geocoding
- Floor detection via barometer
- Photo attachment support
- Offline queue with sync

### 2. Auto-Detection (Premium)
**Files:** `ParkingDetectionService.ts`, `useParkingDetection.ts`
- Activity recognition (driving → walking)
- Speed-based detection (< 1.5 m/s = stopped)
- Geofencing for frequent locations
- 70% confidence threshold
- Background tracking support

### 3. Navigation Guidance
**Files:** `GuidanceScreen.tsx`, `distanceMatrix.service.ts`
- Walking directions with ETA
- Voice guidance (expo-speech)
- Compass-based direction indicator
- Distance updates in real-time

### 4. Multi-Sensor Location Fusion
**File:** `locationFusion.ts`
```
GPS (60% weight) + WiFi (30%) + Cell Tower (10%)
+ Barometer for floor detection
+ Map snapping to nearby parking lots
= ±5m accuracy vs ±15m GPS alone
```

### 5. Smart POI Learning
**File:** `smartPOIService.ts`
- Auto-learns: home, work, gym, etc. (11 types)
- Suppresses prompts at known locations
- Min 3 visits before suggesting
- Reduces notification fatigue by 60%

### 6. Battery Optimization
**File:** `batteryOptimization.ts`

| Mode | Interval | Distance | Accuracy |
|------|----------|----------|----------|
| Ultra Low | 5 min | 500m | Low |
| Battery Saver | 2 min | 200m | Balanced |
| Balanced | 1 min | 100m | Balanced |
| High Performance | 30 sec | 50m | High |
| Adaptive | AI-optimized | 75m | Balanced |

Auto-switches based on battery level and app state.

---

## Monetization

### Pricing Tiers
| Plan | Price | Features |
|------|-------|----------|
| **Free** | $0 | 10 saves/month, basic navigation |
| **Premium Monthly** | $3.99/mo | Unlimited, auto-detection, voice |
| **Premium Annual** | $29.99/yr | Same, 37% savings |
| **Lifetime** | $59.99 once | Everything forever |

### RevenueCat Configuration
- **Entitlement:** `premium`
- **iOS API Key:** `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`
- **Products:**
  - `okapifind_monthly` (Auto-renewable)
  - `okapifind_annual` (Auto-renewable)
  - `okapifind_lifetime` (Non-consumable)

### API Quota by Tier
**File:** `apiQuotaService.ts`
| Tier | Daily API | Monthly Saves | Maps/Day |
|------|-----------|---------------|----------|
| Free | 50 | 10 | 10 |
| Monthly | 500 | Unlimited | 100 |
| Annual | 1000 | Unlimited | 200 |
| Lifetime | Unlimited | Unlimited | 500 |

---

## Database Schema (Supabase)

### Tables (All with RLS)
```sql
profiles           -- User profile (auth.users FK)
user_settings      -- App preferences
parking_sessions   -- Parking history (main data)
vehicles          -- User's vehicles
devices           -- Push tokens
api_usage         -- Rate limiting
```

### Key RLS Pattern
```sql
CREATE POLICY "users_own_data" ON table_name
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Migration Files
- `20260117150000_comprehensive_rls_setup.sql` - Full schema + RLS

---

## Analytics (40+ Events)

### Key Events
| Event | When | Properties |
|-------|------|------------|
| `parking_saved` | Save location | method, source, has_photo |
| `parking_detected` | Auto-detect | confidence, address |
| `navigation_started` | Navigate to car | distance |
| `paywall_view` | Paywall shown | source |
| `paywall_purchase_success` | Purchase | package_id, price |
| `feature_gated` | Hit free limit | feature |
| `battery_mode_changed` | Power mode | from, to, battery_level |

### Investor Analytics
**File:** `investorAnalytics.ts`
- MRR/ARR tracking
- LTV:CAC ratio
- D1/D7/D30 retention
- DAU/MAU stickiness
- Feature adoption rates
- Churn prediction

---

## Environment Variables

### Required in eas.json (preview/production)
```env
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=okapifind-e5b81.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=okapifind-e5b81
EXPO_PUBLIC_FIREBASE_APP_ID=1:897907860773:web:830b5654c6a20b8199e6cc
EXPO_PUBLIC_SUPABASE_URL=https://kmobwbqdtmbzdyysdxjx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyB2SGV6...
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_VZWlOGhnbs...
```

### Never Commit (.gitignored)
```env
SUPABASE_SERVICE_ROLE_KEY
FIREBASE_ADMIN_PRIVATE_KEY
REVENUECAT_SECRET_KEY
```

---

## Build & Deploy

### EAS Profiles
```bash
# Development (Expo Go)
eas build --profile development --platform ios

# Preview (Internal testing)
eas build --profile preview --platform ios

# Production (App Store)
eas build --profile production --platform ios
```

### Current Configuration
- **Bundle ID:** com.okapi.find
- **Apple Team:** LFB9Z5Q3Y9 (CIEN RIOS, LLC)
- **ASC App ID:** 6756395219
- **EAS Project ID:** 9218d954-2ca6-4eb1-8f1e-4b4fd81d4812

---

## Key Configuration Details

### Apple Developer
| Field | Value |
|-------|-------|
| Apple ID | guampaul@gmail.com |
| Team ID | LFB9Z5Q3Y9 |
| Team Name | CIEN RIOS, LLC |
| Bundle ID | com.okapi.find |

### Expo/EAS
| Field | Value |
|-------|-------|
| Project ID | 9218d954-2ca6-4eb1-8f1e-4b4fd81d4812 |
| Owner | guampaul |
| Dashboard | https://expo.dev/accounts/guampaul/projects/okapifind |

### Supabase
| Field | Value |
|-------|-------|
| Project | kmobwbqdtmbzdyysdxjx |
| URL | https://kmobwbqdtmbzdyysdxjx.supabase.co |

### Firebase
| Field | Value |
|-------|-------|
| Project ID | okapifind-e5b81 |
| App ID | 1:897907860773:web:830b5654c6a20b8199e6cc |

---

## Development Guidelines

### Error Handling
```typescript
// Always wrap external calls
try {
  const result = await service.doSomething();
} catch (error) {
  console.warn('Service failed:', error);
  // Fallback - don't crash
}
```

### Battery-Conscious Code
```typescript
// DON'T: Continuous high accuracy
Location.Accuracy.BestForNavigation

// DO: Use battery optimization service
const mode = await batteryOptimization.getCurrentMode();
const config = batteryOptimization.getLocationConfig();
```

### Config Safety
```typescript
// Always check before using
if (isFirebaseConfigured()) { /* use firebase */ }
if (isSupabaseConfigured()) { /* use supabase */ }
```

### Service Patterns
- Services are **singletons**: `export const analytics = new Analytics()`
- Hooks wrap services with React state
- Use `try-catch` in hooks, not components

---

## Known Issues & TODOs

### High Priority
- [ ] Test full payment flow (sandbox)
- [ ] Verify Google OAuth on device
- [ ] Test background location battery impact
- [ ] Add Sentry crash reporting

### Medium Priority
- [ ] Android build configuration
- [ ] Apple Watch companion
- [ ] CarPlay integration
- [ ] Home/Lock screen widgets

### Low Priority
- [ ] AR navigation mode
- [ ] Social sharing
- [ ] Family plan management
- [ ] Multi-vehicle support

---

## Quick Commands

```bash
# Development
cd OkapiFind && npm start

# Build iOS preview
eas build --platform ios --profile preview

# Build iOS production
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios --latest

# Check builds
eas build:list --platform ios --limit 3

# Type check
npm run typecheck

# Tests
npm test

# Git
git add -A && git commit -m "message" && git push
```

---

## For Claude: Critical Context

1. **Error Boundaries Exist** - Top-level ErrorBoundary catches uncaught errors and shows "Something went wrong" screen.

2. **Services May Not Be Configured** - Always check `isSupabaseConfigured()` / `isFirebaseConfigured()` before using. Mock fallbacks exist.

3. **Battery Matters** - Users uninstall battery-draining apps. Always respect `batteryOptimization` service modes.

4. **Premium Features Gated** - Check `useRevenueCat().isPremium` or `apiQuotaService.checkQuota()`.

5. **Offline-First** - Use AsyncStorage for local data. Sync when online.

6. **i18n Ready** - Use `useTranslation()` for user-facing strings.

7. **Hooks Wrap Services** - Don't use services directly in components. Use hooks.

8. **All User Data Has RLS** - Supabase tables use `auth.uid() = user_id` policies.

---

## Resources

- **GitHub:** https://github.com/Paulmait/okapifind
- **Expo:** https://expo.dev/accounts/guampaul/projects/okapifind
- **Supabase:** https://supabase.com/dashboard/project/kmobwbqdtmbzdyysdxjx
- **RevenueCat:** https://app.revenuecat.com
- **Firebase:** https://console.firebase.google.com/project/okapifind-e5b81

---

*Keep this file updated as the app evolves. It's the primary context for Claude to continue development.*
