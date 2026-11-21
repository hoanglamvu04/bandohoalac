# HOLA Maps — Real Estate user submissions V1

## User flow

1. Open the HOLA Housing map at `/map?vertical=housing&category=bat-dong-san` and choose **Đăng tin BĐS**.
2. Pin the property's coordinates, confirm the pin, choose **Cần bán** / **Cho thuê**, enter the property type, title, address, area, total sale price or monthly rent, contact person and phone, and optionally add up to eight photos.
3. Authenticated users submit a `CREATE_PLACE` contribution with `place.categorySlug=bat-dong-san` and a structured `place.realEstate` object. The submission is stored with status `PENDING`. **No public place is created on submission.**
4. Admin/Moderator reviews the request in `/admin/contributions`, sees the price and contact details, and explicitly approves or rejects it. Approval is a transactional operation that inserts the `places` entry as `PUBLISHED`, stores its structured `housing_listings` record, and marks the contribution approved. A real-estate approval awards zero quality points.
5. The published property appears in the Housing map and the place details page; rejected requests do not appear. User can follow status in their contributions/profile and receives the existing notification.

## API and governance

- Existing `POST /api/contributions` API and photo upload/rate limiting are reused.
- `place.realEstate` shape: `transactionType: SALE|RENT`, `propertyType: LAND|HOUSE|APARTMENT|VILLA|COMMERCIAL|OTHER`, `areaM2`, `totalPriceVnd` for sales or `monthlyRentVnd` for rentals, optional `contactName`.
- Requires a valid in-coverage location, title, address and contact phone.
- Generic `CREATE_PLACE` requests in the BĐS category without these fields are rejected. The generic contribution page links to the dedicated form.
- The community verification queue excludes pending real-estate listings, and verification by direct contribution ID is blocked. Only Admin/Moderator can approve or reject these requests.
- Admin-account two-factor security and the existing audit and notification workflow remain in effect.
- `GET /api/housing?listingType=SALE|RENT` supports listing segmentation and returns `housing.listingType`, `housing.propertyType`, `housing.totalPriceVnd`, `housing.contactName`.
- The phone number is published as part of the place after moderation; the form informs contributors.

## Database and deployment

Migration: `backend/src/database/migrations/20261120_240_real_estate_submissions_v1.sql`. Adds sale-specific fields to the existing `housing_listings` table. Existing Housing V2 room-rental records remain `listing_type=RENT`. Re-runnable, no demo seed.

Manual VPS update (deploy automation is disabled):

```bash
cd /var/www/bandohoalac
git status
git pull --ff-only origin main
cd backend
npm ci
npm run db:migrate
cd ../frontend
npm ci
npm run build
```

Restart only the live backend process using the VPS's existing service manager after migration. Do not run `db:seed` in production.

## Acceptance tests

- A non-authenticated visitor cannot submit.
- A signed-in user can submit with price, type, location, contact; response is PENDING.
- A sale listing cannot omit total price; rent cannot omit monthly price; category and service coverage are validated.
- Unauthorized community users cannot view or vote on property submissions prior to moderation.
- Reject leaves no published place; approval creates a published place plus the structured Housing row within one transaction.
- Map list and place detail show sale price versus monthly rent correctly.
- Existing rental and non-real-estate map workflows remain unaffected.

This is moderation of user-provided listings, not certification of legal ownership, boundaries, prices or availability.


## P0 real-estate submission hardening (V2)

- `/tin-bat-dong-san-cua-toi` shows separate **PENDING** and **REJECTED**
  property CREATE_PLACE requests from the **authenticated user's**
  `GET /api/contributions/me` history. Rejected requests display the
  moderation reason; pending requests have no link to a public listing.
  Published housing still loads when the contribution-history endpoint fails.
- `/dang-tin-bat-dong-san` supports an **explicit** session-only draft scoped
  to the signed-in user's ID. Drafts expire after 24 hours. They contain the
  property fields and chosen map pin, but **never** contact name/phone,
  files, consent flags, or login credentials. The user must explicitly
  restore the saved values and reconfirm the pin. A successful submission
  clears this draft. The application does not auto-save to localStorage.
- The photo picker rejects more than 8 files, unsupported MIME types and
  files over the default 5 MB limit; it does not silently discard extra
  images. Users can remove files and rights consent resets on changes.
  Server-side file signature/dimension/size checks remain authoritative.
- The submission screen displays best-effort upload progress while keeping
  user-edited fields after a failure. The standard `POST /api/contributions`
  multipart API and the existing approval / publishing transaction are
  unchanged. No migration is needed.

### V2 validation

The Playwright suite verifies private draft storage and removal, multiple
photo selection and rights consent, passing selected images through the
multipart request, showing pending/rejected submissions with reasons, and
keeping live listings visible if contribution history temporarily fails.

For launch, run the production smoke test with a separate ordinary account:
submit SALE and RENT, review the pending request with Admin 2FA, reject
one with a reason, approve the other and confirm the public map pin and
place detail. Also repeat with actual photo uploads via HTTPS, because
a mocked browser test cannot prove the live VPS storage path is mounted
or that CDN/Cloudinary URLs are reachable. Check `UPLOAD_PROVIDER`,
`UPLOAD_DIR`, and `MAX_UPLOAD_FILE_SIZE_MB` on the deployed server
before accepting photo submissions; the browser's 5 MB check mirrors
the repository's **default**, not an arbitrary VPS override.


## P0 moderation: near-duplicate review before publication

When reviewing a `PENDING` real-estate `CREATE_PLACE` request, an
Admin/Moderator can inspect **both published places and other pending
real-estate requests** within 100 meters. The results are ordered by
likely duplicate (matching normalized phone + accent-insensitive name
within 25 m), requires review (matching phone or very near matching
name) and nearby only.

Multiple apartments, floors and land lots may legitimately share the
same pin; **distance alone never automatically rejects a listing**.
If nearby items exist, the reviewer must explicitly compare and
acknowledge them; if the set changes at approval time, it must be
reviewed again. A new backend check in the same approval transaction
rejects requests without `nearbyListingsReviewed: true` with HTTP 409
`PROPERTY_NEARBY_REVIEW_REQUIRED`. The pre-existing transactional
advisory-lock/25-m exact duplicate guard is retained, so even an
acknowledged exact duplicate is blocked.

Only Admin/Moderator with the existing security gate can view the
nearby review endpoint. Pending submissions are **never** published
by this check, and their details must not be exposed via public
search or map APIs. No migration is required.

Release verification: use two separate normal user accounts to
submit nearby properties; confirm the second appears in Admin's
review-only list and never on the public map. Approve the first
submission and confirm exactly one published pin/structured Housing
record. Reject an identical second request; verify the status/reason
appears for its owner and no second public pin is created.
