-- Hola Maps Data Trust & Moderation v2
-- Idempotent migration: CTV levels, anti-spam signals, place revision history,
-- moderation audits and data-quality verification timestamps.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ctv_level SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ctv_trust_score INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS ctv_reviews_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ctv_confirmed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ctv_overturned_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('USER', 'CONTRIBUTOR', 'CTV', 'MODERATOR', 'ADMIN'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_ctv_level_check;
ALTER TABLE users
  ADD CONSTRAINT users_ctv_level_check CHECK (ctv_level IN (1, 2));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_ctv_trust_score_check;
ALTER TABLE users
  ADD CONSTRAINT users_ctv_trust_score_check CHECK (ctv_trust_score BETWEEN 0 AND 100);

ALTER TABLE contributions
  ADD COLUMN IF NOT EXISTS risk_score SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fingerprint TEXT;

ALTER TABLE contributions DROP CONSTRAINT IF EXISTS contributions_risk_score_check;
ALTER TABLE contributions
  ADD CONSTRAINT contributions_risk_score_check CHECK (risk_score BETWEEN 0 AND 100);

CREATE INDEX IF NOT EXISTS contributions_fingerprint_idx
  ON contributions (fingerprint, created_at DESC)
  WHERE fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS contributions_user_created_idx
  ON contributions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contributions_risk_idx
  ON contributions (risk_score DESC, created_at DESC);

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS place_revisions (
  id BIGSERIAL PRIMARY KEY,
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'CREATE', 'UPDATE', 'ARCHIVE', 'VERIFY', 'IMAGE_ADD', 'IMAGE_COVER',
    'IMAGE_DELETE', 'CONTRIBUTION_APPLY', 'ROLLBACK'
  )),
  before_snapshot JSONB,
  after_snapshot JSONB,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  contribution_id BIGINT REFERENCES contributions(id) ON DELETE SET NULL,
  reason TEXT,
  rolled_back_from_revision_id BIGINT REFERENCES place_revisions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS place_revisions_place_created_idx
  ON place_revisions (place_id, created_at DESC);
CREATE INDEX IF NOT EXISTS place_revisions_actor_idx
  ON place_revisions (actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ctv_moderation_audits (
  id BIGSERIAL PRIMARY KEY,
  contribution_id BIGINT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  reviewer_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  audited_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  verdict TEXT NOT NULL CHECK (verdict IN ('CONFIRMED', 'OVERTURNED')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contribution_id)
);

CREATE INDEX IF NOT EXISTS ctv_moderation_audits_reviewer_idx
  ON ctv_moderation_audits (reviewer_user_id, created_at DESC);
