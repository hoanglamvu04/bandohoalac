# P0-005 — Security handoff: uploads and cron

## Verified in main before PR
- Current `storage.service.js` calls `sanitizeUploadedImage` **before** Cloudinary upload; local non-place files are re-encoded and originals deleted; local place variants remove original in production, fail-closed if codec absent. Thus old draft PR #54 should **not** be blindly merged; compare any residual differences against current main.
- Legacy `scripts/install-backup-cron.sh` previously returned success if `crontab` did not exist, so operators could believe backup scheduling was configured when it was not. This PR makes missing cron/installation failures return nonzero, guards ambiguous application paths and verifies installed cron entry. This does **not** validate offsite backups.
- P0 scheduler `scripts/install-p0-jobs.sh` already fails if `crontab` is absent. Both must be verified on the actual VPS before public launch.
- Security PR #57 adversarial tests are stale and require code/CI reconciliation, not bulk merging.

## Acceptance
Unit tests use a **fake crontab** stored in temporary files, never change the host crontab or live VPS. Test missing cron, idempotency, preservation of unrelated cron jobs, and unsafe `APP_DIR` input. Full backend/PostGIS/CodeQL/Playwright gates must pass; no VPS changes. Offsite checksum, independent restore drill, image archive privacy and branch protection remain unverified.
