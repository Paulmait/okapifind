# 🚨 CRITICAL: Add These Environment Variables to Vercel NOW

## Your app is WHITE SCREEN because these are MISSING:

Go to: **https://vercel.com/[your-team]/okapifind/settings/environment-variables**

---

## ✅ Copy-Paste This Checklist

### 1. Delete Wrong Variables First
- [ ] Delete `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
- [ ] Delete `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- [ ] Delete `NEXT_PUBLIC_OKAPIFIND_MAPS_KEY`

### 2. Add These Variables (Click "Add New" for each)

#### Firebase (7 variables) ⚠️ CRITICAL
```
Name: EXPO_PUBLIC_FIREBASE_API_KEY
Value: [Your Firebase API Key]
Environments: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
Value: [your-project.firebaseapp.com]
Environments: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_FIREBASE_PROJECT_ID
Value: [your-project-id]
Environments: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
Value: [your-project.appspot.com]
Environments: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
Value: [123456789012]
Environments: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_FIREBASE_APP_ID
Value: [1:123456789012:web:abc123]
Environments: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
Value: [G-XXXXXXXXXX]
Environments: ✓ Production ✓ Preview ✓ Development
```

#### Supabase (2 variables) ⚠️ CRITICAL
```
Name: EXPO_PUBLIC_SUPABASE_URL
Value: [https://your-project.supabase.co]
Environments: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_SUPABASE_ANON_KEY
Value: [eyJhbGc...]
Environments: ✓ Production ✓ Preview ✓ Development
```

#### Maps (2 variables) ⚠️ CRITICAL
```
Name: EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
Value: [pk.eyJ...]
Environments: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
Value: [AIzaSy...]
Environments: ✓ Production ✓ Preview ✓ Development
```

#### Google OAuth (3 variables) ⚠️ CRITICAL
```
Name: EXPO_PUBLIC_GOOGLE_CLIENT_ID
Value: [xxx.apps.googleusercontent.com]
Environments: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
Value: [xxx-ios.apps.googleusercontent.com]
Environments: ✓ Production ✓ Preview ✓ Development
```

```
Name: EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
Value: [xxx-android.apps.googleusercontent.com]
Environments: ✓ Production ✓ Preview ✓ Development
```

---

## 3. After Adding ALL Variables

1. Click **"Redeploy"** in Vercel Deployments tab
2. Wait 3-5 minutes
3. Hard refresh browser (Ctrl+Shift+R)
4. Open Console (F12) - look for logs

---

## What You'll See After Adding Variables:

### Current (Without Variables):
- White blank screen
- Console shows Firebase warnings
- React fails to mount

### After Adding Variables:
- Purple/gradient loading screen (5-10 seconds)
- Then either:
  - ✅ Login/Auth screen (SUCCESS!)
  - ⚠️ ConfigDiagnostic screen showing what's still missing

---

## Where to Get Each Value:

### Firebase
1. Go to: https://console.firebase.google.com
2. Select your project → ⚙️ Settings → Project Settings
3. Scroll to "Your apps" → Web app (</> icon)
4. Copy all config values

### Supabase
1. Go to: https://supabase.com/dashboard
2. Select project → ⚙️ Settings → API
3. Copy "Project URL" and "anon public" key

### Mapbox
1. Go to: https://account.mapbox.com/access-tokens
2. Copy your default public token (starts with `pk.`)

### Google Maps
1. Go to: https://console.cloud.google.com
2. APIs & Services → Credentials
3. Copy your API key

### Google OAuth
1. Same Google Cloud Console
2. OAuth 2.0 Client IDs → Copy each (Web, iOS, Android)

---

## 🎯 Quick Test

After adding variables and redeploying, open browser console and type:

```javascript
console.log({
  firebase: !!process?.env?.EXPO_PUBLIC_FIREBASE_API_KEY,
  supabase: !!process?.env?.EXPO_PUBLIC_SUPABASE_URL,
  mapbox: !!process?.env?.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
});
```

Should show: `{ firebase: true, supabase: true, mapbox: true }`

---

## Total Required: 14 Variables

- [x] CE_ROLE_KEY (already added ✅)
- [x] ENCRYPTION_KEY (already added ✅)
- [x] JWT_SECRET (already added ✅)
- [x] RESEND_API_KEY (already added ✅)
- [ ] EXPO_PUBLIC_FIREBASE_API_KEY ⚠️
- [ ] EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ⚠️
- [ ] EXPO_PUBLIC_FIREBASE_PROJECT_ID ⚠️
- [ ] EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ⚠️
- [ ] EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ⚠️
- [ ] EXPO_PUBLIC_FIREBASE_APP_ID ⚠️
- [ ] EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ⚠️
- [ ] EXPO_PUBLIC_SUPABASE_URL ⚠️
- [ ] EXPO_PUBLIC_SUPABASE_ANON_KEY ⚠️
- [ ] EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ⚠️
- [ ] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ⚠️
- [ ] EXPO_PUBLIC_GOOGLE_CLIENT_ID ⚠️
- [ ] EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ⚠️
- [ ] EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ⚠️

---

**Without these variables, the white screen will persist!**
