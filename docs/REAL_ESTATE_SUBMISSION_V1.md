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
