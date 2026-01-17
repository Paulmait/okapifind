-- ============================================
-- OKAPIFIND COMPREHENSIVE RLS SETUP
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. CREATE TABLES IF NOT EXIST
-- ============================================

-- Profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium_monthly', 'premium_annual', 'lifetime')),
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  push_notifications BOOLEAN DEFAULT true,
  location_tracking BOOLEAN DEFAULT true,
  dark_mode TEXT DEFAULT 'system' CHECK (dark_mode IN ('light', 'dark', 'system')),
  haptic_feedback BOOLEAN DEFAULT true,
  voice_guidance BOOLEAN DEFAULT false,
  auto_detect_parking BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Parking sessions (main data table)
CREATE TABLE IF NOT EXISTS public.parking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  notes TEXT,
  photo_urls TEXT[],
  meter_expiry TIMESTAMPTZ,
  floor_level TEXT,
  spot_number TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Devices table (for multi-device support)
CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT,
  platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
  push_token TEXT,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  make TEXT,
  model TEXT,
  color TEXT,
  license_plate TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API usage tracking (for quota enforcement)
CREATE TABLE IF NOT EXISTS public.api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  api_calls INTEGER DEFAULT 0,
  google_maps_calls INTEGER DEFAULT 0,
  parking_saves INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 2. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- 3. DROP EXISTING POLICIES (clean slate)
-- ============================================

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

DROP POLICY IF EXISTS "user_settings_all_own" ON public.user_settings;

DROP POLICY IF EXISTS "parking_sessions_select_own" ON public.parking_sessions;
DROP POLICY IF EXISTS "parking_sessions_insert_own" ON public.parking_sessions;
DROP POLICY IF EXISTS "parking_sessions_update_own" ON public.parking_sessions;
DROP POLICY IF EXISTS "parking_sessions_delete_own" ON public.parking_sessions;

DROP POLICY IF EXISTS "devices_all_own" ON public.devices;
DROP POLICY IF EXISTS "vehicles_all_own" ON public.vehicles;
DROP POLICY IF EXISTS "api_usage_all_own" ON public.api_usage;

-- 4. CREATE RLS POLICIES
-- ============================================

-- Profiles: Users can only access their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- User Settings: Full CRUD on own settings
CREATE POLICY "user_settings_all_own" ON public.user_settings
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Parking Sessions: Full CRUD on own sessions
CREATE POLICY "parking_sessions_select_own" ON public.parking_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "parking_sessions_insert_own" ON public.parking_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "parking_sessions_update_own" ON public.parking_sessions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "parking_sessions_delete_own" ON public.parking_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Devices: Full CRUD on own devices
CREATE POLICY "devices_all_own" ON public.devices
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Vehicles: Full CRUD on own vehicles
CREATE POLICY "vehicles_all_own" ON public.vehicles
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- API Usage: Full CRUD on own usage (for tracking)
CREATE POLICY "api_usage_all_own" ON public.api_usage
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_parking_sessions_user_id ON public.parking_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_parking_sessions_active ON public.parking_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_parking_sessions_created ON public.parking_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_date ON public.api_usage(user_id, date);

-- 6. CREATE TRIGGER FOR updated_at
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. CREATE FUNCTION TO AUTO-CREATE PROFILE ON SIGNUP
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

-- Trigger to auto-create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. VERIFY RLS STATUS
-- ============================================

SELECT
  schemaname,
  tablename,
  CASE WHEN rowsecurity THEN '✅ RLS ON' ELSE '❌ RLS OFF' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'user_settings', 'parking_sessions', 'devices', 'vehicles', 'api_usage')
ORDER BY tablename;

-- 9. SECURITY: Revoke direct table access, allow only through RLS
-- ============================================

REVOKE ALL ON public.profiles FROM anon, authenticated;
REVOKE ALL ON public.user_settings FROM anon, authenticated;
REVOKE ALL ON public.parking_sessions FROM anon, authenticated;
REVOKE ALL ON public.devices FROM anon, authenticated;
REVOKE ALL ON public.vehicles FROM anon, authenticated;
REVOKE ALL ON public.api_usage FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parking_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.api_usage TO authenticated;

-- Done!
SELECT 'RLS Setup Complete!' as status;
