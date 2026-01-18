-- ============================================
-- OKAPIFIND PERFORMANCE OPTIMIZATION MIGRATION
-- Fixes Performance Advisor warnings:
-- 1. auth_rls_initplan: Wrap auth.uid() with (select auth.uid())
-- 2. multiple_permissive_policies: Remove duplicate policies
-- 3. duplicate_index: Remove duplicate indexes
-- ============================================

-- ============================================
-- 1. DROP DUPLICATE INDEXES
-- ============================================

-- Drop duplicate index on devices table (keep idx_devices_user_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'devices_user_id_idx') THEN
    DROP INDEX IF EXISTS devices_user_id_idx;
    RAISE NOTICE 'Dropped duplicate index: devices_user_id_idx';
  END IF;
END $$;

-- ============================================
-- 2. DROP DUPLICATE RLS POLICIES
-- Keep only one policy per table for each operation type
-- ============================================

-- PROFILES table: Keep "Users can CRUD own profile", drop others
DO $$
BEGIN
  -- Drop duplicate select policies
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile') THEN
    DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
    RAISE NOTICE 'Dropped duplicate policy: Users can view own profile';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_select_own') THEN
    DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
    RAISE NOTICE 'Dropped duplicate policy: profiles_select_own';
  END IF;

  -- Drop duplicate update policies
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile') THEN
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    RAISE NOTICE 'Dropped duplicate policy: Users can update own profile';
  END IF;
END $$;

-- USER_SETTINGS table: Keep "Users can manage own settings", drop others
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'settings_select_own') THEN
    DROP POLICY IF EXISTS "settings_select_own" ON user_settings;
    RAISE NOTICE 'Dropped duplicate policy: settings_select_own';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'settings_insert_own') THEN
    DROP POLICY IF EXISTS "settings_insert_own" ON user_settings;
    RAISE NOTICE 'Dropped duplicate policy: settings_insert_own';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'settings_update_own') THEN
    DROP POLICY IF EXISTS "settings_update_own" ON user_settings;
    RAISE NOTICE 'Dropped duplicate policy: settings_update_own';
  END IF;
END $$;

-- DEVICES table: Keep "devices_all_own", drop "own device rw"
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'devices' AND policyname = 'own device rw') THEN
    DROP POLICY IF EXISTS "own device rw" ON devices;
    RAISE NOTICE 'Dropped duplicate policy: own device rw';
  END IF;
END $$;

-- PARKING_SESSIONS table: Keep one policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'parking_sessions' AND policyname = 'sessions_select_own') THEN
    DROP POLICY IF EXISTS "sessions_select_own" ON parking_sessions;
    RAISE NOTICE 'Dropped duplicate policy: sessions_select_own';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'parking_sessions' AND policyname = 'sessions_insert_own') THEN
    DROP POLICY IF EXISTS "sessions_insert_own" ON parking_sessions;
    RAISE NOTICE 'Dropped duplicate policy: sessions_insert_own';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'parking_sessions' AND policyname = 'sessions_update_own') THEN
    DROP POLICY IF EXISTS "sessions_update_own" ON parking_sessions;
    RAISE NOTICE 'Dropped duplicate policy: sessions_update_own';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'parking_sessions' AND policyname = 'sessions_delete_own') THEN
    DROP POLICY IF EXISTS "sessions_delete_own" ON parking_sessions;
    RAISE NOTICE 'Dropped duplicate policy: sessions_delete_own';
  END IF;
END $$;

-- VEHICLES table: Keep one policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicles' AND policyname = 'vehicles_select_own') THEN
    DROP POLICY IF EXISTS "vehicles_select_own" ON vehicles;
    RAISE NOTICE 'Dropped duplicate policy: vehicles_select_own';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicles' AND policyname = 'vehicles_insert_own') THEN
    DROP POLICY IF EXISTS "vehicles_insert_own" ON vehicles;
    RAISE NOTICE 'Dropped duplicate policy: vehicles_insert_own';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicles' AND policyname = 'vehicles_update_own') THEN
    DROP POLICY IF EXISTS "vehicles_update_own" ON vehicles;
    RAISE NOTICE 'Dropped duplicate policy: vehicles_update_own';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicles' AND policyname = 'vehicles_delete_own') THEN
    DROP POLICY IF EXISTS "vehicles_delete_own" ON vehicles;
    RAISE NOTICE 'Dropped duplicate policy: vehicles_delete_own';
  END IF;
END $$;

-- ============================================
-- 3. RECREATE OPTIMIZED RLS POLICIES
-- Using (select auth.uid()) instead of auth.uid()
-- This prevents re-evaluation per row
-- ============================================

-- PROFILES: Optimized policy
DO $$
BEGIN
  -- Drop existing policy if any
  DROP POLICY IF EXISTS "Users can CRUD own profile" ON profiles;
  DROP POLICY IF EXISTS "profiles_crud_own" ON profiles;

  -- Create optimized policy
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    CREATE POLICY "profiles_crud_own" ON profiles
      FOR ALL
      USING ((select auth.uid()) = id)
      WITH CHECK ((select auth.uid()) = id);
    RAISE NOTICE 'Created optimized policy: profiles_crud_own';
  END IF;
END $$;

-- USER_SETTINGS: Optimized policy
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage own settings" ON user_settings;
  DROP POLICY IF EXISTS "user_settings_crud_own" ON user_settings;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_settings') THEN
    CREATE POLICY "user_settings_crud_own" ON user_settings
      FOR ALL
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
    RAISE NOTICE 'Created optimized policy: user_settings_crud_own';
  END IF;
