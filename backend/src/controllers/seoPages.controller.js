import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getPlaceById,
  getPlaceBySlug
} from '../services/place.service.js';
import {
  getExploreArticleBySlug,
  listExploreArticles
} from '../services/explore.service.js';
import { getLocalSeoPageBySlug } from '../services/localSeo.service.js';
import { getHousingListingByPlaceId } from '../services/housing.service.js';
import {
  renderExploreArticleSeoPage,
  renderLocalSeoLandingPage,
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

function sendSeoHtml(res, html, maxAge = 300, staleWhileRevalidate = 1800) {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set(
    'Cache-Control',
    staleWhileRevalidate > 0
      ? 'public, max-age=' + maxAge + ', stale-while-revalidate=' + staleWhileRevalidate
      : 'public, max-age=' + maxAge + ', must-revalidate'
  );
  res.set('X-Content-Type-Options', 'nosniff');
  res.send(html);
}

export async function publicSeoPlaceIsVisible(place, loadHousing = getHousingListingByPlaceId) {
  if (!place || place.status !== 'PUBLISHED' || !place.slug) return false;
  if (place.categorySlug !== 'bat-dong-san') return true;
  // Respect the canonical housing-publication policy, even before cron.
  return Boolean(await loadHousing(Number(place.id)));
}

export const getPlaceSeoPage = asyncHandler(async (req, res) => {
  const place = await getPlaceBySlug(req.params.slug);
  if (!await publicSeoPlaceIsVisible(place)) return notFound(res);
  return sendSeoHtml(res, renderPlaceSeoPage(place), 60, 0);
});

export const redirectLegacyPlaceSeoPage = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return notFound(res);

  const place = await getPlaceById(id);
  if (!await publicSeoPlaceIsVisible(place)) return notFound(res);

  res.set('Cache-Control', 'public, max-age=60, must-revalidate');
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
    category: category || 'all',
    query,
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

export const getLocalSeoLandingPage = asyncHandler(async (req, res) => {
  const result = await getLocalSeoPageBySlug(req.params.slug);
  if (!result) return notFound(res);
  return sendSeoHtml(res, renderLocalSeoLandingPage(result), 60, 0);
});
