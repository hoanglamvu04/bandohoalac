# HOLA Maps — Sprint 2: Real Estate Intelligence

**Status:** implementation PR, not production deployment.

## Public property comparison

`GET /api/housing/compare?ids=701,702` accepts 2–4 distinct, positive
public property IDs. It uses the canonical housing listing service so
only **PUBLISHED** places with **ACTIVE**, unexpired housing are shown.
Missing/unpublished/expired IDs are not leaked, only counted in
`unavailableCount`. Order follows user selection. Each result contains
`pricePerM2Vnd` derived exclusively from the published listing price
and nonzero published floor/land area; if any input is absent, this
number is `null` (never an inferred appraised price).

For SALE, unit price is VND/m². For RENT, it is VND/m²/month.
The existing `distanceToFptM` is geographic (straight-line)
distance, **not driving distance**. Use Sprint 1 / OSRM for driving
minutes instead. The React sidebar supports selection of 2–4 currently
loaded Housing results, a responsive comparison table and direct
links to public detail pages.

## Additional Housing filters

Reuse the existing `GET /api/housing` and `housing_listings`
PostgreSQL schema. New frontend filters include
`propertyType=LAND|HOUSE|APARTMENT|VILLA|COMMERCIAL|OTHER`,
`minArea`, `maxArea`. All former price, rental, distance,
availability and amenity filters remain available.

## Saved searches and in-app alerts

```http
GET    /api/housing/saved-searches
POST   /api/housing/saved-searches
PATCH  /api/housing/saved-searches/:id
DELETE /api/housing/saved-searches/:id
```

All require the website's **existing authenticated user JWT**,
bound to userId from the validated session, not request parameters.
No admin bypass or cross-account lookup. Bodies are strictly
allowlisted; a saved search contains a user-defined name and bounded
filter criteria only (no IP, GPS, geolocation, session, contact, form
payload, external URL or account IDs). Limit **12 searches per user**,
serialized by a PostgreSQL user row lock. Users explicitly save a search
to opt into IN-APP alerts; they may pause, resume or delete each one.

After the user applies a saved search, the web map keeps its current
layout and reloads the matching published Housing dataset. The alerts
are rendered by the **existing** notification bell and open the
published property detail. They do not send email, SMS or push
notifications and do not share account filters with X-HUB.

### Alert algorithm: post-approval only

A new idempotent migration
`backend/src/database/migrations/20261123_300_real_estate_intelligence_v1.sql`
adds `housing_saved_searches`, private user-scoped indexes and an
`housing_published_at` timestamp to `places`. A trigger stamps
the timestamp only when status **enters PUBLISHED**. Existing
published listings are backfilled with their original creation date
to prevent false notifications when a new saved search is created.
Normal place edits do not change the publication date.

The scheduled job `npm --prefix backend run housing:match-alerts`
scans **newly published, public, active, unexpired** property listings
against each opted-in search's allowed criteria (sale/rent, property
type, price/rent bounds, area, availability, partner status, amenities,
maximum straight-line distance from FPT and optional query text).
It inserts notifications only when the actual listing matches.

The matcher runs inside a single PostgreSQL transaction, using a
Postgres advisory lock (to reject overlapping runs) and a high-water
mark per saved search. A 24-hour overlap prevents loss when approval
commits overlap scans; the unique index on
`notifications(user_id,savedSearchId,placeId)` guarantees
idempotence. The user sees at most one notice per saved-search/listing
pair even when the cron retries. Pausing skips future notices; resume
does not backfill its paused interval.

The existing `scripts/install-p0-jobs.sh` now adds
`housing:match-alerts` every 10 minutes alongside its existing
backup, expiry and reminder jobs. The installer is idempotent (uses
the same marker to remove old entries before adding the revised
schedule). The PR does NOT execute this installer on VPS.

**Operational caveat:** as with any timestamp-based polling
algorithm, approvals held in uncommitted database transactions
longer than the 24-hour overlap are beyond the recovery window.
Normal moderation transactions are short; monitor the cron and
PostgreSQL job for persistent failures. Do not promise immediate
notifications: delivery follows the periodic scan and users may
need to wait for the existing navbar notification refresh.

## Security & release

- The notification API already enforces session auth; the saved-search
  endpoints also require auth and verify user ownership on every
  SELECT/UPDATE/DELETE. Unauthorized requests are 401.
- Alert matcher never reads pending, rejected, archived, sold, rented
  or expired listings; it uses category `bat-dong-san` only.
- No additional external messaging, location tracking, ad rank,
  data exports or changes to X-HUB WA-002/WA-005.
- No secrets and no private account search terms are checked into Git.
- CI: PostgreSQL 16/PostGIS migration, compare (price/m² and missing
  fields), validation/PII rejections, cross-account IDOR, approved-
  only notification matching and duplicate scan, frontend build,
  Playwright compare/save/pause/delete, Security Scan/CodeQL.
- **Do not deploy production until database backup is verified and
  post-merge CI passes.** Deployment is operator-controlled. After
  approval, migrate, rebuild frontend, restart PM2 and run the
  idempotent jobs installer; verify health and the Housing UI.
