# Vercel Deployment Troubleshooting Guide

## ✅ Issue: "require is not defined" Error

### Problem:
```
Uncaught ReferenceError: require is not defined
at useFrameSize.tsx:17
```

### Root Cause:
Vercel was serving a cached build that didn't have the patch-package fixes applied.

### Solution Applied:
1. **Updated vercel.json** to clear cache before each build:
   ```json
   {
     "buildCommand": "cd OkapiFind && rm -rf node_modules/.cache web-build && npm install --legacy-peer-deps && npm run build:web"
   }
   ```

2. **Ensured patch-package runs** before webpack build
3. **Excluded server-only modules** from web bundle

### How to Verify Fix:
1. Wait 2-3 minutes for Vercel deployment
2. Visit https://okapifind.com
3. Open DevTools (F12) → Console tab
4. Should see:
   ```
   🚀 OkapiFind starting...
   ✅ React mounted successfully
   ```
5. NO errors about "require is not defined"

---

## 🔍 Common Vercel Issues & Solutions

### Issue 1: Build Fails with "Cannot find module"
**Solution:** Check `package.json` dependencies
```bash
cd OkapiFind
npm install --legacy-peer-deps
npm run build:web
```

### Issue 2: Environment Variables Not Working
**Solution:** Set in Vercel Dashboard
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add all `EXPO_PUBLIC_*` variables
3. Select "Production" environment
4. Redeploy

### Issue 3: Old Build Cached
**Solution:** Force fresh build
```bash
# Option 1: Clear cache in vercel.json (already done)
"buildCommand": "rm -rf node_modules/.cache web-build && ..."

# Option 2: Trigger redeploy
git commit --allow-empty -m "Force rebuild"
git push origin main

# Option 3: In Vercel Dashboard
Go to Deployments → Latest → "Redeploy"
```

### Issue 4: Patches Not Applied
**Solution:** Verify patch-package runs
```bash
# Check package.json has postinstall script
"postinstall": "patch-package"

# Verify patches directory exists
ls OkapiFind/patches

# Test patches locally
cd OkapiFind
npm install --legacy-peer-deps
npm run postinstall
```

### Issue 5: Bundle Too Large (>50MB)
**Solution:** Code splitting and tree shaking
- Already implemented in webpack.config.js
- Vendor bundle separated
- Service worker handles large files

---

## 📊 Deployment Status Checks

### Check 1: View Deployments
```bash
vercel ls
```

### Check 2: View Logs
```bash
vercel logs
```

### Check 3: Check Build Output
```bash
# In Vercel Dashboard
Go to Deployments → Latest → Build Logs
Look for:
  ✔ patch-package applied
  ✔ expo export:web success
  ✔ Build completed
```

### Check 4: Test Production URL
```bash
curl -I https://okapifind.com
# Should return 200 OK
```

---

## 🚀 Manual Deploy Steps

If automatic deployment fails, deploy manually:

```bash
# 1. Clean local build
cd OkapiFind
rm -rf web-build node_modules/.cache
npm install --legacy-peer-deps
npm run build:web

# 2. Test locally
npx serve web-build
# Visit http://localhost:3000

# 3. Deploy to Vercel
vercel --prod
```

---

## 🔧 Vercel Configuration

### Current Setup:
```json
{
  "buildCommand": "cd OkapiFind && rm -rf node_modules/.cache web-build && npm install --legacy-peer-deps && npm run build:web",
  "outputDirectory": "OkapiFind/web-build",
  "installCommand": "echo 'Skipping root install'",
  "framework": null,
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/service-worker.js",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }]
    },
    {
      "source": "/static/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
```

### Environment Variables Required:
```
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
```

---

## ✅ Success Criteria

After deployment, verify:

1. **Build Succeeds**
   - ✅ No build errors in logs
   - ✅ patch-package applied successfully
   - ✅ web-build/ directory created
   - ✅ index.html, static/js/*.js files present

2. **App Loads**
   - ✅ Page loads in <3 seconds
   - ✅ No console errors
   - ✅ React mounts successfully
   - ✅ Firebase initializes

3. **Features Work**
   - ✅ Map loads (with location permission)
   - ✅ Authentication flows work
   - ✅ Can save parking location
   - ✅ Mobile app promotion shows
   - ✅ PWA install prompt appears

---

## 🆘 Emergency Rollback

If deployment breaks production:

### Option 1: Revert in Vercel Dashboard
1. Go to Deployments
2. Find last working deployment
3. Click "..." → "Promote to Production"

### Option 2: Revert Git Commit
```bash
git revert HEAD
git push origin main
```

### Option 3: Redeploy Previous Commit
```bash
git reset --hard <previous-commit-hash>
git push --force origin main
```

---

## 📞 Support

**Deployment Failing?**
1. Check Vercel build logs
2. Test build locally first
3. Verify environment variables set
4. Check git commit message for changes
5. Review this troubleshooting guide

**Still Stuck?**
- Check: `vercel logs` for detailed error messages
- Test: `npm run build:web` locally
- Verify: patches applied with `ls OkapiFind/patches`

---

**Last Updated:** October 1, 2025
**Current Fix:** Cache clearing in vercel.json
**Status:** ✅ Deployed with fix
