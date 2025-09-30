# 🚀 Vercel Deployment - Step-by-Step Guide

**Complete guide to deploy OkapiFind to production in 30 minutes**

---

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] GitHub account with OkapiFind repository
- [ ] Vercel account (sign up at https://vercel.com)
- [ ] Firebase project created
- [ ] Supabase project created
- [ ] Google Maps API key
- [ ] Mapbox account and token
- [ ] Stripe account for payments
- [ ] RevenueCat account (optional for mobile)

---

## 🔐 STEP 1: Prepare Your API Keys (15 minutes)

### 1.1 Firebase Setup
**Go to:** https://console.firebase.google.com

1. Select your project (or create new one)
2. Click ⚙️ → Project Settings
3. Scroll to "Your apps" → Web app
4. Copy these values:

```
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123:web:abc123
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=G-ABC123XYZ
```

5. Go to Authentication → Sign-in method
6. Enable Google Sign-In
7. Copy Web Client ID:

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123-abc.apps.googleusercontent.com
```

### 1.2 Supabase Setup
**Go to:** https://app.supabase.com

1. Select your project → Settings → API
2. Copy these values:

```
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
```

3. Go to Settings → Database → Connection String
4. Copy Service Role Key (click "Reveal"):

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

5. Go to Settings → API → JWT Settings
6. Copy JWT Secret:

```
SUPABASE_JWT_SECRET=your-super-secret-jwt-secret
```

### 1.3 Google Maps Setup
**Go to:** https://console.cloud.google.com/apis/credentials

1. Select your project
2. Click "Create Credentials" → API Key
3. Copy the key:

```
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
```

4. **IMPORTANT:** Click "Restrict Key"
   - API restrictions → Select APIs:
     - Maps JavaScript API
     - Places API
     - Directions API
     - Distance Matrix API
     - Geocoding API
   - Save

### 1.4 Mapbox Setup
**Go to:** https://account.mapbox.com

1. Go to Tokens
2. Create new token or copy default token:

```
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1...
```

### 1.5 Stripe Setup
**Go to:** https://dashboard.stripe.com/apikeys

1. Copy Publishable key:

```
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

2. Copy Secret key (click "Reveal"):

```
STRIPE_SECRET_KEY=sk_live_...
```

3. Go to Developers → Webhooks
4. Click "Add endpoint"
5. Set URL: `https://your-domain.vercel.app/api/stripe-webhook`
6. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
7. Copy webhook signing secret:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 1.6 RevenueCat Setup (Optional)
**Go to:** https://app.revenuecat.com

1. Go to Settings → API Keys
2. Copy public API key:

```
EXPO_PUBLIC_REVENUECAT_API_KEY_WEB=rc_...
```

3. Copy secret key:

```
REVENUECAT_SECRET_KEY=sk_...
```

### 1.7 Gemini AI Setup (Optional)
**Go to:** https://makersuite.google.com/app/apikey

1. Create API key
2. Copy:

```
EXPO_PUBLIC_GEMINI_API_KEY=AIza...
```

### 1.8 Resend Email Setup (Optional)
**Go to:** https://resend.com/api-keys

1. Create API key
2. Copy:

```
RESEND_API_KEY=re_...
```

### 1.9 Sentry Monitoring Setup (Optional)
**Go to:** https://sentry.io

1. Create new project → React
2. Copy DSN:

```
EXPO_PUBLIC_SENTRY_DSN=https://abc@xyz.ingest.sentry.io/123
```

### 1.10 Generate Security Keys

Open your terminal and run:

```bash
# Generate JWT Secret (32 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate Encryption Key (32 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the outputs:

```
JWT_SECRET=abc123def456...
ENCRYPTION_KEY=xyz789uvw012...
```

---

## 🌐 STEP 2: Deploy to Vercel (10 minutes)

### 2.1 Connect Repository

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your GitHub repository
4. Click "Import"

### 2.2 Configure Project

1. **Framework Preset:** Detected automatically (Expo)
2. **Root Directory:** `OkapiFind`
3. **Build Command:** `npm run build` (or leave default)
4. **Output Directory:** `web-build` (or leave default)
5. **Install Command:** `npm install`

### 2.3 Add Environment Variables

Click "Environment Variables" and add ALL 23 variables:

#### Database & Backend (4 vars)
```
SUPABASE_URL = https://xyz.supabase.co
SUPABASE_ANON_KEY = eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY = eyJhbGc...
SUPABASE_JWT_SECRET = your-super-secret...
```

#### Firebase Authentication (9 vars)
```
EXPO_PUBLIC_FIREBASE_API_KEY = AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID = your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET = your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 123456789
EXPO_PUBLIC_FIREBASE_APP_ID = 1:123:web:abc123
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID = G-ABC123XYZ
EXPO_PUBLIC_GOOGLE_CLIENT_ID = 123-abc.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 123-def.apps.googleusercontent.com
```

#### Maps & Location (2 vars)
```
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = AIza...
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = pk.eyJ1...
```

#### Payments (5 vars)
```
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_...
STRIPE_SECRET_KEY = sk_live_...
STRIPE_WEBHOOK_SECRET = whsec_...
EXPO_PUBLIC_REVENUECAT_API_KEY_WEB = rc_...
REVENUECAT_SECRET_KEY = sk_...
```

#### AI & Services (3 vars)
```
EXPO_PUBLIC_GEMINI_API_KEY = AIza...
RESEND_API_KEY = re_...
EXPO_PUBLIC_SENTRY_DSN = https://abc@xyz.ingest.sentry.io/123
```

#### Security (2 vars)
```
JWT_SECRET = abc123def456...
ENCRYPTION_KEY = xyz789uvw012...
```

#### API Endpoints (2 vars)
```
EXPO_PUBLIC_API_URL = https://your-app.vercel.app
EXPO_PUBLIC_WEBSOCKET_URL = wss://your-app.vercel.app
```

**IMPORTANT:** For each variable:
1. Enter **Name** (exact match from above)
2. Enter **Value** (paste your actual key)
3. Select **Environment:** Production, Preview, Development (check all 3)
4. Click "Add"

### 2.4 Deploy

1. Click "Deploy"
2. Wait 2-5 minutes for build to complete
3. Once deployed, copy your production URL: `https://your-app.vercel.app`

---

## ✅ STEP 3: Update API Endpoints (2 minutes)

### 3.1 Update Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Find these two variables and update with your actual Vercel URL:

```
EXPO_PUBLIC_API_URL = https://your-actual-app.vercel.app
EXPO_PUBLIC_WEBSOCKET_URL = wss://your-actual-app.vercel.app
```

3. Click "Save"
4. Go to Deployments → Latest deployment → ⋯ → Redeploy

### 3.2 Update Firebase Authorized Domains

1. Go to Firebase Console → Authentication → Settings → Authorized Domains
2. Click "Add domain"
3. Add: `your-actual-app.vercel.app`
4. Click "Add"

### 3.3 Update Google Maps API Restrictions

1. Go to Google Cloud Console → APIs & Credentials
2. Click your API key → Edit
3. Add HTTP referrer:
   - `https://your-actual-app.vercel.app/*`
   - `https://*.vercel.app/*` (for preview deployments)
4. Save

### 3.4 Update Stripe Webhook URL

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click your webhook endpoint → Edit
3. Update URL to: `https://your-actual-app.vercel.app/api/stripe-webhook`
4. Save

---

## 🧪 STEP 4: Test Your Deployment (3 minutes)

### 4.1 Health Check

Visit: `https://your-actual-app.vercel.app/api/health`

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2025-09-30T12:00:00.000Z",
  "services": {
    "api": "operational",
    "database": "operational",
    "firebase": "operational",
    "maps": "operational"
  }
}
```

### 4.2 App Functionality

1. Visit: `https://your-actual-app.vercel.app`
2. Check:
   - [ ] App loads without errors
   - [ ] Firebase config guard shows if keys missing
   - [ ] Offline indicator appears when disconnected
   - [ ] Sign in with Google works
   - [ ] Map loads correctly
   - [ ] Location tracking works
   - [ ] Navigation works

