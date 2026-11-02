-- HOLA Embed Platform V1: approved, origin-bound PUBLIC iframe identifiers.
-- Re-run safe: migrate.js applies every migration on each deployment.
CREATE TABLE IF NOT EXISTS embed_applications (
  id BIGSERIAL PRIMARY KEY,
  app_name TEXT NOT NULL CHECK (CHAR_LENGTH(app_name) BETWEEN 2 AND 120),
  contact_email TEXT NOT NULL,
  requested_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  requested_origins TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  approved_origins TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  note TEXT,
  review_note TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED')),
  embed_key TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT embed_approved_must_have_key CHECK (
    status <> 'APPROVED' OR
    (embed_key IS NOT NULL AND CARDINALITY(approved_origins) BETWEEN 1 AND 10)
  )
);
CREATE INDEX IF NOT EXISTS embed_applications_status_created_idx
  ON embed_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS embed_applications_requested_by_idx
  ON embed_applications (requested_by, created_at DESC);
