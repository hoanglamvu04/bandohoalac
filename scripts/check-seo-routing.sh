#!/usr/bin/env bash
set -euo pipefail

APP="backend/src/app.js"
NGINX="scripts/install-embed-gateway.sh"
SITEMAP="frontend/public/sitemap-pages.xml"
SEO_RENDERER="backend/src/services/seoHtml.service.js"
SEO_CSS="frontend/public/seo-rendered.css"

if grep -Fq "app.get('/', getHomeSeoPage);" "$APP"; then
  echo "[seo] ERROR: root homepage must remain on the original React SPA." >&2
  exit 1
fi
grep -Fq "app.get('/kham-pha', getExploreHubSeoPage);" "$APP"
grep -Fq "app.get('/kham-pha/:slug', getExploreArticleSeoPage);" "$APP"
grep -Fq "app.get('/dia-diem/:slug', getPlaceSeoPage);" "$APP"
grep -Fq "app.get('/place/:id', redirectLegacyPlaceSeoPage);" "$APP"
grep -Fq "listPublishedPlaceSitemapEntries" "$APP"

if grep -Fxq 'write_seo_proxy_location "= /"' "$NGINX"; then
  echo "[seo] ERROR: Nginx root must fall through to the React SPA." >&2
  exit 1
fi
grep -Fq 'write_seo_proxy_location "= /kham-pha"' "$NGINX"
grep -Fq 'write_seo_proxy_location "^~ /kham-pha/"' "$NGINX"
grep -Fq 'write_seo_proxy_location "^~ /dia-diem/"' "$NGINX"
grep -Fq 'write_seo_proxy_location "^~ /place/"' "$NGINX"

grep -Fq 'href="/seo-rendered.css"' "$SEO_RENDERER"
grep -Fq 'class="hola-app-header"' "$SEO_RENDERER"
grep -Fq 'src="/logo.svg?v=20260929-2"' "$SEO_RENDERER"
test -s "$SEO_CSS"
grep -Fq '.seo-editorial-layout {' "$SEO_CSS"
grep -Fq '.seo-sidebar-card {' "$SEO_CSS"
grep -Fq 'font-size: 19px;' "$SEO_CSS"
grep -Fq 'font-family: Arial, "Segoe UI", Tahoma, sans-serif;' "$SEO_CSS"
if grep -Eq 'font-family:.*(Georgia|Times New Roman)' "$SEO_CSS"; then
  echo "[seo] ERROR: editorial SEO pages must use a Vietnamese-safe sans-serif font stack." >&2
  exit 1
fi
grep -Fq '@media (max-width: 760px)' "$SEO_CSS"
grep -Fq '.hola-app-header {' "$SEO_CSS"
grep -Fq '.seo-primary-nav .seo-nav-link' "$SEO_CSS"
grep -Fq '.seo-header-cta' "$SEO_CSS"
grep -Fq '.seo-nav-icon {' "$SEO_CSS"

if grep -Eq 'https://maps\.dothihoalac\.vn/(map|halo|an-uong|phong-tro|kham-pha)</loc>' "$SITEMAP"; then
  echo "[seo] ERROR: map-only, client-redirect or dynamically-sitemapped URLs must not be in the static sitemap." >&2
  exit 1
fi

echo "[seo] PASS: server-rendered routes, Nginx proxy paths, stylesheet and static sitemap contract."
