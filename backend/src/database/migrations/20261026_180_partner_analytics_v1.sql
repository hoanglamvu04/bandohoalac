-- Partner Analytics V1: aggregate events only, never store visitor identity.
-- Idempotent: the project reapplies migrations during deployment.
CREATE TABLE IF NOT EXISTS place_engagement_daily (
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('VIEW', 'CALL', 'DIRECTIONS', 'WEBSITE')),
  event_count BIGINT NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  PRIMARY KEY (place_id, day, event_type)
);

CREATE INDEX IF NOT EXISTS place_engagement_daily_day_idx
  ON place_engagement_daily (day DESC, place_id);
