CREATE TABLE IF NOT EXISTS reputation_controls (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  score_adjustment SMALLINT NOT NULL DEFAULT 0
    CHECK (score_adjustment BETWEEN -15 AND 15),
  permission_ceiling VARCHAR(32) NULL
    CHECK (permission_ceiling IS NULL OR permission_ceiling IN (
      'NEW_MEMBER',
      'EXPLORER',
      'CONTRIBUTOR',
      'TRUSTED_CONTRIBUTOR',
      'LOCAL_EXPERT'
    )),
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ NULL,
  updated_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reputation_controls_active
  ON reputation_controls (expires_at)
  WHERE expires_at IS NULL OR expires_at > NOW();
