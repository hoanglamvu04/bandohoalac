# HOLA Maps — Sprint 15 / Public Market Insights Performance

`GET /api/housing/market-insights` is an on-demand, read-only
aggregate that uses PostgreSQL ordered-set percentiles over ACTIVE,
PUBLISHED, unexpired housing. Repeated concurrent requests for the
same public filters no longer run separate percentile queries.

The Express controller now uses a bounded in-memory singleflight
cache: 60s TTL, max 128 public filter entries, safe key length,
successful results only, no user/session/IP/phone/GPS in cache keys.
Failed PostgreSQL requests are retried on the next request; failures
are not cached. Distinct transaction/property/bounding filters remain
isolated. The existing 30/minute/IP rate limit and HTTP 60s cache
header remain in place.

The nearby amenities endpoint is intentionally NOT server-cached so
a newly paused or expired property is rechecked on every API call.
Results can be stale for at most 60s on the market aggregate; this
is acceptable for explicitly nontransactional asking-price statistics.
No new migrations, dependencies, cookies or telemetry.

Node tests exercise concurrent coalescing, TTL, capacity limits,
errors, safe keys and retry. PG16/PostGIS CI and Playwright must pass
before merge. Production latency still requires live observation.
