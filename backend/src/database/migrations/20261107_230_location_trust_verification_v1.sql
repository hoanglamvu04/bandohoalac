-- Location Trust Verification V1
-- Keep HOLA verification, verified-owner confirmations and community activity
-- as separate provenance streams. Community/owner confirmations never advance
-- the official HOLA last_verified_at timestamp.

CREATE TABLE IF NOT EXISTS place_verification_events (
  id BIGSERIAL PRIMARY KEY,
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL
    CHECK (source IN ('HOLA', 'OWNER', 'COMMUNITY', 'LEGACY')),
  event_type TEXT NOT NULL
    CHECK (event_type IN ('VERIFIED', 'CONFIRMED_ACTIVE')),
  note TEXT,
  event_day DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS place_verification_events_place_created_idx
  ON place_verification_events (place_id, created_at DESC);

CREATE INDEX IF NOT EXISTS place_verification_events_source_created_idx
  ON place_verification_events (source, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS place_verification_events_place_source_event_idx
  ON place_verification_events (place_id, source, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS contributions_place_status_type_created_idx
  ON contributions (place_id, status, type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS place_verification_events_actor_daily_uidx
  ON place_verification_events (place_id, actor_user_id, source, event_type, event_day)
  WHERE actor_user_id IS NOT NULL
    AND event_type = 'CONFIRMED_ACTIVE';

-- Preserve the historical timestamp without falsely attributing old checks to
-- HOLA staff or to the community: V1 cannot recover the original actor/source.
INSERT INTO place_verification_events (
  place_id, source, event_type, note, event_day, created_at
)
SELECT
  p.id,
  'LEGACY',
  'VERIFIED',
  'Mốc xác minh cũ; hệ thống chưa lưu nguồn xác minh',
  p.last_verified_at::date,
  p.last_verified_at
FROM places p
WHERE p.last_verified_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM place_verification_events e
    WHERE e.place_id = p.id
      AND e.source = 'LEGACY'
      AND e.event_type = 'VERIFIED'
      AND e.created_at = p.last_verified_at
  );

COMMENT ON TABLE place_verification_events IS
  'Auditable provenance for HOLA checks, verified owner confirmations and community active-place confirmations.';
