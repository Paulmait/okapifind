# 🔒 OkapiFind Critical Security & Launch Checklist

## 🚨 CRITICAL ITEMS YOU'RE MISSING

### 1. **API Key Security** ⚠️
**Problem**: Google and Vercel are warning about exposed keys
**Solution**:
```javascript
// NEVER put these in .env for frontend:
// ❌ STRIPE_SECRET_KEY
// ❌ SUPABASE_SERVICE_ROLE_KEY
// ❌ RESEND_API_KEY

// Instead, create Supabase Edge Functions:
// ✅ /functions/send-email (uses RESEND_API_KEY server-side)
// ✅ /functions/create-payment (uses STRIPE_SECRET_KEY server-side)
// ✅ /functions/admin-actions (uses SERVICE_ROLE_KEY server-side)
```

### 2. **Google Maps API Security** 🗺️
Go to Google Cloud Console → APIs & Services → Credentials
- **Android**: Restrict to SHA-1 fingerprint + package name
- **iOS**: Restrict to bundle ID: `com.okapi.find`
- **Web**: Restrict to domains: `okapifind.com`, `*.vercel.app`
- **Set Quotas**: Max 25,000 requests/day

### 3. **Supabase Row Level Security (RLS)** 🛡️
```sql
-- Enable RLS on all tables
ALTER TABLE parking_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own parking locations"
ON parking_locations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own parking locations"
ON parking_locations FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### 4. **Missing Critical Features** 📱

#### A. **Crash Reporting** (Sentry)
```typescript
// src/App.tsx
import * as Sentry from 'sentry-expo';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enableInExpoDevelopment: false,
  debug: false,
  environment: 'production',
  tracesSampleRate: 0.1, // 10% of transactions
});
```

#### B. **App Review Prompt** (Critical for growth)
```typescript
// After successful parking save (3rd time)
import * as StoreReview from 'expo-store-review';

if (await StoreReview.isAvailableAsync()) {
  StoreReview.requestReview();
}
```

#### C. **Analytics Events** (Revenue tracking)
```typescript
// Track these events:
analytics.track('subscription_started', {
  plan: 'plus',
  price: 2.99,
  period: 'monthly'
});

analytics.track('parking_saved', {
  method: 'automatic',
  has_photo: true
});

analytics.track('navigation_started', {
  distance: 150, // meters
  has_ar: false
});
```

#### D. **Push Notification Permission** (Day 3)
```typescript
// Don't ask immediately! Wait for right moment:
// - After 3rd parking save
// - When setting parking meter reminder
// - After 3 days of usage
```

### 5. **Revenue Protection** 💰

#### A. **Receipt Validation**
```typescript
// Never trust client-side subscription status
// Always verify with Stripe webhook:
const isValidSubscription = await verifyWithStripe(userId);
```

#### B. **Refund Policy**
- Apple: Must honor their refund policy
- Google: 48-hour refund window
- Stripe: Your 14-day policy

### 6. **Data Privacy Compliance** 📋

#### A. **Data Deletion**
```typescript
// Implement user data deletion within 30 days
async function deleteUserData(userId: string) {
  // Delete from Supabase
  await supabase.from('parking_locations').delete().eq('user_id', userId);
  await supabase.from('user_profiles').delete().eq('id', userId);

  // Delete from Stripe
  await stripe.customers.del(customerId);

  // Delete from Analytics
  await analytics.deleteUser(userId);
}
```

#### B. **Data Export (GDPR)**
```typescript
// User can request all their data
async function exportUserData(userId: string) {
  const data = {
    profile: await getUserProfile(userId),
    parkingHistory: await getParkingHistory(userId),
    subscriptions: await getSubscriptionHistory(userId),
  };

  return JSON.stringify(data, null, 2);
}
```

### 7. **App Store Requirements** 📱

#### A. **Apple App Store**
- [ ] Privacy Nutrition Label filled out
- [ ] App uses HTTPS only
- [ ] Sign in with Apple implemented
- [ ] Subscription descriptions clear
- [ ] Screenshots without status bar
- [ ] 5.5" and 6.5" screenshots

#### B. **Google Play Store**
- [ ] Data Safety form completed
- [ ] Target API level 33+
- [ ] 64-bit build
- [ ] App Bundle (.aab) not APK
- [ ] Content rating questionnaire

### 8. **Edge Cases to Handle** ⚠️

```typescript
// 1. No GPS signal
if (!location) {
  showManualParkingSave();
}

