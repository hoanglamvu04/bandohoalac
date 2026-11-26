-- Monthly observations of the actual active asking-price inventory.
-- No historical backfill or listing identifiers in this aggregate table.
CREATE TABLE IF NOT EXISTS housing_market_monthly (
 month_start DATE NOT NULL,
 observed_day DATE NOT NULL,
 listing_type TEXT NOT NULL CHECK(listing_type IN ('SALE','RENT')),
 property_group TEXT NOT NULL CHECK(property_group IN ('ALL','LAND','HOUSE','APARTMENT','VILLA','COMMERCIAL','OTHER')),
 sample_count INTEGER NOT NULL CHECK(sample_count>=0),
 median_vnd_m2 BIGINT CHECK(median_vnd_m2 IS NULL OR median_vnd_m2>0),
 PRIMARY KEY(month_start,listing_type,property_group),
 CHECK(observed_day>=month_start AND observed_day<month_start+INTERVAL '1 month')
);
