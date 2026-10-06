CREATE TABLE IF NOT EXISTS reputation_expertise (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dimension VARCHAR(16) NOT NULL
    CHECK (dimension IN ('AREA', 'DOMAIN')),
  expertise_key VARCHAR(64) NOT NULL,
  label TEXT NOT NULL,
  approved_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  quality_points INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, dimension, expertise_key)
);

CREATE INDEX IF NOT EXISTS idx_reputation_expertise_user
  ON reputation_expertise (user_id, dimension, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_reputation_expertise_lookup
  ON reputation_expertise (dimension, expertise_key, user_id);
