-- Hola Maps local-search data hygiene.
-- Repair obvious legacy category mistakes and hide stale central-Hanoi addresses
-- on Hòa Lạc landmark records imported from Overture.

DO $$
DECLARE
  school_category_id BIGINT;
BEGIN
  SELECT id INTO school_category_id
  FROM categories
  WHERE slug = 'truong-hoc'
  LIMIT 1;

  IF school_category_id IS NOT NULL THEN
    UPDATE places
    SET category_id = school_category_id,
        updated_at = NOW()
    WHERE status = 'PUBLISHED'
      AND lower(public.hola_unaccent(COALESCE(name, ''))) ~
        '(^| )(truong dai hoc|dai hoc|hoc vien|cao dang|university|college)( |$)'
      AND category_id IS DISTINCT FROM school_category_id;
  END IF;
END $$;

UPDATE imported_places
SET mapped_category_slug = 'truong-hoc',
    updated_at = NOW()
WHERE source = 'OVERTURE'
  AND lower(public.hola_unaccent(COALESCE(name, ''))) ~
    '(^| )(truong dai hoc|dai hoc|hoc vien|cao dang|university|college)( |$)'
  AND mapped_category_slug IS DISTINCT FROM 'truong-hoc';

-- Some imported Hòa Lạc education POIs carried the address of their old/main
-- campus in central Hanoi although their coordinates are in the Hola Maps area.
-- Replace only the clearly stale central-Hanoi address strings. Coordinates are
-- kept untouched and remain the source of truth for map/search distance.
UPDATE places
SET address = 'Hòa Lạc, Hà Nội',
    updated_at = NOW()
WHERE source = 'OVERTURE'
  AND status = 'PUBLISHED'
  AND lower(public.hola_unaccent(COALESCE(name, ''))) ~
    '(^| )(truong dai hoc|dai hoc|hoc vien|cao dang|university|college)( |$)'
  AND lower(public.hola_unaccent(COALESCE(address, ''))) ~
    '(pham van dong|ton that thuyet|xuan thuy|cau giay|nam tu liem|bac tu liem)'
  AND ST_X(location) BETWEEN 105.250 AND 105.790
  AND ST_Y(location) BETWEEN 20.825 AND 21.245;

UPDATE imported_places
SET address = 'Hòa Lạc, Hà Nội',
    updated_at = NOW()
WHERE source = 'OVERTURE'
  AND lower(public.hola_unaccent(COALESCE(name, ''))) ~
    '(^| )(truong dai hoc|dai hoc|hoc vien|cao dang|university|college)( |$)'
  AND lower(public.hola_unaccent(COALESCE(address, ''))) ~
    '(pham van dong|ton that thuyet|xuan thuy|cau giay|nam tu liem|bac tu liem)'
  AND ST_X(location) BETWEEN 105.250 AND 105.790
  AND ST_Y(location) BETWEEN 20.825 AND 21.245;