// 2. Offline mode
if (!isOnline) {
  saveToLocalStorage();
  syncWhenOnline();
}

// 3. Subscription expired during usage
if (subscriptionExpired && usingPremiumFeature) {
  gracefulDowngrade();
}

// 4. Multiple devices same account
syncAcrossDevices();

// 5. Time zone changes
useUTCforAllTimestamps();
```

### 9. **Server Infrastructure** 🖥️

#### Supabase Edge Functions Needed:
```typescript
// 1. /functions/stripe-webhook
export async function handler(req: Request) {
  const sig = req.headers.get('stripe-signature');
  const event = stripe.webhooks.constructEvent(
    await req.text(),
    sig,
    STRIPE_WEBHOOK_SECRET
  );
  // Handle subscription events
}

// 2. /functions/send-email
export async function handler(req: Request) {
  const { to, subject, html } = await req.json();
  await resend.emails.send({
    from: 'OkapiFind <noreply@okapifind.com>',
    to,
    subject,
    html,
  });
}

// 3. /functions/validate-receipt
export async function handler(req: Request) {
  // Validate Apple/Google receipts
}
```

### 10. **Launch Week Checklist** 🚀

#### Week Before Launch:
- [ ] Load test with 10,000 concurrent users
- [ ] Penetration testing on API
- [ ] Legal review of all documents
- [ ] App Store/Play Store review (can take 7 days)
- [ ] Customer support email ready
- [ ] Refund process documented

#### Launch Day:
- [ ] Monitor Sentry for crashes
- [ ] Watch Stripe for payment issues
- [ ] Check Supabase rate limits
- [ ] Have hotfix process ready
- [ ] Social media announcement ready

#### Post-Launch:
- [ ] Respond to reviews daily
- [ ] Fix crashes within 24 hours
- [ ] Weekly feature releases
- [ ] A/B test pricing
- [ ] Monitor churn rate

## 🎯 Revenue Optimization Tips

1. **Free Trial Conversion**:
   - Send email on day 5 of trial
   - Show feature comparison
   - Offer 20% off if they subscribe before trial ends

2. **Reduce Churn**:
   - Send "we miss you" email after 7 days inactive
   - Offer pause subscription instead of cancel
   - Win-back campaign: 50% off for 2 months

3. **Increase LTV**:
   - Upsell to yearly (show savings)
   - Family plan upgrade prompt
   - Referral rewards program

4. **Price Testing**:
   - A/B test $2.99 vs $3.99 for Plus
   - Test free trial length (7 vs 14 days)
   - Regional pricing for emerging markets

## 🔐 Security Contacts

- **Bug Bounty**: security@okapifind.com
- **GDPR Inquiries**: privacy@okapifind.com
- **Legal**: legal@okapifind.com
- **Abuse**: abuse@okapifind.com

## 🚨 Emergency Procedures

### If API Keys Leaked:
1. Rotate immediately in provider dashboard
2. Update Supabase Edge Functions
3. Force app update if needed
4. Audit logs for unauthorized usage

### If Data Breach:
1. Document everything
2. Notify users within 72 hours (GDPR)
3. Contact legal counsel
4. File with authorities if required
5. Offer identity protection services

### If Major Bug in Production:
1. Rollback using Expo Updates
2. Hotfix and test
3. Gradual rollout (10% → 50% → 100%)
4. Post-mortem within 48 hours

---

**Remember**: It's better to delay launch by a week than to launch with security vulnerabilities!