-- HOLA-P2-123: opt-in partner catalog and private appointment requests.
CREATE TABLE IF NOT EXISTS partner_services (
 id BIGSERIAL PRIMARY KEY,
 place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
 title TEXT NOT NULL CHECK(char_length(title) BETWEEN 2 AND 120),
 description TEXT NOT NULL DEFAULT '' CHECK(char_length(description)<=500),
 price_vnd BIGINT CHECK(price_vnd IS NULL OR price_vnd BETWEEN 0 AND 100000000000),
 active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_services_place_idx ON partner_services(place_id,active,id);
CREATE TABLE IF NOT EXISTS partner_service_requests (
 id BIGSERIAL PRIMARY KEY,
 service_id BIGINT NOT NULL REFERENCES partner_services(id) ON DELETE CASCADE,
 requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 starts_at TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','DECLINED','CANCELLED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS partner_service_request_open_slot_idx ON partner_service_requests(service_id,requester_id,starts_at) WHERE status IN ('PENDING','ACCEPTED');
CREATE INDEX IF NOT EXISTS partner_service_requests_requester_idx ON partner_service_requests(requester_id,created_at DESC);
CREATE INDEX IF NOT EXISTS partner_service_requests_service_idx ON partner_service_requests(service_id,starts_at DESC);
