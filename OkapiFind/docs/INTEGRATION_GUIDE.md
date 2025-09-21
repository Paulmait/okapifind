# OkapiFind Integration Guide

## 🔗 Supabase Edge Functions Integration

Your Supabase Edge Functions are deployed and ready at:

### Function Endpoints

1. **RevenueCat Webhook**
   - URL: `https://kmobwbqdtmbzdyysdxjx.supabase.co/functions/v1/revenuecat-webhook`
   - Purpose: Syncs subscription status from RevenueCat
   - Auth: Bearer token (set in RevenueCat webhook settings)

2. **Signed Upload**
   - URL: `https://kmobwbqdtmbzdyysdxjx.supabase.co/functions/v1/signed-upload`
   - Purpose: Generate secure upload URLs for meter photos
   - Auth: Supabase user token

3. **Start Share**
   - URL: `https://kmobwbqdtmbzdyysdxjx.supabase.co/functions/v1/start-share`
   - Purpose: Create safety sharing sessions
   - Auth: Supabase user token
   - Public endpoint: `/view?token={share_token}` (no auth required)

## 🔧 Setup Steps

### 1. Configure RevenueCat Webhook

In RevenueCat Dashboard:
1. Go to Project Settings → Integrations → Webhooks
2. Add webhook URL: `https://kmobwbqdtmbzdyysdxjx.supabase.co/functions/v1/revenuecat-webhook`
3. Set Authorization header: `Bearer YOUR_WEBHOOK_SECRET`
4. Select events: All subscription events

In Supabase Dashboard:
```sql
-- Set the webhook secret
SELECT vault.create_secret('REVENUECAT_WEBHOOK_SECRET', 'your-secret-here');
```

### 2. Configure Environment Variables

Update your `.env` file:
```env
EXPO_PUBLIC_SUPABASE_URL=https://kmobwbqdtmbzdyysdxjx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Test Edge Functions

#### Test Signed Upload
```typescript
const response = await supabase.functions.invoke('signed-upload', {
  body: {
    session_id: 'test-session-id',
    content_type: 'image/jpeg'
  }
});
console.log('Upload URL:', response.data.upload_url);
```

#### Test Start Share
```typescript
const response = await supabase.functions.invoke('start-share', {
  body: {
    session_id: 'test-session-id',
    expires_in: 120
  }
});
console.log('Share URL:', response.data.share_url);
```

### 4. Setup Cron Job for Timers

In Supabase SQL Editor:
```sql
-- Install pg_cron extension (if not already installed)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the cron secret
SELECT vault.create_secret('CRON_SECRET', 'your-cron-secret-here');

-- Schedule timer checks every minute
SELECT cron.schedule(
  'check-parking-timers',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kmobwbqdtmbzdyysdxjx.supabase.co/functions/v1/cron-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || vault.read_secret('CRON_SECRET')
    )
  ) AS request_id;
  $$
);
```

## 📱 Client Integration

### Initialize Supabase Client
```typescript
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SUPABASE_CONFIG } from './src/config/supabase'

const supabase = createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
    }
  }
)
```

### Upload Meter Photo
```typescript
// 1. Get signed upload URL
const { data: uploadData } = await supabase.functions.invoke(
  'signed-upload',
  {
    body: {
      session_id: currentSessionId,
      content_type: 'image/jpeg'
    }
  }
)

// 2. Upload image to signed URL
const response = await fetch(uploadData.upload_url, {
  method: 'PUT',
  headers: { 'Content-Type': 'image/jpeg' },
  body: imageBlob
})

// 3. Save photo record
const { data: photo } = await supabase
  .from('meter_photos')
  .insert({
    session_id: currentSessionId,
    image_path: uploadData.file_path,
    ocr_text: ocrResult.text,
    expires_at: timerExpiry
  })
  .select()
  .single()
```

### Start Safety Share
```typescript
// Start sharing location
const { data: share } = await supabase.functions.invoke(
  'start-share',
  {
    body: {
      session_id: currentSessionId,
      expires_in: 120, // 2 hours
      recipient_info: {
        phone: '+1234567890',
        name: 'John Doe'
      }
    }
  }
)

// Share the link
const message = `Track my location: ${share.share_url}`
// Send via SMS/WhatsApp

// Update location periodically
const interval = setInterval(async () => {
  const location = await Location.getCurrentPositionAsync()

  await supabase.from('share_locations').insert({
    share_id: share.share_id,
    at_point: {
      type: 'Point',
      coordinates: [location.coords.longitude, location.coords.latitude]
    },
    speed: location.coords.speed,
    heading: location.coords.heading,
    accuracy: location.coords.accuracy
  })
}, 10000) // Every 10 seconds
```

## 🧪 Testing

### Test Authentication
```bash
# Get your anon key from Supabase Dashboard
curl -X POST 'https://kmobwbqdtmbzdyysdxjx.supabase.co/auth/v1/signup' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword"
  }'
```

### Test Edge Functions
```bash
# Test signed upload
curl -X POST 'https://kmobwbqdtmbzdyysdxjx.supabase.co/functions/v1/signed-upload' \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-session-id"
  }'

# Test public share view
curl 'https://kmobwbqdtmbzdyysdxjx.supabase.co/functions/v1/start-share/view?token=SHARE_TOKEN'
```

## 🔒 Security Checklist

- [ ] Set all Edge Function secrets in Supabase vault
- [ ] Configure RLS policies are enabled on all tables
- [ ] Test that users can only access their own data
- [ ] Verify webhook authentication is working
- [ ] Check storage bucket policies are restrictive
- [ ] Ensure signed URLs expire appropriately
- [ ] Test rate limiting on Edge Functions

## 📊 Monitoring

### Edge Function Logs
View in Supabase Dashboard → Functions → Logs

### Database Queries
Monitor slow queries in Dashboard → Database → Query Performance

### Storage Usage
Check in Dashboard → Storage → Usage

## 🚨 Troubleshooting

### Edge Function Not Working
1. Check function logs in Supabase Dashboard
2. Verify secrets are set correctly
3. Test with curl to isolate issues
4. Check CORS settings if browser-based

### Timer Notifications Not Sending
1. Verify cron job is running: `SELECT * FROM cron.job;`
2. Check user has expo_push_token in devices table
3. Verify timer status is 'scheduled'
4. Check Edge Function logs for errors

### Photo Upload Failing
1. Check session ownership
2. Verify storage bucket exists
3. Check file size limits (10MB)
4. Ensure correct MIME type

## 📞 Support

- Supabase Docs: https://supabase.com/docs
- OkapiFind Issues: https://github.com/okapifind/app/issues
- Email: support@okapifind.com