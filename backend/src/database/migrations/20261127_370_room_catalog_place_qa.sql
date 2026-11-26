-- One listing / map pin, multiple reviewed rental room types.
ALTER TABLE housing_listings
 ADD COLUMN IF NOT EXISTS room_types jsonb NOT NULL DEFAULT '[]'::jsonb,
 ADD COLUMN IF NOT EXISTS room_catalog_version integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS housing_room_catalog_proposals (
 id bigserial PRIMARY KEY,
 place_id bigint NOT NULL REFERENCES housing_listings(place_id) ON DELETE CASCADE,
 user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 base_version integer NOT NULL CHECK(base_version>=0),
 types jsonb NOT NULL CHECK(jsonb_typeof(types)='array' AND jsonb_array_length(types) BETWEEN 1 AND 20),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
 reviewed_by bigint REFERENCES users(id) ON DELETE SET NULL,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS room_catalog_one_pending ON housing_room_catalog_proposals(place_id) WHERE status='PENDING';
CREATE INDEX IF NOT EXISTS room_catalog_review_queue ON housing_room_catalog_proposals(status,created_at);
CREATE OR REPLACE FUNCTION guard_housing_room_catalog() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE representative jsonb; total_count bigint; available_count bigint;
BEGIN
 IF jsonb_typeof(NEW.room_types)<>'array' OR jsonb_array_length(NEW.room_types)>20 THEN
   RAISE EXCEPTION 'Invalid room catalog';
 END IF;
 IF jsonb_array_length(NEW.room_types)=0 THEN
   IF TG_OP='UPDATE' AND jsonb_array_length(OLD.room_types)>0 THEN
     RAISE EXCEPTION 'Reviewed room catalog cannot be silently removed';
   END IF;
   RETURN NEW;
 END IF;
 SELECT t INTO representative FROM jsonb_array_elements(NEW.room_types) WITH ORDINALITY AS a(t,n)
 ORDER BY CASE WHEN (t->>'availableRooms')::int>0 THEN 0 ELSE 1 END,(t->>'monthlyRentVnd')::bigint,n LIMIT 1;
 SELECT SUM((t->>'totalRooms')::int),SUM((t->>'availableRooms')::int)
 INTO total_count,available_count FROM jsonb_array_elements(NEW.room_types) AS a(t);
 IF NEW.listing_type<>'RENT' OR NEW.property_type NOT IN ('HOUSE','APARTMENT')
 OR NEW.monthly_rent IS DISTINCT FROM (representative->>'monthlyRentVnd')::bigint
 OR NEW.deposit_amount IS DISTINCT FROM (representative->>'depositVnd')::bigint
 OR NEW.area_m2 IS DISTINCT FROM (representative->>'areaM2')::numeric
 OR NEW.total_rooms IS DISTINCT FROM total_count OR NEW.available_rooms IS DISTINCT FROM available_count
 OR NEW.availability_status IS DISTINCT FROM CASE WHEN available_count>0 THEN 'AVAILABLE' ELSE 'FULL' END THEN
   RAISE EXCEPTION 'Use reviewed room catalog to update inventory and representative price';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS housing_room_catalog_guard ON housing_listings;
CREATE TRIGGER housing_room_catalog_guard BEFORE INSERT OR UPDATE OF room_types,monthly_rent,deposit_amount,area_m2,total_rooms,available_rooms,availability_status,listing_type,property_type ON housing_listings
 FOR EACH ROW EXECUTE FUNCTION guard_housing_room_catalog();

CREATE TABLE IF NOT EXISTS place_qa_posts (
 id bigserial PRIMARY KEY,
 place_id bigint NOT NULL REFERENCES places(id) ON DELETE CASCADE,
 author_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 parent_id bigint,
 kind text NOT NULL CHECK(kind IN ('QUESTION','ANSWER')),
 body text NOT NULL CHECK(char_length(body) BETWEEN 10 AND 1200),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PUBLISHED','REJECTED','ARCHIVED')),
 created_at timestamptz NOT NULL DEFAULT NOW(),
 reviewed_at timestamptz,
 reviewed_by bigint REFERENCES users(id) ON DELETE SET NULL,
 UNIQUE(id,place_id),
 FOREIGN KEY(parent_id,place_id) REFERENCES place_qa_posts(id,place_id) ON DELETE CASCADE,
 CHECK((kind='QUESTION' AND parent_id IS NULL) OR (kind='ANSWER' AND parent_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS place_qa_public ON place_qa_posts(place_id,status,kind,created_at DESC);
CREATE INDEX IF NOT EXISTS place_qa_author ON place_qa_posts(author_id,created_at DESC);
CREATE INDEX IF NOT EXISTS place_qa_queue ON place_qa_posts(status,created_at);
CREATE TABLE IF NOT EXISTS place_qa_reports (
 post_id bigint NOT NULL REFERENCES place_qa_posts(id) ON DELETE CASCADE,
 reporter_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 reason text NOT NULL CHECK(reason IN ('SPAM','WRONG_INFO','PRIVATE_INFO','ABUSE')),
 resolved_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT NOW(),
 PRIMARY KEY(post_id,reporter_id)
);
CREATE INDEX IF NOT EXISTS place_qa_unresolved ON place_qa_reports(post_id) WHERE resolved_at IS NULL;
