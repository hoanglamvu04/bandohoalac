-- Hola Maps database schema
-- PostgreSQL 14+ with PostGIS extension

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER'
    CHECK (role IN ('USER', 'CONTRIBUTOR', 'MODERATOR', 'ADMIN')),
  avatar_url TEXT,
  bio TEXT,
  points_total INTEGER NOT NULL DEFAULT 0,
  trust_score INTEGER NOT NULL DEFAULT 0,
  approved_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PLACES (single source of truth for every location on the map)
-- ============================================================
CREATE TABLE IF NOT EXISTS places (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  address TEXT,
  location GEOMETRY(Point, 4326) NOT NULL,
  phone TEXT,
  website TEXT,
  price_level TEXT,
  opening_hours TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PUBLISHED', 'REJECTED', 'ARCHIVED')),
  source TEXT NOT NULL DEFAULT 'ADMIN'
    CHECK (source IN ('ADMIN', 'CTV', 'USER')),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  rating_avg NUMERIC(3, 2) NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS places_location_idx ON places USING GIST (location);
CREATE INDEX IF NOT EXISTS places_status_idx ON places (status);
CREATE INDEX IF NOT EXISTS places_category_idx ON places (category_id);
CREATE INDEX IF NOT EXISTS places_slug_idx ON places (slug);

-- Google Places import provenance. Only the stable Place ID is used for
-- duplicate detection; Admin still reviews imported fields before publishing.
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS google_maps_uri TEXT,
  ADD COLUMN IF NOT EXISTS google_imported_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS places_google_place_id_unique_idx
  ON places (google_place_id)
  WHERE google_place_id IS NOT NULL;

-- ============================================================
-- PLACE IMAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS place_images (
  id BIGSERIAL PRIMARY KEY,
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS place_images_place_idx ON place_images (place_id);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id BIGSERIAL PRIMARY KEY,
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (place_id, user_id)
);

CREATE INDEX IF NOT EXISTS reviews_place_idx ON reviews (place_id);

-- ============================================================
-- FAVORITES
-- ============================================================
CREATE TABLE IF NOT EXISTS favorites (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, place_id)
);

-- ============================================================
-- CONTRIBUTIONS (CTV/User submissions awaiting moderation)
-- ============================================================
CREATE TABLE IF NOT EXISTS contributions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id BIGINT REFERENCES places(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'CREATE_PLACE', 'UPDATE_PLACE', 'ADD_PHOTO', 'FIX_LOCATION',
    'UPDATE_HOURS', 'UPDATE_PRICE', 'REPORT_CLOSED', 'REPORT_WRONG_INFO'
  )),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  reject_reason TEXT,
  reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contributions_user_idx ON contributions (user_id);
CREATE INDEX IF NOT EXISTS contributions_status_idx ON contributions (status);
CREATE INDEX IF NOT EXISTS contributions_place_idx ON contributions (place_id);

