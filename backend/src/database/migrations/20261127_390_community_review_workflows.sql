-- Role review is a time-limited manual attestation; not legal ownership or KYC.
CREATE TABLE IF NOT EXISTS housing_advertiser_reviews (
 id BIGSERIAL PRIMARY KEY,
 place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
 requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 declared_role TEXT NOT NULL CHECK(declared_role IN ('OWNER','BROKER','MANAGER')),
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','REVOKED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 reviewed_at TIMESTAMPTZ,
 reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
 valid_until TIMESTAMPTZ,
 revoked_at TIMESTAMPTZ,
 revoked_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
 CHECK(status <> 'APPROVED' OR (reviewed_at IS NOT NULL AND valid_until IS NOT NULL)),
 CHECK(status <> 'REVOKED' OR revoked_at IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS housing_advertiser_one_pending ON housing_advertiser_reviews(place_id) WHERE status='PENDING';
CREATE INDEX IF NOT EXISTS housing_advertiser_review_lookup ON housing_advertiser_reviews(place_id,status,valid_until DESC);
CREATE INDEX IF NOT EXISTS housing_advertiser_review_requester ON housing_advertiser_reviews(requester_id,created_at DESC);
CREATE TABLE IF NOT EXISTS community_event_proposals (
 id BIGSERIAL PRIMARY KEY,
 place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
 requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 5 AND 120),
 description TEXT NOT NULL CHECK(length(description) BETWEEN 10 AND 1000),
 source_url TEXT NOT NULL CHECK(length(source_url) BETWEEN 8 AND 500),
 starts_at TIMESTAMPTZ NOT NULL,
 ends_at TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','REVOKED')),
 feature_id BIGINT UNIQUE REFERENCES map_features(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 reviewed_at TIMESTAMPTZ,
 reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
 revoked_at TIMESTAMPTZ,
 revoked_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
 CHECK(ends_at > starts_at AND ends_at <= starts_at + INTERVAL '7 days')
);
CREATE INDEX IF NOT EXISTS community_event_review_queue ON community_event_proposals(status,created_at);
CREATE INDEX IF NOT EXISTS community_event_requester_idx ON community_event_proposals(requester_id,created_at DESC);
CREATE INDEX IF NOT EXISTS community_event_place_idx ON community_event_proposals(place_id,starts_at,status);
