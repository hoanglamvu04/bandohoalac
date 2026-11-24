# HOLA Maps — Sprint 8: Suspicious real estate reporting (human review)

Each public property detail now links to `/gop-y?reportHousing=<id>`
through the existing public Guest Feedback feature.
The action is deliberately separate from authenticated
`REPORT_CLOSED` (the existing expiry / sold report).

The route accepts only a safe positive public integer ID from the
query string, prefills category DATA / area HOUSING and clearly asks
for an explanation. The report body includes only the public ID and
the user's typed description. No GPS, place coordinates, login data,
phone numbers, image originals or form secrets are copied.

The existing feedback API still enforces its server-side schema,
honeypot, rate limit and private Admin review queue. **No report can
automatically archive, reject, delete or modify a public listing.**
Administrators must independently verify the claimed place reference,
evidence and context before any ordinary moderation workflow.

Existing guest feedback, housing lifecycle and X-HUB analytics are
unchanged; no migration or new secrets. Playwright covers guest
submission, privacy fields and invalid IDs.
