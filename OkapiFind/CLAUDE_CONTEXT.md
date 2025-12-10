# OkapiFind - Claude Context File

**Purpose:** This file provides full context for Claude to continue development on OkapiFind.

---

## Project Overview

**OkapiFind** is a "Find My Car" mobile app built with React Native + Expo. Users save their parking spot with one tap and get turn-by-turn walking directions back to their car. Works offline in parking garages.

**Tech Stack:**
- Frontend: React Native, Expo SDK 52, TypeScript
- Backend: Supabase (Auth, Database, Edge Functions, Storage)
- Maps: Google Maps API, Mapbox
- Payments: RevenueCat (Plus $4.99/mo, Pro $9.99/mo)
- Auth: Supabase, Firebase, Apple Sign-In, Google OAuth

---

## Current State (December 10, 2025)

### COMPLETED:

1. **Supabase Edge Functions** - All 8 deployed and ACTIVE:
   - `google-maps-proxy` - Secure proxy for Google Maps API (directions, geocode, places)
   - `gemini-proxy` - AI parking sign/meter analysis
   - `secure-config` - Feature flags based on subscription
   - `signed-upload`, `start-share`, `revenuecat-webhook`, `cron-reminders`, `detect-spot-number`

2. **Supabase Secrets** - `GOOGLE_MAPS_API_KEY` is set. `GEMINI_API_KEY` pending (optional).

3. **Premium Features Implemented:**
   - `src/services/shareLocationService.ts` - Share car location via SMS/WhatsApp/Email (24hr expiry)
   - `src/components/ShareLocationSheet.tsx` - Beautiful share UI bottom sheet
   - `src/services/parkingHistoryService.ts` - Search past parking spots, stats, favorites
   - `src/screens/ParkingHistoryScreen.tsx` - Browse/search history UI
   - `src/services/floorDetectionService.ts` - Barometric pressure for garage floors (B1, B2)
   - `src/services/appReviewService.ts` - Smart review prompts after 3 successful navigations
   - `src/services/smartPOIService.ts` - Auto-learn home/work, suppress notifications

4. **Landing Page** - `web/index.html` and `public/index.html` redesigned with modern UI

5. **EAS Configuration** - `eas.json` updated with Apple Team ID `LFB9Z5Q3Y9`

### PENDING:

1. **iOS Production Build** - Requires interactive mode for Apple credentials:
   ```bash
   cd "C:\Users\maito\okapifind\OkapiFind" && eas build --platform ios --profile production
   ```

2. **Android Build** (after iOS):
   ```bash
   eas build --platform android --profile production
   ```

3. **Optional:** Set Gemini API key for AI features:
   ```bash
   npx supabase secrets set GEMINI_API_KEY=your-key
   ```

---

## Key Configuration

### Apple Developer
- **Apple ID:** guampaul@gmail.com
- **Team ID:** LFB9Z5Q3Y9
- **Bundle ID:** com.okapi.find

### EAS/Expo
- **Project ID:** 9218d954-2ca6-4eb1-8f1e-4b4fd81d4812
- **Owner:** guampaul
- **Dashboard:** https://expo.dev/accounts/guampaul/projects/okapifind

### Supabase
- **Project:** kmobwbqdtmbzdyysdxjx (OkapiFind)
- **URL:** https://kmobwbqdtmbzdyysdxjx.supabase.co
- **Dashboard:** https://supabase.com/dashboard/project/kmobwbqdtmbzdyysdxjx
- **Functions:** https://supabase.com/dashboard/project/kmobwbqdtmbzdyysdxjx/functions

### GitHub
- **Repo:** https://github.com/Paulmait/okapifind
- **Branch:** main

---

## Project Structure

```
OkapiFind/
├── src/
│   ├── screens/           # 16+ screen components
│   ├── components/        # 26+ reusable components
│   ├── services/          # 96 service files (~25k lines)
│   ├── hooks/             # 15 custom hooks
│   ├── config/            # App configuration
│   └── types/             # TypeScript types
├── supabase/
│   └── functions/         # 8 Edge Functions (deployed)
├── web/                   # Landing page
├── public/                # Static assets
├── app.json               # Expo config
├── app.config.js          # Dynamic Expo config
└── eas.json               # EAS Build config
```

---

## Important Files

| File | Purpose |
|------|---------|
| `eas.json` | EAS build profiles, Apple credentials |
| `app.json` | Expo config, bundle ID, permissions |
| `.env` | Environment variables (gitignored) |
| `supabase/config.toml` | Supabase local config |

---

## Recent Git Commits

```
b235582 docs: Add deployment status and progress tracking
45ad3e5 fix: Update eas.json with Apple credentials and fix resource class
c16b96b 🚀 New Premium Features: Share, History, Floor Detection & Review Prompts
a825cd4 🚀 Production Release Prep: Edge Functions, Landing Page & TypeScript Fixes
20a02aa 🛡️ Security Hardening Complete - 4 Critical Improvements
```

---

## Common Commands

```bash
# Navigate to project
cd "C:\Users\maito\okapifind\OkapiFind"

# iOS Build (interactive - prompts for Apple login)
eas build --platform ios --profile production

# Android Build
eas build --platform android --profile production

# Check build status
eas build:list

# Submit to App Store
eas submit --platform ios --latest

# Deploy Supabase function
npx supabase functions deploy FUNCTION_NAME --no-verify-jwt

# Set Supabase secret
npx supabase secrets set KEY=value

# List deployed functions
npx supabase functions list

# Verify build locally
npx expo export --platform all

# TypeScript check
npm run typecheck
```

---

## Known Issues & Solutions

1. **EAS build fails with "Credentials not set up"**
   - Solution: Run without `--non-interactive` flag to allow Apple login

2. **"m-large is deprecated"**
   - Fixed: Changed to `large` in eas.json

3. **offlineMode.ts NetInfo import error**
   - Fixed: Changed `@react-native-netinfo` to `@react-native-community/netinfo`

4. **Windows bash paths**
   - Use forward slashes: `cd "C:/Users/maito/okapifind/OkapiFind"`

---

## Security Notes

- No API keys in git (all in `.gitignore`)
- Google Maps key stored in Supabase secrets vault
- Apple credentials managed via EAS (not stored locally)
- Edge Functions validate Supabase JWT before API calls

---

## Next Steps for Claude

If user wants to continue:

1. **Run iOS build** - User must run `eas build --platform ios --profile production` in terminal (requires Apple login)

2. **After build succeeds** - Submit to TestFlight with `eas submit --platform ios --latest`

3. **Android build** - Same process but `--platform android`

4. **Optional enhancements:**
   - Apple Watch app
   - CarPlay/Android Auto integration
   - Localization (Spanish, French, German)
