-- WA-005: deliberately minimal daily counters from explicit-consent WA-002 events.
-- No session IDs, raw event UUIDs, IPs, coordinates, URLs or account details.
-- This source is distinct from soft_launch operational metrics and legacy GA.
CREATE TABLE IF NOT EXISTS wa005_consented_daily_counts (
  day DATE PRIMARY KEY,
  page_views BIGINT NOT NULL DEFAULT 0 CHECK (page_views >= 0),
  contact_clicks BIGINT NOT NULL DEFAULT 0 CHECK (contact_clicks >= 0),
  lead_submissions BIGINT NOT NULL DEFAULT 0 CHECK (lead_submissions >= 0)
);

-- Only ephemeral SHA-256 digests of random event UUIDs, to prevent
-- retry/double-delivery inflation. Never retain a session or visitor key.
CREATE TABLE IF NOT EXISTS wa005_consented_event_dedup (
  event_digest BYTEA PRIMARY KEY CHECK (octet_length(event_digest) = 32),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wa005_consented_event_dedup_age_idx
  ON wa005_consented_event_dedup (received_at);
