-- ============================================
-- FIX: Enable RLS on ALL tables and move PostGIS
-- Run Date: 2026-01-20
-- ============================================

-- ============================================
-- 1. ENABLE RLS ON ALL PUBLIC TABLES
-- ============================================
-- This dynamically enables RLS on all tables in public schema
-- that don't already have it enabled

DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE '_prisma%'
      AND tablename NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns', 'raster_columns', 'raster_overviews')
  LOOP
    -- Check if RLS is already enabled
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = tbl.tablename
        AND c.relrowsecurity = true
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
      RAISE NOTICE 'Enabled RLS on table: %', tbl.tablename;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 2. ENSURE RLS ON SPECIFIC KNOWN TABLES
-- ============================================
-- Explicitly enable on tables that might have been missed

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.parking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.meter_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.safety_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.share_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.api_usage ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. ADD MISSING RLS POLICIES
-- ============================================

-- Safety Shares policies (ensure they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'safety_shares') THEN
    DROP POLICY IF EXISTS "Users can view own shares" ON public.safety_shares;
    DROP POLICY IF EXISTS "Users can insert own shares" ON public.safety_shares;
    DROP POLICY IF EXISTS "Users can update own shares" ON public.safety_shares;
    DROP POLICY IF EXISTS "Users can delete own shares" ON public.safety_shares;

    CREATE POLICY "Users can view own shares" ON public.safety_shares
      FOR SELECT USING (auth.uid() = created_by);
    CREATE POLICY "Users can insert own shares" ON public.safety_shares
      FOR INSERT WITH CHECK (auth.uid() = created_by);
    CREATE POLICY "Users can update own shares" ON public.safety_shares
      FOR UPDATE USING (auth.uid() = created_by);
    CREATE POLICY "Users can delete own shares" ON public.safety_shares
      FOR DELETE USING (auth.uid() = created_by);
  END IF;
END $$;

-- Share Locations policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'share_locations') THEN
    DROP POLICY IF EXISTS "Share owner can insert locations" ON public.share_locations;
    DROP POLICY IF EXISTS "Share owner can view locations" ON public.share_locations;

    CREATE POLICY "Share owner can insert locations" ON public.share_locations
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.safety_shares
          WHERE safety_shares.id = share_locations.share_id
          AND safety_shares.created_by = auth.uid()
          AND safety_shares.active = true
        )
      );

    CREATE POLICY "Share owner can view locations" ON public.share_locations
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.safety_shares
          WHERE safety_shares.id = share_locations.share_id
          AND safety_shares.created_by = auth.uid()
        )
      );
  END IF;
END $$;

-- Subscriptions policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscriptions') THEN
    DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;

    CREATE POLICY "Users can view own subscription" ON public.subscriptions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Analytics Events policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'analytics_events') THEN
    DROP POLICY IF EXISTS "Users can insert own events" ON public.analytics_events;
    DROP POLICY IF EXISTS "Users can view own events" ON public.analytics_events;

    CREATE POLICY "Users can insert own events" ON public.analytics_events
      FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
    CREATE POLICY "Users can view own events" ON public.analytics_events
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================
-- 4. MOVE POSTGIS TO EXTENSIONS SCHEMA
-- ============================================

-- Create extensions schema if not exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage to roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Check if PostGIS needs to be moved and do it
DO $move_postgis$
DECLARE
  postgis_in_public BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'postgis' AND n.nspname = 'public'
  ) INTO postgis_in_public;

  IF postgis_in_public THEN
    -- Drop and recreate in extensions schema
    DROP EXTENSION IF EXISTS postgis CASCADE;
    CREATE EXTENSION postgis SCHEMA extensions;
    RAISE NOTICE 'PostGIS moved to extensions schema';
  ELSE
    RAISE NOTICE 'PostGIS is not in public schema or does not exist';
  END IF;
END $move_postgis$;

