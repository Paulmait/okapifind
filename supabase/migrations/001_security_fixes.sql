-- ============================================
-- OKAPIFIND SECURITY FIXES
-- Simple security hardening without superuser permissions
-- ============================================

-- ============================================
-- 1. CREATE TYPES IF THEY DON'T EXIST
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
-- 2. CREATE EXTENSIONS SCHEMA
-- ============================================

CREATE SCHEMA IF NOT EXISTS extensions;

GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO service_role;

-- ============================================
-- 3. FIX FUNCTION SEARCH_PATH
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
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_settings') THEN
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

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
-- 4. ENABLE RLS ON ALL EXISTING TABLES
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
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);
      RAISE NOTICE 'RLS enabled and forced on table: %', tbl;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 5. DONE
-- ============================================

SELECT 'Security fixes applied!' as status;
