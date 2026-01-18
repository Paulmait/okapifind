-- ============================================
-- OKAPIFIND SECURITY HARDENING MIGRATION
-- Fixes all Supabase Linter security warnings
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 0. CREATE TYPES IF THEY DON'T EXIST
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unit_system') THEN
    CREATE TYPE unit_system AS ENUM ('imperial', 'metric');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'device_platform') THEN
    CREATE TYPE device_platform AS ENUM ('ios', 'android', 'web');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'parking_source') THEN
    CREATE TYPE parking_source AS ENUM ('auto', 'manual', 'photo');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'timer_status') THEN
    CREATE TYPE timer_status AS ENUM ('scheduled', 'fired', 'canceled', 'snoozed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_platform') THEN
    CREATE TYPE subscription_platform AS ENUM ('ios', 'android');
  END IF;
END $$;

-- ============================================
-- 1. FIX: Function search_path mutable
-- All functions need SET search_path to prevent injection attacks
-- ============================================

-- Fix trigger_set_timestamp function
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile if profiles table exists
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Create settings if user_settings table exists
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_settings') THEN
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Fix create_parking_session function (only if parking_sessions table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'parking_sessions') THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION public.create_parking_session(
        p_lat DOUBLE PRECISION,
        p_lng DOUBLE PRECISION,
        p_vehicle_id UUID DEFAULT NULL,
        p_source parking_source DEFAULT 'manual',
        p_floor TEXT DEFAULT NULL,
        p_notes TEXT DEFAULT NULL,
        p_address TEXT DEFAULT NULL,
        p_venue_name TEXT DEFAULT NULL
      )
      RETURNS UUID
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        v_session_id UUID;
        v_user_id UUID;
      BEGIN
        v_user_id := auth.uid();

        IF v_user_id IS NULL THEN
          RAISE EXCEPTION 'Not authenticated';
        END IF;

        -- End any active sessions for this user
        UPDATE public.parking_sessions
        SET is_active = false,
            found_at = TIMEZONE('utc'::text, NOW())
        WHERE user_id = v_user_id
          AND is_active = true;

        -- Create new session
        INSERT INTO public.parking_sessions (
          user_id,
          vehicle_id,
          car_point,
          car_address,
          source,
          floor,
          notes,
          venue_name,
          is_active
        ) VALUES (
          v_user_id,
          p_vehicle_id,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326),
          p_address,
          p_source,
          p_floor,
          p_notes,
          p_venue_name,
          true
        ) RETURNING id INTO v_session_id;

        RETURN v_session_id;
      END;
      $body$;
    $func$;
  END IF;
END $$;

-- Fix end_parking_session function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'parking_sessions') THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION public.end_parking_session(
        p_session_id UUID
      )
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        v_user_id UUID;
        v_updated INTEGER;
      BEGIN
        v_user_id := auth.uid();

        IF v_user_id IS NULL THEN
          RAISE EXCEPTION 'Not authenticated';
        END IF;

        UPDATE public.parking_sessions
        SET is_active = false,
            found_at = TIMEZONE('utc'::text, NOW())
        WHERE id = p_session_id
          AND user_id = v_user_id
          AND is_active = true;

        GET DIAGNOSTICS v_updated = ROW_COUNT;

        IF v_updated > 0 AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'timers') THEN
          UPDATE public.timers
          SET status = 'canceled',
              canceled_at = TIMEZONE('utc'::text, NOW())
          WHERE session_id = p_session_id
            AND status = 'scheduled';
        END IF;

        RETURN v_updated > 0;
      END;
      $body$;
    $func$;
  END IF;
END $$;

