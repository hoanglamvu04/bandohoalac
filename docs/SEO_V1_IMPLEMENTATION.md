# HOLA Maps SEO V1 — implementation notes

## Public HTML delivery

The existing React/Vite application remains the interactive client application. The Nginx installer now routes selected public SEO document requests to Express before the SPA fallback:

- \`/\` — homepage with published place inventory.
- \`/kham-pha\` — Explore hub with published guide links.
- \`/kham-pha/:slug\` — published guide article.
- \`/dia-diem/:slug\` — published place detail.
- \`/place/:id\` — legacy numeric place URL; HTTP 301 to its canonical slug URL.

Express renders a complete Vietnamese HTML document containing the page title, description, robots directive, canonical, Open Graph/Twitter metadata, visible headings/content, breadcrumbs and JSON-LD. These editorial/place routes do not depend on JavaScript for the primary content. Their static header mirrors the main HOLA Maps navigation and uses the official `/logo.svg` asset. The root homepage is not server-rendered by Express; it remains the original React SPA.

The HTML uses the standalone static stylesheet \`/seo-rendered.css\`, copied from \`frontend/public\` into the Vite build output. It intentionally does not load the React application bundle; links to the map open the existing interactive SPA.

## Canonical and sitemap rules

- Place canonical URL: \`https://maps.dothihoalac.vn/dia-diem/:slug\`.
- Old numeric \`/place/:id\` URLs redirect permanently to the current slug URL.
- Explore article URLs remain \`/kham-pha/:slug\` to avoid unnecessary URL migration.
- Place sitemap entries use the same in-coverage, published-place filter as the public detail API.
- Static sitemap no longer lists map-only routes or client-side redirects.
- The Explore sitemap owns the \`/kham-pha\` hub URL; it is not duplicated in the static pages sitemap.
- Filtered Explore URLs containing \`category\` or \`q\` are noindex and use the hub canonical.

## Deployment

The existing production workflow already runs \`scripts/install-embed-gateway.sh\` after frontend build and backend restart. That script now also adds Nginx proxy locations for the homepage, Explore pages and place pages. Nginx validates the generated configuration with \`nginx -t\` before reloading.

No database migration is required. Existing \`places.slug\` and \`explore_articles\` data are reused.

## Verification

Backend integration tests cover:
- Raw HTML title, description, canonical, visible H1/H2 and JSON-LD before JavaScript.
- Homepage and Explore hub rendering.
- Filtered Explore noindex behavior.
- Published place slug page and legacy 301 redirect.
- Place sitemap canonical slug format.
- 404/noindex behavior for missing content.
- Escaping of user-controlled content in HTML and JSON-LD.

The CI repository-safety job also checks that the Express routes and Nginx proxy paths stay aligned.

## Scope and limitations

This V1 server-renders the homepage, Explore hub/articles and place detail pages. Other application routes remain on the existing React SPA and are not all guaranteed to have first-response route-specific HTML yet.

The server-rendered SEO pages are read-only documents. Interactive map search, account actions, favorites, reviews and contribution tools remain available through the linked interactive map/application experience. A future SSR hydration phase can unify those interactions without sacrificing first-response HTML.

Category landing pages, area landing pages and the Admin editorial CMS are intentionally deferred to later SEO phases. Do not publish thin category/area pages until enough verified local inventory and unique editorial content exist.
