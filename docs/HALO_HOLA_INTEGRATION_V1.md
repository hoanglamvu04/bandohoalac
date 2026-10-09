# HALO HOLA × Hola Maps V1

V1 keeps canonical map data and HALO HOLA community media separate:

- Hola Maps `places` remains the source of truth for canonical locations.
- HALO HOLA posts are stored in `halo_posts` + `halo_media`.
- A `halo_spot` can reference a canonical `place_id`, or stay as a temporary custom pin.
- HALO media never becomes a canonical `place_images` record automatically.

## 1. Location picker

Embed either route in HALO HOLA:

- `/picker`
- `/embed/picker`

Recommended query parameters:

```text
/embed/picker?origin=https%3A%2F%2Fhalohola.vn&lat=21.005&lng=105.525
```

The picker posts:

```js
{
  type: 'HOLA_MAP_PICKER_READY'
}
```

When the user confirms a location it posts:

```js
{
  type: 'HOLA_MAP_LOCATION_SELECTED',
  payload: {
    lat: 21.005,
    lng: 105.525,
    label: 'Tên địa điểm',
    address: 'Địa chỉ',
    placeId: '123',       // present when a canonical Hola Maps place was selected
    placeSlug: '...',
    source: 'hola_place'  // or current_location / hola_picker
  }
}
```

HALO HOLA should validate `event.origin` before accepting the message.

## 2. Shared secret

In Hola Maps Admin:

`API & Tích hợp -> Nguồn ngoài -> HALO HOLA`

Create a random secret of at least 24 characters and save it. Store the same value only in the HALO HOLA backend/server environment.

Do not expose this secret in browser JavaScript.

HALO HOLA backend sends it as either:

```http
X-Halo-Hola-Key: <secret>
```

or:

```http
Authorization: Bearer <secret>
```

## 3. Sync a published/updated HALO post

Server-to-server request:

```http
POST /api/halo/v1/posts
Content-Type: application/json
X-Halo-Hola-Key: <secret>
```

Example linked to a canonical Hola Maps place:

```json
{
  "postId": "halo-post-9021",
  "user": {
    "id": "user-44",
    "name": "Nguyễn An"
  },
  "caption": "Chiều nay ở Hòa Lạc.",
  "sourceUrl": "https://halohola.vn/posts/9021",
  "postedAt": "2026-10-10T00:20:00+07:00",
  "location": {
    "placeId": "123",
    "lat": 21.005,
    "lng": 105.525,
    "label": "Tên hiển thị từ picker",
    "address": "Địa chỉ từ picker"
  },
  "media": [
    {
      "id": "photo-1",
      "url": "https://cdn.halohola.vn/photos/photo-1.jpg",
      "thumbnailUrl": "https://cdn.halohola.vn/photos/photo-1-640.jpg",
      "width": 1600,
      "height": 1200
    }
  ]
}
```

If `location.placeId` is present, Hola Maps ignores client coordinates for canonical placement and uses the published place's own coordinates/name/address.

Example custom pin with no canonical place:

```json
{
  "postId": "halo-post-9022",
  "caption": "Một góc mới ở Hòa Lạc.",
  "location": {
    "spotId": "halo-location-778",
    "lat": 21.0142,
    "lng": 105.5173,
    "label": "Điểm check-in mới"
  },
  "media": [
    {
      "url": "https://cdn.halohola.vn/photos/photo-2.jpg"
    }
  ]
}
```

Custom pins must be inside the Hola Maps service coverage.

The endpoint is idempotent by `postId`: sending the same post again updates its spot, caption, author and replaces its media set rather than creating duplicates.

## 4. Delete/unpublish a HALO post

```http
DELETE /api/halo/v1/posts/halo-post-9021
X-Halo-Hola-Key: <secret>
```

Hola Maps marks the post deleted, so it disappears from the public HALO map without deleting canonical place data.

## 5. Public read endpoints

```text
GET /api/halo/v1/spots?west=...&south=...&east=...&north=...
GET /api/halo/v1/spots/:spotId
GET /api/halo/v1/places/:placeId
```

The dedicated community photo map is available at:

```text
/halo
```

Clicking a HALO spot loads its gallery. If the spot is linked to a canonical Hola Maps place, the gallery includes a link to `/place/:placeId`.

## V1 boundaries

V1 intentionally does not:

- copy HALO HOLA photos into canonical `place_images`;
- auto-create a canonical Hola Maps place from a custom pin;
- expose the shared sync secret to the browser;
- let one HALO post overwrite canonical place coordinates.

Those boundaries keep community content useful without allowing the integration to silently mutate trusted map data.
