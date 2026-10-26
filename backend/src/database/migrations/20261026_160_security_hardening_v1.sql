-- Security Hardening V1
-- Short-lived access tokens + rotating HttpOnly refresh sessions,
-- admin TOTP, brute-force lock state and auditable security events.

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash CHAR(64) NOT NULL UNIQUE,
  user_agent TEXT,
  ip_hash CHAR(64),
  two_factor_verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_active_idx
  ON auth_sessions (user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx
  ON auth_sessions (expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS user_security (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  two_factor_secret_ciphertext TEXT,
  two_factor_secret_iv TEXT,
  two_factor_secret_auth_tag TEXT,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_enabled_at TIMESTAMPTZ,
  two_factor_updated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_login_state (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TIMESTAMPTZ,
  last_failed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'INFO'
    CHECK (severity IN ('INFO','WARN','CRITICAL')),
  ip_hash CHAR(64),
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS security_events_user_created_idx
  ON security_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS security_events_type_created_idx
  ON security_events (event_type, created_at DESC);

-- Revoke expired sessions opportunistically without deleting audit history.
UPDATE auth_sessions
SET revoked_at = COALESCE(revoked_at, NOW()),
    revoke_reason = COALESCE(revoke_reason, 'EXPIRED')
WHERE revoked_at IS NULL
  AND expires_at <= NOW();
