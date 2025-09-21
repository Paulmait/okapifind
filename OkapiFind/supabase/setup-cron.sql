-- ============================================
-- COMPLETE CRON SETUP FOR TIMER REMINDERS
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Create secrets in vault
-- Replace 'your-secret-here' with a strong random string
SELECT vault.create_secret('CRON_SECRET', 'your-cron-secret-here');

-- Step 3: Create the cron job for timer reminders
-- This runs every minute to check for timers that need to fire
SELECT cron.schedule(
  'parking-timer-reminders', -- Job name
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://kmobwbqdtmbzdyysdxjx.supabase.co/functions/v1/cron-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || vault.read_secret('CRON_SECRET'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'type', 'check_timers',
      'timestamp', now()
    )
  ) AS request_id;
  $$
);

-- Step 4: Create cleanup job for expired shares (runs daily at 2 AM)
SELECT cron.schedule(
  'cleanup-expired-shares',
  '0 2 * * *', -- Daily at 2 AM
  $$
  UPDATE public.safety_shares
  SET active = false
  WHERE expires_at < NOW()
    AND active = true;
  $$
);

-- Step 5: Create analytics aggregation job (runs hourly)
SELECT cron.schedule(
  'aggregate-analytics',
  '0 * * * *', -- Every hour
  $$
  INSERT INTO public.analytics_summary (
    date,
    hour,
    event_counts,
    unique_users
  )
  SELECT
    DATE(created_at) as date,
    EXTRACT(HOUR FROM created_at) as hour,
    jsonb_object_agg(event, count) as event_counts,
    COUNT(DISTINCT user_id) as unique_users
  FROM public.analytics_events
  WHERE created_at >= NOW() - INTERVAL '1 hour'
    AND created_at < DATE_TRUNC('hour', NOW())
  GROUP BY DATE(created_at), EXTRACT(HOUR FROM created_at)
  ON CONFLICT (date, hour) DO UPDATE
  SET event_counts = EXCLUDED.event_counts,
      unique_users = EXCLUDED.unique_users;
  $$
);

-- Step 6: Create parking session auto-end job (runs every 5 minutes)
-- Auto-ends sessions older than 24 hours
SELECT cron.schedule(
  'auto-end-old-sessions',
  '*/5 * * * *', -- Every 5 minutes
  $$
  UPDATE public.parking_sessions
  SET is_active = false,
      found_at = NOW(),
      notes = COALESCE(notes || E'\n[Auto-ended after 24 hours]', '[Auto-ended after 24 hours]')
  WHERE is_active = true
    AND saved_at < NOW() - INTERVAL '24 hours';
  $$
);

-- ============================================
-- MONITORING QUERIES
-- ============================================

-- View all scheduled cron jobs
SELECT * FROM cron.job;

-- View recent cron job executions
SELECT
  jobname,
  status,
  return_message,
  start_time,
  end_time,
  (end_time - start_time) as duration
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;

-- Check if timer reminders are working
SELECT
  COUNT(*) as pending_timers,
  MIN(notify_at) as next_timer
FROM public.timers
WHERE status = 'scheduled'
  AND notify_at <= NOW() + INTERVAL '1 hour';

-- ============================================
-- MANUAL TEST COMMANDS
-- ============================================

-- Manually trigger the timer check (for testing)
SELECT net.http_post(
  url := 'https://kmobwbqdtmbzdyysdxjx.supabase.co/functions/v1/cron-reminders',
  headers := jsonb_build_object(
    'Authorization', 'Bearer ' || vault.read_secret('CRON_SECRET'),
    'Content-Type', 'application/json'
  ),
  body := jsonb_build_object(
    'type', 'check_timers',
    'timestamp', now(),
    'test', true
  )
) AS request_id;

-- ============================================
-- TROUBLESHOOTING
-- ============================================

-- If cron jobs aren't running, check:
-- 1. Is pg_cron extension enabled?
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- 2. Is the cron.database_name set correctly?
SHOW cron.database_name;

-- 3. Are there any failed jobs?
SELECT * FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC
LIMIT 10;

-- 4. Check Edge Function logs in Supabase Dashboard
-- Go to: Functions > cron-reminders > Logs

-- ============================================
-- CLEANUP (if needed)
-- ============================================

-- To remove a cron job:
-- SELECT cron.unschedule('parking-timer-reminders');

-- To update a cron job schedule:
-- SELECT cron.alter_job(job_id, schedule := '*/2 * * * *'); -- Every 2 minutes