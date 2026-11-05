# HOLA Maps — SEO Content Batch 02

**Target:** Expand the current 20-guide Explore hub with six more specific local-search intents.  
**Implementation:** \`backend/src/database/migrations/20261105_200_explore_guides_batch_02.sql\`  
**Publication model:** Published guide records are rendered by the existing server-rendered \`/kham-pha/:slug\` route and automatically enter \`/api/sitemap-explore.xml\`.

## Why these six topics

The original 20 articles already cover broad intents such as “Hòa Lạc có gì”, “ăn gì”, “cafe đẹp”, “homestay”, “đi chơi cuối tuần”, “picnic” and “ăn đêm”. Batch 02 therefore targets narrower tasks rather than creating near-duplicate titles.

| New slug | Search intent | Editorial angle | Related HOLA category |
|---|---|---|---|
| \`quan-an-sang-hoa-lac\` | Breakfast near home, campus or work | Choose by schedule, route and meal format | \`an-uong\` |
| \`an-toi-o-hoa-lac\` | Dinner for friends and family | Group size, seating, parking and hours | \`an-uong\` |
| \`quan-lau-hoa-lac\` | Hotpot for groups | Menu, serving format, booking and space | \`an-uong\` |
| \`ca-phe-gan-ho-tan-xa\` | Coffee around Tân Xã Lake | Location, outdoor seating and time of day | \`cafe\` |
| \`cam-trai-quanh-hoa-lac\` | Camping around Hòa Lạc | Booking, permitted activities, safety and environment | \`trai-nghiem\` |
| \`di-hoa-lac-tu-ha-noi\` | Travel from Hanoi to Hòa Lạc | Plan from the actual start point and group stops | Mixed published places |

## Content-quality controls

- No invented venue rankings, addresses, opening hours, menu prices, phone numbers or ratings.
- No named business is presented as a recommendation unless its current HOLA Maps record and facts are verified.
- Each guide answers a narrower user task and includes actionable decision criteria/checklists.
- Related place cards are loaded dynamically from existing \`PUBLISHED\` HOLA Maps place records. They are not hard-coded into article text.
- The Tân Xã guide uses a location-specific query with a cafe-category fallback; if there is no verified match, the page does not falsely claim that a fallback cafe is beside the lake.
- The camping guide uses the existing experience category; the copy explicitly tells readers to confirm permission, services and availability with the operator.
- Existing routes remain unchanged. The Explore sitemap updates automatically from published records.

## Technical implementation

The migration uses \`ON CONFLICT (slug) DO NOTHING\` because the deployment migration runner reapplies every SQL migration. This keeps subsequent deploys idempotent and avoids resetting editorial changes to existing records.

No new tables, category records, frontend routes or CMS endpoints are introduced. The existing article renderer, related-place resolver, canonical metadata and Explore sitemap are reused.

## Acceptance checks

The backend SEO test suite requests each of the six new article URLs and checks:
- HTTP 200 for each published guide.
- Canonical URL matches the article slug.
- A visible H1 and JSON-LD Article object are present in the first HTML response.
- All six URLs appear in the Explore sitemap.

After deployment, manually review the six pages and confirm the related-place cards show only relevant published HOLA Maps records.
