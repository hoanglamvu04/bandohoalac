-- Security Hardening V2: one-time recovery codes for TOTP accounts.

CREATE TABLE IF NOT EXISTS two_factor_recovery_codes (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  UNIQUE (user_id, code_hash)
);

CREATE INDEX IF NOT EXISTS two_factor_recovery_codes_active_idx
  ON two_factor_recovery_codes (user_id, id)
  WHERE used_at IS NULL;
