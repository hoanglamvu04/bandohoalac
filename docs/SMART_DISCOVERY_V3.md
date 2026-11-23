# HOLA Maps — Sprint 1: Smart Discovery V3

## What was upgraded

Existing `GET /api/places` still uses the same PostGIS service-area
boundary, published-only filtering, category filters and existing pg_trgm
matching. When a visitor supplies search text, Smart Rank V3 reorders the
**current bounded result page** using transparent organic signals:
- Vietnamese accent-insensitive name/short phrase match > address/category
  match; partial term coverage for longer queries
- category match when explicitly requested or interpreted
- Bayesian-like review quality (ratings with more independent reviews are
  more reliable than a single 5-star review)
- recency of explicit data verification and presence of photos
- for "X gần Y", decreasing weight with geographic distance **in addition
  to** the real nearby query
- no partner/advertising boost, no user tracking or private search history.

This deliberately does not bypass the server's PUBLISHED status gate or
replace existing map/food/housing filters. As the base database query remains
paginated and already ranked by pg_trgm, the additional organic score is
calculated within each returned page, not across all database records.

## Driving-time discovery (real OSRM durations)

```http
GET /api/places/travel-time?anchor=fpt&minutes=10&category=cafe&limit=12
```

Public, read-only, no cookies or login required. Supported landmark keys:
`fpt`, `dhqg`, `cnc`; **no GPS or arbitrary origin coordinates accepted**.
Supported driving-time thresholds: **5, 10, 15 minutes**, with `limit`
1–20, and an optional validated category slug. Profile is currently
`driving` only.

The API first resolves the **actual published landmark or authoritative
map feature** using the existing name/alias resolver. It then queries up to
40 nearest published POIs inside the existing nine-zone coverage, sends
their public coordinates plus the landmark to the configured OSRM
`/table/v1/driving/...` matrix, and includes only candidates with a
valid road-network duration within the requested threshold. Results are
sorted by **actual OSRM duration**, using organic rank to break ties.
Durations are estimates and **do not model real-time traffic**.

Response includes `anchor`, `items` (public POI plus
`durationSeconds`/`travelMinutes`), `minutes`, `profile` and
`meta:{provider:OSRM,method:road-network-duration,candidatesChecked,
candidateLimit:40,limitedCoverage}`. The candidate limit and
`limitedCoverage` warning are explicit, because this operation does
**not** guarantee an exhaustive isochrone or the fastest path to every
POI in the entire service area.

No crow-flies estimate is presented as actual driving time. If OSRM
is unreachable, returns a malformed/unreachable matrix or times out,
the API returns HTTP **503**, and the UI displays a retryable error.
If a named landmark is missing, the API returns **404** rather than
guessing geographic coordinates.

Expensive requests are limited to 30/minute/IP, and equivalent
anonymous requests share a 45-second in-memory cache with at most 48 keys.
There is no personal profile, history, GPS permission or paid API
requirement in the new feature.

## Frontend

The existing MapPage sidebar has a collapsed **Khám phá theo phút lái xe**
panel (desktop and mobile). The user explicitly chooses anchor,
category and 5/10/15 minutes and presses **Tìm địa điểm phù hợp**.
Results show minutes and allow **Xem ghim** or **Chi tiết**. Opening a pin
uses the existing map-focus and public place selection logic.
Changing any field cancels a pending request and clears outdated results.

The panel also contains non-personalized one-tap natural-search examples:
`cafe gần FPT`, `nhà trọ gần ĐHQG`, and
`quán ăn gần Khu CNC`, which reuse the existing search API.
No tracking occurs without an earlier WA-002 consent. The search chip
uses the existing opt-in telemetry hook without adding GPS/raw keywords.

## Release verification

- Node tests: ranking priority and no paid bias; query validation;
  OSRM `sources=0` matrix parsing; unreachable POIs excluded;
  published-only prefilter; no fabricated driving time; bounded cache;
  faster actual duration wins.
- Playwright: desktop calculation and pin selection, mobile OSRM-offline
  error and no synthetic results, plus all existing map/HOLA Trip suites.
- Build, backend PostgreSQL/PostGIS and security CI must remain green.
- Staging: verify OSRM `/table` route is enabled for the production
  `ROUTING_BASE_URL` (not every route provider supports the matrix API).
  Test from real mobile 4G, confirm travel times and coverage limitation.
- No DB migration. No changes to Developer API, authentication, CMS,
  HaloHola, real estate moderation or X-HUB WA-002/WA-005 switches.
- GitHub merge alone does not deploy VPS.
