# Hola Maps Audit

## Current architecture

- Frontend: React + Vite + MapLibre GL.
- Basemap pipeline: local PMTiles + Protomaps vector layers, with OpenFreeMap fallback.
- Target coverage: Hòa Lạc, Yên Xuân, Thạch Thất, Tây Phương, Hạ Bằng, Phú Cát, Ba Vì, Quốc Oai, Hoài Đức.

## Findings

### Keep
- `frontend/src/components/MapView.jsx`: core map renderer.
- `frontend/src/localBasemap.js`: PMTiles / Protomaps style builder.
- `frontend/src/mapConfig.js`: camera fence and service areas.

### Review for cleanup
- Large CSS files related to old map experiments should be consolidated after visual regression testing.
- Old raster fallback code should remain only as emergency fallback.
- Map styles should move toward one vector-first pipeline.

## Optimization direction

1. Lazy initialize MapLibre only when the map view is opened.
2. Load only PMTiles tiles intersecting the Hòa Lạc service bounding areas.
3. Keep vector layers for buildings, roads, POI and labels.
4. Avoid Google Maps dependencies and paid APIs.
