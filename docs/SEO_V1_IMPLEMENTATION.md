# HOLA Maps SEO V1 — implementation notes

## Public HTML delivery

The React/Vite application owns the product homepage and interactive application chrome. The root URL `/` must fall through to the existing Nginx SPA fallback so the original HOLA Maps Navbar, hero, discovery sections and interactive controls remain intact.

Nginx routes only selected editorial and place SEO document requests to Express before the SPA fallback:
- `/kham-pha` — Explore hub with published guide links.
- `/kham-pha/:slug` — published guide article.
- `/dia-diem/:slug` — published place detail.
- `/place/:id` — legacy numeric place URL; HTTP 301 to its canonical slug URL.

Express renders a complete Vietnamese HTML document containing route-specific title, description, robots directive, canonical, Open Graph/Twitter metadata, visible headings/content, breadcrumbs and JSON-LD. Editorial/place routes do not depend on JavaScript for primary content. Their static header mirrors the main HOLA Maps navigation and uses the official `/logo.svg` asset.

SEO documents use the standalone stylesheet `/seo-rendered.css`, copied from `frontend/public` into the Vite build output. They do not load the React bundle; links to the map open the existing interactive SPA. The homepage itself remains the original interactive React SPA.

## Canonical and sitemap rules

- Place canonical URL: `https://maps.dothihoalac.vn/dia-diem/:slug`.
- Old numeric `/place/:id` URLs redirect permanently to the current slug URL.
- Explore article URLs remain `/kham-pha/:slug` to avoid unnecessary URL migration.
- Place sitemap entries use the same in-coverage, published-place filter as the public detail API.
- Static sitemap excludes map-only routes and client-side redirects.
- The Explore sitemap owns the `/kham-pha` hub URL; it is not duplicated in the static pages sitemap.
- Filtered Explore URLs containing `category` or `q` are noindex and use the hub canonical.

## Deployment

The production workflow runs `scripts/install-embed-gateway.sh` after frontend build and backend restart. That script adds Nginx proxy locations for Explore and place pages only. It deliberately does not proxy `/`, so the existing SPA fallback serves the original homepage. Nginx validates the generated configuration with `nginx -t` before reloading.

No database migration is required for the routing/header restoration. Existing `places.slug` and `explore_articles` data are reused.

## Verification

Backend integration tests cover:
- Root path is not intercepted by the standalone SEO renderer.
- Raw HTML title, description, canonical, visible H1/H2 and JSON-LD before JavaScript.
- Shared HOLA Maps header/logo/navigation on Explore and place SEO pages.
- Explore hub and filtered noindex behavior.
- Published place slug page and legacy 301 redirect.
- Place sitemap canonical slug format.
- 404/noindex behavior for missing content.
- Escaping of user-controlled content in HTML and JSON-LD.

The CI repository-safety job checks that the Express routes, Nginx proxy paths and shared SEO header remain aligned.

## Scope and limitations

The Explore hub/articles and place detail pages are first-response HTML. The homepage, map, account, partner and other interactive routes remain on the existing React SPA. The SEO header is a server-rendered public navigation shell; authentication-specific controls remain available in the interactive app.

Category landing pages, area landing pages and the Admin editorial CMS are deferred to later SEO phases. Do not publish thin category/area pages until enough verified local inventory and unique editorial content exist.