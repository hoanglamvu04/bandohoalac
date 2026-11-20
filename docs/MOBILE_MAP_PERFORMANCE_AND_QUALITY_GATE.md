# HOLA Maps — Mobile map network budget & public-data quality gate

## Map overlay network behavior

- Canonical map points still use the existing progressive viewport/pagination strategy.
- Extra information layers (terrain, flood, community road closures, alerts etc.)
  now request a **15% padded visible viewport**, and reuse the response while
  the camera stays inside it.
- Cache: maximum **4 layer/viewport records**, lifetime **60 seconds**.
  Changing visible types causes a fresh request unless a matching cached
  type-set still exists. Crossing the cached coverage also refetches.
- Submitting or confirming a community road status increments the existing
  `statusRefreshKey` and **invalidates all overlay cache entries**.
- Aborted requests never populate the cache. MapLibre still clips geometry
  outside the current camera, so small mobile pans avoid GeoJSON re-upload.
- No persistent storage, cookies, database migrations or service workers
  are involved in this cache.

## Data Quality V3 corrections

A property listing is not a business with opening hours. Property quality
therefore checks structured listing type, property type, a real sale/rental
price, area, public contact and expiration/status separately from cafés
and shops. Old property records lacking structured fields must be reviewed,
not silently marked as verified.

A missing PostGIS coordinate now reports `MISSING_COORDINATES`, not an
`OUT_OF_COVERAGE` classification at (0,0).

The overview distinguishes:
- `summary.totalPublished`: actual published POI count;
- `summary.auditedCount`: number of oldest published POIs examined (up to 5000);
- `summary.auditPartial`: whether the quality counts come from a partial sample.

Only `totalPublished` is a global count when the published dataset exceeds
5000. Every other KPI and coverage breakdown pertains to the audited
subset; do not describe them as a full-catalog inventory.

## Acceptance before public promotion

1. On a 390×844 mobile viewport, a short pan does not issue a new
   `/api/map-layers` request; panning beyond the padded view does.
2. Turning layers on/off and explicitly confirming road status still reload
   visible data as necessary. No new camera movement on closing place cards.
3. Open the admin Data Quality dashboard: review `PROPERTY_EXPIRED`,
   `PROPERTY_NOT_ACTIVE`, `INCOMPLETE_PROPERTY_PROFILE` and
   `MISSING_PROPERTY_PRICE`. Correct data through moderation, not SQL edits.
4. Check 4G/lower-end Android and Safari iPhone with a cold cache and then
   short panning sessions. Record real transfer size and interactive time.
5. Confirm live VPS offsite backups, actual independent restore drill and
   historical media/EXIF audit from the P0 runbook before public launch.

These changes optimize one network path and improve quality classification.
They do **not** certify end-to-end latency or live data quality by themselves.
