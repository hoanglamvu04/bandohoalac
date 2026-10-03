# Hola Maps Developer API v1

Public, read-only API for approved Hòa Lạc websites and integrations.

Base URL:

```text
https://maps.dothihoalac.vn/api/public/v1
```

Public documentation:

```text
https://maps.dothihoalac.vn/developers
```

OpenAPI schema:

```text
GET /api/public/v1/openapi.json
```

## Access modes

- `OPEN`: endpoints work without a key unless an endpoint is marked "requires key".
- `PARTNER`: data endpoints require `X-Hola-API-Key`. Metadata/OpenAPI can remain public.

Existing integrations remain compatible because migration defaults to `OPEN`.

## Admin management

```text
Admin → API & Tích hợp
```

Admin can enable/disable the whole API, manage website clients and domains, create/revoke API keys, control endpoint availability, set endpoint key requirements, inspect usage logs, and open public documentation.

## API clients & keys

Each client has allowed browser origins, active/paused status, endpoint permissions and a 30–600 request/minute quota.

```http
X-Hola-API-Key: hm_live_xxxxxxxxxxxxxxxxx
```

The full key is shown only once when created. The database stores only SHA-256 hash plus a safe prefix/last four characters.

> Browser JavaScript cannot keep an API key secret. For browser integrations use allowed-origin restrictions and quota. Keep secret partner keys server-side when secrecy is required.

## Endpoints

```http
GET /meta
GET /openapi.json
GET /categories
GET /places
GET /places/bounds
GET /places/geojson
GET /places/nearby
GET /places/:id
GET /places/slug/:slug
```

Only published places are exposed. Internal workflow fields and private user data are omitted.

## Example

```js
const response = await fetch(
  'https://maps.dothihoalac.vn/api/public/v1/places?category=khu-du-lich&limit=20',
  {
    headers: {
      'X-Hola-API-Key': 'hm_live_...'
    }
  }
);

const payload = await response.json();
console.log(payload.data.items);
```

CORS origins can now be managed in Admin. `PUBLIC_API_CORS_ORIGIN` remains supported as a static emergency allowlist.

Breaking changes belong in a future `/api/public/v2`.
