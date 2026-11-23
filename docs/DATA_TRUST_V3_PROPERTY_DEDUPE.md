# HOLA Maps — Sprint 3: Data Trust V3 / Đối chiếu tin bất động sản

## Scope and safety

This iteration extends **existing** P0 housing moderation, rather than
building a second moderation or photo pipeline. It does not migrate
PostgreSQL, change login, bypass 2FA, rewrite CMS/CRM or X-HUB WA-002/WA-005,
or silently modify/approve/delete user listings.

No machine-generated or rule-based score is a calibrated probability of
duplicate ownership. **Every flagged property still needs a human
Admin/Moderator decision.** Apartments, rooms and plots often have
identical coordinates, price, agent/phone or images for legitimate reasons.

## Duplicate-check V3: explainable signals

Existing staff API remains:
`GET /api/admin/contributions/:id/duplicates`
(restricted to Admin/Moderator by the shared 2FA Admin router).

The existing 100-metre, 12-published + 12-pending candidate lookups
are preserved. Only active/unexpired published housing is considered.
Pending candidates must still be in `PENDING` and `CREATE_PLACE`
and must have a housing category plus an actual real-estate payload.
Invalid coordinates are safely rejected; no network image fetch.

Signals used to **prioritize** a candidate:

- Vietnamese accent/case/punctuation-insensitive title similarity:
  token overlap + character bigram Dice coefficient (bounded to 0–1)
- Same contact number (normalized +84), transaction type, property type
- Within 6% area / 7% price for **the same transaction type**
- Explicitly **different** căn/phòng/lô/thửa number, e.g. căn 101 vs căn 102
- Explicitly contradictory area >=25% and price >=40%
- Existing geographic distance (up to 100 m), never treated as
  identity proof by itself

Output for moderation includes risk `LIKELY_DUPLICATE`, `REVIEW`,
`NEARBY`; a heuristic score 0–100 (an **ordering aid, not a
statistical probability**), text similarity and fixed-string evidence:
`SAME_CONTACT`, `SAME_TITLE`, `SIMILAR_TITLE`,
`SAME_TRANSACTION`, `SAME_PROPERTY_TYPE`, `SIMILAR_AREA`,
`SIMILAR_PRICE`, `DIFFERENT_UNIT`, `DIFFERENT_AREA`,
`DIFFERENT_PRICE`, `WITHIN_25M`.

Only **same contact + strongly similar title + within 25 m, without
explicitly conflicting units/size/price**, is marked likely duplicate.
Other plausible cases are for human review. The backend preserves
the existing review-before-approval requirement.

The Admin UI explains evidence with Vietnamese chips and cancels any
previously checked "Tôi đã đối chiếu" acknowledgement if the
**same** candidate's risk/title/evidence changes between reviews,
not just when candidate IDs change. Admin must check the latest result
again. This is UI freshness hardening, **not** a new credential,
automatic rejection, or a substitute for the backend's repeated check.

## On-demand private risk triage

`GET /api/admin/contributions/property-risk-queue?limit=10&offset=0`

Only `ADMIN`/`MODERATOR` with existing Admin security/2FA.
Strict `limit=1..10`, `offset=0..500`; at most 6 scans per minute/IP.
Each scan first selects the oldest pending real-estate submissions
and performs at most 2 bounded spatial queries per selected item
(sequential, no runaway concurrency). Results are prioritized HIGH,
MEDIUM, LOW. The response returns **only** the pending contribution ID,
name, priority, candidate count and safest comparison signals.
**No raw payload, coordinates, phone, account ID, email, title query
history, or token** appear in the aggregate queue response.

There is **no automatic queue scan**, cron, or DB write. A staff member
clicks **Quét & phân loại** in Admin → Đóng góp cộng đồng and can then
click **Xem & đối chiếu** on a flagged contribution in the loaded
queue. Scan pagination is explicitly partial, not a comprehensive site
assessment. Approvals still re-check actual candidates separately.

## Data-quality dashboard fix

The existing Data Trust quality dashboard's duplicate heuristic now
uses Vietnamese unaccented normalized titles **within the same
category**. For housing it also requires the same structured
property type and sale/rent listing type; a café, house and another
property on identical coordinates must not automatically count as
the same item. Existing quality score, coverage, verification,
reviews, media and freshness logic remains unchanged.

## Release gates and tests

Node tests cover accent/punctuation/fuzzy titles, exact and different
unit IDs, contradictory area/price, bounded candidate sets, no PII
in risk-queue responses and read-only behavior. Playwright verifies
Admin candidate evidence, same-ID updated evidence invalidating an
acknowledgement, distinct apartments and a deliberately triggered
risk-queue scan. Run full backend/PostgreSQL 16, frontend build,
Playwright and CodeQL on the PR before merging.

No new migrations; on production only pull, update dependencies if needed,
build and PM2 restart after CI release gates. This PR does not deploy
VPS, change Nginx or enable WA-005 analytics. Real image perceptual hashes
(pHash) and photo ownership verification require a separate vetted
privacy/copyright-aware pipeline and are **not** represented here
as already implemented.
