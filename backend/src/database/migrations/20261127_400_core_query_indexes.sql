-- HOLA-P1-301.02: candidate indexes for existing geography and owner reads.
-- Additive only. Measure on staging before production; ordinary CREATE INDEX
-- can block writes while building. Fail rather than wait indefinitely.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE INDEX IF NOT EXISTS places_location_geography_idx
  ON places USING GIST ((location::geography));
CREATE INDEX IF NOT EXISTS places_owner_created_id_idx
  ON places (created_by, created_at DESC, id DESC);
COMMIT;
