# WA-005 — HOLA Maps → X-HUB federated analytics (READ-only pull)

**State: code proposed, not deployed or enabled.** Contract source:
[`hoanglamvu04/x-hub/docs/integrations/WA005_FEDERATED_ANALYTICS_PULL.md`](https://github.com/hoanglamvu04/x-hub/blob/main/docs/integrations/WA005_FEDERATED_ANALYTICS_PULL.md).
This implements a separate source for X-HUB to **GET daily aggregates**; it
never uses the site's 15-minute `softLaunchMetrics`, old GA data or
unverified session/visitor telemetry.

## Contract

`GET https://maps.dothihoalac.vn/api/xhub/v1/analytics/summary?days=7|30|90`

Header `X-XHub-Analytics-Key` must be a **new 64-character hexadecimal key**,
independent of the WA-002 site→X-HUB token. Key comparison uses
`crypto.timingSafeEqual` on fixed-length 32-byte buffers. The key is only in
the website backend's secret environment and X-HUB backend's secret
environment, never a query string, cookie, browser build, response or log.

Responses are strictly `schemaVersion:1`, `siteCode:bandohoalac`,
`siteHost:maps.dothihoalac.vn`, `period:{days, timezone:Asia/Ho_Chi_Minh}`,
`generatedAt` ISO UTC, `privacy:{consent:explicit_opt_in,granularity:aggregate_only}`,
`metrics:{pageViews,contactClicks,leadSubmissions}`, `daily:[...]`.
Dates use **Vietnam calendar days** including the current day; zero days
are omitted from `daily`, and the sum of daily counters equals `metrics`.
Only safe nonnegative integer counts are returned. No raw event trail, IP,
coordinates, session, visitor/account IDs, emails, phone, query, form body or
URL/UTM values ever appear in responses.

The endpoint has **no CORS** (mounted before the website's CORS middleware)
and denies `Origin`, `Cookie`, `Referer` and `Sec-Fetch-Site` headers
even with a valid key. It is independent of the logged-in user session.

Expected HTTP outcomes:
- `200`: key valid and a consented, persisted source exists, JSON schema above.
- `400`: invalid/missing/repeated `days` or unexpected query parameters.
- `401`: missing/wrong key when the site source has been configured.
- `403`: browser-origin/cookie/Fetch Metadata request.
- `405`: unsupported methods; `429`: more than 40 GETs/minute/IP.
- `503`: disabled/unprovisioned source, missing migration/database, no
  qualifying consented events yet, or unreadable/unsafe aggregate counters.

Never substitute a mock `0` or a `200` HTML SPA fallback for a `503`.

## What counts (privacy-preserving source)

The site reuses WA-002's already allowlisted, explicit-opt-in browser events
and the **existing** `POST /api/xhub-analytics` route. A POST must pass the
old schema/Origin/GPC/DNT/size/rate checks. When the WA-005 feature is
explicitly activated with a valid READ key, that route accepts the consented
batch **locally** rather than pushing the same event batch to X-HUB.
When WA-005 is off, the WA-002 push bridge works exactly as before.
This prevents the two modes from double-delivering a browser event. X-HUB
still displays the pull totals separately from any historic WA-002 push data;
**never sum them together**.

Only these valid consented events update daily counters:

| Aggregate | Qualified WA-002 event | Why |
| --- | --- | --- |
| `pageViews` | `page_view` on approved public routes | One page-view event |
| `pageViews` | `map_place_view` **only on** `/map` or `/local-map` | Content opened in the map; avoids counting the same `/place` detail view twice |
| `contactClicks` | `contact_click` | Public contact CTA, no phone captured |
| `contactClicks` | `map_directions_click` | Explicit navigation/contact intent, no location captured |
| `leadSubmissions` | **No current source** | No verified backend-successful CRM lead form. Do not infer from community contributions or housing submissions |

Events named `search_used`, `filter_used`, `favorite_added`,
`lead_submitted` from an unverified browser and detail-page
`map_place_view` **do not increment** these three metrics. A real,
server-verified lead workflow must be reviewed before adding any lead counts.

**Storage design:** PostgreSQL `wa005_consented_daily_counts` has only one
row per day with three integers. `wa005_consented_event_dedup` has only
SHA-256 digests of fresh random `eventId` UUIDs (not raw UUIDs, visitor or
session IDs) and acceptance timestamps; it prevents replay/double counts.
Original WA-002 batches are never saved. Events are aggregated transactionally
using `INSERT .. ON CONFLICT`; the result is stable across multiple PM2
workers. No background Google Analytics backfill or X-HUB data fetch is used.

The read endpoint returns `503` until at least one **qualified consented
event** has been stored. It never reinterprets historic website traffic as
opted in. Historical coverage begins at activation; X-HUB must not treat
older, uncollected periods as proven complete.

## Disabled-by-default configuration

Backend website only, in `backend/.env` or protected process secret store:

```dotenv
XHUB_PULL_BANDOHOALAC_ENABLED=false
XHUB_PULL_BANDOHOALAC_KEY=
```

X-HUB backend uses its **own** `XHUB_PULL_BANDOHOALAC_KEY` variable holding
the same approved new key. Other WA-002 settings are independent. A missing,
malformed or disabled READ key yields `503` and does not activate collection.
Do not put the key in `VITE_*`, JavaScript, a CLI argument, code, PR body
or Github Actions logs.

**Activation gates:** explicit project-owner approval; X-HUB source/workspace
and `web.analytics.read` review; site PG16 migration and successful staging
ingestion using mock consented events; verify 401/403/400/503/200/429;
HTTPS response JSON and actual Nginx proxy; clock synchronization; file mode
600 for secret files; verified privacy notice and ability to revoke consent.
Only then may the operator enable `XHUB_PULL_BANDOHOALAC_ENABLED=true` on
the website and configure the separate READ key on both backend processes.
Do not silently enable WA-002 push concurrently; WA-005 local aggregation
wins when both flags are set.

## Migration and retention

New idempotent migration:
`backend/src/database/migrations/20261123_290_xhub_wa005_consented_aggregates.sql`.
It is included in the normal `db:migrate` runner but **must not be applied
on production** until a separately approved maintenance/deployment window,
including a verified database backup.

After approval, schedule
`npm --prefix backend run wa005:prune` daily at a quiet hour (e.g. 02:50
local). This removes per-event **digests after 48 hours**, and daily
aggregates older than **100 calendar days** (enough for 90-day queries).
The prune script is not scheduled automatically by this PR. Monitor
migration/retention errors without including secrets, event IDs or user data.

## Test plan

CI PG16/PostGIS, backend tests, frontend build and existing Playwright must
pass. Added tests cover:
- READ key exact 64-hex, constant-time check, no key/wrong key, browser
  origin, cookie, Fetch Metadata, unsupported methods, rate limiting.
- `days=7|30|90`, Vietnam midnight/year boundaries, schema, safe integer
  counts, daily sums, no raw sensitive fields and 503 when unavailable.
- WA-002 opt-out, GPC/DNT, invalid schema/PII payload rejection, opt-in;
  source readiness, local-only collection and replay deduplication.
- A `lead_submitted` from a browser is **not** treated as a confirmed lead;
  `map_place_view` on detail is not counted twice.
- Existing public map/Developer API/HaloHola/auth/CMS/CRM and WA-002 push
  behavior remain covered by their prior tests.

No production VPS changes, no key provisioning, no new/duplicate
`web_analytics_sources` rows in X-HUB, and no X-HUB dashboard aggregation
is performed by this PR.