-- ============================================================
-- CONTRIBUTION CHANGES (field-level diff, mainly for UPDATE_* types)
-- ============================================================
CREATE TABLE IF NOT EXISTS contribution_changes (
  id BIGSERIAL PRIMARY KEY,
  contribution_id BIGINT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contribution_changes_contribution_idx ON contribution_changes (contribution_id);

-- ============================================================
-- POINTS LEDGER (source of truth for a user's points)
-- ============================================================
CREATE TABLE IF NOT EXISTS points_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contribution_id BIGINT REFERENCES contributions(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS points_transactions_user_idx ON points_transactions (user_id);

-- ============================================================
-- BADGES
-- ============================================================
CREATE TABLE IF NOT EXISTS badges (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS user_badges_user_idx ON user_badges (user_id);


-- ============================================================
-- MAP FEATURES (editable local data layers)
-- ============================================================
CREATE TABLE IF NOT EXISTS map_features (
  id BIGSERIAL PRIMARY KEY,
  layer_type TEXT NOT NULL CHECK (layer_type IN (
    'ROAD', 'TERRAIN', 'WATER', 'BUILDING', 'LANDMARK',
    'FLOOD', 'ROAD_CLOSURE', 'ALERT', 'PLANNING', 'EVENT'
  )),
  name TEXT,
  geometry GEOMETRY(Geometry, 4326) NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity TEXT CHECK (severity IS NULL OR severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DRAFT', 'ARCHIVED')),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS map_features_geometry_idx ON map_features USING GIST (geometry);
CREATE INDEX IF NOT EXISTS map_features_layer_type_idx ON map_features (layer_type);
CREATE INDEX IF NOT EXISTS map_features_status_idx ON map_features (status);
CREATE INDEX IF NOT EXISTS map_features_validity_idx ON map_features (valid_from, valid_until);


-- ============================================================
-- STORAGE METADATA FOR MANAGED PLACE IMAGES
-- ============================================================
ALTER TABLE place_images
  ADD COLUMN IF NOT EXISTS storage_provider TEXT,
  ADD COLUMN IF NOT EXISTS storage_public_id TEXT,
  ADD COLUMN IF NOT EXISTS storage_asset_folder TEXT;

-- Old data could contain more than one cover because each photo contribution
-- used to mark its first image as cover. Keep the oldest cover and normalize
-- the rest before enforcing the invariant.
WITH ranked_covers AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY place_id ORDER BY id ASC) AS rn
  FROM place_images
  WHERE is_cover = TRUE
)
UPDATE place_images
SET is_cover = FALSE
WHERE id IN (
  SELECT id FROM ranked_covers WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS place_images_single_cover_idx
  ON place_images (place_id)
  WHERE is_cover = TRUE;

CREATE INDEX IF NOT EXISTS favorites_user_idx ON favorites (user_id);
CREATE INDEX IF NOT EXISTS reviews_user_idx ON reviews (user_id);

-- ============================================================
-- USER NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id, read_at)
  WHERE read_at IS NULL;


-- ============================================================
-- HOMEPAGE ADVERTISEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS advertisements (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT,
  image_storage_provider TEXT,
  image_storage_public_id TEXT,
  image_storage_filename TEXT,
  target_url TEXT NOT NULL,
  alt_text TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS advertisements_public_idx
  ON advertisements (status, sort_order, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS ad_daily_hides (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hide_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, hide_date)
);

CREATE INDEX IF NOT EXISTS ad_daily_hides_user_date_idx
  ON ad_daily_hides (user_id, hide_date DESC);


-- ============================================================
-- USER ACCOUNT STATUS + SPENDABLE POINTS WALLET
-- ============================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status TEXT,
  ADD COLUMN IF NOT EXISTS points_balance INTEGER;

UPDATE users
SET account_status = 'ACTIVE'
WHERE account_status IS NULL;

UPDATE users
SET points_balance = points_total
WHERE points_balance IS NULL;

ALTER TABLE users
  ALTER COLUMN account_status SET DEFAULT 'ACTIVE',
  ALTER COLUMN account_status SET NOT NULL,
  ALTER COLUMN points_balance SET DEFAULT 0,
  ALTER COLUMN points_balance SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_account_status_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_account_status_check
      CHECK (account_status IN ('ACTIVE', 'SUSPENDED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_account_status_idx
  ON users (account_status);

-- ============================================================
-- PARTNER PLACES
-- A partner profile is attached to an existing Hola Maps place.
-- ============================================================
CREATE TABLE IF NOT EXISTS place_partners (
  id BIGSERIAL PRIMARY KEY,
  place_id BIGINT NOT NULL UNIQUE REFERENCES places(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACTIVE', 'PAUSED', 'ENDED')),
  partner_name TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  note TEXT,
  joined_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS place_partners_status_idx
  ON place_partners (status);

-- ============================================================
-- REWARD / VOUCHER CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS voucher_campaigns (
  id BIGSERIAL PRIMARY KEY,
  partner_id BIGINT NOT NULL REFERENCES place_partners(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  voucher_value_text TEXT,
  terms TEXT,
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  quantity_total INTEGER CHECK (quantity_total IS NULL OR quantity_total >= 0),
  quantity_redeemed INTEGER NOT NULL DEFAULT 0 CHECK (quantity_redeemed >= 0),
  max_per_user INTEGER NOT NULL DEFAULT 1 CHECK (max_per_user > 0),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS voucher_campaigns_public_idx
  ON voucher_campaigns (status, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS voucher_campaigns_partner_idx
  ON voucher_campaigns (partner_id);

-- ============================================================
-- VOUCHER REDEMPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS voucher_redemptions (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES voucher_campaigns(id) ON DELETE RESTRICT,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  points_spent INTEGER NOT NULL CHECK (points_spent > 0),
  status TEXT NOT NULL DEFAULT 'ISSUED'
    CHECK (status IN ('ISSUED', 'REDEEMED', 'CANCELLED', 'EXPIRED')),
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS voucher_redemptions_user_idx
  ON voucher_redemptions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS voucher_redemptions_campaign_idx
  ON voucher_redemptions (campaign_id, created_at DESC);


-- ============================================================
-- BUSINESS CLAIMS / PLACE MANAGERS
-- ============================================================
CREATE TABLE IF NOT EXISTS place_claims (
  id BIGSERIAL PRIMARY KEY,
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name TEXT,
  contact_phone TEXT,
  proof_note TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS place_claims_place_idx
  ON place_claims (place_id, created_at DESC);

CREATE INDEX IF NOT EXISTS place_claims_user_idx
  ON place_claims (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS place_claims_pending_unique
  ON place_claims (place_id, user_id)
  WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS place_managers (
  id BIGSERIAL PRIMARY KEY,
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'OWNER'
    CHECK (role IN ('OWNER', 'MANAGER')),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (place_id, user_id)
);

CREATE INDEX IF NOT EXISTS place_managers_user_idx
  ON place_managers (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_memberships (
  id BIGSERIAL PRIMARY KEY,
  partner_id BIGINT NOT NULL REFERENCES place_partners(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'OWNER'
    CHECK (role IN ('OWNER', 'STAFF')),
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (partner_id, user_id)
);

CREATE INDEX IF NOT EXISTS partner_memberships_user_idx
  ON partner_memberships (user_id, status);

-- ============================================================
-- COMMUNITY MISSIONS / CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS missions (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED')),
  contribution_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  target_count INTEGER NOT NULL DEFAULT 1 CHECK (target_count > 0),
  bonus_points INTEGER NOT NULL DEFAULT 0 CHECK (bonus_points >= 0),
  completion_bonus INTEGER NOT NULL DEFAULT 0 CHECK (completion_bonus >= 0),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS missions_active_idx
  ON missions (status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS mission_contributions (
  id BIGSERIAL PRIMARY KEY,
  mission_id BIGINT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  contribution_id BIGINT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bonus_points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mission_id, contribution_id)
);

CREATE INDEX IF NOT EXISTS mission_contributions_user_idx
  ON mission_contributions (user_id, mission_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mission_completions (
  id BIGSERIAL PRIMARY KEY,
  mission_id BIGINT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mission_id, user_id)
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_idx
  ON audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_actor_idx
  ON audit_logs (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_entity_idx
  ON audit_logs (entity_type, entity_id, created_at DESC);
