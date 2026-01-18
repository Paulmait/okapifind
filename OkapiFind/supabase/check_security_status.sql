-- ============================================
-- SECURITY STATUS CHECK
-- Run this in Supabase SQL Editor to verify security
-- ============================================

-- 1. Check RLS Status on all user tables
SELECT
  '1. RLS STATUS' as check_type,
  tablename as "Table",
  CASE WHEN rowsecurity THEN '✅ ON' ELSE '❌ OFF' END as "RLS Status"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'user_settings', 'parking_sessions',
    'devices', 'vehicles', 'meter_photos', 'timers',
    'safety_shares', 'share_locations', 'subscriptions',
    'analytics_events', 'api_usage'
  )
ORDER BY tablename;

-- 2. Check for optimized RLS policies (using select auth.uid())
SELECT
  '2. OPTIMIZED POLICIES' as check_type,
  tablename as "Table",
  policyname as "Policy",
  CASE
    WHEN qual::text LIKE '%select auth.uid()%' THEN '✅ Optimized'
    WHEN qual::text LIKE '%auth.uid()%' THEN '⚠️ Needs optimization'
    ELSE '❓ Check manually'
  END as "Status"
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Check function search_path
SELECT
  '3. FUNCTION SEARCH_PATH' as check_type,
  proname as "Function",
  CASE
    WHEN proconfig IS NULL THEN '⚠️ NOT SET'
    WHEN array_to_string(proconfig, ',') LIKE '%search_path%' THEN '✅ SECURE'
    ELSE '⚠️ NOT SET'
  END as "Status"
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'trigger_set_timestamp',
    'handle_new_user',
    'touch_user_settings',
    'update_updated_at_column',
    'create_parking_session',
    'end_parking_session',
    'get_active_parking_session',
    'calculate_distance',
    'cleanup_expired_shares',
    'upsert_timer'
  );

-- 4. Check for duplicate indexes on devices table
SELECT
  '4. DUPLICATE INDEXES' as check_type,
  indexname as "Index",
  tablename as "Table"
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'devices'
  AND indexname LIKE '%user_id%';

-- 5. Summary
SELECT
  'SECURITY CHECK COMPLETE' as status,
  'Check Supabase Dashboard > Database > Linter for full report' as note;
