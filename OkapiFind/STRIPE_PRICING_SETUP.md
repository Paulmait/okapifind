# OkapiFind Pricing Setup (All Platforms)

> **Uniform Pricing**: These prices are identical across iOS (RevenueCat/App Store), Android (RevenueCat/Play Store), and Web (Stripe).

## v1.0 MVP Pricing Structure

### 1. **Free Tier**
- **Price**: $0
- **Features**:
  - 5 parking saves per month
  - Basic compass navigation back to car
  - Manual parking save only
  - Standard map view

### 2. **Premium Monthly**
- **Price**: $2.99/month
- **RevenueCat Product ID**: `okapifind_premium_monthly`
- **Stripe Price ID**: `price_okapifind_monthly`
- **App Store Product ID**: `com.okapi.find.premium.monthly`
- **Features**:
  - Unlimited parking saves
  - Photo notes for parking spots
  - Parking history (all previous spots)
  - Safety sharing (share location link)
  - Priority email support

### 3. **Premium Annual** (Best Value)
- **Price**: $19.99/year (44% savings vs monthly)
- **RevenueCat Product ID**: `okapifind_premium_annual`
- **Stripe Price ID**: `price_okapifind_annual`
- **App Store Product ID**: `com.okapi.find.premium.annual`
- **Features**: Same as Premium Monthly
- **Savings Badge**: "Save 44%"

### 4. **Lifetime Access**
- **Price**: $39.99 one-time
- **RevenueCat Product ID**: `okapifind_premium_lifetime`
- **Stripe Price ID**: `price_okapifind_lifetime`
- **App Store Product ID**: `com.okapi.find.premium.lifetime`
- **Features**: All premium features, forever
- **Type**: One-time purchase (non-recurring)

---

## Platform Setup Instructions

### RevenueCat Setup (iOS & Android)

1. **Create Products in App Store Connect / Google Play Console**
   - Monthly: `com.okapi.find.premium.monthly` - $2.99
   - Annual: `com.okapi.find.premium.annual` - $19.99
   - Lifetime: `com.okapi.find.premium.lifetime` - $39.99

2. **Configure RevenueCat Dashboard**
   - Create Entitlement: `premium`
   - Create Products and link to store products
   - Create Offering: `default`
   - Add packages: Monthly, Annual, Lifetime

3. **Environment Variables**
   ```env
   EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_xxxxxxxxxx
   EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_xxxxxxxxxx
   ```

### Stripe Setup (Web)

```javascript
// Create the main product
const product = await stripe.products.create({
  name: 'OkapiFind Premium',
  description: 'Never lose your car again with unlimited parking saves',
  metadata: {
    app: 'okapifind',
    tier: 'premium',
  }
});

// Monthly Price - $2.99
await stripe.prices.create({
  product: product.id,
  unit_amount: 299, // $2.99 in cents
  currency: 'usd',
  recurring: { interval: 'month' },
  lookup_key: 'okapifind_monthly',
  metadata: {
    tier: 'premium',
    period: 'monthly',
  }
});

// Annual Price - $19.99
await stripe.prices.create({
  product: product.id,
  unit_amount: 1999, // $19.99 in cents
  currency: 'usd',
  recurring: { interval: 'year' },
  lookup_key: 'okapifind_annual',
  metadata: {
    tier: 'premium',
    period: 'annual',
    savings_percent: '44',
  }
});

// Lifetime Price - $39.99 (one-time)
const lifetimeProduct = await stripe.products.create({
  name: 'OkapiFind Lifetime',
  description: 'One-time payment for lifetime premium access',
  metadata: {
    app: 'okapifind',
    tier: 'lifetime',
  }
});

await stripe.prices.create({
  product: lifetimeProduct.id,
  unit_amount: 3999, // $39.99 in cents
  currency: 'usd',
  lookup_key: 'okapifind_lifetime',
  metadata: {
    tier: 'lifetime',
    period: 'once',
  }
});
```

**Environment Variables**
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL=price_...
STRIPE_PRICE_LIFETIME=price_...
```

---

## Pricing Comparison Table

| Plan | iOS | Android | Web |
|------|-----|---------|-----|
| Monthly | $2.99/mo | $2.99/mo | $2.99/mo |
| Annual | $19.99/yr | $19.99/yr | $19.99/yr |
| Lifetime | $39.99 | $39.99 | $39.99 |

---

## Entitlements

All platforms use the same entitlement ID: `premium`

When a user subscribes via any platform:
1. The entitlement `premium` is granted
2. Cross-platform sync is handled by RevenueCat (mobile) or Supabase (web)
3. User ID must be consistent across platforms

---

## Growth Strategy & Feature Roadmap

### v1.0 (Current) - Core MVP
**Price**: $2.99/mo | $19.99/yr | $39.99 lifetime

**Features included**:
- Unlimited parking saves
- Photo notes
- Parking history
- Safety sharing (basic link sharing)
- Priority email support

### v1.5 (Planned) - Enhanced Features
**Price increase**: $3.99/mo | $24.99/yr | $49.99 lifetime (new users only)

**New features to add**:
- OCR parking sign scanner with automatic timer
- Offline maps (cached tiles)
- Enhanced voice-guided navigation

### v2.0 (Future) - Pro Tier
**Consider adding Pro tier**: $5.99/mo | $39.99/yr | $79.99 lifetime

**Pro-exclusive features**:
- Family sharing (up to 5 members)
- Auto-parking detection
- Smart parking predictions
- Multi-vehicle support
- API access

### Grandfathering Policy
- Existing subscribers keep their original price forever
- Price increases only affect new subscribers
- Lifetime purchases include all future features at no extra cost
- This creates loyal advocates and positive word-of-mouth

---

## Testing

### Stripe Test Mode
Use test card numbers:
- Success: `4242 4242 4242 4242`
- Declined: `4000 0000 0000 0002`
- Requires authentication: `4000 0025 0000 3155`

### RevenueCat Sandbox
- iOS: Use Sandbox Apple ID
- Android: Use license testers in Play Console

---

## Implementation Checklist

### App Store Connect (iOS)
- [ ] Create auto-renewable subscription group
- [ ] Add monthly product ($2.99)
- [ ] Add annual product ($19.99)
- [ ] Add non-consumable lifetime product ($39.99)
- [ ] Submit for review

### Google Play Console (Android)
- [ ] Create subscription products
- [ ] Add monthly ($2.99)
- [ ] Add annual ($19.99)
- [ ] Add one-time lifetime ($39.99)
- [ ] Configure license testers

### RevenueCat Dashboard
- [ ] Create `premium` entitlement
- [ ] Link iOS products
- [ ] Link Android products
- [ ] Create `default` offering
- [ ] Configure webhooks (optional)

### Stripe Dashboard
- [ ] Create products in test mode
- [ ] Create prices matching structure above
- [ ] Set up webhook endpoint
- [ ] Test checkout flow
- [ ] Switch to live mode for production

### Code Updates
- [x] Update PaywallScreen with v1.0 features
- [x] Update pricing documentation
- [ ] Test purchase flow on iOS
- [ ] Test purchase flow on Android
- [ ] Test Stripe checkout on web
