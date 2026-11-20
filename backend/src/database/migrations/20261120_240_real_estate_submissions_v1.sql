-- Real Estate submissions V1: extend the existing Housing profile for
-- reviewed sale and rental listings. Existing room-rental entries stay RENT.
-- This repository reapplies SQL migrations on each deploy.
ALTER TABLE housing_listings
  ADD COLUMN IF NOT EXISTS listing_type TEXT NOT NULL DEFAULT 'RENT',
  ADD COLUMN IF NOT EXISTS property_type TEXT,
  ADD COLUMN IF NOT EXISTS total_price_vnd BIGINT,
  ADD COLUMN IF NOT EXISTS contact_name TEXT;

ALTER TABLE housing_listings
  DROP CONSTRAINT IF EXISTS housing_listings_listing_type_check;
ALTER TABLE housing_listings
  ADD CONSTRAINT housing_listings_listing_type_check
  CHECK (listing_type IN ('SALE', 'RENT'));

ALTER TABLE housing_listings
  DROP CONSTRAINT IF EXISTS housing_listings_property_type_check;
ALTER TABLE housing_listings
  ADD CONSTRAINT housing_listings_property_type_check
  CHECK (property_type IS NULL OR property_type IN (
    'LAND', 'HOUSE', 'APARTMENT', 'VILLA', 'COMMERCIAL', 'OTHER'
  ));

ALTER TABLE housing_listings
  DROP CONSTRAINT IF EXISTS housing_listings_total_price_check;
ALTER TABLE housing_listings
  ADD CONSTRAINT housing_listings_total_price_check
  CHECK (total_price_vnd IS NULL OR total_price_vnd > 0);

CREATE INDEX IF NOT EXISTS housing_listings_transaction_price_idx
  ON housing_listings (listing_type, total_price_vnd)
  WHERE listing_type = 'SALE';
