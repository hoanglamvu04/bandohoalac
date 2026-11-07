# HOLA Maps — SEO Architecture Audit

**Audit date:** 2026-11-05  
**Repository:** \`hoanglamvu04/bandohoalac\`  
**Audited branch:** \`main\`  
**Audited commit:** \`56791eec9d310b51b3bbe0b5ce3ea6b0bdc305a2\`  
**Scope:** Source-code audit of routes, place/article data, CMS/admin routes, metadata, structured data, sitemap, robots and existing SEO tests.

> This is a repository/source audit. It does not claim that Google has indexed any URL, and it is not a live production crawl or a Search Console audit. Production HTML/HTTP headers, database row counts and Search Console coverage still require a staging/production check.

## Executive summary

HOLA Maps already has a useful SEO foundation:

- Public place records have stable slugs in PostgreSQL.
- Place details have a public API lookup by ID and by slug.
- The Explore content hub has a database-backed article model and 20 seed articles.
- Dynamic place and Explore sitemaps are present.
- Robots.txt, canonical metadata, Open Graph/Twitter metadata and JSON-LD are implemented.
- A Playwright test checks hydrated place-detail SEO metadata and structured data.

However, the current implementation is **not ready to scale to 120 editorial pages and hundreds/thousands of location pages**. The main blockers are:

1. Public route HTML is a Vite SPA shell. Per-route SEO tags and content are created after JavaScript runs; there is no SSR/prerender pipeline in the current frontend build.
2. Category URLs such as \`/an-uong\` and \`/phong-tro\` are client-side redirects to the map, not SEO landing pages.
3. There are no area landing pages.
4. The Explore article table is seeded by SQL, but no Admin CRUD/editorial workflow for Explore articles was found.
5. Place detail URLs use numeric IDs even though a place slug and slug API already exist.
6. Internal links from Explore article place cards lead to a map query, while Article ItemList structured data points to the numeric place-detail URL.
7. The static pages sitemap contains the two client-redirect URLs; the place sitemap can include published records that the public detail API subsequently hides when they are outside the service coverage.

## 1. Existing architecture inventory

| Area | Current implementation | Audit result |
|---|---|---|
| Frontend | React 18 + Vite + React Router 7 | SPA; route metadata is client-managed |
| Backend | Node.js + Express | Public JSON APIs and dynamic sitemap endpoints |
| Database | PostgreSQL + PostGIS | Places, categories and Explore articles are database-backed |
| Public discovery | \`/map\` | Map-first experience; not a category SEO landing page |
| Explore hub | \`/kham-pha\` | Article listing and category/query filters |
| Explore article | \`/kham-pha/:slug\` | Database-backed article detail |
| Place detail | \`/place/:id\` | Numeric-ID public URL |
| Place slug | \`places.slug\`, \`getPlaceBySlug()\`, \`/api/places/slug/:slug\` | Backend capability exists but frontend route does not use it |
| Category pages | \`/an-uong\`, \`/phong-tro\` | React \`Navigate\` to map query; not dedicated landing pages |
| Area pages | None found | Not implemented |
| Article CMS | \`explore_articles\` migration and public read APIs | No Admin create/edit/publish routes or page found |
| Place admin | \`/admin/places\` | Manages core place data, images and status; SEO editorial fields are not present in the form |
| Sitemap | Static sitemap index + static pages + two dynamic API sitemaps | Partial; needs cleanup and coverage consistency |
| SEO tests | \`frontend/e2e/place-seo.spec.js\` | Tests browser DOM after hydration, not raw HTML or sitemap validity |

### Main routes currently relevant to SEO

- \`/\`
- \`/map\`
- \`/kham-pha\`
- \`/kham-pha/:slug\`
- \`/place/:id\`
- \`/an-uong\` → client-side navigation to \`/map?vertical=food\`
- \`/phong-tro\` → client-side navigation to \`/map?vertical=housing&category=bat-dong-san\`

No route was found for \`/ca-phe\`, \`/vui-choi\`, \`/khu-vuc/:slug\`, or \`/dia-diem/:slug\`.

## 2. Findings by priority

### P0 — Route-specific SEO is not present in the initial HTML

**Evidence**

- \`frontend/index.html\` contains one generic title, description, canonical URL and WebSite JSON-LD for the homepage.
- \`frontend/src/components/SeoHead.jsx\` uses React \`useEffect()\` to update title, meta description, robots, canonical, Open Graph, Twitter and JSON-LD.
- \`frontend/src/components/RouteSeoRuntime.jsx\` selects route metadata in the browser.
- \`frontend/vite.config.js\` configures Vite/React and build chunks; no SSR or prerender plugin/pipeline was found.
- \`frontend/package.json\` build script is \`vite build\`.

**Impact**

A direct request to an article or place URL initially receives the SPA document with generic homepage metadata and an empty \`#root\`. The correct title, canonical, structured data and main content appear only after JavaScript and API requests complete. Google can render JavaScript, but this adds a rendering queue/dependency and weakens first-response HTML, social previews and non-JavaScript crawlers.

**Recommendation**

Implement route-aware HTML rendering for public SEO routes. Prefer a controlled SSR/SSG architecture for:

- \`/\`
- category landing pages
- area landing pages
- \`/dia-diem/:slug\`
- \`/kham-pha/:slug\`

Keep the interactive map, admin, partner and account workflows as the existing client application where appropriate. If SSG is selected, regenerate affected pages after content publish/update and ensure 404/noindex/canonical are emitted in the HTML response.

**Acceptance test**

For a published article and place URL, \`curl\`/HTTP response HTML must already contain the correct unique title, description, canonical, robots directive, H1 and JSON-LD before any browser JavaScript executes.

### P1 — Category landing pages do not exist

**Evidence**

In \`frontend/src/routes.jsx\`, \`/an-uong\` and \`/phong-tro\` render React \`Navigate\` components to map query URLs. The static \`frontend/public/sitemap-pages.xml\` currently lists both source URLs.

**Impact**

The URLs are not editorial landing pages with crawlable introductions, curated places, filters and internal links. They are also included in the sitemap despite being client-side redirects. Query URLs are not a substitute for stable category pages.

**Recommendation**

Create real category pages with stable URLs and distinct useful content:

- \`/an-uong\`
- \`/ca-phe\`
- \`/vui-choi\`
- \`/luu-tru\`
- later: services, education, healthcare, shopping and events

Each page should have a unique intro, relevant published places, category-specific filters, internal links to guides and an interactive map entry point. Do not create a page for a category until it has enough real, relevant inventory to provide value.

Keep \`/map?vertical=...\` for the map application. If the old paths must redirect, use a server-side HTTP 301/308; otherwise make them the new landing pages and remove the client redirects.

### P1 — Place detail pages use numeric IDs instead of the existing slug

**Evidence**

- The database and \`place.service.js\` already have \`places.slug\`, \`generateUniqueSlug()\` and \`getPlaceBySlug()\`.
- \`GET /api/places/slug/:slug\` already exists.
- Frontend routing only exposes \`/place/:id\`.
- \`PlaceDetailV2.jsx\` calls \`getPlace(id)\` and sets canonical to \`/place/<id>\`.
- Explore article cards link to \`/map?place=<id>\`, while their ItemList JSON-LD links to \`/place/<id>\`.

**Impact**

The existing slug capability is not used for human-readable, keyword-relevant location URLs. The article's visible place link and its structured-data URL also disagree.

**Recommendation**

Introduce \`/dia-diem/:slug\` using the existing slug API. Preserve old \`/place/:id\` links and redirect them to the canonical slug URL after resolving the record. Update all place cards, nearby-place links, Explore article cards, breadcrumbs, canonical tags, JSON-LD and sitemap entries to use the same canonical place URL.

Do not change slugs automatically when a place name changes. Add a redirect/slug history strategy before allowing manual slug edits.

### P1 — Explore articles have no editorial CMS workflow

**Evidence**

- \`20261021_130_explore_guides.sql\` creates \`explore_articles\` and inserts 20 seed articles.
- Public routes only expose list/detail reads through \`backend/src/routes/explore.routes.js\`.
- No Admin Explore article controller, CRUD route or Admin page was found in the current repository tree/search.
- Existing \`AdminPlaces.jsx\` manages basic place fields, coordinates, photos and status, but does not expose dedicated SEO title/description or editorial page controls.

**Impact**

New content requires SQL/migration or developer intervention. This is not a sustainable workflow for 120 articles or ongoing updates. A \`DRAFT/PUBLISHED/ARCHIVED\` column alone is not an editorial CMS.

**Recommendation**

Build Admin → SEO Content with:

- article create/edit/preview/publish/archive
- slug uniqueness and redirect history
- SEO title, meta description, canonical and social image
- structured content blocks (H2/H3, paragraphs, lists, images, place references, FAQ where genuinely useful)
- author/editor, reviewer, source notes, last factual verification and update history
- related category, area, place and article links
- preview of desktop/mobile and rendered HTML
- publication validation before a URL enters sitemap

Use the existing \`explore_articles\` table as the base; do not create a parallel article database.

### P1 — No area landing pages or area content model

**Evidence**

No \`/khu-vuc/:slug\` route, area page, area CMS or area sitemap was found. The current map coverage configuration is operational/geospatial coverage, not a full editorial area-page model.

**Recommendation**

Add an area model with a stable slug, official display name, parent/administrative relationship, verified boundary or center, editorial introduction, SEO metadata, status and last-reviewed date. Link places to areas using verified spatial/administrative mapping; do not infer an area from free-text addresses alone.

Only publish an area page when it contains distinct information and enough verified places. Avoid generating thin pages for every commune simply by replacing the place name.

### P1 — Existing article content is not yet a trustworthy local guide at scale

**Evidence**

The 20 seed records are useful layout/data examples, but several article bodies are generic advice rather than a researched list of real named venues with verified details. For example, the seed \`top-quan-cafe-dep-hoa-lac\` has generic selection advice and a dynamically related category list; it does not store per-place editorial notes, evidence for price/opening hours or a last-checked date.

The current body renderer supports headings, paragraphs and bullets. It does not yet model a table of contents, place-specific editorial notes, source citations, image blocks, FAQ blocks or reviewed factual claims.

**Recommendation**

Treat the 20 rows as starter content, not as proof that 20 finished SEO guides are ready. Upgrade the editorial schema and verify each named venue before using titles such as “Top 10” or claims about price, opening hours, ratings and amenities. Never fabricate details to fill a template.

### P2 — Sitemap includes client redirects and may include out-of-coverage place URLs

**Evidence**

- \`frontend/public/sitemap-pages.xml\` includes \`/an-uong\` and \`/phong-tro\`, which are client-side \`Navigate\` routes.
- \`backend/src/app.js\` builds \`/api/sitemap-places.xml\` from all \`places.status = 'PUBLISHED'\` records, capped at 10,000.
- The public detail API's \`getPlaceById()\` and \`getPlaceBySlug()\` both apply \`ST_Intersects(... SERVICE_AREA_GEOJSON_STRING ...)\`; therefore a published record outside service coverage can be listed in the sitemap but return 404 from its detail endpoint.
- \`/api/sitemap-explore.xml\` correctly includes published articles whose \`published_at <= NOW()\`.

**Recommendation**

- Remove redirect URLs from sitemaps; include only final canonical 200 indexable URLs.
- Apply the same publication and service-coverage rule in the place sitemap as the public detail endpoint.
- Use canonical slug URLs after the slug route is introduced.
- Add category and area sitemaps when those pages exist.
- Add sitemap sharding/index generation before approaching the 50,000 URL or 50 MB protocol limits.
- Keep \`lastmod\` tied to real content changes, not deployment time.

### P2 — Internal links and schema need a consistent canonical graph

**Evidence**

- Explore place cards currently navigate to \`/map?place=<id>\`.
- Article ItemList JSON-LD points to \`/place/<id>\`.
- Place detail currently emits generic Schema.org \`Place\` even for restaurants/cafes/accommodation.
- Explore article JSON-LD emits Article, BreadcrumbList and ItemList; place detail emits Place and BreadcrumbList.

**Recommendation**

Make the visible card URL, schema URL, canonical URL and sitemap URL identical. Choose the most accurate Schema.org subtype only when category and data support it (for example Restaurant, CafeOrCoffeeShop or LodgingBusiness). Keep aggregateRating only when it is supported by real review data and follows the relevant structured-data rules.

### P2 — SEO test coverage checks hydrated DOM, not crawl delivery

**Evidence**

\`frontend/e2e/place-seo.spec.js\` waits for the React page and then asserts title, canonical, geo metadata and JSON-LD. It does not test the raw HTML response before JavaScript, published article rendering, category/area routes, sitemap URL status/canonical consistency, robots/noindex or structured-data validity.

**Recommendation**

Add tests for:

1. Raw HTML metadata/content on direct requests.
2. Published vs draft article responses (200 vs 404/noindex policy).
3. Canonical URL equals the sitemap URL.
4. Every sitemap URL returns 200 and is indexable; no redirects or noindex entries.
5. Place URL redirects to its canonical slug exactly once.
6. Category and area pages render unique H1/title/description and valid breadcrumbs.
7. JSON-LD parses and matches visible page facts.
8. Mobile and desktop layout for category, place and guide templates.

## 3. Recommended target architecture

The goal is a local discovery platform, not a blog-only site.

| Page family | Target URL | Data source | Primary purpose |
|---|---|---|---|
| Home | \`/\` | Places/categories/editorial collections | Discover and search |
| Category | \`/an-uong\`, \`/ca-phe\`, \`/vui-choi\`, \`/luu-tru\` | Categories + published places + editorial intro | Commercial/local intent |
| Place | \`/dia-diem/:slug\` | Existing places + images + reviews + verified facts | Specific venue discovery |
| Area | \`/khu-vuc/:slug\` | Areas + mapped places + editorial content | Local geographic intent |
| Guide | \`/cam-nang/:slug\` (or preserve \`/kham-pha/:slug\`) | Existing Explore articles + place references | Informational intent |
| Map | \`/map\` | Existing map/search APIs | Interactive discovery |

Recommendation: preserve \`/kham-pha/:slug\` initially to avoid unnecessary URL churn; add redirects only if a later URL migration has a clear benefit.

### Shared page templates

- Category landing: short hero, editorial intro, subcategory links, filter controls, curated place cards, map CTA, related guides.
- Place detail: photo gallery, verified status/last-checked, address/area, opening hours, price only when sourced, amenities, map, nearby places, claim/update flow.
- Area landing: unique local intro, map extent, verified place groups, adjacent areas, useful local guides.
- Guide article: compact hero, breadcrumb, table of contents, useful H2/H3 sections, real place cards with editorial notes, sources/last reviewed, related guides and map CTA.

### Shared CMS entities

Reuse current tables and extend only where needed:

- \`places\`: existing slug, coordinates, category, images, phone, website, opening hours and publication status.
- \`categories\`: add editorial intro/SEO fields and curated place ordering.
- \`explore_articles\`: add structured blocks, source/reviewer metadata, image/FAQ/place-reference blocks and publication controls.
- \`areas\`: new stable geographic/editorial entities, linked to places.
- Redirect history: preserve old ID URLs and future slug changes.

## 4. Recommended implementation order

### Phase 0 — Technical SEO foundation (do first)

1. Choose SSR or SSG for public SEO routes; prove raw HTML output.
2. Fix sitemap eligibility and remove redirect URLs.
3. Add canonical slug place route with legacy ID redirects.
4. Make visible internal links, canonical, schema and sitemap agree.
5. Add raw-response/sitemap integration tests.

### Phase 1 — CMS and data quality

1. Admin SEO Content CRUD and preview.
2. Extend article blocks and source/review fields.
3. Add category landing-page metadata and editorial intro.
4. Add area model and verified place-to-area relationships.
5. Publication gate: no publish without unique slug, useful content, relevant real places and factual review.

### Phase 2 — First complete topic cluster

Build one full cluster before multiplying pages:

- Pillar: \`/an-uong\`
- Supporting guides: breakfast, dinner, student budget, family restaurants, grill/BBQ and near-FPT food options
- Real place profiles with verified facts and direct canonical links
- Internal links between pillar, supporting guides and places

Only create a guide if there is enough unique evidence and local inventory to satisfy its search intent.

### Phase 3 — Expand and measure

Expand to cafe, play/experience, accommodation, services and areas based on actual inventory and search demand. Monitor Search Console impressions, clicks, indexed/canonical status, query groups and conversion actions. Do not use 120 as a publishing quota if the underlying local data is not sufficient.

## 5. What was not verified in this audit

- Live production response headers/status and raw HTML from Googlebot.
- Actual production database counts, current number of published places and article rows.
- Search Console indexing, impressions, queries, crawl stats and manual actions.
- Accuracy of each venue's opening hours, phone, price, amenities and photos.
- Whether production Nginx/Cloudflare performs any external prerendering not represented in this repository.

These require staging/production access and Search Console data. The source audit alone cannot establish indexation or ranking performance.

## Final assessment

HOLA Maps already has the data and map foundation needed for a strong local SEO platform. The best next investment is **not writing 120 articles immediately**. It is making public place/article pages render correctly, adding real category and area landing pages, and giving Admin a controlled publishing workflow backed by verified local data.

Once Phase 0 and Phase 1 are complete, the KTHL topic-cluster process can be transferred to HOLA Maps without creating thin pages, duplicate URLs or a second content system.
