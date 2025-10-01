# 🔧 Vercel Environment Variables Setup

## Critical Issue
Your app is showing: **"Configuration Required - Missing EXPO_PUBLIC_FIREBASE_* and EXPO_PUBLIC_SUPABASE_*"**

This means the environment variables are NOT set in your Vercel dashboard.

## ✅ Required Variables for Vercel Dashboard

You need to set these **REQUIRED** variables in Vercel (values are in your local `.env` file):

### Firebase (REQUIRED)
```
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
EXPO_PUBLIC_FIREBASE_DATABASE_URL
```

### Supabase (REQUIRED)
```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### Maps (REQUIRED for map functionality)
```
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
```

### Google OAuth (REQUIRED for sign-in)
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
```

### RevenueCat (OPTIONAL - for premium features)
```
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID
```

### Analytics (OPTIONAL)
```
EXPO_PUBLIC_GEMINI_API_KEY
EXPO_PUBLIC_SENTRY_DSN
```

---

## 📝 Step-by-Step: How to Set Variables in Vercel

### Method 1: Via Vercel Dashboard (Recommended)

1. **Go to your project**: https://vercel.com/dashboard
2. **Click on your project** (okapifind)
3. **Click "Settings"** tab
4. **Click "Environment Variables"** in left sidebar
5. **For EACH variable above**:
   - Click "Add New"
   - **Name**: Copy the exact variable name (e.g., `EXPO_PUBLIC_FIREBASE_API_KEY`)
   - **Value**: Copy from your local `.env` file
   - **Environments**: Check ALL THREE boxes:
     - ✅ Production
     - ✅ Preview
     - ✅ Development
   - Click "Save"
6. **Repeat for ALL variables** listed above
7. **After adding all variables**: Go to "Deployments" tab
8. **Click "..." menu** on latest deployment
9. **Click "Redeploy"** → **Enable "Use existing build cache"** should be OFF
10. **Click "Redeploy"** button

### Method 2: Via Vercel CLI (Faster for bulk)

```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Login to Vercel
vercel login

# Link to your project
cd C:\Users\maito\okapifind
vercel link

# Add environment variables from .env file
vercel env pull .env.vercel

# Then manually add each variable
vercel env add EXPO_PUBLIC_FIREBASE_API_KEY
# Paste the value when prompted
# Select: Production, Preview, Development (all 3)

# Repeat for each variable...
```

---

## 🔍 Verify Variables Are Set

After setting variables in Vercel dashboard:

1. Go to Settings → Environment Variables
2. You should see ALL variables listed above
3. Each should show: `Production` `Preview` `Development` tags
4. If any are missing, add them

---

## 🚀 After Setting Variables

1. **Force redeploy** (important - don't use cache):
   - Go to Deployments tab
   - Click "..." on latest deployment
   - Click "Redeploy"
   - **UNCHECK** "Use existing build cache"
   - Click "Redeploy"

2. **Wait for build** to complete (~2-3 minutes)

3. **Test the app**:
   - Open your deployed URL
   - You should NO LONGER see "Configuration Required"
   - App should load normally

---

## 🐛 Still Not Working?

If you still see "Configuration Required" after setting variables:

### Check 1: Verify variables are actually set
```bash
# In Vercel dashboard, Settings → Environment Variables
# Count how many variables you see
# You should have at least 12 variables (Firebase + Supabase + Maps)
```

### Check 2: Check build logs
```bash
# In Vercel dashboard, go to latest deployment
# Click "Building" or "View Function Logs"
# Search for "EXPO_PUBLIC_FIREBASE_API_KEY"
# If you see "undefined", variables aren't being loaded
```

### Check 3: Clear Vercel cache
```bash
# Redeploy with cache disabled
vercel --force
```

---

## 📋 Quick Checklist

- [ ] All Firebase variables added to Vercel (8 variables)
- [ ] All Supabase variables added to Vercel (2 variables)
- [ ] Map tokens added to Vercel (2 variables)
- [ ] Google OAuth IDs added to Vercel (3 variables)
- [ ] Each variable set for: Production + Preview + Development
- [ ] Forced redeploy without cache
- [ ] App loads without "Configuration Required" error
- [ ] Can see map on homepage
- [ ] Can sign in with Google

---

## 🎯 Expected Result

After completing this setup:

✅ App loads immediately
✅ No "Configuration Required" error
✅ Map displays on homepage
✅ Google Sign-In button works
✅ Firebase authentication works

---

## 💡 Tips

1. **Variable names must be EXACT** - including `EXPO_PUBLIC_` prefix
2. **No quotes** around values in Vercel dashboard (just paste the value)
3. **No spaces** before/after the value
4. **Always redeploy** after changing environment variables
5. **Disable cache** on first redeploy after adding variables

---

## 🔗 Useful Links

- Vercel Environment Variables Docs: https://vercel.com/docs/concepts/projects/environment-variables
- Your Vercel Dashboard: https://vercel.com/dashboard
- Firebase Console: https://console.firebase.google.com/
- Supabase Dashboard: https://app.supabase.com/

---

## ⚠️ Security Note

These variables are **safe to expose** in the client bundle because:
- Firebase/Supabase have domain restrictions
- API keys are restricted in provider dashboards
- Sensitive operations use backend `/api` proxies (already implemented)

**DO NOT** set these in Vercel:
- `SUPABASE_SERVICE_ROLE_KEY` (backend only)
- `STRIPE_SECRET_KEY` (backend only)
- Any `*_SECRET` or `*_PRIVATE` keys
