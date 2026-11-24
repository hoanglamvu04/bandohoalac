# HOLA Maps — Sprint 10 / Data Trust V5 staff triage

The existing quality/scoring implementation is preserved; quality scores
and the V3 API schema stay compatible. We add a deterministic,
explainable staff-only **priority tier** for quality-repair work:

- CRITICAL: BĐS still public after expiry or PAUSED/SOLD, missing
  coordinates, or a published point outside the supported map coverage
- HIGH: missing property profile/contact/area/price or probable duplicate
- MEDIUM: never/stale verification, missing or aging photos
- LOW: editorial metadata gaps without immediate visibility implications

Priority is a queue ordering aid, not a fraud probability or a new form
of official verification. No mutations, rejections or auto-publishing.

`GET /api/admin/data-quality` includes `triageVersion:5`,
`triageMode:READ_ONLY`, `summary.triageCounts`, and per-item
`triagePriority`, `triageRank`, and up to three fixed evidence codes.
The existing 5000-published-place audit cap remains; summary counts
describe ONLY the audited sample when `auditPartial=true`.
The API sorts urgent items before lower-scoring cosmetic issues.

Admin → Data Trust shows the priority tiers, urgent counts and
classification disclaimer, reusing existing RBAC/2FA. No extra queries,
secrets, migrations, X-HUB telemetry or production action.

Node tests cover priority rationale, property-hours exemption and
ordering under PostgreSQL 16. Full E2E and Security CI must pass before
merge. Live production data review is still required.
