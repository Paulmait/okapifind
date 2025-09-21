-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- USER SETTINGS TABLE
-- ============================================
CREATE TYPE unit_system AS ENUM ('imperial', 'metric');

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  units unit_system DEFAULT 'imperial' NOT NULL,
  haptics_enabled BOOLEAN DEFAULT true NOT NULL,
  voice_enabled BOOLEAN DEFAULT true NOT NULL,
  safety_default BOOLEAN DEFAULT false NOT NULL,
  premium BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- User settings policies
CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER set_timestamp_user_settings
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- ============================================
-- DEVICES TABLE
-- ============================================
CREATE TYPE device_platform AS ENUM ('ios', 'android', 'web');

CREATE TABLE IF NOT EXISTS public.devices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform device_platform NOT NULL,
  expo_push_token TEXT,
  device_info JSONB,
  last_seen_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, expo_push_token)
);

-- Enable RLS
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Devices policies
CREATE POLICY "Users can view own devices"
  ON public.devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own devices"
  ON public.devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devices"
  ON public.devices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own devices"
  ON public.devices FOR DELETE
  USING (auth.uid() = user_id);

-- Index for push token lookups
CREATE INDEX idx_devices_push_token ON public.devices(expo_push_token) WHERE expo_push_token IS NOT NULL;

-- ============================================
-- VEHICLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  plate TEXT,
  color TEXT,
  make TEXT,
  model TEXT,
  is_default BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Vehicles policies
CREATE POLICY "Users can view own vehicles"
  ON public.vehicles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vehicles"
  ON public.vehicles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vehicles"
  ON public.vehicles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vehicles"
  ON public.vehicles FOR DELETE
  USING (auth.uid() = user_id);

-- Index for user lookups
CREATE INDEX idx_vehicles_user_id ON public.vehicles(user_id);

-- ============================================
-- PARKING SESSIONS TABLE
-- ============================================
CREATE TYPE parking_source AS ENUM ('auto', 'manual', 'photo');

CREATE TABLE IF NOT EXISTS public.parking_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  car_point geometry(Point, 4326) NOT NULL,
  car_address TEXT,
  saved_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  source parking_source DEFAULT 'manual' NOT NULL,
  floor TEXT,
  venue_id TEXT,
  venue_name TEXT,
  notes TEXT,
  found_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.parking_sessions ENABLE ROW LEVEL SECURITY;

-- Parking sessions policies
CREATE POLICY "Users can view own sessions"
  ON public.parking_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON public.parking_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.parking_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON public.parking_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Spatial index for location queries
CREATE INDEX idx_parking_sessions_car_point ON public.parking_sessions USING GIST(car_point);

-- Index for active session lookups
CREATE INDEX idx_parking_sessions_active ON public.parking_sessions(user_id, is_active) WHERE is_active = true;

-- Index for history queries
CREATE INDEX idx_parking_sessions_user_saved ON public.parking_sessions(user_id, saved_at DESC);

-- ============================================
-- METER PHOTOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.meter_photos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES public.parking_sessions(id) ON DELETE CASCADE NOT NULL,
  image_path TEXT NOT NULL,
  ocr_text TEXT,
  rules_json JSONB,
  expires_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.meter_photos ENABLE ROW LEVEL SECURITY;

-- Meter photos policies (via session ownership)
CREATE POLICY "Users can view own meter photos"
  ON public.meter_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parking_sessions
      WHERE parking_sessions.id = meter_photos.session_id
      AND parking_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own meter photos"
  ON public.meter_photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parking_sessions
      WHERE parking_sessions.id = meter_photos.session_id
      AND parking_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own meter photos"
  ON public.meter_photos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.parking_sessions
      WHERE parking_sessions.id = meter_photos.session_id
      AND parking_sessions.user_id = auth.uid()
    )
  );

-- Index for session lookups
CREATE INDEX idx_meter_photos_session_id ON public.meter_photos(session_id);

-- ============================================
-- TIMERS TABLE
-- ============================================
CREATE TYPE timer_status AS ENUM ('scheduled', 'fired', 'canceled', 'snoozed');

CREATE TABLE IF NOT EXISTS public.timers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES public.parking_sessions(id) ON DELETE CASCADE NOT NULL,
  notify_at TIMESTAMPTZ NOT NULL,
  buffer_seconds INTEGER DEFAULT 600 NOT NULL, -- 10 minutes default
  status timer_status DEFAULT 'scheduled' NOT NULL,
  fired_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  snooze_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.timers ENABLE ROW LEVEL SECURITY;

-- Timers policies (via session ownership)
CREATE POLICY "Users can view own timers"
  ON public.timers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parking_sessions
      WHERE parking_sessions.id = timers.session_id
      AND parking_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own timers"
  ON public.timers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parking_sessions
      WHERE parking_sessions.id = timers.session_id
      AND parking_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own timers"
  ON public.timers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.parking_sessions
      WHERE parking_sessions.id = timers.session_id
      AND parking_sessions.user_id = auth.uid()
    )
  );

-- Index for notification queries
CREATE INDEX idx_timers_notify ON public.timers(status, notify_at)
  WHERE status = 'scheduled';

