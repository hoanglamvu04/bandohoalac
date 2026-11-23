-- Real Estate Intelligence Sprint 2: user-owned saved searches and
-- deduplicated IN-APP alerts for newly published, approved property listings.
-- Re-runnable: this application reapplies SQL migrations on deployment.

CREATE TABLE IF NOT EXISTS housing_saved_searches (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(filters) = 'object'),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS housing_saved_searches_user_idx
  ON housing_saved_searches (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS housing_saved_searches_enabled_idx
  ON housing_saved_searches (id) WHERE enabled = TRUE;

-- No historical page updates should generate "new property" notifications.
-- A publication timestamp changes only when a place ENTERS PUBLISHED status.
ALTER TABLE places ADD COLUMN IF NOT EXISTS housing_published_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION set_housing_publication_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'PUBLISHED'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'PUBLISHED') THEN
    NEW.housing_published_at = statement_timestamp();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS places_housing_publication_timestamp ON places;
CREATE TRIGGER places_housing_publication_timestamp
BEFORE INSERT OR UPDATE OF status ON places
FOR EACH ROW EXECUTE FUNCTION set_housing_publication_timestamp();

-- Backfill the timestamp conservatively for already published properties:
-- this never produces an alert for a subsequently CREATED saved search.
UPDATE places p
SET housing_published_at = COALESCE(p.created_at, p.updated_at)
WHERE p.housing_published_at IS NULL
  AND p.status = 'PUBLISHED'
  AND p.category_id = (SELECT id FROM categories WHERE slug = 'bat-dong-san');

CREATE INDEX IF NOT EXISTS places_housing_published_at_idx
  ON places (housing_published_at) WHERE status = 'PUBLISHED';

-- Idempotency across overlapping cron runs and process restarts.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_housing_saved_search_dedupe_idx
  ON notifications (
    user_id,
    (data ->> 'savedSearchId'),
    (data ->> 'placeId')
  )
  WHERE type = 'HOUSING_SAVED_SEARCH_MATCH';