-- ============================================
-- 4b. CREATE WRAPPER FUNCTIONS FOR BACKWARDS COMPATIBILITY
-- ============================================
-- These are created outside the DO block to avoid delimiter conflicts
-- Using fully qualified extensions.geometry type

-- ST_SetSRID wrapper
CREATE OR REPLACE FUNCTION public.ST_SetSRID(geom extensions.geometry, srid integer)
RETURNS extensions.geometry AS $func$
  SELECT extensions.ST_SetSRID(geom, srid);
$func$ LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE;

-- ST_MakePoint wrapper
CREATE OR REPLACE FUNCTION public.ST_MakePoint(x double precision, y double precision)
RETURNS extensions.geometry AS $func$
  SELECT extensions.ST_MakePoint(x, y);
$func$ LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE;

-- ST_Distance wrapper
CREATE OR REPLACE FUNCTION public.ST_Distance(geom1 extensions.geometry, geom2 extensions.geometry)
RETURNS double precision AS $func$
  SELECT extensions.ST_Distance(geom1, geom2);
$func$ LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE;

-- ST_Transform wrapper
CREATE OR REPLACE FUNCTION public.ST_Transform(geom extensions.geometry, srid integer)
RETURNS extensions.geometry AS $func$
  SELECT extensions.ST_Transform(geom, srid);
$func$ LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE;

-- ST_X wrapper
CREATE OR REPLACE FUNCTION public.ST_X(geom extensions.geometry)
RETURNS double precision AS $func$
  SELECT extensions.ST_X(geom);
$func$ LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE;

-- ST_Y wrapper
CREATE OR REPLACE FUNCTION public.ST_Y(geom extensions.geometry)
RETURNS double precision AS $func$
  SELECT extensions.ST_Y(geom);
$func$ LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE;

-- ============================================
-- 5. RECREATE GEOMETRY COLUMNS IF NEEDED
-- ============================================

-- Recreate car_point column if parking_sessions exists and column was dropped
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'parking_sessions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'parking_sessions'
      AND column_name = 'car_point'
    ) THEN
      ALTER TABLE public.parking_sessions
        ADD COLUMN car_point extensions.geometry(Point, 4326);
      RAISE NOTICE 'Recreated car_point column in parking_sessions';
    END IF;
  END IF;
END $$;

-- Recreate at_point column if share_locations exists and column was dropped
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'share_locations') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'share_locations'
      AND column_name = 'at_point'
    ) THEN
      ALTER TABLE public.share_locations
        ADD COLUMN at_point extensions.geometry(Point, 4326);
      RAISE NOTICE 'Recreated at_point column in share_locations';
    END IF;
  END IF;
END $$;

-- ============================================
-- 6. RECREATE SPATIAL INDEXES (if tables exist)
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'parking_sessions'
    AND column_name = 'car_point'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_parking_sessions_car_point
      ON public.parking_sessions USING GIST(car_point);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'share_locations'
    AND column_name = 'at_point'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_share_locations_point
      ON public.share_locations USING GIST(at_point);
  END IF;
END $$;

-- ============================================
-- 7. VERIFICATION
-- ============================================

-- Show tables without RLS enabled (should be empty)
DO $$
DECLARE
  tbl RECORD;
  count_no_rls INTEGER := 0;
BEGIN
  FOR tbl IN
    SELECT c.relname as tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = false
      AND c.relname NOT LIKE 'pg_%'
      AND c.relname NOT LIKE '_prisma%'
      AND c.relname NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns', 'raster_columns', 'raster_overviews')
  LOOP
    RAISE WARNING 'Table % does not have RLS enabled!', tbl.tablename;
    count_no_rls := count_no_rls + 1;
  END LOOP;

  IF count_no_rls = 0 THEN
    RAISE NOTICE 'All tables have RLS enabled!';
  ELSE
    RAISE WARNING '% tables without RLS', count_no_rls;
  END IF;
END $$;

-- Show extension locations
SELECT e.extname, n.nspname as schema
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE e.extname IN ('postgis', 'uuid-ossp', 'pgcrypto', 'pg_trgm');
