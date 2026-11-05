import { asyncHandler } from '../utils/asyncHandler.js';
import { getPlaceById, getPlaceBySlug } from '../services/place.service.js';
import {
  getExploreArticleBySlug,
  listExploreArticles
} from '../services/explore.service.js';
import {
  renderExploreArticleSeoPage,
  renderExploreHubSeoPage,
  renderPlaceSeoPage,
  renderSeoNotFoundPage
} from '../services/seoHtml.service.js';

function notFound(res) {
  res.status(404);
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex,follow');
  res.type('html').send(renderSeoNotFoundPage());
}

function sendSeoHtml(res, html, maxAge = 300) {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=' + maxAge + ', stale-while-revalidate=1800');
  res.set('X-Content-Type-Options', 'nosniff');
  res.send(html);
}

export const getPlaceSeoPage = asyncHandler(async (req, res) => {
  const place = await getPlaceBySlug(req.params.slug);
  if (!place || place.status !== 'PUBLISHED' || !place.slug) return notFound(res);
  return sendSeoHtml(res, renderPlaceSeoPage(place));
});

export const redirectLegacyPlaceSeoPage = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return notFound(res);

  const place = await getPlaceById(id);
  if (!place || place.status !== 'PUBLISHED' || !place.slug) return notFound(res);

  res.set('Cache-Control', 'public, max-age=86400');
  return res.redirect(301, '/dia-diem/' + encodeURIComponent(place.slug));
});

export const getExploreHubSeoPage = asyncHandler(async (req, res) => {
  const category = String(req.query.category || '').trim();
  const query = String(req.query.q || '').trim();
  const result = await listExploreArticles({
    category: category || undefined,
    q: query || undefined,
    limit: 40
  });
  const noindex = Boolean(category || query);
  const html = renderExploreHubSeoPage({
    items: result.items,
    categories: result.categories,
    noindex
  });
  if (noindex) {
    res.set('X-Robots-Tag', 'noindex,follow');
    return sendSeoHtml(res, html, 60);
  }
  return sendSeoHtml(res, html, 120);
});

export const getExploreArticleSeoPage = asyncHandler(async (req, res) => {
  const result = await getExploreArticleBySlug(req.params.slug);
  if (!result?.article) return notFound(res);
  return sendSeoHtml(res, renderExploreArticleSeoPage(result));
});
