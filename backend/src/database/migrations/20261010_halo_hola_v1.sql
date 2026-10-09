-- HALO HOLA × Hola Maps V1
-- Community photo posts are stored separately from canonical place images.
-- A spot may point to a canonical Hola Maps place or remain a temporary pin.

CREATE TABLE IF NOT EXISTS halo_spots (
  id BIGSERIAL PRIMARY KEY,
  place_id BIGINT REFERENCES places(id) ON DELETE SET NULL,
  external_spot_id TEXT,
  label TEXT NOT NULL,
  address TEXT,
  location GEOMETRY(Point, 4326) NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'HIDDEN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS halo_spots_place_unique_idx
  ON halo_spots (place_id)
  WHERE place_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS halo_spots_external_unique_idx
  ON halo_spots (external_spot_id)
  WHERE external_spot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS halo_spots_location_idx
  ON halo_spots USING GIST (location);

CREATE INDEX IF NOT EXISTS halo_spots_status_idx
  ON halo_spots (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS halo_posts (
  id BIGSERIAL PRIMARY KEY,
  spot_id BIGINT NOT NULL REFERENCES halo_spots(id) ON DELETE CASCADE,
  external_post_id TEXT NOT NULL UNIQUE,
  external_user_id TEXT,
  external_user_name TEXT,
  caption TEXT,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'PUBLISHED'
    CHECK (status IN ('PUBLISHED', 'HIDDEN', 'DELETED')),
  posted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS halo_posts_spot_idx
  ON halo_posts (spot_id, posted_at DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS halo_posts_status_idx
  ON halo_posts (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS halo_media (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES halo_posts(id) ON DELETE CASCADE,
  external_media_id TEXT,
  media_type TEXT NOT NULL DEFAULT 'IMAGE'
    CHECK (media_type IN ('IMAGE')),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'HIDDEN')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, url)
);

CREATE INDEX IF NOT EXISTS halo_media_post_idx
  ON halo_media (post_id, status, sort_order, id);
