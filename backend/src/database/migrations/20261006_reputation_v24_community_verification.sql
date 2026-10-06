CREATE TABLE IF NOT EXISTS community_verifications (
  id BIGSERIAL PRIMARY KEY,
  contribution_id BIGINT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verdict VARCHAR(16) NOT NULL CHECK (verdict IN ('CONFIRM', 'DISPUTE', 'UNSURE')),
  weight NUMERIC(4,2) NOT NULL DEFAULT 1,
  reputation_score INTEGER NOT NULL DEFAULT 0,
  reputation_code VARCHAR(40),
  confidence_score INTEGER NOT NULL DEFAULT 0,
  expertise_key VARCHAR(80),
  expertise_tier VARCHAR(24),
  reason VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contribution_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_verifications_contribution
  ON community_verifications(contribution_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_verifications_user
  ON community_verifications(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS community_verification_states (
  contribution_id BIGINT PRIMARY KEY REFERENCES contributions(id) ON DELETE CASCADE,
  state VARCHAR(24) NOT NULL DEFAULT 'COLLECTING'
    CHECK (state IN ('COLLECTING', 'CONFIRMED', 'DISPUTED', 'SPLIT')),
  required_voters INTEGER NOT NULL DEFAULT 3,
  confirm_count INTEGER NOT NULL DEFAULT 0,
  dispute_count INTEGER NOT NULL DEFAULT 0,
  unsure_count INTEGER NOT NULL DEFAULT 0,
  confirm_weight NUMERIC(8,2) NOT NULL DEFAULT 0,
  dispute_weight NUMERIC(8,2) NOT NULL DEFAULT 0,
  unsure_weight NUMERIC(8,2) NOT NULL DEFAULT 0,
  agreement_ratio NUMERIC(6,4),
  confidence INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_verification_states_state
  ON community_verification_states(state, confidence DESC, updated_at DESC);
