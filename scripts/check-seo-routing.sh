#!/usr/bin/env bash
set -euo pipefail

APP="backend/src/app.js"
NGINX="scripts/install-embed-gateway.sh"
SITEMAP="frontend/public/sitemap-pages.xml"
SEO_RENDERER="backend/src/services/seoHtml.service.js"
SEO_CSS="frontend/public/seo-rendered.css"

grep -Fq "app.get('/', getHomeSeoPage);" "$APP"
grep -Fq "app.get('/kham-pha', getExploreHubSeoPage);" "$APP"
grep -Fq "app.get('/kham-pha/:slug', getExploreArticleSeoPage);" "$APP"
grep -Fq "app.get('/dia-diem/:slug', getPlaceSeoPage);" "$APP"
grep -Fq "app.get('/place/:id', redirectLegacyPlaceSeoPage);" "$APP"
grep -Fq "listPublishedPlaceSitemapEntries" "$APP"

grep -Fq 'write_seo_proxy_location "= /"' "$NGINX"
grep -Fq 'write_seo_proxy_location "= /kham-pha"' "$NGINX"
grep -Fq 'write_seo_proxy_location "^~ /kham-pha/"' "$NGINX"
grep -Fq 'write_seo_proxy_location "^~ /dia-diem/"' "$NGINX"
grep -Fq 'write_seo_proxy_location "^~ /place/"' "$NGINX"

grep -Fq 'href="/seo-rendered.css"' "$SEO_RENDERER"
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

if grep -Eq 'https://maps\.dothihoalac\.vn/(map|halo|an-uong|phong-tro|kham-pha)</loc>' "$SITEMAP"; then
  echo "[seo] ERROR: map-only, client-redirect or dynamically-sitemapped URLs must not be in the static sitemap." >&2
  exit 1
fi

echo "[seo] PASS: server-rendered routes, Nginx proxy paths, stylesheet and static sitemap contract."