-- Fix upsert_timer function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'timers') THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION public.upsert_timer(
        p_session_id UUID,
        p_notify_at TIMESTAMPTZ,
        p_buffer_seconds INTEGER DEFAULT 600
      )
      RETURNS UUID
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        v_user_id UUID;
        v_timer_id UUID;
        v_session_owner UUID;
      BEGIN
        v_user_id := auth.uid();

        IF v_user_id IS NULL THEN
          RAISE EXCEPTION 'Not authenticated';
        END IF;

        SELECT user_id INTO v_session_owner
        FROM public.parking_sessions
        WHERE id = p_session_id;

        IF v_session_owner != v_user_id THEN
          RAISE EXCEPTION 'Unauthorized';
        END IF;

        UPDATE public.timers
        SET status = 'canceled',
            canceled_at = TIMEZONE('utc'::text, NOW())
        WHERE session_id = p_session_id
          AND status = 'scheduled';

        INSERT INTO public.timers (
          session_id,
          notify_at,
          buffer_seconds,
          status
        ) VALUES (
          p_session_id,
          p_notify_at,
          p_buffer_seconds,
          'scheduled'
        ) RETURNING id INTO v_timer_id;

        RETURN v_timer_id;
      END;
      $body$;
    $func$;
  END IF;
END $$;

-- Fix get_active_parking_session function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'parking_sessions') THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION public.get_active_parking_session()
      RETURNS TABLE (
        id UUID,
        vehicle_id UUID,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        car_address TEXT,
        saved_at TIMESTAMPTZ,
        source parking_source,
        floor TEXT,
        venue_name TEXT,
        notes TEXT
      )
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        RETURN QUERY
        SELECT
          ps.id,
          ps.vehicle_id,
          ST_Y(ps.car_point::geometry) as latitude,
          ST_X(ps.car_point::geometry) as longitude,
          ps.car_address,
          ps.saved_at,
          ps.source,
          ps.floor,
          ps.venue_name,
          ps.notes
        FROM public.parking_sessions ps
        WHERE ps.user_id = auth.uid()
          AND ps.is_active = true
        ORDER BY ps.saved_at DESC
        LIMIT 1;
      END;
      $body$;
    $func$;
  END IF;
END $$;

-- Fix calculate_distance function
CREATE OR REPLACE FUNCTION public.calculate_distance(
  lat1 DOUBLE PRECISION,
  lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lng2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ST_Distance(
    ST_Transform(ST_SetSRID(ST_MakePoint(lng1, lat1), 4326), 3857),
    ST_Transform(ST_SetSRID(ST_MakePoint(lng2, lat2), 4326), 3857)
  );
$$;

-- Fix cleanup_expired_shares function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'safety_shares') THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION public.cleanup_expired_shares()
      RETURNS INTEGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        v_count INTEGER;
      BEGIN
        UPDATE public.safety_shares
        SET active = false
        WHERE expires_at < TIMEZONE('utc'::text, NOW())
          AND active = true;

        GET DIAGNOSTICS v_count = ROW_COUNT;
        RETURN v_count;
      END;
      $body$;
    $func$;
  END IF;
END $$;

-- Fix touch_user_settings if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'touch_user_settings') THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION public.touch_user_settings()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $body$;
    $func$;
  END IF;
END $$;

-- Fix update_updated_at_column if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION public.update_updated_at_column()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $body$;
    $func$;
  END IF;
END $$;

-- ============================================
-- 2. FIX: Create extensions schema
-- ============================================

CREATE SCHEMA IF NOT EXISTS extensions;

GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO service_role;

-- ============================================
-- 3. ENSURE RLS IS ENABLED ON ALL TABLES
-- ============================================

DO $$
DECLARE
  tbl text;
  tables_to_secure text[] := ARRAY[
    'profiles',
    'user_settings',
    'parking_sessions',
    'devices',
    'vehicles',
    'meter_photos',
    'timers',
    'safety_shares',
    'share_locations',
    'subscriptions',
    'analytics_events',
    'api_usage'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_secure
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      RAISE NOTICE 'RLS enabled on table: %', tbl;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 4. FORCE RLS FOR TABLE OWNERS
-- ============================================

DO $$
DECLARE
  tbl text;
  tables_to_force text[] := ARRAY[
    'profiles',
    'user_settings',
    'parking_sessions',
    'devices',
    'vehicles',
    'meter_photos',
    'timers',
    'safety_shares',
    'share_locations',
    'subscriptions',
    'analytics_events'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_force
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);
      RAISE NOTICE 'RLS forced on table: %', tbl;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 5. SHOW RESULTS
-- ============================================

SELECT 'Security hardening complete!' as status;

-- Show RLS status for all public tables
SELECT
  tablename as "Table",
  CASE WHEN rowsecurity THEN 'RLS ON' ELSE 'RLS OFF' END as "RLS Status"
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
