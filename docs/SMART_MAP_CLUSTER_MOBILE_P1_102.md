# HOLA-P1-102 / Issue #117 — map pin clustering, mobile slow-network acceptance

## Scope of this change
- MapLibre's already existing single GeoJSON source for public place pins now clusters nearby points at zoom 14 and below. Cluster markers are WebGL-rendered (no DOM marker explosion) and display an aggregate count, with a manual tap to zoom in.
- Unclustered POIs continue using the existing icon images, labels, feature-state hover/selection and details; clusters are not promoted as unique places. No change to server API, stored data, user tracking or GPS.
- A synthetic Playwright test loads 65 mock published POIs on a 390x844 viewport, verifies clustered markers at zoom 12.5 and individual icons at zoom 16.5. This does **not** constitute mobile hardware P95 or actual slow-network certification.

## Required on-device / production-copy acceptance
Test Android Chrome and iOS Safari on **real devices**, in normal and throttled 3G/4G network. Repeat zoom/pan, open/dismiss POI, filter BĐS, switch street/satellite and return, restore connectivity; use a geographically dense **approved test fixture** rather than load-testing real production at scale.

Record device/OS, route, data quantity and sample count; collect map-ready, POI markers time, P50/P95 request latency, layout shift and memory. Do not invent numeric latency targets or publish device coordinates/PII. Review clustering aesthetics, tappable group target and accessibility at multiple zoom levels, and capture any failures as separately testable issues.

This feature is code + CI readiness only. Public launch remains BLOCKED until offsite backup/restore, data audit on an authorized independent PostgreSQL copy and real mobile device acceptance.
