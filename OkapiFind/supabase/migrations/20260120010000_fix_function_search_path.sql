-- ============================================
-- FIX: Set search_path on wrapper functions
-- Run Date: 2026-01-20
-- ============================================

-- Recreate wrapper functions with SET search_path for security

-- ST_SetSRID wrapper with secure search_path
CREATE OR REPLACE FUNCTION public.ST_SetSRID(geom extensions.geometry, srid integer)
RETURNS extensions.geometry
LANGUAGE SQL
IMMUTABLE STRICT PARALLEL SAFE
SET search_path = extensions
AS $func$
  SELECT extensions.ST_SetSRID(geom, srid);
$func$;

-- ST_MakePoint wrapper with secure search_path
CREATE OR REPLACE FUNCTION public.ST_MakePoint(x double precision, y double precision)
RETURNS extensions.geometry
LANGUAGE SQL
IMMUTABLE STRICT PARALLEL SAFE
SET search_path = extensions
AS $func$
  SELECT extensions.ST_MakePoint(x, y);
$func$;

-- ST_Distance wrapper with secure search_path
CREATE OR REPLACE FUNCTION public.ST_Distance(geom1 extensions.geometry, geom2 extensions.geometry)
RETURNS double precision
LANGUAGE SQL
IMMUTABLE STRICT PARALLEL SAFE
SET search_path = extensions
AS $func$
  SELECT extensions.ST_Distance(geom1, geom2);
$func$;

-- ST_Transform wrapper with secure search_path
CREATE OR REPLACE FUNCTION public.ST_Transform(geom extensions.geometry, srid integer)
RETURNS extensions.geometry
LANGUAGE SQL
IMMUTABLE STRICT PARALLEL SAFE
SET search_path = extensions
AS $func$
  SELECT extensions.ST_Transform(geom, srid);
$func$;

-- ST_X wrapper with secure search_path
CREATE OR REPLACE FUNCTION public.ST_X(geom extensions.geometry)
RETURNS double precision
LANGUAGE SQL
IMMUTABLE STRICT PARALLEL SAFE
SET search_path = extensions
AS $func$
  SELECT extensions.ST_X(geom);
$func$;

-- ST_Y wrapper with secure search_path
CREATE OR REPLACE FUNCTION public.ST_Y(geom extensions.geometry)
RETURNS double precision
LANGUAGE SQL
IMMUTABLE STRICT PARALLEL SAFE
SET search_path = extensions
AS $func$
  SELECT extensions.ST_Y(geom);
$func$;

-- ============================================
-- Check for any remaining extensions in public
-- ============================================
DO $$
DECLARE
  ext RECORD;
BEGIN
  FOR ext IN
    SELECT e.extname, n.nspname
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE n.nspname = 'public'
  LOOP
    RAISE NOTICE 'Extension % is still in public schema', ext.extname;
  END LOOP;
END $$;

-- Move any remaining extensions to extensions schema
-- uuid-ossp
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'uuid-ossp' AND n.nspname = 'public'
  ) THEN
    DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
    RAISE NOTICE 'Moved uuid-ossp to extensions schema';
  END IF;
END $$;

-- pgcrypto
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pgcrypto' AND n.nspname = 'public'
  ) THEN
    DROP EXTENSION IF EXISTS pgcrypto CASCADE;
    CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
    RAISE NOTICE 'Moved pgcrypto to extensions schema';
  END IF;
END $$;

-- pg_trgm
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pg_trgm' AND n.nspname = 'public'
  ) THEN
    DROP EXTENSION IF EXISTS pg_trgm CASCADE;
    CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
    RAISE NOTICE 'Moved pg_trgm to extensions schema';
  END IF;
END $$;

-- Final verification
SELECT e.extname, n.nspname as schema
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE e.extname IN ('postgis', 'uuid-ossp', 'pgcrypto', 'pg_trgm');
