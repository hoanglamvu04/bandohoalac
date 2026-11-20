# HOLA Maps — Soft launch operations (API, PostgreSQL, privacy)

## Why this exists

`GET /api/health` is a **liveness** endpoint: it confirms Express is serving
responses. It can return HTTP 200 while PostgreSQL is unavailable. Do not use
liveness as proof that user flows or data queries work.

`GET /api/ready` is the independent, rate-limited **readiness** endpoint:
- HTTP 200 + `{ ok: true, database: "up" }` when `SELECT 1` succeeds.
- HTTP 503 + `{ ok: false, database: "down" }` when the database is unreachable
  or the 1.5-second probe timeout expires.
- Short in-process 2.5-second caching limits concurrent DB probes.
- Responses deliberately omit hostnames, credentials, SQL diagnostics and
  personal information, and include `Cache-Control: no-store`.

## Admin monitoring

After deploying to VPS, sign in as ADMIN with 2FA and open:

`https://maps.dothihoalac.vn/admin/operations`

`GET /api/admin/operations/overview` requires an authenticated ADMIN session;
non-admin accounts and users without verified admin 2FA are rejected.

The screen shows a 15-minute in-memory aggregation of:
- API calls, HTTP 5xx, HTTP 429, incomplete requests
- Estimated P95 API duration (bounded reservoir sample)
- PostgreSQL readiness/response time and process heap/uptime
- Fixed endpoint *groups* (places, housing, layers, directions, auth, etc.)
- Warnings when server errors or high latency cross soft-launch thresholds

Thresholds: 5xx count >= 3 and error rate >= 2% (minimum 25 requests),
P95 > 1500 ms (minimum 25 sampled requests), or >= 10 HTTP 429 responses.
Database failure always surfaces a critical warning. Low-volume data is
flagged as insufficient evidence rather than claimed healthy performance.

## Privacy and limits

Only fixed route-group names, status counters and aggregate timings are
recorded. **Never** add full URLs, query strings, IDs, IP addresses,
authorization headers, cookies, request/response bodies or user-agent
fingerprints to the metrics service. Metrics live in RAM and expire after
15 minutes; restart of PM2 resets the data, and multiple PM2 instances would
each have an independent partial view.

This new in-memory collector does **not** change existing Nginx or Morgan
access-log policies. Those logs must be reviewed and rotated separately if
privacy retention matters. This dashboard is **not** RUM/Web Vitals: it
cannot measure mobile frame rate, tile transfer time or client crashes.

## Operator acceptance

1. Deploy the new backend/frontend and restart **bandohoalac-api**.
2. Run `curl -i https://maps.dothihoalac.vn/api/health` (liveness).
3. Run `curl -i https://maps.dothihoalac.vn/api/ready` (database readiness).
   If HTTP 503, investigate PostgreSQL/PM2 before opening the product.
4. Log in as ADMIN with verified 2FA and visit `/admin/operations`.
5. Have staff browse several places and switch mobile map layers; confirm
   counters appear under Địa điểm and Lớp bản đồ.
6. On a 390x844 handset, verify the dashboard remains readable.
7. Keep regular VPS log, offsite backup, restore-drill, photo privacy audit and
   real-device performance checks. The existing P0 readiness script now
   requires `/api/ready` in addition to `/api/health`.

This instrumentation has **no migrations** and needs no new API secrets.
Passing CI does not prove production performance, Nginx configuration or
external backup integrity.