END $$;

-- DEVICES: Optimized policy
DO $$
BEGIN
  DROP POLICY IF EXISTS "devices_all_own" ON devices;
  DROP POLICY IF EXISTS "devices_crud_own" ON devices;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'devices') THEN
    CREATE POLICY "devices_crud_own" ON devices
      FOR ALL
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
    RAISE NOTICE 'Created optimized policy: devices_crud_own';
  END IF;
END $$;

-- PARKING_SESSIONS: Optimized policy
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage own sessions" ON parking_sessions;
  DROP POLICY IF EXISTS "parking_sessions_crud_own" ON parking_sessions;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'parking_sessions') THEN
    CREATE POLICY "parking_sessions_crud_own" ON parking_sessions
      FOR ALL
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
    RAISE NOTICE 'Created optimized policy: parking_sessions_crud_own';
  END IF;
END $$;

-- VEHICLES: Optimized policy
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage own vehicles" ON vehicles;
  DROP POLICY IF EXISTS "vehicles_crud_own" ON vehicles;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'vehicles') THEN
    CREATE POLICY "vehicles_crud_own" ON vehicles
      FOR ALL
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
    RAISE NOTICE 'Created optimized policy: vehicles_crud_own';
  END IF;
END $$;

-- METER_PHOTOS: Optimized policy (uses session_id, not user_id)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own meter photos" ON meter_photos;
  DROP POLICY IF EXISTS "Users can insert own meter photos" ON meter_photos;
  DROP POLICY IF EXISTS "Users can update own meter photos" ON meter_photos;
  DROP POLICY IF EXISTS "meter_photos_crud_own" ON meter_photos;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'meter_photos') THEN
    CREATE POLICY "meter_photos_crud_own" ON meter_photos
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM parking_sessions ps
          WHERE ps.id = meter_photos.session_id
            AND ps.user_id = (select auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM parking_sessions ps
          WHERE ps.id = meter_photos.session_id
            AND ps.user_id = (select auth.uid())
        )
      );
    RAISE NOTICE 'Created optimized policy: meter_photos_crud_own';
  END IF;
END $$;

-- TIMERS: Optimized policy (joins with parking_sessions)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage own timers" ON timers;
  DROP POLICY IF EXISTS "timers_crud_own" ON timers;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'timers') THEN
    CREATE POLICY "timers_crud_own" ON timers
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM parking_sessions ps
          WHERE ps.id = timers.session_id
            AND ps.user_id = (select auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM parking_sessions ps
          WHERE ps.id = timers.session_id
            AND ps.user_id = (select auth.uid())
        )
      );
    RAISE NOTICE 'Created optimized policy: timers_crud_own';
  END IF;
END $$;

-- SAFETY_SHARES: Optimized policy (table may not exist yet)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'safety_shares') THEN
    DROP POLICY IF EXISTS "Users can manage own shares" ON safety_shares;
    DROP POLICY IF EXISTS "safety_shares_crud_own" ON safety_shares;

    CREATE POLICY "safety_shares_crud_own" ON safety_shares
      FOR ALL
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
    RAISE NOTICE 'Created optimized policy: safety_shares_crud_own';
  END IF;
END $$;

-- SHARE_LOCATIONS: Optimized policy (table may not exist yet)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'share_locations') THEN
    DROP POLICY IF EXISTS "share_locations_crud_own" ON share_locations;
    DROP POLICY IF EXISTS "Share locations readable by token" ON share_locations;

    CREATE POLICY "share_locations_crud_own" ON share_locations
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM safety_shares ss
          WHERE ss.id = share_locations.share_id
            AND ss.user_id = (select auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM safety_shares ss
          WHERE ss.id = share_locations.share_id
            AND ss.user_id = (select auth.uid())
        )
      );
    RAISE NOTICE 'Created optimized policy: share_locations_crud_own';
  END IF;
END $$;

-- SUBSCRIPTIONS: Optimized policy (table may not exist yet)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscriptions') THEN
    DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
    DROP POLICY IF EXISTS "subscriptions_select_own" ON subscriptions;

    CREATE POLICY "subscriptions_select_own" ON subscriptions
      FOR SELECT
      USING ((select auth.uid()) = user_id);
    RAISE NOTICE 'Created optimized policy: subscriptions_select_own';
  END IF;
END $$;

-- ANALYTICS_EVENTS: Optimized policy (table may not exist yet)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'analytics_events') THEN
    DROP POLICY IF EXISTS "Users can insert own events" ON analytics_events;
    DROP POLICY IF EXISTS "analytics_events_insert_own" ON analytics_events;

    CREATE POLICY "analytics_events_insert_own" ON analytics_events
      FOR INSERT
      WITH CHECK ((select auth.uid()) = user_id);
    RAISE NOTICE 'Created optimized policy: analytics_events_insert_own';
  END IF;
END $$;

-- API_USAGE: Optimized policy (table may not exist yet)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'api_usage') THEN
    DROP POLICY IF EXISTS "Users can view own usage" ON api_usage;
    DROP POLICY IF EXISTS "api_usage_select_own" ON api_usage;

    CREATE POLICY "api_usage_select_own" ON api_usage
      FOR SELECT
      USING ((select auth.uid()) = user_id);
    RAISE NOTICE 'Created optimized policy: api_usage_select_own';
  END IF;
END $$;

-- ============================================
-- 4. VERIFICATION
-- ============================================

SELECT 'Performance optimization complete!' as status;

-- Show all policies
SELECT
  tablename as "Table",
  policyname as "Policy",
  cmd as "Command"
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
