CREATE TABLE IF NOT EXISTS place_photo_scan_runs (
  id BIGSERIAL PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'QUEUED'
    CHECK (status IN ('QUEUED','RUNNING','SUCCESS','FAILED')),
  scope TEXT NOT NULL DEFAULT 'MISSING_IMAGES'
    CHECK (scope IN ('MISSING_IMAGES','ALL')),
  requested_limit INTEGER NOT NULL DEFAULT 50,
  providers JSONB NOT NULL DEFAULT '[]'::jsonb,
  scanned_places_count INTEGER NOT NULL DEFAULT 0,
  candidate_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  started_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS place_photo_scan_runs_created_idx
  ON place_photo_scan_runs (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS place_photo_scan_runs_active_uidx
  ON place_photo_scan_runs ((1))
  WHERE status IN ('QUEUED','RUNNING');

CREATE TABLE IF NOT EXISTS place_photo_candidates (
  id BIGSERIAL PRIMARY KEY,
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('WIKIMEDIA','FOURSQUARE','GOOGLE')),
  provider_ref TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  remote_url TEXT NOT NULL,
  preview_url TEXT,
  source_page_url TEXT,
  author_name TEXT,
  attribution TEXT,
  license_code TEXT,
  license_url TEXT,
  width INTEGER,
  height INTEGER,
  classification TEXT,
  score NUMERIC(6,4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED','STALE')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  approved_image_id BIGINT REFERENCES place_images(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (place_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS place_photo_candidates_status_score_idx
  ON place_photo_candidates (status, score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS place_photo_candidates_place_idx
  ON place_photo_candidates (place_id, status, score DESC);
CREATE INDEX IF NOT EXISTS place_photo_candidates_source_idx
  ON place_photo_candidates (source, status);

ALTER TABLE place_images
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_photo_id TEXT,
  ADD COLUMN IF NOT EXISTS source_page_url TEXT,
  ADD COLUMN IF NOT EXISTS author_name TEXT,
  ADD COLUMN IF NOT EXISTS attribution TEXT,
  ADD COLUMN IF NOT EXISTS license_code TEXT,
  ADD COLUMN IF NOT EXISTS license_url TEXT,
  ADD COLUMN IF NOT EXISTS storage_mode TEXT,
  ADD COLUMN IF NOT EXISTS photo_candidate_id BIGINT REFERENCES place_photo_candidates(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS place_images_photo_candidate_uidx
  ON place_images (photo_candidate_id)
  WHERE photo_candidate_id IS NOT NULL;
