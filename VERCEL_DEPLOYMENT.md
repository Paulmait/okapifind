# 🚀 Vercel Deployment Guide for OkapiFind

## 📋 Prerequisites
- Vercel account (create at vercel.com)
- GitHub repository connected
- All environment variables ready

## 🔧 Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

## 🔑 Step 2: Add Environment Variables to Vercel

### Method A: Via Vercel Dashboard (Recommended)
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project "OkapiFind"
3. Go to Settings → Environment Variables
4. Add each variable from `.env.production`
5. Select scopes: Production, Preview, Development

### Method B: Via Vercel CLI
```bash
# Login to Vercel
vercel login

# Link your project
vercel link

# Add environment variables (run for each variable)
vercel env add MASTER_ENCRYPTION_KEY production
vercel env add JWT_SECRET production
vercel env add DATABASE_URL production
# ... repeat for all variables
```

### Method C: Bulk Import
```bash
# Generate secrets first
node scripts/generate-secrets.js

# Import all at once
vercel env pull .env.production
```

## 🎯 Step 3: Critical Environment Variables (MUST ADD)

### Security Keys (Generate with script)
```bash
MASTER_ENCRYPTION_KEY=
JWT_SECRET=
JWT_REFRESH_SECRET=
SESSION_SECRET=
CSRF_SECRET=
AUDIT_ENCRYPTION_KEY=
```

### Database (Supabase)
```bash
DATABASE_URL=postgresql://[USER]:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
SUPABASE_URL=https://[PROJECT].supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
```

### Redis Cache
```bash
REDIS_HOST=your-redis-host.com
REDIS_PASSWORD=
REDIS_HOST_1=redis-1.okapifind.com
REDIS_HOST_2=redis-2.okapifind.com
REDIS_HOST_3=redis-3.okapifind.com
```

### CloudFlare (DDoS Protection)
```bash
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_API_KEY=
CLOUDFLARE_EMAIL=admin@okapifind.com
```

### Maps
```bash
MAPBOX_ACCESS_TOKEN=pk.xxx
GOOGLE_MAPS_API_KEY=AIza...
```

### Email (Resend)
```bash
RESEND_API_KEY=re_xxx
RESEND_DOMAIN=mail.okapifind.com
```

### Payments (Stripe)
```bash
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Monitoring (Sentry)
```bash
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=
```

## 📦 Step 4: Configure Vercel Project

### vercel.json (already created)
```json
{
  "name": "okapifind",
  "builds": [
    {
      "src": "api/**/*.ts",
      "use": "@vercel/node"
    },
    {
      "src": "package.json",
      "use": "@vercel/static-build"
    }
  ],
  "env": {
    // Environment variables mapping
  }
}
```

## 🏗 Step 5: Deploy to Vercel

### Production Deployment
```bash
# Deploy to production
vercel --prod

# Or push to main branch (auto-deploy)
git push origin main
```

### Preview Deployment
```bash
# Deploy preview
vercel

# Or push to any branch
git push origin feature-branch
```

## 🔒 Step 6: Set Up Security Features

### 1. Enable CloudFlare Protection
1. Add your domain to CloudFlare
2. Update nameservers
3. Enable "Under Attack Mode" if needed
4. Configure WAF rules

### 2. Configure Rate Limiting
Environment variables already set:
- RATE_LIMIT_GLOBAL=100
- RATE_LIMIT_API=30
- RATE_LIMIT_AUTH=5

### 3. Set Up Monitoring
1. Create Sentry project
2. Add SENTRY_DSN to environment
3. Enable error tracking

## 🗄 Step 7: Initialize Database

### Run Supabase Migrations
```sql
-- Connect to Supabase SQL Editor
-- Run the migration file: supabase/migrations/001_security_setup.sql
```

### Generate Database Keys
```bash
# Run in Supabase SQL Editor
ALTER DATABASE postgres SET "app.jwt_secret" TO 'YOUR_JWT_SECRET';
ALTER DATABASE postgres SET "app.encryption_key" TO 'YOUR_ENCRYPTION_KEY';
```

## ✅ Step 8: Verify Deployment

### Check Application
```bash
# Your app URLs
Production: https://okapifind.vercel.app
Preview: https://okapifind-git-[branch].vercel.app
```

### Test Security Headers
```bash
curl -I https://okapifind.vercel.app
```

Should see:
- Strict-Transport-Security
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Content-Security-Policy

### Test API Endpoints
```bash
# Test health check
curl https://okapifind.vercel.app/api/health

# Test rate limiting
for i in {1..10}; do curl https://okapifind.vercel.app/api/test; done
```

## 🚨 Step 9: Post-Deployment Checklist

- [ ] All environment variables added
- [ ] Database migrations completed
- [ ] Redis cache connected
- [ ] CloudFlare configured
- [ ] SSL certificate active
- [ ] 2FA enabled for admin accounts
- [ ] Monitoring active (Sentry)
- [ ] Backups configured
- [ ] Rate limiting working
- [ ] Security headers present

## 🔄 Step 10: Continuous Deployment

### GitHub Integration
```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

## 📊 Monitoring & Maintenance

### Daily Tasks
- Check error logs in Sentry
- Monitor API response times
- Review security alerts

### Weekly Tasks
- Review audit logs
- Check backup integrity
- Update dependencies

### Monthly Tasks
- Rotate encryption keys
- Security audit
- Performance review

## 🆘 Troubleshooting

### Environment Variables Not Loading
```bash
# Pull from Vercel
vercel env pull

# Check current variables
vercel env ls
```

### Build Failures
```bash
# Check build logs
vercel logs

# Clear cache and rebuild
vercel --force
```

### Database Connection Issues
- Verify DATABASE_URL format
- Check SSL requirements
- Confirm IP whitelisting

## 📞 Support

- Vercel Support: support@vercel.com
- CloudFlare: support.cloudflare.com
- Supabase: support@supabase.io

## 🎉 Launch Checklist

### Pre-Launch
- [ ] Security audit completed
- [ ] Load testing performed
- [ ] Backup system tested
- [ ] SSL certificates valid
- [ ] Monitoring alerts configured

### Launch Day
- [ ] Enable CloudFlare protection
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify all endpoints

### Post-Launch
- [ ] Monitor user feedback
- [ ] Track performance metrics
- [ ] Review security logs
- [ ] Optimize based on usage

---

## 🔐 Security Reminders

1. **NEVER** commit `.env` files to Git
2. **ALWAYS** use production values in Vercel
3. **ROTATE** keys monthly
4. **MONITOR** security alerts daily
5. **BACKUP** data continuously

Your app is now deployed with Fort Knox-level security! 🚀🔒