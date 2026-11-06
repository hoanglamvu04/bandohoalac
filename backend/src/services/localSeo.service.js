import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { SERVICE_AREA_GEOJSON_STRING } from '../config/mapCoverage.js';

const PAGE_SELECT = [
  'SELECT',
  '  id, slug, page_type, title, seo_title, seo_description, excerpt,',
  '  area_name, area_terms, center, radius_m, category_slug,',
  '  include_category_slugs, exclude_category_slugs, map_region_slug, map_supported,',
  '  body, min_place_count, min_photo_places, min_recent_verified,',
  '  freshness_days, min_word_count, min_sections, status, published_at,',
  '  editorial_reviewed_by, editorial_reviewed_at, created_at, updated_at',
  'FROM local_seo_pages'
].join('\n');

function countWords(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/<[^>]*>/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function editorialWordCount(page) {
  const parts = [page.excerpt];
  for (const section of Array.isArray(page.body) ? page.body : []) {
    parts.push(section?.heading);
    if (Array.isArray(section?.paragraphs)) parts.push(...section.paragraphs);
    if (Array.isArray(section?.bullets)) parts.push(...section.bullets);
  }
  return countWords(parts.filter(Boolean).join(' '));
}

function mapPage(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    slug: row.slug,
    pageType: row.page_type,
    title: row.title,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    excerpt: row.excerpt,
    areaName: row.area_name,
    areaTerms: row.area_terms || [],
    radiusM: Number(row.radius_m) || 0,
    categorySlug: row.category_slug || null,
    includeCategorySlugs: row.include_category_slugs || [],
    excludeCategorySlugs: row.exclude_category_slugs || [],
    mapRegionSlug: row.map_region_slug || null,
    mapSupported: Boolean(row.map_supported),
    body: Array.isArray(row.body) ? row.body : [],
    minPlaceCount: Number(row.min_place_count) || 5,
    minPhotoPlaces: Number(row.min_photo_places) || 3,
    minRecentVerified: Number(row.min_recent_verified) || 3,
    freshnessDays: Number(row.freshness_days) || 180,
    minWordCount: Number(row.min_word_count) || 350,
    minSections: Number(row.min_sections) || 3,
    status: row.status,
    publishedAt: row.published_at,
    editorialReviewedBy: row.editorial_reviewed_by ? String(row.editorial_reviewed_by) : null,
    editorialReviewedAt: row.editorial_reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function placeAreaFilterSql(pageAlias = 's', placeAlias = 'p') {
  return [
    '(',
    '  (' + pageAlias + '.center IS NOT NULL AND ' + placeAlias + '.location IS NOT NULL AND ST_DWithin(' + placeAlias + '.location::geography, ' + pageAlias + '.center::geography, ' + pageAlias + '.radius_m))',
    '  OR',
    '  ((' + pageAlias + '.center IS NULL OR ' + placeAlias + '.location IS NULL) AND EXISTS (',
    '    SELECT 1 FROM unnest(' + pageAlias + '.area_terms) AS term',
    "    WHERE lower(public.hola_unaccent(COALESCE(" + placeAlias + ".address, ''))) LIKE",
    "      '%' || lower(public.hola_unaccent(term)) || '%'",
    '  ))',
    ')'
  ].join('\n');
}

function placeMapFilterSql(pageAlias = 's', placeAlias = 'p') {
  return [
    placeAreaFilterSql(pageAlias, placeAlias),
    placeAlias + '.location IS NOT NULL',
    'ST_IsValid(' + placeAlias + '.location)',
    '(' + pageAlias + '.center IS NULL OR ST_DWithin(' + placeAlias + '.location::geography, ' + pageAlias + '.center::geography, ' + pageAlias + '.radius_m))',
    '(' + pageAlias + '.map_supported = FALSE OR ST_Intersects(' + placeAlias + '.location, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)))'
  ].join(' AND ');
}
function categoryFilterSql(pageAlias = 's', categoryAlias = 'c') {
  return [
    '(' + pageAlias + '.category_slug IS NULL OR ' + categoryAlias + '.slug = ' + pageAlias + '.category_slug)',
    '(cardinality(' + pageAlias + '.include_category_slugs) = 0 OR ' + categoryAlias + '.slug = ANY(' + pageAlias + '.include_category_slugs))',
    '(cardinality(' + pageAlias + '.exclude_category_slugs) = 0 OR NOT (' + categoryAlias + '.slug = ANY(' + pageAlias + '.exclude_category_slugs)))'
  ].join(' AND ');
}

async function getPageRowById(id, client = pool) {
  const { rows } = await client.query(PAGE_SELECT + ' WHERE id = $1 LIMIT 1', [id]);
  return rows[0] || null;
}

async function getPageRowBySlug(slug, client = pool) {
  const { rows } = await client.query(PAGE_SELECT + ' WHERE slug = $1 LIMIT 1', [String(slug || '').trim()]);
  return rows[0] || null;
}

async function evaluateQuality(row, client = pool) {
  const page = mapPage(row);
  const areaFilter = placeAreaFilterSql('s', 'p');
  const categoryFilter = categoryFilterSql('s', 'c');
  const { rows } = await client.query(
    [
      'SELECT',
      '  COUNT(*)::int AS place_count,',
      '  COUNT(*) FILTER (WHERE p.location IS NOT NULL AND ST_IsValid(p.location)',
      '    AND ST_X(p.location) BETWEEN -180 AND 180',
      '    AND ST_Y(p.location) BETWEEN -90 AND 90',
      '    AND (s.center IS NULL OR ST_DWithin(p.location::geography, s.center::geography, s.radius_m))',
      '    AND (s.map_supported = FALSE OR ST_Intersects(p.location, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))))::int AS coordinate_count,',
      '  COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM place_images pi WHERE pi.place_id = p.id))::int AS photo_place_count,',
      "  COUNT(*) FILTER (WHERE p.last_verified_at >= NOW() - ($3::integer * INTERVAL '1 day'))::int AS recent_verified_count,",
      "  COUNT(*) FILTER (WHERE NULLIF(BTRIM(p.address), '') IS NOT NULL)::int AS address_count,",
      '  MAX(p.updated_at) AS inventory_updated_at,',
      '  MAX(p.last_verified_at) AS latest_verified_at',
      'FROM local_seo_pages s',
      "JOIN places p ON p.status = 'PUBLISHED' AND " + areaFilter,
      'LEFT JOIN categories c ON c.id = p.category_id',
      'WHERE s.id = $1 AND ' + categoryFilter
    ].join('\n'),
    [row.id, SERVICE_AREA_GEOJSON_STRING, page.freshnessDays]
  );

  const stats = rows[0] || {};
  const placeCount = Number(stats.place_count) || 0;
  const coordinateCount = Number(stats.coordinate_count) || 0;
  const photoPlaceCount = Number(stats.photo_place_count) || 0;
  const recentVerifiedCount = Number(stats.recent_verified_count) || 0;
  const addressCount = Number(stats.address_count) || 0;
  const wordCount = editorialWordCount(page);
  const sectionCount = page.body.length;
  const blockers = [];

  if (!page.mapSupported) blockers.push('Khu vực chưa được HOLA MAP hỗ trợ bản đồ tương tác.');
  if (placeCount < page.minPlaceCount) {
    blockers.push('Chỉ có ' + placeCount + '/' + page.minPlaceCount + ' địa điểm phù hợp đã xuất bản.');
  }
  if (coordinateCount !== placeCount) {
    blockers.push('Có ' + (placeCount - coordinateCount) + ' địa điểm thiếu tọa độ hợp lệ.');
  }
  if (addressCount !== placeCount) {
    blockers.push('Có ' + (placeCount - addressCount) + ' địa điểm thiếu địa chỉ.');
  }
  if (photoPlaceCount < page.minPhotoPlaces) {
    blockers.push('Chỉ có ' + photoPlaceCount + '/' + page.minPhotoPlaces + ' địa điểm có ảnh thực tế.');
  }
  if (recentVerifiedCount < page.minRecentVerified) {
    blockers.push('Chỉ có ' + recentVerifiedCount + '/' + page.minRecentVerified + ' địa điểm được xác minh trong ' + page.freshnessDays + ' ngày gần đây.');
  }
  if (wordCount < page.minWordCount) {
    blockers.push('Nội dung có ' + wordCount + '/' + page.minWordCount + ' từ biên tập.');
  }
  if (sectionCount < page.minSections) {
    blockers.push('Nội dung có ' + sectionCount + '/' + page.minSections + ' phần chuyên biệt.');
  }

  return {
    placeCount,
    coordinateCount,
    photoPlaceCount,
    recentVerifiedCount,
    addressCount,
    wordCount,
    sectionCount,
    inventoryUpdatedAt: stats.inventory_updated_at || null,
    latestVerifiedAt: stats.latest_verified_at || null,
    ready: blockers.length === 0,
    blockers
  };
}

async function loadPagePlaces(row, client = pool) {
  const mapFilter = placeMapFilterSql('s', 'p');
  const categoryFilter = categoryFilterSql('s', 'c');
  const { rows } = await client.query(
    [
      'SELECT',
      '  p.id, p.slug, p.name, p.description, p.address, p.phone, p.website,',
      '  p.price_level, p.opening_hours, p.rating_avg, p.rating_count,',
      '  p.last_verified_at, p.updated_at,',
      '  ST_X(p.location) AS lng, ST_Y(p.location) AS lat,',
      '  c.name AS category, c.slug AS category_slug,',
      '  (SELECT COALESCE(pi.card_url, pi.thumbnail_url, pi.url)',
      '   FROM place_images pi WHERE pi.place_id = p.id',
      '   ORDER BY pi.is_cover DESC, pi.id ASC LIMIT 1) AS cover_image,',
      '  COALESCE((SELECT json_agg(pi.url ORDER BY pi.is_cover DESC, pi.id ASC)',
      "   FROM place_images pi WHERE pi.place_id = p.id), '[]'::json) AS images,",
      '  COALESCE((SELECT json_agg(COALESCE(pi.card_url, pi.thumbnail_url, pi.url)',
      '   ORDER BY pi.is_cover DESC, pi.id ASC)',
      "   FROM place_images pi WHERE pi.place_id = p.id), '[]'::json) AS card_images",
      'FROM local_seo_pages s',
      "JOIN places p ON p.status = 'PUBLISHED' AND " + mapFilter,
      'LEFT JOIN categories c ON c.id = p.category_id',
      'WHERE s.id = $1 AND ' + categoryFilter,
      'ORDER BY',
      '  CASE WHEN EXISTS (SELECT 1 FROM place_images pi2 WHERE pi2.place_id = p.id) THEN 1 ELSE 0 END DESC,',
      "  CASE WHEN p.last_verified_at >= NOW() - (s.freshness_days * INTERVAL '1 day') THEN 1 ELSE 0 END DESC,",
      '  p.rating_avg DESC, p.rating_count DESC, p.updated_at DESC, p.id ASC',
      'LIMIT 40'
    ].join('\n'),
    [row.id, SERVICE_AREA_GEOJSON_STRING]
  );

  return rows.map((item) => ({
    id: String(item.id),
    slug: item.slug,
    name: item.name,
    description: item.description || '',
    address: item.address || '',
    phone: item.phone || null,
    website: item.website || null,
    priceLevel: item.price_level || null,
    openingHours: item.opening_hours || null,
    rating: Number(item.rating_avg) || 0,
    reviews: Number(item.rating_count) || 0,
    lat: Number(item.lat),
    lng: Number(item.lng),
    category: item.category || 'Địa điểm',
    categorySlug: item.category_slug || null,
    coverImage: item.cover_image || null,
    images: Array.isArray(item.images) ? item.images : [],
    cardImages: Array.isArray(item.card_images) ? item.card_images : [],
    lastVerifiedAt: item.last_verified_at || null,
    updatedAt: item.updated_at
  }));
}

export async function getLocalSeoPageBySlug(slug) {
  const row = await getPageRowBySlug(slug);
  if (!row || row.status !== 'PUBLISHED') return null;

  const page = mapPage(row);
  const quality = await evaluateQuality(row);
  if (!quality.ready || !page.mapSupported || !page.editorialReviewedAt) return null;

  const places = await loadPagePlaces(row);
  if (places.length < page.minPlaceCount) return null;

  return {
    page: {
      slug: page.slug,
      title: page.title,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      excerpt: page.excerpt,
      areaName: page.areaName,
      mapSupported: page.mapSupported,
      body: page.body,
      updatedAt: quality.inventoryUpdatedAt
        && new Date(quality.inventoryUpdatedAt) > new Date(page.updatedAt)
        ? quality.inventoryUpdatedAt
        : page.updatedAt,
      coverImage: places.find((place) => place.coverImage)?.coverImage || null
    },
    places
  };
}

export async function listLocalSeoSitemapEntries() {
  const { rows } = await pool.query(
    PAGE_SELECT + " WHERE status = 'PUBLISHED' ORDER BY updated_at DESC, id ASC"
  );
  const entries = [];

  for (const row of rows) {
    const page = mapPage(row);
    if (!page.mapSupported || !page.editorialReviewedAt) continue;
    const quality = await evaluateQuality(row);
    if (!quality.ready) continue;
    const places = await loadPagePlaces(row);
    if (places.length < page.minPlaceCount) continue;
    entries.push({
      slug: page.slug,
      updated_at: quality.inventoryUpdatedAt
        && new Date(quality.inventoryUpdatedAt) > new Date(page.updatedAt)
        ? quality.inventoryUpdatedAt
        : page.updatedAt,
      cover_image: places.find((place) => place.coverImage)?.coverImage || null
    });
  }

  return entries;
}

export async function listAdminLocalSeoPages() {
  const { rows } = await pool.query(PAGE_SELECT + ' ORDER BY created_at ASC, id ASC');
  const items = [];

  for (const row of rows) {
    const page = mapPage(row);
    const quality = await evaluateQuality(row);
    items.push({
      ...page,
      quality,
      canPublish: quality.ready && page.mapSupported
    });
  }

  return items;
}

export async function updateLocalSeoPageStatus(id, status, reviewedBy) {
  const row = await getPageRowById(id);
  if (!row) throw new AppError('Không tìm thấy trang SEO địa phương.', 404);

  if (status === 'PUBLISHED') {
    const quality = await evaluateQuality(row);
    const page = mapPage(row);
    if (!quality.ready || !page.mapSupported) {
      throw new AppError(
        'Trang chưa đạt điều kiện xuất bản. Hãy bổ sung dữ liệu và nội dung còn thiếu.',
        409,
        { blockers: quality.blockers, quality }
      );
    }

    await pool.query(
      [
        'UPDATE local_seo_pages SET',
        "status = 'PUBLISHED', published_at = NOW(),",
        'editorial_reviewed_by = $2, editorial_reviewed_at = NOW(), updated_at = NOW()',
        'WHERE id = $1'
      ].join('\n'),
      [id, reviewedBy]
    );
  } else {
    await pool.query(
      [
        'UPDATE local_seo_pages SET',
        'status = $2, published_at = NULL,',
        'editorial_reviewed_by = NULL, editorial_reviewed_at = NULL, updated_at = NOW()',
        'WHERE id = $1'
      ].join('\n'),
      [id, status]
    );
  }

  const updated = await getPageRowById(id);
  const quality = await evaluateQuality(updated);
  const updatedPage = mapPage(updated);
  return {
    ...updatedPage,
    quality,
    canPublish: quality.ready && updatedPage.mapSupported
  };
}
