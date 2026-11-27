# HOLA Maps — Seven-wave release readiness (HOLA-P0-134)

Code/CI is not production acceptance. PR #136/#138–#141 merged when this document was created; #142 and this readiness PR must pass their own gates. Check the current main SHA, merge status and all checks before deploying.

## Owner-operated release
- Use the existing `docs/PUBLIC_LAUNCH_P0_RUNBOOK.md` as the deployment contract. Review `git status --short`, `git fetch origin main`, `git log --oneline HEAD..origin/main`. Stop for unexpected changes or unknown commits. No hard reset.
- Complete verified DB/media backup and separate isolated restore drill. Run `bash scripts/p0-verified-backup.sh`; an absent offsite destination or unverified media-provider export is a blocker, not success.
- On isolated staging, review migrations 370, 380, and 390 (only those merged on main). From repository root: `(cd backend && npm ci && npm run db:migrate)`, `(cd frontend && npm ci && npm run build)`. Never seed production or restore over the live DB. Follow the existing owner-approved PM2/Nginx procedure, confirm the process name first.
- After successful staging and approval, owner may pull main with `git pull --ff-only origin main` and apply migrations/build under the established deployment procedure. Do not blindly roll back schema changes. If failure, stop and consult backup/restore runbook.

## Anonymous read-only smoke
Run from root against deployed staging or approved production:
```sh
node scripts/release-smoke.mjs https://maps.dothihoalac.vn
bash scripts/check-p0-readiness.sh
```
First command checks ten public/anonymous API conditions without printing bodies, IDs or contacts; no cookie/token, no writes, redirects disabled, ten-second request timeout. Exit 0 all checks pass, 1 failure, 2 skipped detail checks when no eligible rental sample. An empty rental list is not proof of detail redaction. Passing does not prove all contact leakage channels are absent or authenticated paths work.

## Manual staging acceptance
| Area | Verify |
|---|---|
| Housing | One room type must satisfy all filter criteria; review and revoke role status using separate authorized admin; no legal-title claim; contact revealed only through member route; reminder job schedule and moderation reports |
| Search | Vietnamese typo/diacritics, service names, opt-in local history and clearing, quick categories |
| Map | Geographic price grid and legend, low-sample suppression, share/restore camera and filters, mobile viewport, no leaked private coordinates |
| Admin | Filter quality issues, selected CSV neutralization, inspect revisions and restore a test revision |
| Community | Submit/approve/revoke real-source test event on isolated staging, no self-approval; Q&A moderation and expiry |
| SEO/PWA | Drafts not public/indexable, canonical/sitemap gate, public BĐS phone redaction, offline static page rather than cached authenticated pages, installation on actual devices |
| Operations | Verified backup/restore, readiness, TLS, job schedules, peak load/P95, real-device E2E and rollback drill |

Record evidence and decisions in LUU_Y_CODE. No production action is taken by this document or the smoke script.
