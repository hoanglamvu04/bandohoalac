-- Security Hardening V1.1
-- Retain hashes of rotated refresh tokens so replay of an old token can be
-- detected and the whole account session family revoked.

CREATE TABLE IF NOT EXISTS auth_refresh_token_history (
  token_hash CHAR(64) PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_refresh_token_history_user_idx
  ON auth_refresh_token_history (user_id, rotated_at DESC);

CREATE INDEX IF NOT EXISTS auth_refresh_token_history_expiry_idx
  ON auth_refresh_token_history (expires_at);
