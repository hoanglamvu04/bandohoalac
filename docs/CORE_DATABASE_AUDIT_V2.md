# HOLA-P1-301 — Database Intelligence: first audit and implementation slice

Baseline main `509b077d56685f861a62ad5c4b9d5303a9a4afe6` after #145; roadmap #144 reconciled at `0930078c43ac4e596dd2126d90d2ca282e1de719`. Static review of schema.sql, migration runner, pool, spatial/owner query paths and migration DDL inventory through 390. **No live database, catalog, production EXPLAIN, load or backup/restore evidence was collected.** Catalog output must be obtained in the intended environment before acceptance.

## Findings and treatment

| Severity | Evidence on baseline | Cause / risk | Treatment |
|---|---|---|---|
| HIGH | backend/src/database/migrate.js:8–31; migrations/20261010_core_landmark_fpt.sql:37–75 | All historical SQL replays every deploy, including an UPDATE/UPSERT that can republish the FPT landmark. No applied checksum ledger. | Add sorted SHA256 dry plan and session advisory lock now. **Legacy replay remains unchanged**; do not silently infer migration history from a populated DB. Next: isolated restore, validate baseline/schema and actual applied revision, review legacy DML, explicit adoption and forward-only transactional ledger. |
| HIGH | backend/src/database/migrate.js:8–31 | Concurrent deployment runs may interleave SQL/DDL. | Dedicated session and nonblocking advisory lock for whole runner, cleanup on failure. All operators must use the new runner; older direct SQL/runner does not honor the lock. |
| HIGH | backend/src/database/pool.js:7–24 | Driver default pool config with no acquisition deadline; rollback failure masks original exception and can return broken connection. | Bounded configurable max/connect/idle; optional server timeout overrides; preserve original error and discard failed sessions; unit tests. |
| MEDIUM | schema.sql:103–108, place.service.js:495–549, housing.service.js:261–268 | Geometry GiST does not directly cover geography-cast ST_DWithin. | Candidate geography GiST index in migration 400. Verify plan and size/lock on staging; no speedup claim yet. |
| MEDIUM | schema.sql:95–106, housingLifecycle.service.js:11–30, place.service.js:906–938 | No leading owner/created_at index found in static inventory, unstable sort on equal timestamps. | Add owner/date/id B-tree and deterministic owner listing order. Actual catalog/usage still to verify. |
| MEDIUM | housingLifecycle.service.js:17–24 | Repeated correlated scans for viewing and metrics. | One lateral aggregate per relation, retain exact owner scope and response fields. |
| MEDIUM | place.service.js:215–257, 495–550, 750–799; housing.service.js:335–345 | OFFSET pagination and some count windows scale with deep pages. | Keep current contracts until cursor endpoint + compatibility tests designed; no claimed cursor implementation. |
| REVIEW | schema.sql and migration SQL through 390 | FK/constraint/index validity, duplicate and unused index questions cannot be established from files alone. | Catalog audit flags missing leading B-tree candidates and invalid/unvalidated entries; do not auto-add/drop or repair rows. |

## Read-only checks (from backend directory)

```bash
npm run db:migrate:plan
npm run ops:db:audit
```

The first command does not connect to PostgreSQL or apply SQL; SHA256 list is a plan, not applied migration history. The second connects using configured database credentials and runs a bounded read-only transaction; emits only catalog/index/constraint statistics and sanitized fixed access-path plans, no data rows, connection strings or raw EXPLAIN filters. Row counts are estimates. It can fail on lock/statement timeout; no automatic retry. Review output privately.

For actual execution probes only on isolated staging (use the real isolated DB name, not the production connection):

```bash
NODE_ENV=test HOLA_DB_AUDIT_CONFIRM=ANALYZE_ISOLATED_STAGING HOLA_DB_AUDIT_EXPECTED_DATABASE=hola_staging npm run ops:db:audit -- --analyze
```

The command refuses ANALYZE for NODE_ENV=production or mismatched confirmation/database name. Operator must ensure DATABASE_URL is staging. Fixed SELECT probes are not full API benchmarks; owner probe uses ID 0 and is deliberately not representative. Capture baseline before migration 400 on a staging copy, compare plans after migration, measure actual endpoint load separately. No raw query or row output. Do not run load testing on production.

## Pool and migration rollout

Optional DB_POOL_MAX (default 10, max 50), DB_CONNECT_TIMEOUT_MS (10s), DB_IDLE_TIMEOUT_MS (10s); count across PM2 instances, jobs and maintenance tools before tuning. DB_STATEMENT_TIMEOUT_MS, DB_LOCK_TIMEOUT_MS and DB_IDLE_TRANSACTION_TIMEOUT_MS are opt-in overrides (0/unset preserves PostgreSQL role defaults). Application/CLI pool shares those limits; dedicated migration client does not inherit timeout overrides. Do not retry uncertain commits. Inspect cron/long-running jobs before enabling statement/transaction timeouts.

Migration 400 is additive with bounded lock/statement timeouts, ordinary index builds can block writes. Use verified backup/restore and staging upgrade; schedule approved maintenance if necessary. Existing runner still replays historical migration SQL and schema.sql. The new lock prevents only concurrent new runners; it does not authorize production replay or mark earlier migrations applied. The high-risk legacy baseline/ledger issue must be resolved with evidence before adopting a forward-only runner. Do not change historical migrations or remove indexes without measured evidence.

## Acceptance remaining

- Full catalog audit on isolated restored PG16/PostGIS, inspect unvalidated constraints/FK coverage, index overlap and actual schema drift.
- EXPLAIN ANALYZE and API load baseline before/after, pool saturation and realistic owner selectivity. No measured latency or throughput claims.
- Migration ledger/adoption plan, cursor pagination and persistent aggregate tables remain separate tasks; existing monthly and daily aggregates must be reused.
- Real backup/offsite/restore, security/consent and WA-005 gates remain unchanged.
