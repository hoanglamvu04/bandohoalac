# HOLA Maps — Sprint 13 / SEO Housing Publication & Expiry Gate

A public `places.status='PUBLISHED'` alone does not prove a structured
property listing remains available: its linked housing record may be
PAUSED, SOLD, RENTED or EXPIRED, or `expires_at` has passed before
the daily archive job reconciles `places`.

This release checks canonical Housing public visibility for
`/dia-diem/:slug` SEO HTML, legacy `/place/:id` redirects and
`/api/sitemap-places.xml`. An invalid/expired housing listing returns
404 `X-Robots-Tag: noindex,follow`; no stale JSON-LD is served.
The sitemap excludes inactive or expired structured housing even when
the original place remains PUBLISHED. Cache lifetimes for the place
SEO document and sitemap shrink to 60 seconds without stale responses.

Other published nonhousing places and historical unstructured housing
retain their existing public policy; no automatic archival or deletion.
An isolated PG16 test creates a still-PUBLISHED place with expired,
PAUSED and finally ACTIVE housing, checking HTML, redirect and sitemap.

No new migrations, admin access, tokens, tracking or WA-005 changes;
production re-deploy remains manual and readiness-gated.
