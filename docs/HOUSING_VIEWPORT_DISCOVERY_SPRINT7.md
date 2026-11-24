# HOLA Maps — Sprint 7 / Spatial Real-Estate Discovery

- An explicit **Tìm tin trong vùng bản đồ** button in the existing
  housing intelligence panel requests `GET /api/housing` with four map
  bounds (west/east/south/north) and the selected housing filters.
- Data are filtered server-side by indexed PostGIS
  `ST_Intersects(places.location, ST_MakeEnvelope(...))` **before**
  pagination. The UI supports 20-result pages and displays public
  listing links. Moving the map without pressing the button does not
  generate new database queries or override other map interactions.
- Bounds must be complete, non-reversed, and no larger than 0.6 degrees
  in either direction; otherwise the user is asked to zoom in.
- The existing published-only, active, unexpired filters and client-side
  auth/consent mechanisms remain unchanged.
- No user GPS, search history persistence or contact leakage.
- This is only a real-estate viewport search, not a global isochrone,
  polygon-drawing map or guaranteed exhaustive POI catalog.
- Test backend schema/query and Playwright discovery. No migrations.
