# ✅ Vercel Variables Verification Checklist

## Copy this checklist and check each variable in your Vercel dashboard

Go to: https://vercel.com/dashboard → Your Project → Settings → Environment Variables

### 🔥 Critical Variables (11 - App won't work without these):

```
[ ] EXPO_PUBLIC_FIREBASE_API_KEY
[ ] EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
[ ] EXPO_PUBLIC_FIREBASE_PROJECT_ID
[ ] EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
[ ] EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
[ ] EXPO_PUBLIC_FIREBASE_APP_ID
[ ] EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
[ ] EXPO_PUBLIC_SUPABASE_URL
[ ] EXPO_PUBLIC_SUPABASE_ANON_KEY
[ ] EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ⚠️ MUST ADD THIS!
[ ] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
```

### ⚡ Optional Variables (5 - App will work but missing features):

```
[ ] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
[ ] EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
[ ] EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
[ ] EXPO_PUBLIC_REVENUECAT_API_KEY_IOS
[ ] EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID
[ ] EXPO_PUBLIC_SENTRY_DSN
```

### 🔐 Backend Variables (3 - Already set):

```
[✓] RESEND_API_KEY
[✓] ENCRYPTION_KEY
[✓] JWT_SECRET
```

---

## 📊 Expected Count:

- **You said you have**: 16 variables
- **You should have**:
  - Minimum (required + backend): 11 + 3 = **14 variables**
  - Ideal (required + optional + backend): 11 + 5 + 3 = **19 variables**

Since you have 16, you likely have:
- ✅ 3 backend variables (RESEND, ENCRYPTION_KEY, JWT_SECRET)
- ✅ Some EXPO_PUBLIC_* variables
- ❓ Missing: EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN

---

## 🚨 Most Likely Missing:

Based on your 16 count and what you showed earlier, you're probably missing:

1. **EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN** (CRITICAL - map won't work!)
2. Maybe 1-2 optional variables

---

## ✅ How to Test:

After adding MAPBOX token to Vercel:

1. **Redeploy without cache**:
   - Deployments → Latest → "..." → Redeploy
   - UNCHECK "Use existing build cache"
   - Redeploy

2. **Test the deployed app**:
   - Open your Vercel URL
   - Should NOT show "Configuration Required"
   - Map should load
   - Google Sign-In button should appear

3. **If still broken**:
   - Take screenshot of ALL your Vercel environment variables (names only)
   - Share which variables you see
   - I'll verify against this checklist

---

## 📸 Take Screenshot

Go to Vercel → Settings → Environment Variables

Take screenshot showing:
- All variable names (values can be hidden)
- How many total variables shown
- Which environments (should show "All Environments" or "Production, Preview, Development")

Share that and I can confirm if you're missing any!
