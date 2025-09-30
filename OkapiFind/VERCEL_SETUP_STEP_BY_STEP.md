# 🚀 Vercel Deployment - Step-by-Step Guide

**Complete guide to deploy OkapiFind to production in 30 minutes**

---

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] GitHub account with OkapiFind repository
- [ ] Vercel account (sign up at https://vercel.com)
- [ ] Firebase project created
- [ ] Supabase project created
- [ ] Google Maps API keys (may need 2 keys with different restrictions)
- [ ] Stripe account for payments

---

## 🔐 STEP 1: Prepare Your API Keys (15 minutes)

### 1.1 Firebase Setup
**Go to:** https://console.firebase.google.com

1. Select your project (or create new one)
2. Click ⚙️ → Project Settings
3. Scroll to "Your apps" → Web app
4. Copy these values:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBBz1nwINWdmnKr13zutmBoEgwFD6XHAfg
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=okapifind-e5b81.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=okapifind-e5b81
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=okapifind-e5b81.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=897907860773
NEXT_PUBLIC_FIREBASE_APP_ID=1:897907860773:web:830b5654c6a20b8199e6cc
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-GLP7PK7361
```

### 1.2 Supabase Setup
**Go to:** https://app.supabase.com

1. Select your project → Settings → API
2. Copy these values:

```
NEXT_PUBLIC_SUPABASE_URL=https://kmobwbqdtmbzdyysdxjx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_LCRH55EAKXxEO-HAZko8XA_lwLi_NK9
```

**Note:** You do NOT need SUPABASE_SERVICE_ROLE_KEY or JWT_SECRET for typical client-side usage.

### 1.3 Google Maps Setup
**Go to:** https://console.cloud.google.com/apis/credentials

**You may have TWO different keys with different restrictions:**

1. **Maps Platform API Key** - for primary map features
2. **OkapiFind Maps Key** - for additional features or different restrictions

Copy both keys and note which is which:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=[your_first_maps_key]
NEXT_PUBLIC_OKAPIFIND_MAPS_KEY=[your_second_maps_key]
```

**IMPORTANT:** For each key, click "Edit" and ensure it has:
- **API restrictions** → Select required APIs:
  - Maps JavaScript API
  - Places API
  - Directions API
  - Distance Matrix API
  - Geocoding API
- **HTTP referrer restrictions** (add after deployment)
- Save

### 1.4 Stripe Setup
**Go to:** https://dashboard.stripe.com/apikeys

1. Copy Publishable key:

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

2. Copy Secret key (click "Reveal"):

```
STRIPE_SECRET_KEY=sk_live_...
```

3. **IMPORTANT:** Webhook setup (do this AFTER first deployment in Step 3.4)

### 1.5 Generate Security Keys

Open your terminal and run:

```bash
# Generate Encryption Key (32 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate JWT Secret (32 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the outputs:

```
ENCRYPTION_KEY=8f7a9b2c4d6e1f3a5b8c9d0e2f4a6b8c
JWT_SECRET=3a7f9c2e5b8d1f4a6c9e2b5d8f1a4c7e
```

---

## 🌐 STEP 2: Deploy to Vercel (10 minutes)

### 2.1 Connect Repository

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your GitHub repository
4. Click "Import"

### 2.2 Configure Project

1. **Framework Preset:** Next.js (detected automatically)
2. **Root Directory:** Leave as root or specify if needed
3. **Build Command:** `npm run build` (or leave default)
4. **Output Directory:** Leave default
5. **Install Command:** `npm install`

### 2.3 Add Environment Variables

Click "Environment Variables" and add these **11 required variables**:

#### Firebase (7 vars)
```
NEXT_PUBLIC_FIREBASE_API_KEY = AIzaSyBBz1nwINWdmnKr13zutmBoEgwFD6XHAfg
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = okapifind-e5b81.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID = okapifind-e5b81
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = okapifind-e5b81.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 897907860773
NEXT_PUBLIC_FIREBASE_APP_ID = 1:897907860773:web:830b5654c6a20b8199e6cc
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = G-GLP7PK7361
```

#### Supabase (2 vars)
```
NEXT_PUBLIC_SUPABASE_URL = https://kmobwbqdtmbzdyysdxjx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_LCRH55EAKXxEO-HAZko8XA_lwLi_NK9
```

#### Google Maps (2 vars - add BOTH if you have them)
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = [your_first_maps_key]
NEXT_PUBLIC_OKAPIFIND_MAPS_KEY = [your_second_maps_key]
```

#### Stripe (2 vars)
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_...
STRIPE_SECRET_KEY = sk_live_...
```

**Note:** STRIPE_WEBHOOK_SECRET will be added AFTER deployment in Step 3.4

#### Security (2 vars)
```
ENCRYPTION_KEY = 8f7a9b2c4d6e1f3a5b8c9d0e2f4a6b8c
JWT_SECRET = 3a7f9c2e5b8d1f4a6c9e2b5d8f1a4c7e
```

**IMPORTANT:** For each variable:
1. Enter **Name** (exact match from above)
2. Enter **Value** (paste your actual key)
3. Select **Environment:** Production, Preview, Development (check all 3)
4. Click "Add"

### 2.4 Deploy

1. Click "Deploy"
2. Wait 2-5 minutes for build to complete
3. Once deployed, **copy your production URL**: `https://your-app-name.vercel.app`

---

## ✅ STEP 3: Post-Deployment Configuration (5 minutes)

### 3.1 Update Firebase Authorized Domains

1. Go to Firebase Console → Authentication → Settings → Authorized Domains
2. Click "Add domain"
3. Add: `your-actual-app.vercel.app`
4. Click "Add"

### 3.2 Update Google Maps API Restrictions

For **EACH** of your Google Maps API keys:

1. Go to Google Cloud Console → APIs & Credentials
2. Click your API key → Edit
3. Under **Application restrictions**, add HTTP referrers:
   - `https://your-actual-app.vercel.app/*`
   - `https://*.vercel.app/*` (for preview deployments)
4. Save
5. Repeat for the second Maps key if you have one

### 3.3 Set Up Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Set URL: `https://your-actual-app.vercel.app/api/stripe-webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click "Add endpoint"
6. Copy the **Signing secret** (starts with `whsec_...`)

### 3.4 Add Stripe Webhook Secret to Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add new variable:
   ```
   STRIPE_WEBHOOK_SECRET = whsec_...
   ```
3. Select all environments (Production, Preview, Development)
4. Click "Save"
5. Go to Deployments → Latest deployment → ⋯ → Redeploy

---

## 🧪 STEP 4: Test Your Deployment (3 minutes)

### 4.1 Basic Functionality Test

1. Visit: `https://your-actual-app.vercel.app`
2. Check:
   - [ ] App loads without errors
   - [ ] No console errors in browser DevTools (F12)
   - [ ] Firebase authentication works
   - [ ] Maps load correctly
   - [ ] Navigation works

### 4.2 Check Vercel Logs

1. Go to Vercel Dashboard → Your Project → Deployments
2. Click latest deployment
3. Click "Runtime Logs"
4. Look for any errors (should be clean)

### 4.3 Check Browser Console

1. Open your deployed app
2. Press F12 to open DevTools
3. Check Console tab for errors
4. Common issues:
   - Missing API keys → Check environment variables
   - CORS errors → Check Firebase authorized domains
   - Maps not loading → Check Maps API keys and restrictions

---

## 🔒 STEP 5: Security Checklist (3 minutes)

### 5.1 Verify API Key Restrictions

**Google Maps:**
- [ ] HTTP referrer restrictions enabled (completed in Step 3.2)
- [ ] Only required APIs enabled
- [ ] Billing alerts configured in Google Cloud Console

**Firebase:**
- [ ] Authorized domains configured (completed in Step 3.1)
- [ ] Authentication methods enabled

**Stripe:**
- [ ] Webhook signature verification enabled (completed in Step 3.4)
- [ ] Using live mode keys (not test mode)

**Supabase:**
- [ ] Row Level Security (RLS) policies configured
- [ ] Only using anon/public key (not service role key)

### 5.2 Enable Vercel Analytics (Optional)

1. Go to Vercel Dashboard → Your Project → Settings → Analytics
2. Enable Web Analytics
3. Configure deployment notifications in Settings → Git

---

## 🎯 STEP 6: Custom Domain (Optional, 10 minutes)

### 6.1 Add Domain to Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Enter your domain: `okapifind.com`
3. Click "Add"
4. Vercel will show you DNS records to configure

### 6.2 Update DNS Records

At your domain registrar (GoDaddy, Namecheap, Cloudflare, etc):

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

Wait 5-10 minutes for DNS propagation. Vercel will automatically verify.

### 6.3 Update Service Configurations

Once your custom domain is active, update these services:

**Firebase:**
- Go to Authentication → Settings → Authorized Domains
- Add: `okapifind.com` and `www.okapifind.com`

**Google Maps:**
- Go to Google Cloud Console → APIs & Credentials
- Edit each Maps API key → Add HTTP referrers:
  - `https://okapifind.com/*`
  - `https://www.okapifind.com/*`

**Stripe:**
- Go to Stripe Dashboard → Developers → Webhooks
- Edit your webhook endpoint
- Update URL to: `https://okapifind.com/api/stripe-webhook`

---

## 🐛 Common Issues & Solutions

### Issue: Build fails in Vercel

**Solution:**
1. Check build logs in Vercel Dashboard → Deployments → Your deployment → Build Logs
2. Common causes:
   - Missing dependencies in `package.json`
   - TypeScript errors
   - Environment variables not properly set
3. Fix locally first, then push to trigger rebuild

### Issue: "Firebase not configured" error

**Solution:**
1. Verify all 7 `NEXT_PUBLIC_FIREBASE_*` variables are set in Vercel
2. Check they're set for all environments (Production, Preview, Development)
3. Redeploy after adding variables

### Issue: Maps not loading

**Solution:**
1. Check Google Maps API key is valid
2. Verify HTTP referrer restrictions include your Vercel domain
3. Enable required APIs in Google Cloud Console:
   - Maps JavaScript API
   - Places API
   - Directions API
   - Distance Matrix API
   - Geocoding API
4. Check billing is enabled

### Issue: Stripe webhook not working

**Solution:**
1. Verify `STRIPE_WEBHOOK_SECRET` is set in Vercel
2. Check webhook URL in Stripe Dashboard matches your deployment URL exactly
3. View webhook logs in Stripe Dashboard → Developers → Webhooks → Your endpoint

### Issue: Authentication fails

**Solution:**
1. Check Firebase authorized domains include your Vercel domain
2. Verify all Firebase env vars are correct (no typos)
3. Check browser console (F12) for specific error messages
4. Test in incognito mode

---

## 🎉 You're Live!

Your OkapiFind app is now live in production!

**Your deployment URL:** `https://your-app-name.vercel.app`

### What's Next?

1. **Test thoroughly** - Check all features work as expected
2. **Monitor logs** - Watch Vercel Dashboard for errors
3. **Share with users** - Get feedback
4. **Set up custom domain** - Follow Step 6 if needed

### Ongoing Maintenance

**Weekly:**
- Check Vercel deployment status
- Monitor API quota usage (Google Maps, Stripe)
- Review costs (Vercel, Firebase, Supabase)

**Monthly:**
- Update dependencies (`npm update`)
- Review security settings
- Analyze user feedback

---

## 📝 Environment Variables Quick Reference

**Total: 15 required variables** (11 base + 2 Stripe + 2 security)

### Required Variables (15)

| Variable | Value | Source |
|----------|-------|--------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | AIzaSyBBz1nwINWdmnKr13zutmBoEgwFD6XHAfg | Firebase Console |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | okapifind-e5b81.firebaseapp.com | Firebase Console |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | okapifind-e5b81 | Firebase Console |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | okapifind-e5b81.firebasestorage.app | Firebase Console |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | 897907860773 | Firebase Console |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | 1:897907860773:web:830b5654c6a20b8199e6cc | Firebase Console |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | G-GLP7PK7361 | Firebase Console |
| `NEXT_PUBLIC_SUPABASE_URL` | https://kmobwbqdtmbzdyysdxjx.supabase.co | Supabase Dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sb_publishable_LCRH55EAKXxEO-HAZko8XA_lwLi_NK9 | Supabase Dashboard |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | [your_maps_key_1] | Google Cloud Console |
| `NEXT_PUBLIC_OKAPIFIND_MAPS_KEY` | [your_maps_key_2] | Google Cloud Console |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | pk_live_... | Stripe Dashboard |
| `STRIPE_SECRET_KEY` | sk_live_... | Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | whsec_... | Stripe Dashboard (after webhook setup) |
| `ENCRYPTION_KEY` | 8f7a9b2c4d6e1f3a5b8c9d0e2f4a6b8c | Generated |
| `JWT_SECRET` | 3a7f9c2e5b8d1f4a6c9e2b5d8f1a4c7e | Generated |

---

## 📚 Additional Resources

- **Vercel Docs:** https://vercel.com/docs
- **Firebase Docs:** https://firebase.google.com/docs
- **Supabase Docs:** https://supabase.com/docs
- **Stripe Docs:** https://stripe.com/docs

---

**Need help?** Check the Common Issues section above or review Vercel deployment logs.