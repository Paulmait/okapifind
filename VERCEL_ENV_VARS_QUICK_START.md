# Vercel Environment Variables - Quick Start Guide

## 🚨 CRITICAL: Wrong Variables Detected

You added variables with **NEXT_PUBLIC_** prefix, but this is an **Expo app** (not Next.js).

### ❌ DELETE THESE FROM VERCEL:
1. `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
2. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
3. `NEXT_PUBLIC_OKAPIFIND_MAPS_KEY`

---

## ✅ Step-by-Step Fix (5 Minutes)

### Step 1: Open Vercel Dashboard
Go to: `https://vercel.com/[your-team]/okapifind/settings/environment-variables`

### Step 2: Delete Wrong Variables
Click the three dots (•••) next to each NEXT_PUBLIC_ variable → Delete

### Step 3: Add Required Variables

Click "Add New" and paste each variable:

#### Firebase Authentication (7 variables) - REQUIRED
```
Name: EXPO_PUBLIC_FIREBASE_API_KEY
Value: [Get from Firebase Console → Project Settings → General]
Environment: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
Value: your-project.firebaseapp.com
Environment: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_FIREBASE_PROJECT_ID
Value: your-project-id
Environment: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
Value: your-project.appspot.com
Environment: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
Value: 123456789012
Environment: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_FIREBASE_APP_ID
Value: 1:123456789012:web:abc123def456
Environment: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
Value: G-XXXXXXXXXX
Environment: ✓ Production ✓ Preview ✓ Development
```

#### Supabase Database (2 variables) - REQUIRED
```
Name: EXPO_PUBLIC_SUPABASE_URL
Value: https://your-project.supabase.co
Environment: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_SUPABASE_ANON_KEY
Value: eyJhbGc... [Get from Supabase Dashboard → Settings → API]
Environment: ✓ Production ✓ Preview ✓ Development
```

#### Maps (2 variables) - REQUIRED
```
Name: EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
Value: pk.eyJ1... [Get from Mapbox Dashboard]
Environment: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
Value: AIzaSy... [Get from Google Cloud Console]
Environment: ✓ Production ✓ Preview ✓ Development
```

#### Google OAuth (3 variables) - REQUIRED
```
Name: EXPO_PUBLIC_GOOGLE_CLIENT_ID
Value: your-client-id.apps.googleusercontent.com
Environment: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
Value: your-ios-client-id.apps.googleusercontent.com
Environment: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
Value: your-android-client-id.apps.googleusercontent.com
Environment: ✓ Production ✓ Preview ✓ Development
```

### Step 4: Redeploy
1. Go to "Deployments" tab
2. Click "..." on latest deployment → "Redeploy"
3. Wait 2-3 minutes
4. Refresh browser (Ctrl+Shift+R)

---

## 🎯 What You'll See After Adding Variables

### Before (Current):
- Blank white screen
- Console errors about missing Firebase config

### After (Fixed):
- **Configuration Diagnostic Screen** showing all variables
- Green checkmarks ✅ for configured variables
- Red X ❌ for missing variables
- Once ALL required variables are added → Login/Auth screen appears

---

## 📋 Quick Checklist

### Required (App won't work without):
- [ ] EXPO_PUBLIC_FIREBASE_API_KEY
- [ ] EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
- [ ] EXPO_PUBLIC_FIREBASE_PROJECT_ID
- [ ] EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
- [ ] EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- [ ] EXPO_PUBLIC_FIREBASE_APP_ID
- [ ] EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
- [ ] EXPO_PUBLIC_SUPABASE_URL
- [ ] EXPO_PUBLIC_SUPABASE_ANON_KEY
- [ ] EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
- [ ] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
- [ ] EXPO_PUBLIC_GOOGLE_CLIENT_ID
- [ ] EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
- [ ] EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID

### Already Added (Backend - Keep as-is):
- [x] ENCRYPTION_KEY
- [x] JWT_SECRET
- [x] RESEND_API_KEY
- [x] CE_ROLE_KEY

### Optional (Recommended):
- [ ] EXPO_PUBLIC_GEMINI_API_KEY (AI features)
- [ ] EXPO_PUBLIC_SENTRY_DSN (Error tracking)
- [ ] EXPO_PUBLIC_SHARE_BASE_URL (Sharing features)

---

## 🔍 Where to Get Each Value

### Firebase Variables
1. Go to: https://console.firebase.google.com
2. Select your project
3. Click ⚙️ (Settings) → Project Settings → General
4. Scroll to "Your apps" → Web app
5. Copy all config values

### Supabase Variables
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click ⚙️ (Settings) → API
4. Copy "Project URL" → `EXPO_PUBLIC_SUPABASE_URL`
5. Copy "anon public" key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### Mapbox Token
1. Go to: https://account.mapbox.com/access-tokens
2. Copy your default public token (starts with `pk.`)
3. Or create a new token with these scopes:
   - styles:read
   - fonts:read
   - datasets:read

### Google Maps API Key
1. Go to: https://console.cloud.google.com
2. Select your project
3. APIs & Services → Credentials
4. Find your API key
5. Make sure these APIs are enabled:
   - Maps JavaScript API
   - Geocoding API
   - Places API
   - Directions API

### Google OAuth Client IDs
1. Go to: https://console.cloud.google.com
2. APIs & Services → Credentials
3. Find your OAuth 2.0 Client IDs
4. Web client → Copy Client ID
5. iOS client → Copy Client ID
6. Android client → Copy Client ID

---

## 🐛 Troubleshooting

### "Still showing blank screen after adding variables"
1. Make sure you selected all 3 environments (Production, Preview, Development)
2. Click "Redeploy" in Vercel (not just refresh browser)
3. Wait 2-3 minutes for build to complete
4. Hard refresh browser: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### "Seeing 'Configuration Required' screen"
Good! This means the diagnostic screen is working. It will show you exactly which variables are still missing.

### "Variables are added but diagnostic shows 'NOT SET'"
- You may have used the wrong environment (only selected Production)
- You need to redeploy for changes to take effect
- Check variable names are EXACT (case-sensitive, no spaces)

### "Firebase/Supabase console doesn't match my project"
You need to create these services first:
1. Firebase project: https://console.firebase.google.com
2. Supabase project: https://supabase.com
3. Follow their setup wizards
4. Then come back and get the credentials

---

## 💡 Pro Tips

1. **Copy-paste carefully** - One typo will break everything
2. **Use all 3 environments** - Production, Preview, Development
3. **Redeploy after adding variables** - Changes don't apply until rebuild
4. **Keep secrets safe** - Never commit these to git
5. **Use different keys for dev/prod** - More secure

---

## 📞 Need Help?

After adding all variables, if you still see issues:

1. Check browser console (F12) for error messages
2. Share the specific error message
3. Verify all variables are in Vercel dashboard
4. Try the diagnostic screen - it will tell you what's missing

---

## ⏱️ Expected Timeline

- Add variables: 5-10 minutes
- Vercel rebuild: 2-3 minutes
- Total: ~15 minutes

After this, your web app should show the login screen and be fully functional!
