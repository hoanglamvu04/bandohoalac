import { pool } from '../database/pool.js';

const ARTICLE_SELECT = `
  SELECT
    a.id,
    a.slug,
    a.title,
    a.excerpt,
    a.category_slug,
    a.category_label,
    a.eyebrow,
    a.seo_title,
    a.seo_description,
    a.body,
    a.tags,
    a.featured,
    a.related_query,
    a.related_category,
    a.reading_minutes,
    a.published_at,
    a.updated_at,
    (
      SELECT COALESCE(pi.card_url, pi.thumbnail_url, pi.url)
      FROM places p
      LEFT JOIN categories c ON c.id = p.category_id
      JOIN place_images pi ON pi.place_id = p.id
      WHERE p.status = 'PUBLISHED'
        AND (a.related_query IS NOT NULL OR a.related_category IS NOT NULL)
        AND (a.related_category IS NULL OR c.slug = a.related_category)
        AND (
          a.related_query IS NULL OR
          lower(public.hola_unaccent(
            COALESCE(p.name, '') || ' ' ||
            COALESCE(p.address, '') || ' ' ||
            COALESCE(p.description, '')
          )) LIKE '%' || lower(public.hola_unaccent(a.related_query)) || '%'
        )
      ORDER BY pi.is_cover DESC, p.rating_avg DESC, p.rating_count DESC, pi.id ASC
      LIMIT 1
    ) AS cover_image
  FROM explore_articles a
`;

function mapArticle(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    categorySlug: row.category_slug,
    categoryLabel: row.category_label,
    eyebrow: row.eyebrow || row.category_label,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    body: Array.isArray(row.body) ? row.body : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    featured: Boolean(row.featured),
    relatedQuery: row.related_query || null,
    relatedCategory: row.related_category || null,
    readingMinutes: Number(row.reading_minutes) || 5,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    coverImage: row.cover_image || null
  };
}

function mapRelatedPlace(row) {
  return {
    id: String(row.id),
    slug: row.slug,
    name: row.name,
    address: row.address || 'Hòa Lạc, Hà Nội',
    category: row.category || 'Địa điểm',
    categorySlug: row.category_slug || null,
    rating: Number(row.rating_avg) || 0,
    reviews: Number(row.rating_count) || 0,
    lat: Number(row.lat),
    lng: Number(row.lng),
    coverImage: row.cover_image || null
  };
}

export async function listExploreArticles({ category, q, limit = 30 } = {}) {
  const conditions = ["a.status = 'PUBLISHED'", 'a.published_at <= NOW()'];
  const params = [];

  if (category && category !== 'all') {
    params.push(String(category));
    conditions.push('a.category_slug = $' + params.length);
  }

  if (q && String(q).trim()) {
    params.push(String(q).trim());
    const ref = '$' + params.length;
    conditions.push(`
      lower(public.hola_unaccent(
        COALESCE(a.title, '') || ' ' ||
        COALESCE(a.excerpt, '') || ' ' ||
        COALESCE(array_to_string(a.tags, ' '), '')
      )) LIKE '%' || lower(public.hola_unaccent(${ref})) || '%'
    `);
  }

  params.push(Math.min(Math.max(Number(limit) || 30, 1), 50));
  const limitRef = '$' + params.length;

  const { rows } = await pool.query(
    ARTICLE_SELECT + `
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.featured DESC, a.published_at DESC, a.id DESC
      LIMIT ${limitRef}
    `,
    params
  );

  const { rows: categoryRows } = await pool.query(`
    SELECT category_slug, category_label, COUNT(*)::int AS count
    FROM explore_articles
    WHERE status = 'PUBLISHED'
      AND published_at <= NOW()
    GROUP BY category_slug, category_label
    ORDER BY MIN(id) ASC
  `);

  return {
    items: rows.map(mapArticle),
    categories: categoryRows.map((row) => ({
      slug: row.category_slug,
      label: row.category_label,
      count: Number(row.count) || 0
    }))
  };
}

async function loadRelatedPlaces(article, limit = 6) {
  const conditions = ["p.status = 'PUBLISHED'"];
  const params = [];

  if (article.relatedCategory) {
    params.push(article.relatedCategory);
    conditions.push('c.slug = $' + params.length);
  }

  if (article.relatedQuery) {
    params.push(article.relatedQuery);
    const ref = '$' + params.length;
    conditions.push(`
      lower(public.hola_unaccent(
        COALESCE(p.name, '') || ' ' ||
        COALESCE(p.address, '') || ' ' ||
        COALESCE(p.description, '')
      )) LIKE '%' || lower(public.hola_unaccent(${ref})) || '%'
    `);
  }

  params.push(Math.min(Math.max(Number(limit) || 6, 1), 12));
  const limitRef = '$' + params.length;

  const query = `
    SELECT
      p.id,
      p.slug,
      p.name,
      p.address,
      p.rating_avg,
      p.rating_count,
      ST_X(p.location) AS lng,
      ST_Y(p.location) AS lat,
      c.name AS category,
      c.slug AS category_slug,
      (
        SELECT COALESCE(pi.card_url, pi.thumbnail_url, pi.url)
        FROM place_images pi
        WHERE pi.place_id = p.id
        ORDER BY pi.is_cover DESC, pi.id ASC
        LIMIT 1
      ) AS cover_image
    FROM places p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY
      CASE WHEN EXISTS (SELECT 1 FROM place_images pi2 WHERE pi2.place_id = p.id) THEN 1 ELSE 0 END DESC,
      p.rating_avg DESC,
      p.rating_count DESC,
      p.updated_at DESC
    LIMIT ${limitRef}
  `;

  const { rows } = await pool.query(query, params);
  return rows.map(mapRelatedPlace);
}

export async function getExploreArticleBySlug(slug) {
  const { rows } = await pool.query(
    ARTICLE_SELECT + `
      WHERE a.slug = $1
        AND a.status = 'PUBLISHED'
        AND a.published_at <= NOW()
      LIMIT 1
    `,
    [String(slug)]
  );

  const article = mapArticle(rows[0]);
  if (!article) return null;

  let relatedPlaces = await loadRelatedPlaces(article, 6);

  if (relatedPlaces.length < 3 && (article.relatedQuery || article.relatedCategory)) {
    const fallbackArticle = {
      ...article,
      relatedQuery: null
    };
    const fallback = await loadRelatedPlaces(fallbackArticle, 8);
    const existing = new Set(relatedPlaces.map((item) => item.id));
    for (const item of fallback) {
      if (!existing.has(item.id)) {
        relatedPlaces.push(item);
        existing.add(item.id);
      }
      if (relatedPlaces.length >= 6) break;
    }
  }

  return { article, relatedPlaces: relatedPlaces.slice(0, 6) };
}

export async function listExploreSitemapEntries() {
  const { rows } = await pool.query(`
    SELECT slug, updated_at
    FROM explore_articles
    WHERE status = 'PUBLISHED'
      AND published_at <= NOW()
    ORDER BY published_at DESC, id DESC
    LIMIT 5000
  `);

  return rows;
}
