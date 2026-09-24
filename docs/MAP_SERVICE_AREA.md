# Hola Maps service area

Hola Maps now uses one focused product service polygon instead of the old set
of large overlapping rectangles.

## Coverage

Core product areas:

- Hòa Lạc
- Hạ Bằng
- Thạch Thất
- Tây Phương
- Yên Xuân
- Phú Cát

Extended coverage:

- nearby part of Ba Vì
- nearby part of Quốc Oai

The current polygon is a **product coverage boundary**, not an official legal
or cadastral administrative boundary. It is intentionally shaped to keep the
map focused and lightweight. When an authoritative commune-boundary GeoJSON
is available, replace `SERVICE_AREA_RING` in both:

- `frontend/src/mapConfig.js`
- `backend/src/config/mapCoverage.js`

Everything else (camera fence, point validation, API clipping, map mask and
contribution validation) will continue to use the new polygon automatically.

## Loading strategy

- Map camera is restricted to a tight Hòa Lạc fence.
- Outside the service polygon is visually masked.
- Places are requested by the current viewport, not as a full 100-place load.
- Heavy data layers are requested only at useful zoom levels.
- PostGIS clips `map_features` to the service polygon.
- Public place queries always include the service polygon.
- New places and new map features are rejected if they are outside coverage.
- PMTiles extraction now uses a much smaller buffered BBOX.
- The default archive now includes real z17 tiles for individual buildings, local roads, POIs and available address detail.
- Basemap detail is progressively disclosed by zoom so the overview remains light.

## Rebuild local PMTiles

From PowerShell:

```powershell
.\scripts\get-hoalac-pmtiles.ps1
```

The default `MaxZoom` is now `17`. Use `-MaxZoom 16` only for a smaller low-detail development archive.

Default buffered tile extraction bounds:

```text
105.30,20.86,105.69,21.16
```

To override them temporarily:

```powershell
.\scripts\get-hoalac-pmtiles.ps1 -BBox "west,south,east,north"
```

The tile BBOX deliberately has a small buffer outside the exact product
polygon so roads and labels do not look cut off at the edge.
