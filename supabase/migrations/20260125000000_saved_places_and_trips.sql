-- =========================================
-- OkapiFind: Base Camp (Hotel) + Saved Places
-- Migration: 20260125000000_saved_places_and_trips.sql
-- =========================================

-- 0) Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Try to enable PostGIS if available (ignore error if not)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "postgis";
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PostGIS extension not available, spatial features will be limited';
END$$;

-- 1) Create trips table (minimal default-trip support)
-- Allows users to organize saved places by trip (optional feature)
CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  is_default BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for efficient user queries
CREATE INDEX IF NOT EXISTS trips_user_id_idx ON public.trips(user_id);
CREATE INDEX IF NOT EXISTS trips_is_default_idx ON public.trips(user_id, is_default) WHERE is_default = true;

-- 2) Create saved_places table (without PostGIS dependency)
CREATE TABLE IF NOT EXISTS public.saved_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id UUID NULL REFERENCES public.trips(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('HOTEL', 'FAVORITE', 'CUSTOM', 'CAR')),
  label TEXT NOT NULL,
  address TEXT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  provider TEXT NULL CHECK (provider IN ('apple', 'google', 'manual')),
  provider_place_id TEXT NULL,
  geofence_radius_m INTEGER NOT NULL DEFAULT 150,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Hotel-specific fields
  check_in_date DATE NULL,
  check_out_date DATE NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS saved_places_user_id_idx ON public.saved_places(user_id);
CREATE INDEX IF NOT EXISTS saved_places_trip_id_idx ON public.saved_places(trip_id);
CREATE INDEX IF NOT EXISTS saved_places_type_idx ON public.saved_places(type);
CREATE INDEX IF NOT EXISTS saved_places_lat_lng_idx ON public.saved_places(lat, lng);
CREATE INDEX IF NOT EXISTS saved_places_active_hotel_idx ON public.saved_places(user_id, type)
  WHERE type = 'HOTEL' AND is_active = true;

-- Add PostGIS geometry column if extension is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    ALTER TABLE public.saved_places ADD COLUMN IF NOT EXISTS location GEOMETRY(Point, 4326)
      GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED;
    CREATE INDEX IF NOT EXISTS saved_places_location_idx ON public.saved_places USING GIST(location);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add PostGIS column: %', SQLERRM;
END$$;

-- 3) Create or replace updated_at trigger function
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply trigger to trips table
DROP TRIGGER IF EXISTS trg_trips_updated_at ON public.trips;
CREATE TRIGGER trg_trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- Apply trigger to saved_places table
DROP TRIGGER IF EXISTS trg_saved_places_updated_at ON public.saved_places;
CREATE TRIGGER trg_saved_places_updated_at
  BEFORE UPDATE ON public.saved_places
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- 4) Enforce single active HOTEL per user (partial unique index)
-- This ensures only one active hotel exists per user at any time
DROP INDEX IF EXISTS saved_places_one_active_hotel_per_user;
CREATE UNIQUE INDEX saved_places_one_active_hotel_per_user
  ON public.saved_places(user_id)
  WHERE (type = 'HOTEL' AND is_active = true);

-- 5) Enable Row Level Security
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;

-- 6) RLS Policies for trips table
DROP POLICY IF EXISTS "trips_select_own" ON public.trips;
CREATE POLICY "trips_select_own"
  ON public.trips FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "trips_insert_own" ON public.trips;
CREATE POLICY "trips_insert_own"
  ON public.trips FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "trips_update_own" ON public.trips;
CREATE POLICY "trips_update_own"
  ON public.trips FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "trips_delete_own" ON public.trips;
CREATE POLICY "trips_delete_own"
  ON public.trips FOR DELETE
  USING (user_id = auth.uid());

-- 7) RLS Policies for saved_places table
DROP POLICY IF EXISTS "saved_places_select_own" ON public.saved_places;
CREATE POLICY "saved_places_select_own"
  ON public.saved_places FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_places_insert_own" ON public.saved_places;
CREATE POLICY "saved_places_insert_own"
  ON public.saved_places FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_places_update_own" ON public.saved_places;
