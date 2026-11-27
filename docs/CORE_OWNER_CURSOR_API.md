# HOLA-P1-301.06 — Owner housing cursor API

Existing `GET /api/housing/mine` remains authenticated/private/no-store, returns the existing `{items}` (maximum 100) when called without pagination parameters. Opt in using `GET /api/housing/mine?limit=50`. Response `{items,nextCursor}`; null means no more results. Request the next page with the same limit and URL-encoded nextCursor. Range 1–100. Invalid/malformed cursor or repeated limit parameters return HTTP 400. No OFFSET in the new path.

Sort uses `created_at DESC, id DESC` on owner-scoped rows, with a strict lexicographic boundary and one-row lookahead. Cursor encodes a versioned timestamp (exact microseconds) and bigint string. It is not a secret or authorization token; the SQL independently constrains created_by to the authenticated owner every time, never trusts an ID from the cursor as an account. Raw internal timestamp field is not exposed in the listing DTO. No public catalog, auth, contact reveal, approval or metric semantics change.

A newly created newer listing will appear on a fresh first-page query, not be inserted into the middle of an ongoing traversal. This is not a frozen snapshot: deletions, ownership changes, backdated writes or modifications to sort keys can affect later pages. Other filters/sorts and public map queries still use their existing contracts. The current owner frontend remains compatible and is not switched to pagination in this backend-only PR.

Migration 400 (previous DB foundation PR) provides the matching owner/date/id index. Actual plans/latency still require staging evidence. Tests include invalid cursor, bigint, exact same/microsecond timestamps, cross-owner boundaries, lookahead, and legacy response behavior.
