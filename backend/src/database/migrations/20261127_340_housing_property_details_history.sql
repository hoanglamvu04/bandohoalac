-- Additive detail fields; old records stay unknown. No fabricated backfill.
ALTER TABLE housing_listings ADD COLUMN IF NOT EXISTS property_details JSONB NOT NULL DEFAULT '{}'::jsonb
  CHECK(jsonb_typeof(property_details)='object');
CREATE INDEX IF NOT EXISTS housing_subtype_idx ON housing_listings((property_details->>'subtype'));
CREATE INDEX IF NOT EXISTS housing_furnishing_idx ON housing_listings((property_details->>'furnishing'));

CREATE TABLE IF NOT EXISTS housing_listing_history (
  id BIGSERIAL PRIMARY KEY,
  place_id BIGINT NOT NULL REFERENCES housing_listings(place_id) ON DELETE CASCADE,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  listing_type TEXT NOT NULL CHECK(listing_type IN ('SALE','RENT')),
  asking_price_vnd BIGINT CHECK(asking_price_vnd IS NULL OR asking_price_vnd>0),
  availability_status TEXT NOT NULL CHECK(availability_status IN ('AVAILABLE','LIMITED','FULL','UNKNOWN')),
  available_rooms INTEGER CHECK(available_rooms IS NULL OR available_rooms>=0)
);
CREATE INDEX IF NOT EXISTS housing_history_place_time_idx ON housing_listing_history(place_id,observed_at DESC,id DESC);

CREATE OR REPLACE FUNCTION hola_record_housing_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE published BOOLEAN;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF ROW(OLD.listing_type,OLD.monthly_rent,OLD.total_price_vnd,OLD.availability_status,OLD.available_rooms)
       IS NOT DISTINCT FROM ROW(NEW.listing_type,NEW.monthly_rent,NEW.total_price_vnd,NEW.availability_status,NEW.available_rooms)
    THEN RETURN NEW; END IF;
  END IF;
  SELECT EXISTS(SELECT 1 FROM places p JOIN categories c ON c.id=p.category_id
    WHERE p.id=NEW.place_id AND p.status='PUBLISHED' AND c.slug='bat-dong-san'
      AND p.external_source IS NULL AND p.source IN ('USER','CTV','ADMIN')) INTO published;
  IF published AND NEW.listing_status='ACTIVE' AND (NEW.expires_at IS NULL OR NEW.expires_at>NOW()) THEN
    INSERT INTO housing_listing_history(place_id,listing_type,asking_price_vnd,availability_status,available_rooms)
    VALUES(NEW.place_id,NEW.listing_type,
      NULLIF(CASE WHEN NEW.listing_type='SALE' THEN NEW.total_price_vnd ELSE NEW.monthly_rent END,0),
      NEW.availability_status,NEW.available_rooms);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS hola_housing_history ON housing_listings;
CREATE TRIGGER hola_housing_history AFTER INSERT OR UPDATE OF listing_type,monthly_rent,total_price_vnd,availability_status,available_rooms
  ON housing_listings FOR EACH ROW EXECUTE FUNCTION hola_record_housing_history();
