# OkapiFind - Vercel Quick Deploy Guide

## 🚀 Fast Track Deployment (5 Minutes)

### Prerequisites
- Vercel account (free tier works)
- Firebase project configured
- Supabase project configured
- Google Maps API key

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Configure Environment Variables

Copy your environment variables from `OkapiFind/.env.local`:

**Required Variables (10):**
```bash
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

### Step 3: Deploy

**Option A: Automated Script (Recommended)**
```bash
# Make script executable
chmod +x scripts/setup-vercel-env.sh

# Run setup script
./scripts/setup-vercel-env.sh

# Deploy
vercel --prod
```

**Option B: Manual Deployment**
```bash
# Login to Vercel
vercel login

# Link project (first time only)
vercel link

# Add environment variables via dashboard
# Go to: https://vercel.com/dashboard > Your Project > Settings > Environment Variables

# Deploy
vercel --prod
```

### Step 4: Configure Environment in Vercel Dashboard

1. Go to your project in Vercel Dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add all `EXPO_PUBLIC_*` variables for **Production** environment
4. Click **Save**

### Step 5: Trigger Deployment

```bash
# Production deployment
vercel --prod

# Or push to main branch if GitHub integration is enabled
git push origin main
```

## 📱 Mobile & Web Seamless Experience

Your deployment includes:

✅ **Cross-Platform Sync**
- Real-time data sync between mobile and web
- Offline queue for changes
- Automatic conflict resolution

✅ **Smart Platform Detection**
- Automatic mobile app promotion for web users
- Deep linking between web and mobile apps
- Consistent UI/UX across platforms

✅ **Performance Optimizations**
- Service worker for offline support
- Code splitting and lazy loading
- Optimized bundle sizes
- CDN caching

## 🔧 Post-Deployment

### Verify Deployment
```bash
# Check deployment status
vercel ls

# View logs
vercel logs <deployment-url>

# Test production URL
curl https://your-app.vercel.app
```

### Set Custom Domain (Optional)
```bash
vercel domains add yourdomain.com
```

### Enable Analytics (Optional)
```bash
vercel analytics enable
```

## 🎯 Testing the Web App

### Test Locally First
```bash
cd OkapiFind
npm run build:web
npx serve web-build
```

Visit http://localhost:3000 to test

### Test Mobile App Integration

1. Open web app on mobile browser
2. See mobile app download prompt
3. Install mobile app
4. Data syncs automatically between web and mobile

## 🔍 Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
cd OkapiFind
rm -rf web-build node_modules/.cache
npm run build:web
```

### Environment Variables Not Working
- Ensure all vars start with `EXPO_PUBLIC_` for client-side access
- Check Vercel dashboard for proper environment selection
- Redeploy after adding new variables

### App Shows Config Error
- Check browser console (F12) for missing variables
- Verify Firebase and Supabase credentials
- Ensure API keys are valid and not restricted

## 📊 Performance Checklist

- [ ] All critical environment variables configured
- [ ] Build completes without errors
- [ ] Service worker registered (check DevTools)
- [ ] Static assets cached (check Network tab)
- [ ] Mobile app promotion shows on web
- [ ] Cross-platform sync working
- [ ] Maps loading correctly
- [ ] Firebase auth working
- [ ] API calls successful

## 🚨 Security Reminders

✅ **Safe to expose (EXPO_PUBLIC_*):**
- Firebase client config
- Supabase anon key
- Google Maps API key (with restrictions)
- Mapbox public token

❌ **Never expose:**
- Supabase service role key
- Firebase admin SDK
- Stripe secret key
- Any `_SECRET` or `_PRIVATE` keys

## 📈 Monitoring

After deployment, monitor:

1. **Vercel Analytics** - Page views, performance
2. **Firebase Console** - Auth usage, errors
3. **Supabase Dashboard** - Database queries, storage
4. **Sentry** (if configured) - Error tracking

## 🎉 Success!

Your OkapiFind web app is now live! Users can:

1. Access via browser at your Vercel URL
2. Install as PWA (Progressive Web App)
3. Sync seamlessly with mobile app
4. Use offline with service worker
5. Get prompted to download mobile app for full features

## 📞 Need Help?

- Check deployment logs: `vercel logs`
- View build output in Vercel dashboard
- Check browser console for client errors
- Review environment variables in Vercel settings

## 🔄 Continuous Deployment

### GitHub Integration (Recommended)
1. Connect GitHub repo in Vercel dashboard
2. Enable automatic deployments
3. Every push to `main` = production deploy
4. Pull requests get preview deployments

### Manual Deployments
```bash
# Production
vercel --prod

# Preview
vercel
```

---

**Built with:** Expo Web + React Native Web + Vercel
**Deploy Time:** ~3-5 minutes
**Build Time:** ~2-3 minutes

🎯 Your seamless mobile & web experience is ready!
