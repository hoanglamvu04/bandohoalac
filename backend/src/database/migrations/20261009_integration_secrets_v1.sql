CREATE TABLE IF NOT EXISTS integration_secrets (
  provider TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  last4 TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','DISABLED')),
  last_test_status TEXT
    CHECK (last_test_status IS NULL OR last_test_status IN ('SUCCESS','FAILED')),
  last_test_message TEXT,
  last_tested_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS integration_secrets_status_idx
  ON integration_secrets (status, updated_at DESC);

COMMENT ON TABLE integration_secrets IS
  'Encrypted server-side secrets for external providers. Plaintext values must never be returned by APIs or written to audit logs.';
