# HOLA Local SEO — Area and Category Landing Pages V1

## Purpose

Create editorial landing pages that connect local search intent to real, published HOLA MAP places. A landing page is not generated from a category label alone: it needs distinct local copy, a sufficiently complete place inventory, current verification signals, and an interactive map that can render the same places.

## Public routes

- /khu-vuc/cafe-hoa-lac
- /khu-vuc/quan-an-thach-that
- /khu-vuc/check-in-quoc-oai
- /khu-vuc/homestay-ba-vi
- /khu-vuc/dich-vu-quanh-dai-hoc-fpt

Each public page is server-rendered, has a canonical URL, a CollectionPage + ItemList JSON-LD graph, actual place cards, and a first-party map iframe at /local-map/:slug.

The map iframe loads the existing MapPage/MapView stack and obtains the exact same filtered place list from /api/local-seo/:slug. It does not generate synthetic map pins.

## Quality gate

A page can be approved only when all of these conditions are true:

- At least 5 published places match the page's geographic and category filters.
- Every matching place has a valid coordinate and a non-empty address.
- At least 3 matching places have an actual place image.
- At least 3 matching places have last_verified_at within the last 180 days.
- Editorial content has at least 350 words and 3 or more dedicated sections.
- The page's area is supported by the current HOLA MAP service coverage.
- An administrator explicitly approves publication.

The numeric thresholds are HOLA's editorial/data policy, not a Google ranking rule.

The gate is checked when an administrator publishes, on every public page request, and when the local SEO sitemap is generated. If inventory quality later falls below threshold, the page returns a noindex 404 and is omitted from the sitemap until it recovers.

## Initial page configuration

| Slug | Filter | Map coverage |
|---|---|---|
| cafe-hoa-lac | Cafe within Hòa Lạc search radius | Supported |
| quan-an-thach-that | Food and dining within Thạch Thất search radius | Supported |
| check-in-quoc-oai | Check-in places with Quốc Oai address terms | Not yet supported |
| homestay-ba-vi | Homestays with Ba Vì address terms | Not yet supported |
| dich-vu-quanh-dai-hoc-fpt | Selected daily-service categories within 3 km of the FPT campus landmark | Supported |

Quốc Oai and Ba Vì are intentionally seeded as drafts. They are outside the current nine-commune HOLA MAP service coverage. Do not change map_supported to true until product coverage, place geometry and map rendering have been extended and validated for those areas.

## Admin workflow

1. Open /admin/local-seo as an administrator.
2. Review the inventory counts, photo coverage, recent verification, editorial word count and map-coverage blockers.
3. Fix missing or stale place data through the existing Data Quality V3 and place-management workflows.
4. Review the page copy and local relevance.
5. Publish only when the API reports canPublish: true.

The publish endpoint is PATCH /api/admin/local-seo/:id/status with { "status": "PUBLISHED" }. The service re-evaluates the gate server-side; a disabled button is not the security boundary.

## Data model and operations

- local_seo_pages stores the editorial page, geographic/category filter, map support flag, thresholds and publication review.
- Place records are never copied into the landing page table. The page query joins the existing places, categories and place_images tables.
- The local SEO sitemap is /api/sitemap-local-seo.xml and is referenced from /sitemap.xml.
- The React route /local-map/:slug is served by the first-party map location in scripts/install-embed-gateway.sh. It is framed only by same-origin pages using frame-ancestors self.
- scripts/check-seo-routing.sh validates the public SEO route, sitemap index and first-party map route.

## Release checklist

- Run the normal backend database migration.
- Run backend tests and frontend production build.
- Run scripts/check-seo-routing.sh.
- Run scripts/install-embed-gateway.sh on the web host so /khu-vuc/ proxies to the backend and /local-map/ serves the SPA with same-origin framing.
- Review /admin/local-seo; do not force-publish pages that are still blocked.
- Confirm the sitemap contains only approved, currently qualified pages.
