-- ============================================
-- SUPABASE SECURITY FIXES
-- Run this in Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard/project/kmobwbqdtmbzdyysdxjx/sql
-- ============================================

-- 1. FIX: Function Search Path Mutable
-- Set immutable search_path for touch_user_settings function
CREATE OR REPLACE FUNCTION public.touch_user_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2. FIX: Extensions in Public Schema
-- Move postgis to extensions schema (if not exists, create it)
CREATE SCHEMA IF NOT EXISTS extensions;

-- Note: Moving extensions requires superuser privileges
-- You may need to contact Supabase support or recreate the extension
-- Alternative: Accept this as a known limitation for managed Supabase

-- For pg_trgm, same applies
-- These are warnings, not critical errors for production

-- 3. FIX: Enable RLS on all public tables
-- First, let's check which tables need RLS enabled

-- Enable RLS on common tables (add your specific tables here)
-- Example for user-related tables:

-- Users table
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

-- User settings table
ALTER TABLE IF EXISTS public.user_settings ENABLE ROW LEVEL SECURITY;

-- Parking spots table
ALTER TABLE IF EXISTS public.parking_spots ENABLE ROW LEVEL SECURITY;

-- Parking history table
ALTER TABLE IF EXISTS public.parking_history ENABLE ROW LEVEL SECURITY;

-- Shared locations table
ALTER TABLE IF EXISTS public.shared_locations ENABLE ROW LEVEL SECURITY;

-- Subscriptions table
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. CREATE RLS POLICIES (if not exists)
-- Users can only access their own data

-- Policy for users table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can view own data') THEN
    CREATE POLICY "Users can view own data" ON public.users
      FOR SELECT USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can update own data') THEN
    CREATE POLICY "Users can update own data" ON public.users
      FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

-- Policy for parking_spots table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'parking_spots' AND policyname = 'Users can CRUD own parking spots') THEN
    CREATE POLICY "Users can CRUD own parking spots" ON public.parking_spots
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Policy for parking_history table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'parking_history' AND policyname = 'Users can view own parking history') THEN
    CREATE POLICY "Users can view own parking history" ON public.parking_history
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'parking_history' AND policyname = 'Users can insert own parking history') THEN
    CREATE POLICY "Users can insert own parking history" ON public.parking_history
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Policy for shared_locations table (special case - shared links are public)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shared_locations' AND policyname = 'Users can create shared locations') THEN
    CREATE POLICY "Users can create shared locations" ON public.shared_locations
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shared_locations' AND policyname = 'Anyone can view shared locations by link') THEN
    CREATE POLICY "Anyone can view shared locations by link" ON public.shared_locations
      FOR SELECT USING (expires_at > NOW());
  END IF;
END $$;

-- 5. VERIFY RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================
-- NOTES FOR MANUAL FIXES IN SUPABASE DASHBOARD
-- ============================================
--
-- 1. LEAKED PASSWORD PROTECTION:
--    Go to: Authentication > Settings > Security
--    Enable "Leaked password protection"
--
-- 2. MFA OPTIONS:
--    Go to: Authentication > Settings > Multi-Factor Authentication
--    Enable TOTP (Authenticator apps)
--    Consider enabling Phone/SMS MFA
--
-- 3. EXTENSION SCHEMA:
--    Extensions in public schema is a warning, not critical
--    Supabase managed instances handle this appropriately
--    If needed, contact Supabase support
-- ============================================
