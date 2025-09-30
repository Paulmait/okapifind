# 🚀 Vercel Deployment Guide - OkapiFind Web App

## 📋 **CRITICAL Environment Variables for Vercel**

### **Required for Vercel Deployment** (23 variables)

#### 1. **Database & Backend** (CRITICAL)
```bash
# Supabase (Database & Storage)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key  # Backend only
SUPABASE_JWT_SECRET=your_jwt_secret

# API Configuration
EXPO_PUBLIC_API_URL=https://api.okapifind.com
NODE_ENV=production
JWT_SECRET=your_super_secure_jwt_secret_key_min_32_chars
```

#### 2. **Firebase Authentication** (CRITICAL)
```bash
# Firebase (Auth & Analytics)
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Google OAuth (for Sign-In)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_web_client_id.apps.googleusercontent.com
```

#### 3. **Maps & Location Services** (CRITICAL)
```bash
# Google Maps API (Navigation, Places, Geocoding)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...

# Mapbox (Offline Maps, Custom Styling)
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1...
```

#### 4. **Payment Processing** (CRITICAL for Monetization)
```bash
# Stripe (Payment Processing)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...  # Backend only, never expose
STRIPE_WEBHOOK_SECRET=whsec_...

# RevenueCat (Subscription Management)
EXPO_PUBLIC_REVENUECAT_API_KEY_WEB=rcb_web_...
REVENUECAT_SECRET_KEY=sk_...  # Backend only
```

#### 5. **AI & Smart Features** (HIGH PRIORITY)
```bash
# Google Gemini AI (Smart Parking Predictions)
EXPO_PUBLIC_GEMINI_API_KEY=AIzaSy...
```

#### 6. **Email Service** (HIGH PRIORITY)
```bash
# Resend (Transactional Emails)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=notifications@okapifind.com
```

#### 7. **Error Tracking & Monitoring** (HIGH PRIORITY)
```bash
# Sentry (Error Tracking & Performance)
EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=sntrys_...  # For source maps
SENTRY_ORG=your-org
SENTRY_PROJECT=okapifind
```

#### 8. **Security & Encryption** (REQUIRED)
```bash
# Encryption Keys
ENCRYPTION_KEY=your_32_character_encryption_key_here_minimum
```

---

## 🎯 **Vercel-Specific Configuration**

### **Add to Vercel Dashboard**

1. Go to your project settings: `https://vercel.com/your-team/okapifind/settings/environment-variables`

2. Add each variable with proper scope:
   - **Production**: Live app
   - **Preview**: Staging/preview deployments
   - **Development**: Local development

3. Use Vercel Secrets for sensitive data:
```bash
# Using Vercel CLI
vercel secrets add supabase-service-role-key "your_key_here"
vercel secrets add stripe-secret-key "sk_live_..."
vercel secrets add jwt-secret "your_jwt_secret"
```

---

## 📦 **Optional But Recommended** (10 variables)

```bash
# Analytics (Optional but valuable)
EXPO_PUBLIC_MIXPANEL_TOKEN=your_mixpanel_token
EXPO_PUBLIC_AMPLITUDE_API_KEY=your_amplitude_key

# Weather API (Parking predictions)
EXPO_PUBLIC_WEATHER_API_KEY=your_openweather_key

# Admin Access
ADMIN_EMAILS=admin@okapifind.com,ceo@okapifind.com

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000

# Feature Flags
EXPO_PUBLIC_ENABLE_AI_PREDICTIONS=true
EXPO_PUBLIC_ENABLE_OFFLINE_MODE=true
EXPO_PUBLIC_DEBUG_MODE=false
EXPO_PUBLIC_LOG_LEVEL=info
```

---

## 🔧 **Vercel Build Configuration**

### **vercel.json** (Already configured)
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/**/*.ts",
      "use": "@vercel/node"
    },
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "dist" }
    }
  ],
  "framework": "vite",
  "regions": ["iad1"]
}
```

### **package.json scripts needed**
```json
{
  "scripts": {
    "build": "expo export:web",
    "vercel-build": "npm run build"
  }
}
```

---

## 🚀 **Deployment Steps**

### **Option 1: Deploy via GitHub (Recommended)**

1. **Connect GitHub to Vercel**
   ```bash
   # Push your code
   git push origin main
   ```

2. **Auto-deploy triggers**
   - Every push to `main` = Production deployment
   - Every PR = Preview deployment

### **Option 2: Deploy via Vercel CLI**

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login & Deploy**
   ```bash
   cd OkapiFind
   vercel login
   vercel --prod
   ```

3. **Set Environment Variables**
   ```bash
   vercel env add EXPO_PUBLIC_FIREBASE_API_KEY production
   vercel env add SUPABASE_URL production
   # ... repeat for all variables
   ```

---

## 🔒 **Security Best Practices for Vercel**

### **1. Never Commit Secrets**
```bash
# .gitignore already includes:
.env
.env.local
.env.production
```

### **2. Use Vercel Secrets for Backend**
```bash
# Backend-only variables (never expose)
vercel secrets add supabase-service-role-key "..."
vercel secrets add stripe-secret-key "..."
vercel secrets add jwt-secret "..."
```

### **3. Restrict API Key Origins**

**Google Maps API:**
- Restrict to: `okapifind.com`, `*.vercel.app`

**Firebase:**
- Add authorized domains: `okapifind.com`, `okapifind.vercel.app`

**Stripe:**
- Add webhook endpoint: `https://okapifind.com/api/stripe-webhook`

