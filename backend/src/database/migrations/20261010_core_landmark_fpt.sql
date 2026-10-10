-- Guarantee the real FPT University Hòa Lạc campus exists as a published,
-- searchable canonical place. This repairs production databases where FPT Shop,
-- ATM or Polytechnic records exist but the university landmark is missing,
-- archived, or categorized incorrectly.

DO $$
DECLARE
  school_category_id BIGINT;
  existing_place_id BIGINT;
  fpt_point GEOMETRY(Point, 4326) := ST_SetSRID(ST_MakePoint(105.52522, 21.01354), 4326);
BEGIN
  SELECT id INTO school_category_id
  FROM categories
  WHERE slug = 'truong-hoc'
  LIMIT 1;

  IF school_category_id IS NULL THEN
    RAISE EXCEPTION 'Missing category truong-hoc';
  END IF;

  SELECT p.id INTO existing_place_id
  FROM places p
  WHERE ST_DWithin(p.location::geography, fpt_point::geography, 2500)
    AND lower(public.hola_unaccent(COALESCE(p.name, ''))) IN (
      'truong dai hoc fpt',
      'dai hoc fpt',
      'fpt university',
      'truong dai hoc fpt co so ha noi'
    )
  ORDER BY
    CASE p.status WHEN 'PUBLISHED' THEN 0 WHEN 'PENDING' THEN 1 WHEN 'ARCHIVED' THEN 2 ELSE 3 END,
    p.updated_at DESC,
    p.id ASC
  LIMIT 1;

  IF existing_place_id IS NOT NULL THEN
    UPDATE places
    SET name = 'Trường Đại học FPT',
        category_id = school_category_id,
        address = 'Khu Giáo dục và Đào tạo, Khu Công nghệ cao Hòa Lạc, Km29 Đại lộ Thăng Long, xã Hòa Lạc, TP. Hà Nội',
        location = fpt_point,
        phone = '(024) 7300 5588',
        website = 'https://daihoc.fpt.edu.vn/',
        description = COALESCE(NULLIF(description, ''), 'Trường Đại học FPT cơ sở Hà Nội tại Khu Công nghệ cao Hòa Lạc.'),
        status = 'PUBLISHED',
        updated_at = NOW()
    WHERE id = existing_place_id;
  ELSE
    INSERT INTO places (
      name, slug, description, category_id, address, location, phone, website,
      status, source, created_by
    ) VALUES (
      'Trường Đại học FPT',
      'truong-dai-hoc-fpt-hoa-lac',
      'Trường Đại học FPT cơ sở Hà Nội tại Khu Công nghệ cao Hòa Lạc.',
      school_category_id,
      'Khu Giáo dục và Đào tạo, Khu Công nghệ cao Hòa Lạc, Km29 Đại lộ Thăng Long, xã Hòa Lạc, TP. Hà Nội',
      fpt_point,
      '(024) 7300 5588',
      'https://daihoc.fpt.edu.vn/',
      'PUBLISHED',
      'ADMIN',
      NULL
    )
    ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        category_id = EXCLUDED.category_id,
        address = EXCLUDED.address,
        location = EXCLUDED.location,
        phone = EXCLUDED.phone,
        website = EXCLUDED.website,
        description = EXCLUDED.description,
        status = 'PUBLISHED',
        updated_at = NOW();
  END IF;
END $$;
