# OkapiFind Supabase Backend

Production-grade backend for the OkapiFind parking app built with Supabase.

## 🚀 Quick Start

### 1. Setup Supabase Project

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Initialize project (if not already done)
supabase init

# Link to your Supabase project
supabase link --project-ref your-project-ref
```

### 2. Run Migrations

```bash
# Apply database schema
supabase db push migrations/001_initial_schema.sql

# Setup storage buckets
supabase db push storage-setup.sql
```

### 3. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy revenuecat-webhook
supabase functions deploy signed-upload
supabase functions deploy start-share
supabase functions deploy cron-reminders

# Deploy secure API proxy functions (API keys stay server-side)
supabase functions deploy google-maps-proxy
supabase functions deploy gemini-proxy
supabase functions deploy secure-config

# Set function secrets (REQUIRED - get these from respective dashboards)
supabase secrets set REVENUECAT_WEBHOOK_SECRET=your-secret
supabase secrets set CRON_SECRET=your-cron-secret
supabase secrets set PUBLIC_SITE_URL=https://okapifind.com

# CRITICAL: Set API keys for secure proxies (these NEVER go to client)
supabase secrets set GOOGLE_MAPS_API_KEY=your-google-maps-api-key
supabase secrets set GEMINI_API_KEY=your-gemini-api-key
```

### API Key Security

The following API keys are secured via Edge Functions and NEVER exposed to the client:
- `GOOGLE_MAPS_API_KEY` - Used by `google-maps-proxy` for directions, geocoding, places
- `GEMINI_API_KEY` - Used by `gemini-proxy` for parking sign/meter AI analysis

Client apps call these Edge Functions with their Supabase auth token. The Edge Functions:
1. Verify the user is authenticated
2. Make the API call with the secret key
3. Return results to the client
4. Log usage for analytics

### 4. Configure Cron Job

In Supabase Dashboard → SQL Editor:

```sql
-- Schedule timer reminders to run every minute
SELECT cron.schedule(
  'check-parking-timers',
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/cron-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
    )
  );
  $$
);
```

## 📊 Database Schema

### Core Tables

- **profiles** - User profiles (1:1 with auth.users)
- **user_settings** - User preferences (units, premium status)
- **devices** - Push notification tokens
- **vehicles** - User's vehicles
- **parking_sessions** - Parking location history
- **meter_photos** - Parking meter photos with OCR
- **timers** - Parking expiry notifications
- **safety_shares** - Live location sharing sessions
- **share_locations** - Location updates for safety shares
- **subscriptions** - RevenueCat subscription data
- **analytics_events** - Event tracking

### Key Features

- **PostGIS** for spatial queries (finding nearby parking)
- **Row Level Security** (RLS) for data isolation
- **Realtime** subscriptions for live updates
- **Storage** for meter photos with signed URLs
- **Edge Functions** for webhooks and background tasks

## 🔐 Security

### Row Level Security (RLS)

All tables have RLS enabled with policies ensuring:
- Users can only access their own data
- Session-linked data validated through joins
- Public share viewing only via Edge Functions

### Storage Security

- `meter-photos` bucket is private
- Access only via signed URLs
- User folder structure enforced

### API Security

- Edge Functions use Bearer token auth
- RevenueCat webhook validates secret
- Cron jobs use separate secret

## 📱 Client Integration

### Initialize Client

```typescript
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
    }
  }
)
```

### Example: Create Parking Session

```typescript
// Save parking location
const sessionId = await createParkingSession(
  location,
  {
    source: 'manual',
    notes: 'Level 2, near elevator',
    address: '123 Main St'
  }
)

// Upload meter photo
const photo = await uploadMeterPhoto(
  sessionId,
  imageUri,
  {
    text: '2 HOUR PARKING',
    expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000)
  }
)

// Set timer
const timerId = await setParkingTimer(
  sessionId,
  new Date(Date.now() + 110 * 60 * 1000), // 1:50 from now
  10 // 10 minute buffer
)
```

### Example: Safety Mode

```typescript
// Start sharing
const share = await startSafetyShare(sessionId, 120)

// Share link via SMS/WhatsApp
const message = `Track my walk: ${share.share_url}`

// Update location every 10 seconds
const interval = setInterval(async () => {
  const location = await Location.getCurrentPositionAsync()
  await updateShareLocation(share.share_id, location)
}, 10000)

// Stop sharing
await endSafetyShare(share.share_id)
clearInterval(interval)
```

## 🔧 Environment Variables

### Supabase Project

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

### Edge Functions

```env
REVENUECAT_WEBHOOK_SECRET=your-webhook-secret
CRON_SECRET=your-cron-secret
PUBLIC_SITE_URL=https://okapifind.com
```

### Client (Expo)

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 📈 Performance Optimizations

### Indexes

- **GIST** index on `car_point` for spatial queries
- **B-tree** on `(user_id, is_active)` for active sessions
- **B-tree** on `(status, notify_at)` for timer queries

### Query Optimization

- Use `rpc` functions for complex operations
- Leverage PostGIS for distance calculations
- Batch operations where possible

### Caching

- Signed URLs cached for 1 hour
- User settings cached in client
- Active session cached locally

## 🚦 Monitoring

### Key Metrics

- Timer notification delivery rate
- Safety share usage
- Photo upload success rate
- Subscription sync accuracy

### Alerts

Set up alerts for:
- Failed timer notifications
- Expired shares not cleaned
- Storage quota usage
- Function execution errors

## 🔄 Backup & Recovery

```bash
# Backup database
supabase db dump -f backup.sql

# Restore database
supabase db restore -f backup.sql

# Export storage
supabase storage download meter-photos
```

## 📝 Maintenance Tasks

### Daily

- Check cron job execution
- Monitor storage usage
- Review error logs

### Weekly

- Clean expired shares
- Archive old sessions
- Update analytics dashboard

### Monthly

- Review RLS policies
- Optimize slow queries
- Update Edge Function dependencies

## 🆘 Troubleshooting

### Common Issues

1. **Timer not firing**
   - Check cron job status
   - Verify expo_push_token exists
   - Check timer status is 'scheduled'

2. **Photo upload fails**
   - Verify session ownership
   - Check storage quota
   - Validate file size/type

3. **Safety share not updating**
   - Check share expiry
   - Verify user premium status
   - Check realtime subscription

### Debug Queries

```sql
-- Check active timers
SELECT * FROM timers
WHERE status = 'scheduled'
AND notify_at <= NOW()
ORDER BY notify_at;

-- Check user's active session
SELECT * FROM parking_sessions
WHERE user_id = 'user-uuid'
AND is_active = true;

-- Check share locations
SELECT * FROM share_locations
WHERE share_id = 'share-uuid'
ORDER BY recorded_at DESC
LIMIT 10;
```

## 📚 Resources

- [Supabase Docs](https://supabase.com/docs)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
- [RevenueCat Webhooks](https://www.revenuecat.com/docs/webhooks)

## 🏆 Production Checklist

- [ ] Enable RLS on all tables
- [ ] Set up storage policies
- [ ] Configure auth providers
- [ ] Deploy Edge Functions
- [ ] Set environment secrets
- [ ] Configure cron jobs
- [ ] Set up monitoring
- [ ] Enable backups
- [ ] Configure rate limiting
- [ ] Set up error alerting

---

Built with ❤️ for OkapiFind by a Senior Full-Stack Engineer