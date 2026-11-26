-- Additive; existing listings remain unclassified, never implicitly verified.
ALTER TABLE housing_listings ADD COLUMN IF NOT EXISTS advertiser_role TEXT
  CHECK (advertiser_role IS NULL OR advertiser_role IN ('OWNER','BROKER','MANAGER','OTHER'));
