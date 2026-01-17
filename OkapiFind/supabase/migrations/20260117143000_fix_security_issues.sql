-- ============================================
-- SUPABASE SECURITY FIXES (CORRECTED)
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. FIX: Function Search Path Mutable
DO $$
BEGIN
  -- Only create if the function exists
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
    RAISE NOTICE 'Function touch_user_settings updated with secure search_path';
  END IF;
END $$;

-- 2. Create extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- 3. Enable RLS on existing tables only
-- Check which tables exist first, then enable RLS

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
    'favorites',
    'shared_locations',
    'parking_history'
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

-- 4. Create RLS Policies for profiles table (main user table)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    -- Drop existing policies if they exist to avoid conflicts
    DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

    -- Create new policies
    CREATE POLICY "Users can view own profile" ON public.profiles
      FOR SELECT USING (auth.uid() = id);
    CREATE POLICY "Users can update own profile" ON public.profiles
      FOR UPDATE USING (auth.uid() = id);
    CREATE POLICY "Users can insert own profile" ON public.profiles
      FOR INSERT WITH CHECK (auth.uid() = id);

    RAISE NOTICE 'RLS policies created for profiles table';
  END IF;
END $$;

-- 5. Create RLS Policies for user_settings table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_settings') THEN
    DROP POLICY IF EXISTS "Users can CRUD own settings" ON public.user_settings;

    CREATE POLICY "Users can CRUD own settings" ON public.user_settings
      FOR ALL USING (auth.uid() = user_id);

    RAISE NOTICE 'RLS policies created for user_settings table';
  END IF;
END $$;

-- 6. Create RLS Policies for parking_sessions table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'parking_sessions') THEN
    DROP POLICY IF EXISTS "Users can CRUD own parking sessions" ON public.parking_sessions;

    CREATE POLICY "Users can CRUD own parking sessions" ON public.parking_sessions
      FOR ALL USING (auth.uid() = user_id);

    RAISE NOTICE 'RLS policies created for parking_sessions table';
  END IF;
END $$;

-- 7. Create RLS Policies for devices table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'devices') THEN
    DROP POLICY IF EXISTS "Users can CRUD own devices" ON public.devices;

    CREATE POLICY "Users can CRUD own devices" ON public.devices
      FOR ALL USING (auth.uid() = user_id);

    RAISE NOTICE 'RLS policies created for devices table';
  END IF;
END $$;

-- 8. Create RLS Policies for vehicles table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'vehicles') THEN
    DROP POLICY IF EXISTS "Users can CRUD own vehicles" ON public.vehicles;

    CREATE POLICY "Users can CRUD own vehicles" ON public.vehicles
      FOR ALL USING (auth.uid() = user_id);

    RAISE NOTICE 'RLS policies created for vehicles table';
  END IF;
END $$;

-- 9. Verify RLS status
SELECT
  tablename,
  CASE WHEN rowsecurity THEN '✓ RLS ON' ELSE '✗ RLS OFF' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
