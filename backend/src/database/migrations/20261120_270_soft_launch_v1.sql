-- Soft launch: guest bug reports (moderated) and aggregated RUM samples.
-- No IP, user ID, precise location, URL path or browser fingerprint stored.
CREATE TABLE IF NOT EXISTS soft_launch_feedback (
  id BIGSERIAL PRIMARY KEY,
  public_reference UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('BUG','DATA','UX','SUGGESTION')),
  area TEXT NOT NULL CHECK (area IN ('MAP','PLACE','HOUSING','SEARCH','ACCOUNT','OTHER')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 20 AND 1200),
  status TEXT NOT NULL DEFAULT 'NEW'
    CHECK (status IN ('NEW','IN_REVIEW','RESOLVED','DISMISSED')),
  internal_note TEXT CHECK (internal_note IS NULL OR char_length(internal_note) <= 1000),
  reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS soft_launch_feedback_review_idx
  ON soft_launch_feedback(status,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS soft_launch_feedback_age_idx
  ON soft_launch_feedback(created_at);

CREATE TABLE IF NOT EXISTS soft_launch_vitals_hourly (
  bucket_hour TIMESTAMPTZ NOT NULL,
  metric TEXT NOT NULL CHECK (metric IN ('LCP','INP','CLS','MAP_READY')),
  route_group TEXT NOT NULL CHECK (route_group IN
    ('HOME','MAP','PLACE','HOUSING','EXPLORE','OTHER')),
  device TEXT NOT NULL CHECK (device IN ('MOBILE','DESKTOP')),
  network TEXT NOT NULL CHECK (network IN ('slow-2g','2g','3g','4g','unknown')),
  samples BIGINT NOT NULL DEFAULT 0,
  good BIGINT NOT NULL DEFAULT 0,
  needs_improvement BIGINT NOT NULL DEFAULT 0,
  poor BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_hour,metric,route_group,device,network),
  CONSTRAINT soft_launch_vitals_counter_check CHECK
    (samples >= 0 AND good >= 0 AND needs_improvement >= 0 AND poor >= 0
     AND samples = good + needs_improvement + poor)
);

CREATE INDEX IF NOT EXISTS soft_launch_vitals_age_idx ON soft_launch_vitals_hourly(bucket_hour);
