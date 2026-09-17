# GIS Architecture

## Principle

Hola Maps owns geographic business data.

MapLibre is a rendering layer only.

## Coordinate system

All official place coordinates use:

EPSG:4326

PostGIS type:

geometry(Point,4326)

## Location verification

During contribution:

1. Browser requests location permission
2. Capture latitude/longitude
3. Capture GPS accuracy
4. User adjusts marker if needed
5. Store official place coordinate
6. Store submission metadata separately

No continuous user tracking is stored.

## Provider independence

Possible future map sources:

- MapTiler
- OpenMapTiles
- Protomaps
- self-hosted tiles

Database schema does not depend on any provider.
