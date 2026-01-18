-- ============================================
-- VERIFY SECURITY STATUS
-- Run this in Supabase SQL Editor to check security
-- ============================================

-- 1. Check RLS Status on all tables
SELECT
  '1. RLS STATUS' as section,
  tablename as "Table",
  CASE WHEN rowsecurity THEN 'ON' ELSE 'OFF' END as "RLS"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
ORDER BY tablename;

-- 2. Check function search_path
SELECT
  '2. FUNCTION SEARCH_PATH' as section,
  proname as "Function",
  CASE
    WHEN proconfig IS NULL THEN 'NOT SET (needs fix)'
    WHEN array_to_string(proconfig, ',') LIKE '%search_path%' THEN 'SECURE'
    ELSE 'NOT SET (needs fix)'
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
    'get_active_parking_session'
  );

-- 3. Check extensions location
SELECT
  '3. EXTENSIONS' as section,
  extname as "Extension",
  nspname as "Schema"
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE extname IN ('postgis', 'pg_trgm', 'uuid-ossp', 'pgcrypto');

-- 4. Summary
SELECT 'SECURITY CHECK COMPLETE' as status;
