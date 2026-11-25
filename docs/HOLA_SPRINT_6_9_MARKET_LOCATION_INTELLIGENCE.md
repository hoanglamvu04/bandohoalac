# HOLA Maps — Price & Location Intelligence (Sprint 6 / 9 foundation)

## What users see

Map > Bất động sản > So sánh & theo dõi tin mới:

1. **Giá chào tham khảo** — button-triggered quartiles (25th, median,
   75th) of VND/m² for SALE or VND/m²/month for RENT, filtered by
   transaction type, optional property type, and the current map viewport
   when it is small and bounded. Never labels asking prices as closed
   transactions, legal appraisals, or proven market valuations.
2. **Tiện ích quanh bất động sản** — button-triggered overview anchored
   to the *public property listing ID*, at 500 m, 1 km or 2 km. Shows
   category counts and up to 8 nearest public places with straight-line
   distance. No phone, account, location source, GPS or form data.
3. **Exploratory price signal** — after the user also compares
   public listings, a price/m² notably outside the selected public
   distribution may be explained as an atypical asking price, with no
   automatic takedown, rejection or fraud label.

## API

```http
GET /api/housing/market-insights?listingType=SALE&propertyType=LAND
GET /api/housing/market-insights?listingType=RENT&west=105.50&south=21.00&east=105.58&north=21.06
GET /api/housing/:placeId/amenities?radius=1000
```

Public read-only, 30 requests/minute/IP on either expensive endpoint
and 60 seconds public response caching. API validates all inputs and
rejects partial, reversed or >0.6°-wide viewport envelopes.
Market query uses only already-published, ACTIVE and unexpired
structured housing with positive price and plausible area. An explicit
minimum of 5 published observations is required for reporting quartiles;
otherwise `quartiles: null`. Results carry `sampleCount`,
`source`, `unit`, `areaBasis` and a disclaimer.

Amenities include eight preapproved public categories only. If more
than 100 public nearby places are found, counts and results are
explicitly labeled capped, not presented as exhaustive. The optional
`dataQuality` response object gives `trackedCategoryCount`, `freshnessDays`,
and `verification` counts (`recent`, `older`, `unknown`) for the same
nearest-100 sample. Freshness uses HOLA's `last_verified_at`, with a
180-day threshold. Missing or future dates count as unknown. This is
evidence of verification recorded in the database.

## Audit amenity coverage by HOLA service zone

Run against a permitted database or read-only snapshot, with the backend
database connection already configured:

```bash
npm run housing:amenities:audit --prefix backend
```

The command runs in a read-only transaction with a 30-second statement
timeout. It emits aggregate JSON for all eight amenity categories in
each of the nine service zones, plus a bucket for listings outside them.
Each published, active, unexpired structured listing is assigned to its
nearest configured zone that contains it. These circles approximate the
product's service areas. Interpreting results as official commune totals
requires authoritative boundaries.

For each zone and category, `activeListings` is the denominator,
`listingsWithPoi` counts listings with at least one published POI
within 1 km, and `listingsWithRecentlyVerifiedPoi` counts those with at
least one HOLA verification within 180 days. Multiple POIs in a category
count once per listing. A zero denominator means there are no eligible
listings to assess. The results measure the share of listings with
recorded amenities, while estimating completeness on the ground
requires an independent inventory.

## Scope and limits

- This is not a housing transaction database, predictive price model,
  historical price trend, ownership verification or real-time routing.
- No personal geo collection, raw search histories, uploads,
  persistent storage, external AI provider, cron, migration or analytics
  are introduced.
- Existing WorkOS/X-HUB WA-005 remains separately gated. No production
  enablement or VPS deployment.
- Node schema/service tests and Playwright UI coverage must pass, along
  with existing PG16/PostGIS, frontend build and security checks.
- Public launch still requires live backup/restore, privacy, accessibility,
  mobile and security acceptance according to PUBLIC_LAUNCH_P0_RUNBOOK.md.
