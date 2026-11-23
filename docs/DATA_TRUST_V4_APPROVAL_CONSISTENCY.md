# HOLA Maps — Sprint 4: Data Trust V4 / Consistent real-estate approval

## Motivation

Sprint 3 (#95) introduced explainable matching, but the final SQL approval
guard still used only unaccented title, phone and 25-metre distance. It could
reject valid sale/rent or different property-type records sharing an agent,
while punctuation differences could evade its strict title comparison.
This release aligns the review heuristic and the final duplicate guard.

## V4 behavior

- The moderation risk scorer now explicitly detects conflicting sale/rent
  transaction and land/house/apartment/etc. property types. Shared phone and
  location with an explicit type conflict lead to **REVIEW**, not
  **LIKELY_DUPLICATE**; without a matching phone or other corroboration,
  the result is merely **NEARBY**.
- Review evidence includes `DIFFERENT_TRANSACTION` and
  `DIFFERENT_PROPERTY_TYPE`; the Admin UI shows clear Vietnamese labels.
- The final approval guard retains the PostgreSQL transaction advisory lock
  keyed by normalized contact and title, but reads active, unexpired,
  published **structured** housing listings within 25 m. It uses the same
  accent/punctuation/phone normalization and property comparison rules as
  staff review. It blocks only near-identical records with matching phone,
  normalized title, transaction type, property type, area within 6%, and
  sale/rental price within 7%. Different units, substantially different
  dimensions/prices, sale vs rent, and differing property types are not
  automatically blocked.
- Existing staff review acknowledgement remains mandatory whenever there
  are nearby published/pending listings. An Admin can still manually reject
  suspicious items. No automatic publishing, bulk mutation or silent
  deletion is introduced.
- The candidate query is not cut off at an arbitrary LIMIT so the matching
  record cannot hide after other nearby items. Geographic 25 m, active
  publication, category and matching normalized contact constrain the scan.

## Operational constraints

The human-reviewed duplicate indicators remain **heuristics, not fraud
probabilities or title/ownership verification**. Distinct units with
identical descriptive titles and matching price/area/contact may still need
an explicit unit number in the title for approval; that is intentional for
hard-blocked indistinguishable listings.

No schema migrations, new secrets, production actions, WA-002/WA-005 or
analytics changes. Node regression tests cover contradictory types, unit,
price, area, distance and normalization; Playwright checks Vietnamese
signals. GitHub CI + Security Scan must pass before merge. Production
launch remains blocked by the separate manual VPS readiness gates.
