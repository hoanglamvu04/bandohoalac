# Hola Maps Public Integration API v1

Stable, read-only API intended for HALO HOLA and other approved Hòa Lạc websites.

Base path:

```text
/api/public/v1
```

No Admin/JWT credentials are required. Only published Hola Maps places are exposed.

## CORS

For browser clients, add the HALO HOLA production origin to the VPS backend environment:

```env
PUBLIC_API_CORS_ORIGIN=https://halohola.vn,https://www.halohola.vn
HOLA_MAPS_WEB_URL=https://map.dothihoalac.vn
```

Keep Admin/app origins in `CORS_ORIGIN`. The public API has a separate browser allowlist.

Development accepts localhost / 127.0.0.1 origins on any port.

## Endpoints

```http
GET /api/public/v1/meta
GET /api/public/v1/categories
GET /api/public/v1/places?q=ho+dong+mo&category=khu-du-lich&limit=20
GET /api/public/v1/places/bounds?north=21.145&south=20.885&east=105.665&west=105.325
GET /api/public/v1/places/geojson?north=21.145&south=20.885&east=105.665&west=105.325
GET /api/public/v1/places/nearby?lat=21.005&lng=105.525&radius=5000
GET /api/public/v1/places/123
GET /api/public/v1/places/slug/ho-dong-mo
```

Search uses Hola Maps accent-insensitive + typo-tolerant search.

## MapLibre example

```js
const bounds = map.getBounds();

const params = new URLSearchParams({
  north: bounds.getNorth(),
  south: bounds.getSouth(),
  east: bounds.getEast(),
  west: bounds.getWest()
});

const response = await fetch(
  'https://map.dothihoalac.vn/api/public/v1/places/geojson?' + params
);

const geojson = await response.json();
map.getSource('hola-places').setData(geojson);
```

GeoJSON feature properties include:

```json
{
  "id": 123,
  "name": "Hồ Đồng Mô",
  "slug": "ho-dong-mo",
  "category": "Khu du lịch",
  "categorySlug": "khu-du-lich",
  "address": "...",
  "rating": 4.8,
  "reviews": 21,
  "thumbnail": "https://...",
  "cardImage": "https://...",
  "isPartner": false,
  "apiUrl": "https://.../api/public/v1/places/123",
  "holaMapsUrl": "https://map.dothihoalac.vn/map?place=123"
}
```

Detail responses intentionally expose only public information and omit Admin workflow fields such as moderation state, createdBy, import source, audit data, and private user information.

HALO HOLA should integrate against `/api/public/v1`, not the internal `/api/places` routes. Breaking changes should go into a future `/api/public/v2`.