---

## 📊 **Environment Variable Priority**

### **CRITICAL (App won't work without these):**
1. ✅ `SUPABASE_URL` + `SUPABASE_ANON_KEY`
2. ✅ `EXPO_PUBLIC_FIREBASE_API_KEY` + Firebase config (7 variables)
3. ✅ `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
4. ✅ `JWT_SECRET`
5. ✅ `NODE_ENV=production`

### **HIGH PRIORITY (Core features affected):**
1. ⚠️ `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` (offline maps)
2. ⚠️ `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` + `STRIPE_SECRET_KEY` (payments)
3. ⚠️ `EXPO_PUBLIC_GEMINI_API_KEY` (AI features)
4. ⚠️ `RESEND_API_KEY` (email notifications)
5. ⚠️ `EXPO_PUBLIC_SENTRY_DSN` (error tracking)

### **NICE TO HAVE (Enhanced features):**
1. 💡 `EXPO_PUBLIC_REVENUECAT_API_KEY_WEB` (subscription analytics)
2. 💡 `EXPO_PUBLIC_WEATHER_API_KEY` (parking predictions)
3. 💡 `EXPO_PUBLIC_MIXPANEL_TOKEN` (analytics)

---

## 🧪 **Testing Vercel Deployment Locally**

```bash
# Install Vercel CLI
npm install -g vercel

# Run local development server
cd OkapiFind
vercel dev

# This will:
# - Pull environment variables from Vercel
# - Run API routes locally
# - Simulate Vercel edge functions
```

---

## 📱 **Web vs Mobile Environment Variables**

### **Web-Only (Vercel)**
```bash
# These are used by api/ folder
SUPABASE_SERVICE_ROLE_KEY  # Backend database access
STRIPE_SECRET_KEY          # Backend payment processing
JWT_SECRET                 # Token signing
RESEND_API_KEY            # Email sending
```

### **Shared (Web + Mobile)**
```bash
# All EXPO_PUBLIC_* variables are used by both
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
# ... etc
```

---

## 🎯 **Quick Start Checklist**

### **Before First Deployment:**

- [ ] Create Firebase project → Get 7 Firebase env vars
- [ ] Create Supabase project → Get URL + anon key + service role key
- [ ] Get Google Maps API key → Enable 4 APIs (Maps, Places, Directions, Geocoding)
- [ ] Get Mapbox access token → Enable offline maps
- [ ] Create Stripe account → Get publishable + secret keys
- [ ] Sign up for Gemini AI → Get API key
- [ ] Sign up for Resend → Get API key
- [ ] Create Sentry project → Get DSN
- [ ] Generate JWT secret → Use: `openssl rand -base64 32`
- [ ] Add all variables to Vercel dashboard

### **Deploy:**
```bash
git push origin main
# Vercel auto-deploys!
```

---

## 🔥 **Common Issues & Solutions**

### **Issue 1: "Firebase not configured"**
**Solution:** Add all 7 Firebase env vars to Vercel

### **Issue 2: "Supabase connection failed"**
**Solution:** Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set

### **Issue 3: "Maps not loading"**
**Solution:**
1. Check `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is set
2. Verify API key has Maps JavaScript API enabled
3. Add `okapifind.vercel.app` to allowed referrers

### **Issue 4: "Payment not working"**
**Solution:** Verify both Stripe keys are set (public + secret)

### **Issue 5: Build fails on Vercel**
**Solution:** Check build logs, ensure `vercel-build` script exists

---

## 📊 **Environment Variable Template**

Copy this to Vercel Dashboard → Environment Variables:

```env
# ============================================
# CRITICAL - Database & Backend
# ============================================
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
JWT_SECRET=
NODE_ENV=production

# ============================================
# CRITICAL - Firebase Authentication
# ============================================
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=
EXPO_PUBLIC_GOOGLE_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=

# ============================================
# CRITICAL - Maps
# ============================================
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=

# ============================================
# CRITICAL - Payments
# ============================================
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
EXPO_PUBLIC_REVENUECAT_API_KEY_WEB=
REVENUECAT_SECRET_KEY=

# ============================================
# HIGH PRIORITY - AI & Services
# ============================================
EXPO_PUBLIC_GEMINI_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=notifications@okapifind.com
EXPO_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
ENCRYPTION_KEY=
```

---

## 🎉 **Production Deployment URL**

After deployment, your app will be available at:
- **Production:** `https://okapifind.com`
- **Vercel Default:** `https://okapifind.vercel.app`
- **Preview (PR):** `https://okapifind-git-[branch]-[team].vercel.app`

---

## 📞 **Support**

- **Vercel Docs:** https://vercel.com/docs
- **Expo Web:** https://docs.expo.dev/workflow/web/
- **Troubleshooting:** Check Vercel deployment logs

---

**Total Required Environment Variables: 23 critical + 10 optional = 33 variables**

**Deployment Time: ~5-10 minutes** (after env vars are set)