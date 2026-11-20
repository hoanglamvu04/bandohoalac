-- P0 property lifecycle. Additive and safely re-runnable.
ALTER TABLE housing_listings
  ADD COLUMN IF NOT EXISTS listing_status TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS last_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE housing_listings
  DROP CONSTRAINT IF EXISTS housing_listings_listing_status_check;
ALTER TABLE housing_listings
  ADD CONSTRAINT housing_listings_listing_status_check
  CHECK (listing_status IN ('ACTIVE', 'PAUSED', 'SOLD', 'RENTED', 'EXPIRED'));

CREATE INDEX IF NOT EXISTS housing_listings_active_expiry_idx
  ON housing_listings (expires_at)
  WHERE listing_status = 'ACTIVE' AND expires_at IS NOT NULL;
