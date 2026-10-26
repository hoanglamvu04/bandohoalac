# Housing V3 — HOLA Rank (organic)

## Product rules

The recommended Housing results are **organic**, independent of Partner status,
payment, vouchers and advertisement campaigns. A verified Partner may be shown
with its Partner badge, but that badge is not an advertising label and does not
grant a higher position. A future paid placement must appear in a separate
visually labeled **Tài trợ** area, not within the organic ranking algorithm.

### Availability is not evergreen

The backend preserves the source-reported `housing.availabilityStatus` for
editing and auditing. It also returns the effective status:

- A timestamp in the last 30 days is required before `AVAILABLE`,
  `LIMITED` or `FULL` is presented as current.
- Missing, older-than-30-day, or future verification timestamps become
  `housing.effectiveAvailabilityStatus = 'UNKNOWN'`.
- Contradictory counts (e.g. `AVAILABLE` with 0 rooms, or `FULL` with
  more than 0 rooms) also become `UNKNOWN` even for legacy rows.
- `availableOnly=true`, `minAvailableRooms` and `availability=` filters
  use the effective status rather than the unverified original.
- New Partner edits reject contradictory room counts before storing.

A visitor must confirm availability with the owner before visiting. The
timestamp means **the last report**, not independent on-site verification.

### HOLA Rank scoring

Scores are 0–100, computed by PostgreSQL and returned in `holaRank.score`.
The `recommended` sort first groups by effective availability:

1. AVAILABLE
2. LIMITED
3. UNKNOWN
4. FULL

Inside each group, the score determines order. Ties use verification recency
then place ID so pagination remains stable.

| Factor | Max. points | Conditions |
| --- | ---: | --- |
| Effective availability | 40 | AVAILABLE 40, LIMITED 28, UNKNOWN 6, FULL 0 |
| Verification recency | 20 | ≤7 days: 20; ≤30: 13; ≤60: 6 |
| Data completeness | 30 | Price 8, area 6, contact 5, photo 7, description 4 |
| Straight-line distance to FPT | 8 | ≤1.5 km: 8; ≤3 km: 5; ≤5 km: 3 |
| Recent verification source | 2 | ADMIN 2, PARTNER/COMMUNITY 1 |

Partners and community confirmations receive the same source score; only a recent Hola Maps admin confirmation receives the extra source point.\n\nThe distance uses PostGIS geodesic distance to the fixed FPT reference point,
**not** road routing time or a user's personalized distance. The rating and
Partner's commercial membership do not affect this ranking.

### API contract

- `GET /api/housing?sort=recommended` returns ranked `items` plus
  `meta.rank` with the ranking policy and 30-day freshness window.
- `GET /api/housing/:placeId` returns the same ranking fields.
- `item.housing.availabilityStatus` retains the submitted value.
- `item.housing.effectiveAvailabilityStatus` is safe for consumer display.
- `item.housing.availabilityFresh` signals whether the timestamp is current.
- `item.holaRank` includes `score`, `signals`, `version` and `mode`.
- `verifiedWithinDays=7` or `30` filters recent verification; the existing
  Housing V2 filters and URLs remain supported.

The frontend must **not re-sort recommended Housing results by viewport**;
the SQL order is authoritative across the full filtered result set. A separate
user-chosen sort (price, distance, rating, etc.) may override recommendations.

### Operational notes

No new database migration is required: Housing V3 computes ranking from the
existing `places`, `housing_listings` and `place_images` data.
Existing records are not rewritten. Recently verified availability does not
get extended when a user only views or searches for a listing.

This is a relevance score, **not** a fraud-detection score, independent
inspection, guarantee of price, or confirmed booking. Revisit ranking weights
using real search quality feedback rather than paid partner conversions.
