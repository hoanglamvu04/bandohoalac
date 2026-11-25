# HOLA Maps — HOLA-P1-104 / Nearby amenities on public housing details

## Why

The public, structured housing amenities API (Sprint 9, PR #99) was usable
only inside the housing map's intelligence sidebar. A visitor opening
`/place/:id` or `/dia-diem/:slug` could not directly examine grouped,
approved nearby amenities for that housing listing.

## Implementation

- New `HousingNearbyPlaces` component embedded directly below the
  published property information card, only for structured housing.
- Manual search with 500 m / 1 km / 2 km radius, published category counts,
  up to eight nearest public POIs, working detail links and retry on failure.
- Changing radius resets old results, invalidates/aborts the in-flight request
  and prevents stale responses after navigation/unmount.
- No GPS permission, IP-derived location, browser geolocation, new tracking
  or auto-fetch on initial page load. Uses existing authenticated-independent
  `GET /api/housing/:placeId/amenities`, already rate limited and validated.
- Incomplete data and capped 100-place samples explicitly marked. Distances
  are straight-line measurements, **not** travel time, road distance or a
  completeness guarantee.

## Tests and launch

Playwright covers public guest/mobile, no prefetch, 1 km -> 2 km, link targets,
API retry/503, capped data, and nonhousing POIs. Existing backend/PostGIS,
frontend build, E2E, CodeQL and dependency audit must pass on the PR.

This is a **P1-104 partial implementation**, not all Location Intelligence
features (routing accuracy/data coverage) and not a production deployment.
Production verification and X-HUB PR #92 approval remain separate.
