-- ============================================
-- SECURITY FIX: Enable RLS on all tables
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable RLS on all user tables
ALTER TABLE IF EXISTS public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.meter_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.parking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES: api_usage
-- ============================================
DROP POLICY IF EXISTS "Users can view own api_usage" ON public.api_usage;
DROP POLICY IF EXISTS "Users can insert own api_usage" ON public.api_usage;
DROP POLICY IF EXISTS "Users can update own api_usage" ON public.api_usage;

CREATE POLICY "Users can view own api_usage" ON public.api_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api_usage" ON public.api_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own api_usage" ON public.api_usage
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: devices
-- ============================================
DROP POLICY IF EXISTS "Users can view own devices" ON public.devices;
DROP POLICY IF EXISTS "Users can insert own devices" ON public.devices;
DROP POLICY IF EXISTS "Users can update own devices" ON public.devices;
DROP POLICY IF EXISTS "Users can delete own devices" ON public.devices;

CREATE POLICY "Users can view own devices" ON public.devices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own devices" ON public.devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devices" ON public.devices
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own devices" ON public.devices
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: meter_photos
-- ============================================
DROP POLICY IF EXISTS "Users can view own meter_photos" ON public.meter_photos;
DROP POLICY IF EXISTS "Users can insert own meter_photos" ON public.meter_photos;
DROP POLICY IF EXISTS "Users can delete own meter_photos" ON public.meter_photos;

CREATE POLICY "Users can view own meter_photos" ON public.meter_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.parking_sessions ps
      WHERE ps.id = meter_photos.session_id
      AND ps.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own meter_photos" ON public.meter_photos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parking_sessions ps
      WHERE ps.id = meter_photos.session_id
      AND ps.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own meter_photos" ON public.meter_photos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.parking_sessions ps
      WHERE ps.id = meter_photos.session_id
      AND ps.user_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES: parking_sessions
-- ============================================
DROP POLICY IF EXISTS "Users can view own parking_sessions" ON public.parking_sessions;
DROP POLICY IF EXISTS "Users can insert own parking_sessions" ON public.parking_sessions;
DROP POLICY IF EXISTS "Users can update own parking_sessions" ON public.parking_sessions;
DROP POLICY IF EXISTS "Users can delete own parking_sessions" ON public.parking_sessions;

CREATE POLICY "Users can view own parking_sessions" ON public.parking_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own parking_sessions" ON public.parking_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own parking_sessions" ON public.parking_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own parking_sessions" ON public.parking_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: profiles
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- RLS POLICIES: timers
-- ============================================
DROP POLICY IF EXISTS "Users can view own timers" ON public.timers;
DROP POLICY IF EXISTS "Users can insert own timers" ON public.timers;
DROP POLICY IF EXISTS "Users can update own timers" ON public.timers;
DROP POLICY IF EXISTS "Users can delete own timers" ON public.timers;

CREATE POLICY "Users can view own timers" ON public.timers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.parking_sessions ps
      WHERE ps.id = timers.session_id
      AND ps.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own timers" ON public.timers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parking_sessions ps
      WHERE ps.id = timers.session_id
      AND ps.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own timers" ON public.timers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.parking_sessions ps
      WHERE ps.id = timers.session_id
      AND ps.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own timers" ON public.timers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.parking_sessions ps
      WHERE ps.id = timers.session_id
      AND ps.user_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES: user_settings
-- ============================================
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;

CREATE POLICY "Users can view own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: vehicles
-- ============================================
DROP POLICY IF EXISTS "Users can view own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Users can insert own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Users can update own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Users can delete own vehicles" ON public.vehicles;

CREATE POLICY "Users can view own vehicles" ON public.vehicles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vehicles" ON public.vehicles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vehicles" ON public.vehicles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vehicles" ON public.vehicles
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- MOVE POSTGIS TO EXTENSIONS SCHEMA
-- ============================================
-- Create extensions schema if not exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage to authenticated and anon roles
GRANT USAGE ON SCHEMA extensions TO authenticated, anon;

-- Note: Moving PostGIS extension requires dropping and recreating it
-- This may affect existing spatial data. Run with caution:
--
-- DROP EXTENSION IF EXISTS postgis CASCADE;
-- CREATE EXTENSION postgis SCHEMA extensions;
--
-- If you have spatial data, you may need to:
-- 1. Backup your data
-- 2. Update your queries to reference extensions.function_name
-- 3. Or keep PostGIS in public and suppress the warning

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify RLS is enabled:
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check policies:
-- SELECT tablename, policyname, permissive, roles, cmd, qual FROM pg_policies WHERE schemaname = 'public';