-- Index for session lookups
CREATE INDEX idx_timers_session_id ON public.timers(session_id);

-- ============================================
-- SAFETY SHARES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.safety_shares (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES public.parking_sessions(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  share_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  recipient_info JSONB,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.safety_shares ENABLE ROW LEVEL SECURITY;

-- Safety shares policies
CREATE POLICY "Users can view own shares"
  ON public.safety_shares FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own shares"
  ON public.safety_shares FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own shares"
  ON public.safety_shares FOR UPDATE
  USING (auth.uid() = created_by);

-- Index for token lookups
CREATE INDEX idx_safety_shares_token ON public.safety_shares(share_token) WHERE active = true;

-- Index for expiry cleanup
CREATE INDEX idx_safety_shares_expires ON public.safety_shares(expires_at) WHERE active = true;

-- ============================================
-- SHARE LOCATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.share_locations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  share_id UUID REFERENCES public.safety_shares(id) ON DELETE CASCADE NOT NULL,
  at_point geometry(Point, 4326) NOT NULL,
  speed REAL,
  heading REAL,
  accuracy REAL,
  recorded_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.share_locations ENABLE ROW LEVEL SECURITY;

-- Share locations policies (write-only for owner, read via Edge Function)
CREATE POLICY "Share owner can insert locations"
  ON public.share_locations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.safety_shares
      WHERE safety_shares.id = share_locations.share_id
      AND safety_shares.created_by = auth.uid()
      AND safety_shares.active = true
    )
  );

-- Spatial index for location queries
CREATE INDEX idx_share_locations_point ON public.share_locations USING GIST(at_point);

-- Index for share lookups
CREATE INDEX idx_share_locations_share_id ON public.share_locations(share_id, recorded_at DESC);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TYPE subscription_platform AS ENUM ('ios', 'android');

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform subscription_platform NOT NULL,
  product_id TEXT NOT NULL,
  rc_customer_id TEXT UNIQUE,
  entitlements JSONB,
  active_until TIMESTAMPTZ,
  is_active BOOLEAN GENERATED ALWAYS AS (
    active_until IS NOT NULL AND active_until > TIMEZONE('utc'::text, NOW())
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, platform)
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Subscriptions policies
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER set_timestamp_subscriptions
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Index for customer ID lookups
CREATE INDEX idx_subscriptions_rc_customer ON public.subscriptions(rc_customer_id);

-- ============================================
-- ANALYTICS EVENTS TABLE (Optional)
-- ============================================
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB,
  session_id TEXT,
  platform device_platform,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Analytics policies
CREATE POLICY "Users can insert own events"
  ON public.analytics_events FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view own events"
  ON public.analytics_events FOR SELECT
  USING (auth.uid() = user_id);

-- Index for event queries
CREATE INDEX idx_analytics_events_user ON public.analytics_events(user_id, created_at DESC);
CREATE INDEX idx_analytics_events_name ON public.analytics_events(event, created_at DESC);

-- ============================================
-- DATABASE FUNCTIONS
-- ============================================

-- Create parking session function
CREATE OR REPLACE FUNCTION create_parking_session(
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
AS $$
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
$$;

-- End parking session function
CREATE OR REPLACE FUNCTION end_parking_session(
  p_session_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_updated INTEGER;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- End the session if owned by user
  UPDATE public.parking_sessions
  SET is_active = false,
      found_at = TIMEZONE('utc'::text, NOW())
  WHERE id = p_session_id
    AND user_id = v_user_id
    AND is_active = true;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Cancel any active timers for this session
  IF v_updated > 0 THEN
    UPDATE public.timers
    SET status = 'canceled',
        canceled_at = TIMEZONE('utc'::text, NOW())
    WHERE session_id = p_session_id
      AND status = 'scheduled';
  END IF;

  RETURN v_updated > 0;
END;
$$;

-- Upsert timer function
CREATE OR REPLACE FUNCTION upsert_timer(
  p_session_id UUID,
  p_notify_at TIMESTAMPTZ,
  p_buffer_seconds INTEGER DEFAULT 600
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_timer_id UUID;
  v_session_owner UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify session ownership
  SELECT user_id INTO v_session_owner
  FROM public.parking_sessions
  WHERE id = p_session_id;

  IF v_session_owner != v_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Cancel any existing scheduled timers for this session
  UPDATE public.timers
  SET status = 'canceled',
      canceled_at = TIMEZONE('utc'::text, NOW())
  WHERE session_id = p_session_id
    AND status = 'scheduled';

  -- Create new timer
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
$$;

-- Get active parking session
CREATE OR REPLACE FUNCTION get_active_parking_session()
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
AS $$
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
$$;

-- Create user profile trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );

  -- Create settings with defaults
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Calculate distance between two points (in meters)
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 DOUBLE PRECISION,
  lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lng2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ST_Distance(
    ST_Transform(ST_SetSRID(ST_MakePoint(lng1, lat1), 4326), 3857),
    ST_Transform(ST_SetSRID(ST_MakePoint(lng2, lat2), 4326), 3857)
  );
$$;

-- Cleanup expired shares (to be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_shares()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
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
$$;