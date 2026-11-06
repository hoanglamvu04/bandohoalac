CREATE TABLE IF NOT EXISTS place_collections (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'PRIVATE'
    CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS place_collections_user_updated_idx
  ON place_collections (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS place_collections_public_updated_idx
  ON place_collections (updated_at DESC)
  WHERE visibility = 'PUBLIC';

CREATE TABLE IF NOT EXISTS place_collection_items (
  id BIGSERIAL PRIMARY KEY,
  collection_id BIGINT NOT NULL REFERENCES place_collections(id) ON DELETE CASCADE,
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  note VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (collection_id, place_id)
);

CREATE INDEX IF NOT EXISTS place_collection_items_order_idx
  ON place_collection_items (collection_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS place_collection_items_place_idx
  ON place_collection_items (place_id, collection_id);
