-- Private appointment requests; no phone, email, GPS, or notes are stored.
CREATE TABLE IF NOT EXISTS housing_viewing_requests (
  id BIGSERIAL PRIMARY KEY,
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','DECLINED','CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(requester_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS housing_viewings_requester_idx ON housing_viewing_requests(requester_id,starts_at DESC);
CREATE INDEX IF NOT EXISTS housing_viewings_recipient_idx ON housing_viewing_requests(recipient_id,starts_at DESC);
CREATE INDEX IF NOT EXISTS housing_viewings_place_idx ON housing_viewing_requests(place_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS housing_viewings_request_slot_idx
  ON housing_viewing_requests(requester_id,place_id,starts_at) WHERE status IN ('PENDING','ACCEPTED');
CREATE UNIQUE INDEX IF NOT EXISTS housing_viewings_recipient_slot_idx
  ON housing_viewing_requests(recipient_id,starts_at) WHERE status='ACCEPTED';
CREATE UNIQUE INDEX IF NOT EXISTS housing_viewings_accepted_requester_slot_idx
  ON housing_viewing_requests(requester_id,starts_at) WHERE status='ACCEPTED';
