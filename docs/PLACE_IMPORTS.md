# Overture Places import for Hola Maps

Hola Maps imports external POIs into a staging table before anything becomes public.

## Flow

1. Download Overture Places for the Hòa Lạc bounding box.
2. Clip records again to the Hola Maps service polygon.
3. Normalize Overture schema v2 fields.
4. Map common Overture categories to Hola Maps categories.
5. Detect likely duplicates against existing Hola Maps places.
6. Store everything in `imported_places`.
7. Review at `/admin/place-imports` and approve into the public `places` table.

## Requirements

```powershell
pip install -U overturemaps
npm run db:migrate
```

## Scan Hòa Lạc

From the repository root:

```powershell
.\scripts\import-overture-places.ps1
```

Defaults:

- BBOX: `105.325,20.885,105.665,21.145`
- minimum confidence: `0.55`
- Overture type: `place`
- output: temporary GeoJSON

Override confidence:

```powershell
.\scripts\import-overture-places.ps1 -MinConfidence 0.7
```

Keep the raw GeoJSON for inspection:

```powershell
.\scripts\import-overture-places.ps1 -KeepGeoJson
```

## Review statuses

- `NEW`: mapped and ready for review.
- `REVIEW`: missing a Hola Maps category, missing confidence, or temporarily closed.
- `DUPLICATE`: likely matches an existing Hola Maps place.
- `APPROVED`: copied into the public places table.
- `REJECTED`: manually skipped.

Bulk approval only processes NEW records with a mapped category, no duplicate flag, and confidence >= 0.80.

## Provenance

Approved Overture records keep:

- `places.source = OVERTURE`
- `external_source = OVERTURE`
- `external_id`
- `source_confidence`
- `last_source_sync_at`

The unique external source/id index prevents future scans from creating the same imported place twice.
