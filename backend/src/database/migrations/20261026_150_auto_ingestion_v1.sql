-- HOLA Maps Auto Ingestion V1
-- Orchestrates existing Overture place imports + licensed photo scanning,
-- tracks provenance, schedules freshness checks and keeps unsafe candidates
-- behind moderation.

CREATE TABLE IF NOT EXISTS data_sources (
  id BIGSERIAL PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  source_kind TEXT NOT NULL
    CHECK (source_kind IN ('PLACE', 'PHOTO', 'FRESHNESS', 'EVENT')),
  collection_mode TEXT NOT NULL DEFAULT 'SCHEDULED'
    CHECK (collection_mode IN ('SCHEDULED', 'EVENT', 'MANUAL')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  schedule_minutes INTEGER
    CHECK (schedule_minutes IS NULL OR schedule_minutes BETWEEN 5 AND 10080),
  confidence_floor NUMERIC(4,3)
    CHECK (confidence_floor IS NULL OR confidence_floor BETWEEN 0 AND 1),
  auto_publish_threshold NUMERIC(4,3)
    CHECK (auto_publish_threshold IS NULL OR auto_publish_threshold BETWEEN 0 AND 1),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_error TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS data_sources_due_idx
  ON data_sources (enabled, collection_mode, next_run_at);

CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL DEFAULT 'SCHEDULE'
    CHECK (trigger_type IN ('SCHEDULE', 'MANUAL', 'EVENT')),
  status TEXT NOT NULL DEFAULT 'QUEUED'
    CHECK (status IN ('QUEUED', 'DISPATCHED', 'RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED')),
  underlying_kind TEXT,
  underlying_run_id BIGINT,
  requested_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ingestion_jobs_source_created_idx
  ON ingestion_jobs (source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ingestion_jobs_status_idx
  ON ingestion_jobs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS place_source_links (
  id BIGSERIAL PRIMARY KEY,
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  source_id BIGINT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  source_url TEXT,
  confidence NUMERIC(4,3)
    CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  last_seen_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, external_id)
);

CREATE INDEX IF NOT EXISTS place_source_links_place_idx
  ON place_source_links (place_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS place_verification_queue (
  id BIGSERIAL PRIMARY KEY,
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  reason TEXT NOT NULL
    CHECK (reason IN ('STALE_DATA', 'MISSING_PHOTO', 'HOUSING_AVAILABILITY')),
  priority SMALLINT NOT NULL DEFAULT 50
    CHECK (priority BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'DONE', 'DISMISSED')),
  due_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (place_id, reason)
);

CREATE INDEX IF NOT EXISTS place_verification_queue_pending_idx
  ON place_verification_queue (status, priority DESC, due_at ASC);

INSERT INTO data_sources (
  source_key, name, source_kind, collection_mode, enabled,
  schedule_minutes, confidence_floor, auto_publish_threshold,
  config, policy, next_run_at
)
VALUES
(
  'OVERTURE_PLACES',
  'Overture Places',
  'PLACE',
  'SCHEDULED',
  TRUE,
  1440,
  0.65,
  0.92,
  '{"mode":"STAGING","autoPublishLimit":200}'::jsonb,
  '{"license":"Overture Maps data terms","storesRawPayload":true,"autoPublish":"high-confidence-only"}'::jsonb,
  NOW() + INTERVAL '5 minutes'
),
(
  'PHOTO_SCAN',
  'Licensed Photo Scanner',
  'PHOTO',
  'SCHEDULED',
  TRUE,
  360,
  0.70,
  0.88,
  '{"scope":"MISSING_IMAGES","limit":60,"autoApproveLicensed":true}'::jsonb,
  '{"providers":["WIKIMEDIA","FOURSQUARE_IF_CONFIGURED"],"autoApproveSources":["WIKIMEDIA"],"requiresLicenseForAutoApprove":true}'::jsonb,
  NOW() + INTERVAL '8 minutes'
),
(
  'FRESHNESS_SWEEP',
  'Freshness & Verification',
  'FRESHNESS',
  'SCHEDULED',
  TRUE,
  720,
  NULL,
  NULL,
  '{"placeTtlDays":180,"housingTtlDays":14}'::jsonb,
  '{"mutatesPlaces":false,"createsVerificationQueue":true}'::jsonb,
  NOW() + INTERVAL '12 minutes'
),
(
  'COMMUNITY_EVENT',
  'Community Contributions',
  'EVENT',
  'EVENT',
  TRUE,
  NULL,
  NULL,
  NULL,
  '{}'::jsonb,
  '{"provenance":"approved-contributions"}'::jsonb,
  NULL
),
(
  'PARTNER_EVENT',
  'HOLA Partner',
  'EVENT',
  'EVENT',
  TRUE,
  NULL,
  NULL,
  NULL,
  '{}'::jsonb,
  '{"provenance":"verified-partner"}'::jsonb,
  NULL
)
ON CONFLICT (source_key) DO NOTHING;
