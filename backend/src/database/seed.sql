-- Hola Maps development seed data
-- Safe to re-run: uses ON CONFLICT guards.
-- IMPORTANT: default passwords below are for LOCAL DEVELOPMENT ONLY. Change them
-- (or drop this seed) before pointing this schema at a real deployment.

-- ============================================================
-- CATEGORIES
-- ============================================================
INSERT INTO categories (name, slug, icon) VALUES
  ('Cafe', 'cafe', 'coffee'),
  ('Ăn uống', 'an-uong', 'utensils'),
  ('Homestay', 'homestay', 'home'),
  ('Villa', 'villa', 'building'),
  ('Check-in', 'check-in', 'camera'),
  ('Trải nghiệm', 'trai-nghiem', 'ferris-wheel')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- USERS
-- Default passwords (bcrypt-hashed via pgcrypto):
--   admin@holamaps.vn      -> Admin@123
--   moderator@holamaps.vn  -> Moderator@123
--   ctv@holamaps.vn        -> Explorer@123
--   user@holamaps.vn       -> Explorer@123
-- ============================================================
INSERT INTO users (name, email, password_hash, role, bio, points_total, trust_score, approved_count)
VALUES
  ('Hola Admin', 'admin@holamaps.vn', crypt('Admin@123', gen_salt('bf', 10)), 'ADMIN', 'Quản trị hệ thống Hola Maps.', 0, 100, 0),
  ('Hola Moderator', 'moderator@holamaps.vn', crypt('Moderator@123', gen_salt('bf', 10)), 'MODERATOR', 'Kiểm duyệt đóng góp cộng đồng.', 0, 80, 0),
  ('Chinh Explorer', 'ctv@holamaps.vn', crypt('Explorer@123', gen_salt('bf', 10)), 'CONTRIBUTOR', 'Thích cafe có view đẹp, homestay yên tĩnh và những góc Hòa Lạc ít người biết.', 1280, 62, 58),
  ('Diep Local Guide', 'user@holamaps.vn', crypt('Explorer@123', gen_salt('bf', 10)), 'USER', 'Người dùng Hola Maps.', 40, 4, 2)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- PLACES around Hoa Lac
-- ============================================================
WITH cat AS (SELECT id, slug FROM categories),
     ctv AS (SELECT id FROM users WHERE email = 'ctv@holamaps.vn')
INSERT INTO places (name, slug, description, category_id, address, location, phone, price_level, opening_hours, status, source, created_by, rating_avg, rating_count)
SELECT * FROM (VALUES
  (
    'The Lake Coffee', 'the-lake-coffee',
    'Không gian nhiều cây xanh, view mở và phù hợp cho một buổi chiều chậm rãi ở Hòa Lạc.',
    (SELECT id FROM cat WHERE slug = 'cafe'), 'Thạch Hòa, Hòa Lạc, Hà Nội',
    ST_SetSRID(ST_MakePoint(105.525, 21.007), 4326)::geometry,
    '0900000001', '30.000 - 70.000đ', '07:00 - 22:00', 'PUBLISHED', 'CTV',
    (SELECT id FROM ctv), 4.8, 126
  ),
  (
    'Forest View Homestay', 'forest-view-homestay',
    'Homestay yên tĩnh giữa rừng thông, phù hợp nghỉ dưỡng cuối tuần.',
    (SELECT id FROM cat WHERE slug = 'homestay'), 'Yên Bình, Hòa Lạc, Hà Nội',
    ST_SetSRID(ST_MakePoint(105.497, 21.028), 4326)::geometry,
    '0900000002', '400.000 - 900.000đ/đêm', '24/7', 'PUBLISHED', 'CTV',
    (SELECT id FROM ctv), 4.9, 84
  ),
  (
    'Lucia Villa', 'lucia-villa',
    'Villa sân vườn rộng, có bể bơi, phù hợp cho nhóm bạn hoặc gia đình.',
    (SELECT id FROM cat WHERE slug = 'villa'), 'Tiến Xuân, Hòa Lạc, Hà Nội',
    ST_SetSRID(ST_MakePoint(105.478, 20.994), 4326)::geometry,
    '0900000003', '2.000.000 - 4.500.000đ/đêm', '24/7', 'PUBLISHED', 'CTV',
    (SELECT id FROM ctv), 4.7, 52
  ),
  (
    'Đồi ngắm hoàng hôn', 'doi-ngam-hoang-hon',
    'Điểm check-in ngắm hoàng hôn nổi tiếng khu vực Hòa Lạc.',
    (SELECT id FROM cat WHERE slug = 'check-in'), 'Hòa Lạc, Hà Nội',
    ST_SetSRID(ST_MakePoint(105.548, 21.014), 4326)::geometry,
    NULL, 'Miễn phí', '05:00 - 20:00', 'PUBLISHED', 'CTV',
    (SELECT id FROM ctv), 4.8, 201
  ),
  (
    'Bếp Nhà Đồi', 'bep-nha-doi',
    'Quán ăn gia đình, món Bắc Bộ, không gian ngoài trời thoáng mát.',
    (SELECT id FROM cat WHERE slug = 'an-uong'), 'Thạch Hòa, Hòa Lạc, Hà Nội',
    ST_SetSRID(ST_MakePoint(105.512, 21.001), 4326)::geometry,
    '0900000005', '50.000 - 150.000đ', '10:00 - 21:00', 'PUBLISHED', 'CTV',
    (SELECT id FROM ctv), 4.6, 67
  )
) AS t(name, slug, description, category_id, address, location, phone, price_level, opening_hours, status, source, created_by, rating_avg, rating_count)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- BADGES
-- ============================================================
INSERT INTO badges (code, name, description, icon, criteria) VALUES
  ('cafe_hunter', 'Cafe Hunter', 'Đóng góp ít nhất 25 quán cafe.', 'coffee', '{"category":"cafe","min_places":25}'),
  ('photographer', 'Photographer', 'Đóng góp hơn 200 ảnh thực tế.', 'camera', '{"min_photos":200}'),
  ('trusted_explorer', 'Trusted Explorer', 'Tỷ lệ đóng góp được duyệt trên 90%.', 'badge-check', '{"min_approval_rate":0.9}')
ON CONFLICT (code) DO NOTHING;

WITH ctv AS (SELECT id FROM users WHERE email = 'ctv@holamaps.vn')
INSERT INTO user_badges (user_id, badge_id)
SELECT ctv.id, badges.id FROM ctv, badges
WHERE badges.code IN ('cafe_hunter', 'photographer', 'trusted_explorer')
ON CONFLICT DO NOTHING;

-- ============================================================
-- POINTS LEDGER seed (backs the cached points_total above)
-- ============================================================
WITH ctv AS (SELECT id FROM users WHERE email = 'ctv@holamaps.vn')
INSERT INTO points_transactions (user_id, amount, reason)
SELECT ctv.id, 1280, 'SEED_INITIAL_BALANCE' FROM ctv
ON CONFLICT DO NOTHING;
