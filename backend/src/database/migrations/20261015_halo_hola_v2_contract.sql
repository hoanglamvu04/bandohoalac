-- HALO HOLA × HOLA Maps V2 contract hardening.
-- Adds explicit provenance and normalizes persisted media URLs to the stable
-- HALO redirect endpoint instead of signed R2 targets.

ALTER TABLE halo_posts
  ADD COLUMN IF NOT EXISTS source TEXT;

UPDATE halo_posts
SET source = 'HALO_HOLA'
WHERE source IS NULL OR source = '';

ALTER TABLE halo_posts
  ALTER COLUMN source SET DEFAULT 'HALO_HOLA';

ALTER TABLE halo_posts
  ALTER COLUMN source SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'halo_posts_source_check'
  ) THEN
    ALTER TABLE halo_posts
      ADD CONSTRAINT halo_posts_source_check
      CHECK (source IN ('HALO_HOLA'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS halo_posts_source_status_idx
  ON halo_posts (source, status, updated_at DESC);

-- Existing rows with an external media id are safe to normalize because the
-- HALO endpoint is stable and issues fresh signed redirects on every request.
UPDATE halo_media
SET url = 'https://halohola.vn/api/submissions/media/' ||
          replace(replace(external_media_id, '/', '%2F'), ' ', '%20') || '/halo',
    thumbnail_url = 'https://halohola.vn/api/submissions/media/' ||
          replace(replace(external_media_id, '/', '%2F'), ' ', '%20') || '/halo',
    updated_at = NOW()
WHERE external_media_id IS NOT NULL
  AND btrim(external_media_id) <> '';