### 4.3 Check Vercel Logs

1. Go to Vercel Dashboard → Your Project → Deployments
2. Click latest deployment
3. Click "Runtime Logs"
4. Look for any errors (should be clean)

---

## 🔒 STEP 5: Security Post-Deployment (5 minutes)

### 5.1 Enable API Key Restrictions

**Google Maps:**
- [ ] HTTP referrer restrictions enabled
- [ ] Only required APIs enabled
- [ ] Billing alerts configured

**Firebase:**
- [ ] Authorized domains configured
- [ ] Security rules configured for Firestore/Storage

**Stripe:**
- [ ] Webhook signature verification enabled
- [ ] Live mode enabled (not test mode)

**Supabase:**
- [ ] Row Level Security (RLS) enabled
- [ ] API key restrictions configured

### 5.2 Configure Security Headers

Add to `vercel.json` (create if doesn't exist):

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ]
}
```

### 5.3 Set Up Monitoring

**Vercel:**
- [ ] Enable Web Analytics (Settings → Analytics)
- [ ] Configure deployment notifications (Settings → Git)

**Sentry (if configured):**
- [ ] Error tracking enabled
- [ ] Performance monitoring enabled
- [ ] Alerts configured

---

## 🎯 STEP 6: Custom Domain (Optional, 5 minutes)

### 6.1 Add Domain to Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Enter your domain: `okapifind.com`
3. Click "Add"
4. Follow DNS instructions

### 6.2 Update DNS Records

At your domain registrar (GoDaddy, Namecheap, etc):

**For apex domain (okapifind.com):**
```
A Record
Name: @
Value: 76.76.21.21
```

**For www subdomain:**
```
CNAME Record
Name: www
Value: cname.vercel-dns.com
```

### 6.3 Update Environment Variables

1. Update `EXPO_PUBLIC_API_URL` → `https://okapifind.com`
2. Update `EXPO_PUBLIC_WEBSOCKET_URL` → `wss://okapifind.com`
3. Redeploy

