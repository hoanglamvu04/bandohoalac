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


## Supplemental building footprints

The Protomaps basemap is primarily sourced from OpenStreetMap. Some parts of
Hòa Lạc have roads and POIs but incomplete OSM building footprints. Hola Maps
can therefore load a second, optional PMTiles archive containing Overture Maps
building footprints.

Overture's Buildings theme combines open sources including OpenStreetMap,
Microsoft Global ML Building Footprints, Google Open Buildings and other
compatible datasets. The Buildings theme is published under ODbL.

Build both the basemap and supplemental buildings in one command:

```powershell
.\scripts\get-hoalac-map-data.ps1
```

Or build only the supplemental buildings:

```powershell
.\scripts\get-hoalac-buildings.ps1
```

The building script requires the official Overture Python client:

```powershell
pip install overturemaps
```

For tiling it uses a local `tippecanoe` command when available. If Tippecanoe
is not installed but Docker Desktop is available, the script builds the
official Felt Tippecanoe Docker image on the first run.

Generated archive:

```text
frontend/public/maps/hoalac-buildings.pmtiles
```

The browser checks for that archive automatically. If it exists, the normal
OSM/Protomaps building fill is replaced at local zoom levels with the denser
Overture layer. If it does not exist, the app falls back to the existing
Protomaps buildings without failing.

Map attribution for the supplemental archive:

```text
© OpenStreetMap contributors, Overture Maps Foundation
```

The project does not copy building geometry from the Google Maps UI or tiles.
