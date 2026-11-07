# HOLA Location Trust Verification V1

## Public place trust card

The place detail page now displays three distinct provenance streams:

- HOLA MAP verification: an official check performed by an ADMIN or MODERATOR. Only this stream updates places.last_verified_at.
- Owner confirmation: a user with an approved OWNER record in place_managers confirms that the published place is still operating.
- Community activity: authenticated community members confirm that the place is still operating; approved community contributions and pending correction reports are counted separately.

Historical last_verified_at timestamps are backfilled as LEGACY. They remain visible, but are not falsely attributed to HOLA staff or the community because the original actor/source cannot be reconstructed.

## Freshness policy

- A place with no HOLA/legacy verification timestamp is UNVERIFIED.
- A verification timestamp up to and including 180 days old is FRESH.
- A timestamp older than 180 days is STALE.
- Owner/community active confirmations do not reset the official HOLA verification age.

## Community reporting

The place detail page provides separate report actions for:
- Wrong address
- Wrong opening hours
- Wrong phone number

Reports use the existing REPORT_WRONG_INFO contribution workflow, risk scoring, moderation queue and final approval. An optional suggested correction and a required reason are stored in the contribution payload. Submitting a report never edits public place data directly.

## Active-place confirmation policy

- Only authenticated accounts can confirm that a place is still active.
- Approved place owners are attributed to OWNER; all other members are attributed to COMMUNITY.
- The same account can confirm the same place once every 30 days per provenance stream.
- Confirmation is evidence, not automatic publication or an official HOLA verification.

## Endpoints

- GET /api/places/:id/trust — public provenance and freshness summary.
- POST /api/places/:id/confirm-active — authenticated owner/community active confirmation.
- Existing POST /api/admin/places/:id/verify-quality — official HOLA verification for ADMIN/MODERATOR; CTV level 2 checks are recorded as community verification.

## Database

Migration: 20261107_230_location_trust_verification_v1.sql

The place_verification_events table is an append-only event log. It preserves provenance, actor and event time; public summaries aggregate from the event log and existing contributions table.
