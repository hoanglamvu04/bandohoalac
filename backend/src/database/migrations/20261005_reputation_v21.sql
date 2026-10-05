CREATE TABLE IF NOT EXISTS reputation_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contribution_id BIGINT NULL REFERENCES contributions(id) ON DELETE SET NULL,
  event_type VARCHAR(64) NOT NULL,
  score_before SMALLINT NOT NULL DEFAULT 0,
  score_after SMALLINT NOT NULL DEFAULT 0,
  score_delta SMALLINT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reputation_events_user_created
  ON reputation_events (user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_reputation_events_contribution
  ON reputation_events (contribution_id)
  WHERE contribution_id IS NOT NULL;
