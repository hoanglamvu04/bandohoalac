# HOLA Maps — P0 public launch hardening and operator runbook

## Release policy

Never confuse a green GitHub CI with a healthy VPS: PostgreSQL backups,
object/media storage, DNS/HTTPS, PM2, public content quality, abuse moderation,
restore drills and mobile testing must be checked on production.

P0 modules:
1. Explicit contact/asset rights consent; manual duplicate screening; no points for ads.
2. Property owner controls + moderated price changes; 30-day freshness policy;
   daily expiry archives canonical \`places\` to hide stale adverts everywhere.
3. Local PostgreSQL and media backups, checksum/format verification, offsite
   copy/verification, production data-quality audit and scheduled jobs.

## One-time VPS prerequisites

Production deploy is manual. Do not run demo seed on production.
Before enabling the P0 cron, perform the regular code deploy and migration.

- Install and verify \`pg_dump\`, \`pg_restore\`, \`tar\`, \`sha256sum\`,
  \`cron\` and \`rclone\` availability.
- Configure an **encrypted, independent** offsite rclone remote (prefer
  \`rclone crypt\`; not another folder on the same VPS).
- Create \`/etc/hola-maps-backup.env\` under the cron operator's account
  with mode 0600, containing only a remote destination, for example:
  \`HOLA_BACKUP_RCLONE_DEST=encrypted-backup:hola-maps\`.
  Never commit remote access tokens or credentials to GitHub.
- For \`UPLOAD_PROVIDER=local\`: the media backup script snapshots the
  configured \`UPLOAD_DIR\`. Do not include uploads in git, public webroot
  browsing or CI artifacts.
- For \`UPLOAD_PROVIDER=cloudinary\`: the local media backup script **fails
  intentionally**. A separate provider-side export (including the original
  assets) and verified restore must be implemented and audited before launch.
- Arrange manual restore drills on a separate temporary PostgreSQL DB and a
  separate temporary media directory. Never restore over production to test.

### Image privacy and backup verification

- Production hosts require `cwebp` (`apt-get install webp` on Debian/Ubuntu).
  User-uploaded images are re-encoded to WebP with `-metadata none` before
  being stored on Cloudinary or in non-place local upload areas. Place images
  use sanitized local variants, and originals must be deleted.
- Nightly offsite backup scripts now compare actual SHA256 bytes read back
  through `rclone cat`, not just the destination file sizes. This can consume
  substantial transfer bandwidth, so monitor backup duration and traffic.
- A Green CI means sanitizer and synthetic backup tests succeeded; live VPS
  checks, Cloudinary provider exports (if configured) and restore drills
  remain a separate public launch requirement.

## Install, backup, validate (one-time)

\`\`\`bash
cd /var/www/bandohoalac
bash scripts/install-p0-jobs.sh
bash scripts/p0-verified-backup.sh
bash scripts/check-p0-readiness.sh
\`\`\`

The installer is idempotent and installs:
- 03:17 each day: DB dump, media tar.gz, local SHA256+format verification,
  copy to offsite remote and remote-size cross-check.
- 04:05 each day: archival of expired property listings via
  \`node backend/src/scripts/expireStaleHousingListings.js\`.

If offsite credentials are missing, local backups are produced but
\`p0-verified-backup.sh\` and the readiness gate fail; that is intentional.
Retention defaults to 14 days locally (maximum 90). Set a tested,
appropriate remote retention policy independently. Even after a verified
copy, a **manual complete restore drill** is required.

## Restore drill + legacy image audit (additional mandatory gates)

### PostgreSQL client compatibility

The `pg_dump` and `pg_restore` command-line clients used for a backup
must match the **major version of the production PostgreSQL server**.
HOLA Maps currently targets PostgreSQL 16. A dump generated with newer
client defaults (e.g. `transaction_timeout` from PostgreSQL 17) can pass
archive integrity checks yet fail when restored to PG16. On Debian/Ubuntu,
install `postgresql-client-16` and explicitly choose its binary directory
when another version also exists. The GitHub restore rehearsal pins 16.

### Actual restore drill — empty test database only

The tool never creates, drops or overwrites a database. Prepare a separate
**empty** PostgreSQL database named `hola_restore_<safe_suffix>` (and grant
the drill operator the required schema/extension permissions). Set
`RESTORE_DRILL_DATABASE_URL` through a protected shell environment or secret
file, not a shared command history. The target must be different from the
production `DATABASE_URL`.

Then run from `backend/`:

```bash
RESTORE_DRILL_CONFIRM=RESTORE_IN_EMPTY_HOLA_RESTORE_DB npm run ops:restore:drill
```

The script validates the target DB name, confirms it contains no user tables,
finds the newest valid timestamped dump inside `BACKUP_DIR` (defaults to
`backend/backups`), verifies the SHA256 manifest and `pg_restore --list`,
restores inside a single transaction and checks the `places`, `users`,
`housing_listings` and `place_images` tables and counts.

On success **promptly drop the isolated restored database** after reviewing
the evidence. The restored data may include real users' personal information.
Do not grant application traffic access to this test database, and do not
restore directly over production under any circumstances.

The CI backend job performs an actual restore rehearsal into
`hola_restore_ci_check` from the seeded isolated PostGIS test database.
That demonstrates the procedure works with the checked-in schema, but
production backups must still be separately restored and audited.

### Historical image privacy — read only

```bash
cd backend
npm run ops:media:audit
```

Use `npm run ops:media:audit -- --strict` to return nonzero when the
report includes risk warnings. The audit enumerates public place-image
references, flags locally served raw JPEG/PNG files, treats **all Cloudinary
originals as unverified** until the provider export and metadata history
are independently assessed, and counts legacy raw files and recognizable
metadata markers in `UPLOAD_DIR`. It never modifies images, downloads
remote media, removes database records or prints image URLs.

This is a **risk inventory**, not proof that older WebP files are safe:
absence of a marker in the first 256 KiB does not prove the original has no
sensitive metadata. Do not batch-delete or rewrite historical originals
until offsite and restore tests pass and the new sanitized versions have
been reconciled in the database.

## Public data and property moderation

Run from the repository root:
\`\`\`bash
(cd backend && node src/scripts/publicLaunchAudit.js)
\`\`\`

The audit uses the same uncached, read-only aggregate and blocker policy as
Admin → Operations → Public Launch Gates. The report retains the published
place counts and now includes **all published properties**, even those without
a housing profile. It returns nonzero if public data is empty, a published
property is inactive/expired, contact is absent, price/area is invalid, a
legacy property has no housing profile, or the aggregate cannot be verified.
Missing images/description and stale verification are review counts, not new
automatic publication rules. Exit 0 means only that this data gate detected
no blockers; it does not approve launch or replace media/restore/device checks.
No records are changed and no stored personal data or URLs are printed.

Historical real estate imported before P0 is not automatically given a
30-day expiry or retroactively assumed to have contact consent. Review
those items and their original sources manually.

Property owner:
- \`GET /api/housing/mine\` (private).
- \`PATCH /api/housing/:id/manage\` with \`CONFIRM_ACTIVE\`, \`PAUSE\`,
  \`SOLD\` or \`RENTED\`. Closing archives the canonical place. Reopening
  requires a new moderated submission; there is **no owner self-publish**.
- Price changes are \`UPDATE_PRICE\` contributions with
  \`place.realEstatePriceVnd\`, require ADMIN/MODERATOR approval and do not
  award points/mission bonuses.
- Newly approved properties expire 30 days from publication or most
  recent owner confirmation. The daily job archives them; the public Housing
  API excludes expired records immediately even before the job runs.

## Manual launch acceptance matrix

1. Guest: browse map and details but cannot submit or manage listings.
2. Contributor: confirm map position, consent, photo rights and submit.
   Expect PENDING and no premature public pin.
3. Admin/Moderator (2FA where required): inspect nearby duplicates and
   content, approve/reject, confirm public visibility or absence.
4. Other contributor / CTV: cannot read private property moderation data,
   approve property listings or manage others' properties.
5. Owner: edit price by pending contribution, confirm active, pause,
   mark SOLD/RENTED. Every status change must remove the public map pin.
6. Stale property: run expiry job on test data; archived pin must not be
   returned in public API or map; old valid rentals remain unchanged.
7. Mobile: check 360x800, 390x844 and real Android+iOS Safari/Chrome.
   Map select/dismiss must not trigger camera drift; forms must stay usable.
8. Security: invalid IDs, rapid submissions, uploads with metadata,
   replayed auth tokens, CORS/CSRF, IDOR, rate limiting, moderator scopes.
9. Performance: cold cache and 4G/LTE map loading, slow API fallback,
   peak-concurrency smoke test, PM2 auto-restart and Nginx TLS.
10. Operational: offsite snapshots and an independent restore drill passed,
    no critical errors or broken public sitemap links.

Launch status remains **BLOCKED** until live VPS evidence and the manual
matrix above are recorded, even if GitHub Actions reports PASS.
