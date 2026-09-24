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
therefore loads a second optional PMTiles archive extracted from Overture Maps'
official Buildings PMTiles release.

No Python, `overturemaps`, Tippecanoe or Docker installation is required by
the current Windows build pipeline. The scripts automatically download the
official `pmtiles.exe` into `scripts/.tools/` when it is not already
installed.

Build both archives:

```powershell
.\scripts\get-hoalac-map-data.ps1
```

Or only rebuild the building layer:

```powershell
.\scripts\get-hoalac-buildings.ps1
```

The building script resolves Overture's latest release from its STAC catalog
and extracts the Hòa Lạc BBOX directly from the official remote archive:

```text
https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/<RELEASE>/buildings.pmtiles
```

Generated files:

```text
frontend/public/maps/hoalac.pmtiles
frontend/public/maps/hoalac-buildings.pmtiles
```

The supplemental archive keeps Overture's official source layers
`building` and `building_part`. The browser detects the archive
automatically and swaps the sparse OSM building fill for the denser Overture
building layer at local zoom levels.

The scripts build to temporary files first and only replace existing PMTiles
after a successful extraction, so a network/tool failure no longer deletes a
working local map.

Map attribution for the supplemental archive remains Overture/OpenStreetMap
attribution from the official tileset. The project does not copy building
geometry from the Google Maps UI or tiles.


## Satellite and Hybrid basemaps

Hola Maps supports two imagery modes in addition to the local vector basemap:

- `satellite`: imagery only, with Hola Maps data/markers/routes rendered above it.
- `hybrid`: imagery plus local Protomaps road lines, road labels, place labels and POIs.

The imagery source is resolved in this order:

1. `VITE_SATELLITE_TILE_URL` when explicitly configured.
2. MapTiler Satellite when `VITE_MAPTILER_KEY` exists.
3. Esri World Imagery as the default online fallback.

Optional environment overrides:

```dotenv
VITE_SATELLITE_TILE_URL=https://provider.example/{z}/{x}/{y}.jpg
VITE_SATELLITE_TILE_SIZE=256
VITE_SATELLITE_ATTRIBUTION=Imagery attribution text
```

Satellite imagery is intentionally kept online instead of being copied into
the local PMTiles archive. This keeps the local Hòa Lạc package small while
the vector PMTiles, Overture buildings, Hola Maps data layers, route and
service-area mask continue to work above the imagery.
