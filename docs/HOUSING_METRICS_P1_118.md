# HOLA Housing first-party metrics

- Separate opt-in, off by default. Browser choice in localStorage is a boolean only. UI and server honor DNT/GPC; user can revoke on BĐS detail or privacy page. Not X-HUB tracking.
- POST /api/housing/:placeId/detail-view, empty body, opt-in header, rate limited; once per mounted detail after opt-in. GET contact counts only after authenticated explicit successful phone reveal and opt-in. No stats failure blocks contact. Excludes demo/import/hidden/expired.
- Daily counters, no visitor identity; owners see 30-day aggregate. Approximate event counts, not unique visitors or sales; repeated visits may count. Not used for ranking.
- Existing soft-launch prune CLI also removes metric days older than 90 calendar days and viewing requests more than 180 days past. Operator must verify scheduled prune and backup before deployment.
- Migration 330 after 310/320; no production deployment. CI mandatory; existing P0/WA-005 unchanged.
