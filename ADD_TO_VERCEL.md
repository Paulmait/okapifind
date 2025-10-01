# 🚨 Add These 7 Variables to Vercel NOW

## You Currently Have (✅ Already in Vercel):
- ✅ EXPO_PUBLIC_FIREBASE_API_KEY
- ✅ EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
- ✅ EXPO_PUBLIC_FIREBASE_PROJECT_ID
- ✅ EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET

## ⚠️ MISSING from Vercel (Must Add):

### 1. EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
**Value from your .env**: (12 digits)
```
Example: 123456789012
```

### 2. EXPO_PUBLIC_FIREBASE_APP_ID
**Value from your .env**: (starts with `1:`)
```
Example: 1:123456789012:web:abcdef123456
```

### 3. EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
**Value from your .env**: (starts with `G-`)
```
Example: G-XXXXXXXXXX
```

### 4. EXPO_PUBLIC_SUPABASE_URL
**Value from your .env**: (ends with `.supabase.co`)
```
Example: https://xxxxxxxxxxxxxxxxxxxxx.supabase.co
```

### 5. EXPO_PUBLIC_SUPABASE_ANON_KEY
**Value from your .env**: (very long token starting with `eyJ`)
```
Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBh...
```

### 6. EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
**⚠️ NOT IN YOUR .env FILE - You need to get this!**

**How to get it:**
1. Go to: https://account.mapbox.com/access-tokens/
2. Create a new token or copy existing one
3. Token starts with `pk.` (public token)
```
Example: pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImFiY2RlZmdoIn0...
```

### 7. EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
**Value from your .env**: (ends with `.apps.googleusercontent.com`)
```
Example: 123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
```

---

## 📝 How to Add Each Variable to Vercel:

For **EACH** variable above (1-7):

1. Go to https://vercel.com/dashboard
2. Click your **okapifind** project
3. Click **Settings** → **Environment Variables**
4. Click **"Add New"**
5. **Name**: Copy the variable name exactly (e.g., `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`)
6. **Value**: Open your `.env` file and copy the value (or get Mapbox token from link above)
7. **Environments**: Check **ALL THREE** boxes:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
8. Click **"Save"**
9. Move to the NEXT variable

---

## ✅ After Adding All 7 Variables:

### Step 1: Verify
- Go to Settings → Environment Variables
- You should see **11 total variables** (4 existing + 7 new)

### Step 2: Redeploy
1. Go to **Deployments** tab
2. Click **"..."** on latest deployment
3. Click **"Redeploy"**
4. **UNCHECK** "Use existing build cache" ⚠️ IMPORTANT!
5. Click **"Redeploy"**

### Step 3: Wait & Test
- Wait 2-3 minutes for build
- Open your deployed URL
- Should NO LONGER show "Configuration Required"
- Map should load
- Google Sign-In should work

---

## 🔍 Quick Verification:

After adding variables, you should have these 11 variables in Vercel:

- [x] EXPO_PUBLIC_FIREBASE_API_KEY
- [x] EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
- [x] EXPO_PUBLIC_FIREBASE_PROJECT_ID
- [x] EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
- [ ] EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ← ADD THIS
- [ ] EXPO_PUBLIC_FIREBASE_APP_ID ← ADD THIS
- [ ] EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ← ADD THIS
- [ ] EXPO_PUBLIC_SUPABASE_URL ← ADD THIS
- [ ] EXPO_PUBLIC_SUPABASE_ANON_KEY ← ADD THIS
- [ ] EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ← ADD THIS (get from Mapbox first!)
- [ ] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ← ADD THIS

---

## ⚠️ Special Note: Mapbox Token

Your `.env` file is **MISSING** `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`.

**Get it here**: https://account.mapbox.com/access-tokens/

1. Sign up/login to Mapbox
2. Create a new token or copy existing
3. Token should start with `pk.` (public token)
4. Copy it
5. Add to your local `.env` file:
   ```
   EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijoi...your_token_here
   ```
6. Also add to Vercel dashboard

Without this token, the map won't load!

---

**Do this now and your app will work! 🚀**
