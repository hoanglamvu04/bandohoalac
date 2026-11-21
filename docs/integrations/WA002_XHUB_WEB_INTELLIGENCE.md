# WA-002 — HOLA Maps → X-HUB Web Intelligence (PR only; production disabled)

Based on [site issue #90](https://github.com/hoanglamvu04/bandohoalac/issues/90) and source-of-truth files in `hoanglamvu04/x-hub`:
`docs/integrations/WEB_ANALYTICS_WA001.md`,
`docs/integrations/WA001_SITE_HANDOFF.md`,
`integrations/web-analytics/xhub-web-tracker.mjs` and
`integrations/web-analytics/xhub-express-bridge.mjs`.

## Architecture and privacy boundary

```text
Explicit user analytics opt-in, with GPC/DNT blocking
  -> HOLA-only browser adapter (in-memory random session; no token/cookie ID)
  -> GET /api/xhub-analytics/status (only after opt-in)
  -> schemaVersion:1 POST /api/xhub-analytics (same-origin only)
  -> backend Express bridge, origin + DNT/GPC + strict allowlist + 25/min/IP
  -> HTTPS X-HUB telemetry endpoint (bearer token from backend env only)
```

Consent is **denied by default**. Only an explicit `granted` value
stored under `hola_xhub_analytics_consent_v1` enables attempted collection.
This key stores a *choice*, not an account identifier or session identifier.
A visitor can change this choice using **Tùy chọn thống kê**. Revoking it
clears in-memory data and aborts an outstanding browser request when possible.
An opt-in is not, on its own, enough: the site also requires a successful
backend readiness check before emitting any event. Unsupported browsers,
GPC/DNT, disabled source or missing env lead to **zero event POSTs**.

**No visitor-specific cookies, persistent session IDs, fingerprinting,
search strings, filter values, coordinates, route origins/destinations,
referrers, UTM values, phone, email, form body, account/user ID, JWT or
full URL** are used by this adapter. Even a user-entered dynamic URL is
reduced to a static public route (such as `/place` or `/dia-diem`).
Public `place` IDs must be numeric and pass a strict allowlist; no
untrusted labels are sent. The Express bridge repeats validation and
rejects unexpected JSON keys before contacting X-HUB.

Existing GA/soft-launch vitals, user auth/session and geolocation map
logic are unaffected. No raw CRM or submissions are backfilled. X-HUB
Web Intelligence is an aggregate reporting channel, **not a CRM lead
creation API**.

## Event mapping (no values except the public place ID)

| Event | Trigger | Metadata |
| --- | --- | --- |
| `page_view` | SPA navigation to a public route | Static path only, one/route |
| `search_used` | Explicit selected search result, vertical shortcut or Enter | None |
| `filter_used` | User changes category, availability, rent, rating, sort, etc. | None |
| `map_place_view` | Public place detail API successfully loaded | `entityType:place`, public numeric `entityKey` |
| `map_directions_click` | User clicks directions in map/place detail | Public numeric place ID, never GPS |
| `favorite_added` | `POST /api/places/:id/favorite` succeeded with `favorite:true` | Public numeric place ID, never user ID |
| `contact_click` | User clicks the public phone CTA | None; no phone digits |
| `lead_submitted` | **Not wired** | No validated lead/CRM API success flow in this repo; posting real estate and sending community contributions are **not** qualified leads |

SDK event names are limited to the X-HUB WA-001 enum. The backend
accepts only the mapped event set, `schemaVersion:1`, 1–20 events per
request, body <=16 KB, `consent:true`, valid UUIDs/time windows,
approved static public paths and numeric public place IDs. The backend
never appends IP, cookies, request headers or user account context.

## Release gates — operator action only

**DO NOT deploy this PR or enable X-HUB telemetry yet.** X-HUB issue
[WA-002 #30](https://github.com/hoanglamvu04/x-hub/issues/30)
requires independent PG16 migration 089 review, staging HTTP acceptance,
approved organization/workspace mapping and scoped capability
`web.analytics.read`, site-specific source/token provisioning, GDPR/
local privacy review and retention operations.

In site backend secret configuration (not committed), and only after
approved staging/release gates:

```dotenv
XHUB_WEB_ANALYTICS_ENABLED=true
XHUB_WEB_ANALYTICS_APPROVED=true
XHUB_WEB_ANALYTICS_SITE_ID=      # operator-provisioned UUID, unique to HOLA Maps
XHUB_WEB_ANALYTICS_SITE_TOKEN=   # 43-character secret; DO NOT COMMIT OR PASTE
XHUB_WEB_ANALYTICS_PUBLIC_HOST=maps.dothihoalac.vn
XHUB_WEB_ANALYTICS_BASE_URL=https://hub.holaspace.vn
```

Both switches default false, and invalid/missing credentials keep the
route unavailable without crashing the application. The status endpoint
exposes **only** `{schemaVersion:1,enabled:boolean}`. The browser never
receives a siteId or token. Note that `XHUB_WEB_ANALYTICS_APPROVED=true`
is an operator-controlled release gate, *not* proof of authorization
itself. Revoke/rotate the source server-side if compromised.

## Validation

CI (Node 22, PostgreSQL 16/PostGIS, Playwright) must pass:

```bash
npm test --prefix backend
npm run build --prefix frontend
npm run test:e2e --prefix frontend
```

Test cases include opt-out = 0 event POST and no status check;
opt-in = `schemaVersion:1`, three public place views = three
`map_place_view`; directions and confirmed favorites only; GPC/DNT
blocking; unknown origin, missing origin, invalid consent, PII fields,
URL/GPS payload, oversized batch, over-25/min burst and missing source
rejected. Inspect production frontend assets separately to confirm no
server token exists before any release.

**Not yet accepted:** real event ingestion, X-HUB dashboard aggregates
and cross-workspace permission tests; these require provisioning and
sign-off from the X-HUB team. Do not infer a workspace from this host.