CREATE POLICY "saved_places_update_own"
  ON public.saved_places FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_places_delete_own" ON public.saved_places;
CREATE POLICY "saved_places_delete_own"
  ON public.saved_places FOR DELETE
  USING (user_id = auth.uid());

-- 8) Helper function: Get current active hotel for user
CREATE OR REPLACE FUNCTION public.get_current_hotel(p_user_id UUID DEFAULT auth.uid())
RETURNS SETOF public.saved_places
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT *
  FROM public.saved_places
  WHERE user_id = p_user_id
    AND type = 'HOTEL'
    AND is_active = true
  LIMIT 1;
$$;

-- 9) Helper function: Set hotel (deactivates previous, inserts/activates new)
CREATE OR REPLACE FUNCTION public.set_hotel(
  p_label TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_address TEXT DEFAULT NULL,
  p_provider TEXT DEFAULT 'manual',
  p_provider_place_id TEXT DEFAULT NULL,
  p_check_in_date DATE DEFAULT NULL,
  p_check_out_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_geofence_radius_m INTEGER DEFAULT 200
)
RETURNS public.saved_places
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result public.saved_places;
BEGIN
  -- Deactivate any existing active hotel for this user
  UPDATE public.saved_places
  SET is_active = false, updated_at = now()
  WHERE user_id = v_user_id
    AND type = 'HOTEL'
    AND is_active = true;

  -- Insert new active hotel
  INSERT INTO public.saved_places (
    user_id,
    type,
    label,
    lat,
    lng,
    address,
    provider,
    provider_place_id,
    geofence_radius_m,
    is_active,
    check_in_date,
    check_out_date,
    notes
  ) VALUES (
    v_user_id,
    'HOTEL',
    p_label,
    p_lat,
    p_lng,
    p_address,
    p_provider,
    p_provider_place_id,
    p_geofence_radius_m,
    true,
    p_check_in_date,
    p_check_out_date,
    p_notes
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- 10) Helper function: Clear hotel (deactivate without deleting)
CREATE OR REPLACE FUNCTION public.clear_hotel()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  UPDATE public.saved_places
  SET is_active = false, updated_at = now()
  WHERE user_id = v_user_id
    AND type = 'HOTEL'
    AND is_active = true;

  RETURN FOUND;
END;
$$;

-- 11) Helper function: Get or create default trip for user
CREATE OR REPLACE FUNCTION public.get_or_create_default_trip()
RETURNS public.trips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_trip public.trips;
BEGIN
  -- Try to get existing default trip
  SELECT * INTO v_trip
  FROM public.trips
  WHERE user_id = v_user_id AND is_default = true
  LIMIT 1;

  -- Create if not exists
  IF v_trip IS NULL THEN
    INSERT INTO public.trips (user_id, name, is_default)
    VALUES (v_user_id, 'Default', true)
    RETURNING * INTO v_trip;
  END IF;

  RETURN v_trip;
END;
$$;

-- 12) Create view for current hotel (convenience)
CREATE OR REPLACE VIEW public.v_current_hotel AS
SELECT sp.*
FROM public.saved_places sp
WHERE sp.type = 'HOTEL'
  AND sp.is_active = true
  AND sp.user_id = auth.uid();

-- Grant access to authenticated users
GRANT SELECT ON public.v_current_hotel TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_places TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_hotel TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_hotel TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_hotel TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_default_trip TO authenticated;

-- 13) Comments for documentation
COMMENT ON TABLE public.trips IS 'User trips for organizing saved places (optional grouping)';
COMMENT ON TABLE public.saved_places IS 'User saved places including hotels, favorites, and custom locations';
COMMENT ON COLUMN public.saved_places.type IS 'Place type: HOTEL (base camp), FAVORITE, CUSTOM, or CAR';
COMMENT ON COLUMN public.saved_places.is_active IS 'Whether this place is currently active (for HOTEL: only one active per user)';
COMMENT ON COLUMN public.saved_places.geofence_radius_m IS 'Radius in meters for geofence detection';
COMMENT ON FUNCTION public.set_hotel IS 'Atomically sets a new hotel, deactivating any previous active hotel';