### 6.4 Update Firebase/Google/Stripe

Repeat Step 3 (Update API Endpoints) with your custom domain

---

## 🐛 Common Issues & Solutions

### Issue: "Firebase not configured" error

**Solution:**
1. Verify all `EXPO_PUBLIC_FIREBASE_*` variables are set in Vercel
2. Check Firebase console that project is active
3. Redeploy

### Issue: "Maps not loading"

**Solution:**
1. Check Google Maps API key is valid
2. Verify HTTP referrer restrictions include your domain
3. Enable required APIs (Maps JS, Places, Directions, Distance Matrix)
4. Check billing is enabled in Google Cloud

### Issue: Build fails with "Module not found"

**Solution:**
1. Check all dependencies are in `package.json`
2. Delete `node_modules` and `package-lock.json`
3. Run `npm install`
4. Commit and push
5. Redeploy

### Issue: Stripe webhook not receiving events

**Solution:**
1. Verify webhook URL matches your Vercel URL exactly
2. Check webhook signing secret matches `STRIPE_WEBHOOK_SECRET`
3. Test with Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe-webhook`

### Issue: Authentication fails

**Solution:**
1. Check Firebase authorized domains include your Vercel domain
2. Verify all Firebase env vars are correct
3. Check browser console for specific error messages
4. Test in incognito mode (clear cookies)

---

## 📊 Post-Launch Monitoring

### Daily Checks
- [ ] Vercel deployment status (should be green)
- [ ] Error rate in Sentry (should be <1%)
- [ ] API response times (should be <500ms)
- [ ] User sign-ups and engagement

### Weekly Checks
- [ ] Database size and performance
- [ ] API quota usage (Google Maps, Stripe, etc.)
- [ ] Cost analysis (Vercel, Firebase, Supabase)
- [ ] Security alerts and updates

### Monthly Checks
- [ ] Rotate API keys and secrets
- [ ] Review access logs for anomalies
- [ ] Update dependencies (`npm update`)
- [ ] Performance optimization

---

## 🎉 You're Live!

Your OkapiFind app is now live in production!

**Next Steps:**
1. Share your app: `https://your-actual-app.vercel.app`
2. Monitor analytics in Vercel Dashboard
3. Track errors in Sentry (if configured)
4. Collect user feedback
5. Iterate and improve!

**Support:**
- Vercel Docs: https://vercel.com/docs
- Firebase Docs: https://firebase.google.com/docs
- Supabase Docs: https://supabase.com/docs

---

## 📝 Environment Variables Reference

Total: **23 critical variables**

| Variable | Where to Get | Required? |
|----------|--------------|-----------|
| `SUPABASE_URL` | Supabase Dashboard → API | ✅ Critical |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → API | ✅ Critical |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → API | ✅ Critical |
| `SUPABASE_JWT_SECRET` | Supabase Dashboard → API → JWT Settings | ✅ Critical |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project Settings | ✅ Critical |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Console → Project Settings | ✅ Critical |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Console → Project Settings | ✅ Critical |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Console → Project Settings | ✅ Critical |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Console → Project Settings | ✅ Critical |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase Console → Project Settings | ✅ Critical |
| `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` | Firebase Console → Project Settings | ✅ Critical |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Firebase Console → Authentication | ✅ Critical |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Firebase Console → Authentication | ✅ Critical |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Cloud Console → Credentials | ✅ Critical |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox Account → Tokens | ✅ Critical |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → API Keys | ✅ Critical |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → API Keys | ✅ Critical |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks | ✅ Critical |
| `EXPO_PUBLIC_REVENUECAT_API_KEY_WEB` | RevenueCat → API Keys | 🟡 Optional |
| `REVENUECAT_SECRET_KEY` | RevenueCat → API Keys | 🟡 Optional |
| `EXPO_PUBLIC_GEMINI_API_KEY` | Google AI Studio | 🟡 Optional |
| `RESEND_API_KEY` | Resend Dashboard | 🟡 Optional |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry.io → Project Settings | 🟡 Optional |
| `JWT_SECRET` | Generate with Node.js | ✅ Critical |
| `ENCRYPTION_KEY` | Generate with Node.js | ✅ Critical |
| `EXPO_PUBLIC_API_URL` | Your Vercel URL | ✅ Critical |
| `EXPO_PUBLIC_WEBSOCKET_URL` | Your Vercel URL (wss) | ✅ Critical |

**Total: 18 critical + 5 optional = 23+ variables**