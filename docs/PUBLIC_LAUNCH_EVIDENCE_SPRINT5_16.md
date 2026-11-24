# HOLA Maps — Public Launch Evidence / Operations V2 (Sprint 5 + 16)

The existing Admin → Giám sát vận hành page now shows a **distinct,
read-only launch evidence** section. API process health is NOT public
release approval. A green CI, healthy PostgreSQL connection, low P95
or fresh PM2 uptime cannot verify backups, real-device performance,
photo rights or DNS/HTTPS on the live host.

## Database-only checks

The Admin-only, 2FA-protected existing
`GET /api/admin/operations/overview` carries additional
`launch` metadata. PostgreSQL counts ONLY public statuses,
housing validity, legacy/unstructured housing, and missing imagery.
It returns no users, contacts, IPs, content, coordinates or documents.
The query is coalesced and cached for 60 seconds to avoid repeated
full-table scans on the 15-second operations page refresh.

Read-only blockers include: no public POIs, public housing that is
PAUSED/SOLD/expired, public BĐS missing a contact, invalid structured
area/price, and historical unstructured BĐS needing owner/source
review. The raw count of missing images is informational and does not
automatically remove a valid listing.

**launchStatus stays `NOT_VERIFIED` even when the DB gate reports
`NO_BLOCKERS_DETECTED`.** Manual gates always remain UNVERIFIED until
a human independently reviews the live VPS evidence:

- Verified encrypted offsite backups
- A successful isolated production backup restore drill
- Real Android/iOS mobile acceptance
- Legacy image privacy and copyright review
- Live HTTPS, Nginx and PM2
- WA-005 X-HUB operator approval

No automatic production actions, fake PASS states, DB migration, X-HUB
enablement, telemetry, new API access scope or secret storage.

Next: follow `docs/PUBLIC_LAUNCH_P0_RUNBOOK.md`,
`scripts/check-p0-readiness.sh`, manual production tests and record
sign-off outside this live-process-only dashboard.
