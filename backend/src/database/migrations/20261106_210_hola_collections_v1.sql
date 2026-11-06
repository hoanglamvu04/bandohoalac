-- HOLA Collections V1: user-owned, shareable collections of published places.
-- Idempotent by design: the production migration runner reapplies every SQL file.
CREATE TABLE IF NOT EXISTS place_collections (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL CHECK (CHAR_LENGTH(BTRIM(title)) BETWEEN 2 AND 100),
  slug VARCHAR(140) NOT NULL UNIQUE,
  description VARCHAR(500) NOT NULL DEFAULT '',
  visibility VARCHAR(10) NOT NULL DEFAULT 'PRIVATE'
    CHECK (visibility IN ('PRIVATE', 'PUBLIC')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS place_collections_owner_updated_idx
  ON place_collections (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS place_collections_public_slug_idx
  ON place_collections (slug)
  WHERE visibility = 'PUBLIC';

CREATE TABLE IF NOT EXISTS collection_places (
  collection_id BIGINT NOT NULL REFERENCES place_collections(id) ON DELETE CASCADE,
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, place_id),
  UNIQUE (collection_id, position)
);

CREATE INDEX IF NOT EXISTS collection_places_place_idx
  ON collection_places (place_id, collection_id);
