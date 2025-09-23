# OkapiFind Stripe Pricing Strategy

## Recommended Pricing Tiers

### 1. **Free Tier** (Freemium Model)
- **Price**: $0/month
- **Features**:
  - Save 1 parking location at a time
  - Basic navigation back to car
  - Manual parking save only
  - Standard map view
  - 7-day parking history
- **Stripe Product ID**: `prod_free` (no payment required)

### 2. **OkapiFind Plus** (Most Popular)
- **Price**: $2.99/month or $29.99/year (17% discount)
- **Features**:
  - Unlimited parking saves
  - Automatic parking detection
  - 30-day parking history
  - Photo notes for parking spots
  - Voice navigation
  - Share parking location
  - No ads
  - Widget support
- **Stripe Price IDs**:
  - Monthly: `price_plus_monthly`
  - Yearly: `price_plus_yearly`

### 3. **OkapiFind Pro** (Power Users)
- **Price**: $4.99/month or $49.99/year (17% discount)
- **Features**:
  - Everything in Plus
  - Unlimited parking history
  - AR navigation (iOS)
  - Multi-car support (up to 5 cars)
  - Parking meter reminders
  - Export parking data
  - Priority support
  - Early access to new features
- **Stripe Price IDs**:
  - Monthly: `price_pro_monthly`
  - Yearly: `price_pro_yearly`

### 4. **Family Plan** (Best Value)
- **Price**: $7.99/month or $79.99/year
- **Features**:
  - All Pro features
  - Up to 6 family members
  - Shared parking locations
  - Family car tracking
  - Centralized billing
- **Stripe Price IDs**:
  - Monthly: `price_family_monthly`
  - Yearly: `price_family_yearly`

## Stripe Setup Commands

```javascript
// Create products in Stripe Dashboard or via API:

// 1. OkapiFind Plus
stripe.products.create({
  name: 'OkapiFind Plus',
  description: 'Never lose your car with automatic parking detection',
  metadata: {
    tier: 'plus',
    features: 'unlimited_saves,auto_detect,photo_notes,voice_nav'
  }
});

// 2. Plus Monthly Price
stripe.prices.create({
  product: 'prod_xxxxx', // Your Plus product ID
  unit_amount: 299, // $2.99 in cents
  currency: 'usd',
  recurring: {
    interval: 'month'
  },
  metadata: {
    tier: 'plus',
    period: 'monthly'
  }
});

// 3. Plus Yearly Price
stripe.prices.create({
  product: 'prod_xxxxx', // Your Plus product ID
  unit_amount: 2999, // $29.99 in cents
  currency: 'usd',
  recurring: {
    interval: 'year'
  },
  metadata: {
    tier: 'plus',
    period: 'yearly',
    savings: '17_percent'
  }
});
```

## Revenue Projections

### Conservative Scenario (Year 1)
- 100,000 downloads
- 2% conversion to paid (2,000 users)
- 70% choose Plus, 20% Pro, 10% Family
- Monthly Revenue: ~$7,000
- Annual Revenue: ~$84,000

### Realistic Scenario (Year 2)
- 500,000 total downloads
- 3% conversion to paid (15,000 users)
- Distribution: 60% Plus, 25% Pro, 15% Family
- Monthly Revenue: ~$55,000
- Annual Revenue: ~$660,000

### Optimistic Scenario (Year 3)
- 1,000,000+ downloads
- 5% conversion (50,000 users)
- Monthly Revenue: ~$200,000
- Annual Revenue: ~$2.4M

## Trial Period Strategy

- **7-day free trial** for all paid tiers
- No credit card required for free tier
- Auto-convert to paid after trial
- Grace period of 3 days for payment issues

## Promotional Strategies

1. **Launch Offer**: 50% off first 3 months
2. **Referral Program**: Give 1 month free, get 1 month free
3. **Seasonal**: Black Friday - 40% off yearly plans
4. **Student Discount**: 20% off with .edu email
5. **Early Bird**: Lifetime 30% off for first 1000 users

## Implementation Checklist

- [ ] Create products in Stripe Dashboard
- [ ] Set up webhook endpoints in Supabase
- [ ] Implement subscription management UI
- [ ] Add receipt validation
- [ ] Set up dunning emails for failed payments
- [ ] Configure tax settings (Stripe Tax)
- [ ] Enable SCA/3D Secure for EU customers
- [ ] Set up refund policy (14-day money back)
- [ ] Add subscription analytics tracking