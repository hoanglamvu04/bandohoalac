import { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, RefreshCcw } from 'lucide-react';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  MAP_COVERAGE_BOUNDS,
  SERVICE_AREAS_GEOJSON,
  SERVICE_AREA_MASK_GEOJSON,
  isInsideServiceCoverage
} from '../mapConfig.js';
import {
  PMTILES_URL,
  BUILDINGS_PMTILES_URL,
  createFallbackStyle,
  createPmtilesStyle,
  localPmtilesAvailable,
  supplementalBuildingsAvailable
} from '../localBasemap.js';

const DATA_SOURCE_ID = 'hola-data-layers';
const ROUTE_SOURCE_ID = 'hola-route-source';
const COVERAGE_SOURCE_ID = 'hola-service-areas';
const COVERAGE_MASK_SOURCE_ID = 'hola-service-area-mask';

const DATA_LAYER_IDS = {
  TERRAIN: 'hm-terrain',
  WATER: 'hm-water',
  BUILDING: 'hm-building',
  PLANNING: 'hm-planning',
  FLOOD: 'hm-flood',
  ROAD: 'hm-road',
  ROAD_CLOSURE: 'hm-road-closure',
  LANDMARK: 'hm-landmark',
  EVENT: 'hm-event',
  ALERT: 'hm-alert'
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function categoryIcon(category = '') {
  const normalized = category.toLowerCase();
  if (normalized.includes('cafe') || normalized.includes('coffee')) return '☕';
  if (normalized.includes('ăn') || normalized.includes('food')) return '🍜';
  if (normalized.includes('home')) return '🏡';
  if (normalized.includes('villa')) return '🏘️';
  if (normalized.includes('check')) return '📸';
  return '📍';
}

function removeMarkers(markers) {
  markers.forEach((marker) => marker.remove());
}

function emptyFeatureCollection() {
  return { type: 'FeatureCollection', features: [] };
}

function loadExternalScript(src, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-hola-src="' + src + '"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window[globalName]), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.holaSrc = src;
    script.onload = () => resolve(window[globalName]);
    script.onerror = () => reject(new Error('Không tải được thư viện bản đồ: ' + src));
    document.head.appendChild(script);
  });
}

function addCoverage(map) {
  if (!map.isStyleLoaded()) return;

  if (!map.getSource(COVERAGE_MASK_SOURCE_ID)) {
    map.addSource(COVERAGE_MASK_SOURCE_ID, {
      type: 'geojson',
      data: SERVICE_AREA_MASK_GEOJSON
    });

    map.addLayer({
      id: 'hm-service-area-mask',
      type: 'fill',
      source: COVERAGE_MASK_SOURCE_ID,
      paint: {
        'fill-color': '#f3f7f5',
        'fill-opacity': 0.72
      }
    });
  }

  if (!map.getSource(COVERAGE_SOURCE_ID)) {
    map.addSource(COVERAGE_SOURCE_ID, {
      type: 'geojson',
      data: SERVICE_AREAS_GEOJSON
    });

    map.addLayer({
      id: 'hm-service-area-fill',
      type: 'fill',
      source: COVERAGE_SOURCE_ID,
      paint: {
        'fill-color': '#0d7a5f',
        'fill-opacity': 0.025
      }
    });

    map.addLayer({
      id: 'hm-service-area-line',
      type: 'line',
      source: COVERAGE_SOURCE_ID,
      paint: {
        'line-color': '#0d6a56',
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.4, 16, 2.4],
        'line-opacity': 0.62,
        'line-dasharray': [2, 1.5]
      }
    });
  }
}

function addDataLayers(map, data) {
  if (!map.isStyleLoaded()) return;

  if (!map.getSource(DATA_SOURCE_ID)) {
    map.addSource(DATA_SOURCE_ID, {
      type: 'geojson',
      data: data || emptyFeatureCollection()
    });
  }

  const add = (spec) => {
    if (!map.getLayer(spec.id)) map.addLayer(spec);
  };

  add({
    id: DATA_LAYER_IDS.TERRAIN,
    type: 'fill',
    minzoom: 12,
    source: DATA_SOURCE_ID,
    filter: ['==', ['get', 'layerType'], 'TERRAIN'],
    paint: {
      'fill-color': '#a9c2a5',
      'fill-opacity': 0.10
    }
  });

  add({
    id: DATA_LAYER_IDS.WATER,
    type: 'fill',
    minzoom: 12,
    source: DATA_SOURCE_ID,
    filter: ['==', ['get', 'layerType'], 'WATER'],
    paint: {
      'fill-color': '#62b7c9',
      'fill-opacity': 0.52,
      'fill-outline-color': '#3c93a5'
    }
  });

  add({
    id: DATA_LAYER_IDS.BUILDING,
    type: 'fill',
    minzoom: 14,
    source: DATA_SOURCE_ID,
    filter: ['==', ['get', 'layerType'], 'BUILDING'],
    paint: {
      'fill-color': '#b8b0a1',
      'fill-opacity': 0.28,
      'fill-outline-color': '#8d8579'
    }
  });

  add({
    id: DATA_LAYER_IDS.PLANNING,
    type: 'fill',
    minzoom: 12.5,
    source: DATA_SOURCE_ID,
    filter: ['==', ['get', 'layerType'], 'PLANNING'],
    paint: {
      'fill-color': '#8b5cf6',
      'fill-opacity': 0.12,
      'fill-outline-color': '#6d28d9'
    }
  });

  add({
    id: DATA_LAYER_IDS.FLOOD,
    type: 'fill',
    minzoom: 12.5,
    source: DATA_SOURCE_ID,
    filter: ['==', ['get', 'layerType'], 'FLOOD'],
    paint: {
      'fill-color': [
        'match',
        ['get', 'severity'],
        'CRITICAL', '#be123c',
        'HIGH', '#dc2626',
        'MEDIUM', '#f59e0b',
        'LOW', '#38bdf8',
        '#60a5fa'
      ],
      'fill-opacity': 0.24,
      'fill-outline-color': '#2563eb'
    }
  });

  add({
    id: DATA_LAYER_IDS.ROAD,
    type: 'line',
    minzoom: 13,
    source: DATA_SOURCE_ID,
    filter: ['==', ['get', 'layerType'], 'ROAD'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#334155',
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.2, 17, 4.5],
      'line-opacity': 0.88
    }
  });

  add({
    id: DATA_LAYER_IDS.ROAD_CLOSURE,
    type: 'line',
    minzoom: 13,
    source: DATA_SOURCE_ID,
    filter: ['==', ['get', 'layerType'], 'ROAD_CLOSURE'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#dc2626',
      'line-width': 5,
      'line-dasharray': [1.5, 1.3]
    }
  });

  for (const [type, color, radius] of [
    ['LANDMARK', '#0f766e', 6],
    ['EVENT', '#7c3aed', 7],
    ['ALERT', '#dc2626', 8]
  ]) {
    add({
      id: DATA_LAYER_IDS[type],
      type: 'circle',
      minzoom: type === 'LANDMARK' ? 12.5 : 13,
      source: DATA_SOURCE_ID,
      filter: ['==', ['get', 'layerType'], type],
      paint: {
        'circle-radius': radius,
        'circle-color': color,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });
  }
}

function setLayerVisibility(map, activeLayers) {
  if (!map?.isStyleLoaded()) return;
  Object.entries(DATA_LAYER_IDS).forEach(([type, id]) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', activeLayers.includes(type) ? 'visible' : 'none');
    }
  });
}

function renderRoute(map, route, maplibre, fittedRouteKeyRef) {
  if (!map?.isStyleLoaded()) return;

  if (!route?.geometry?.coordinates?.length) {
    ['hm-route-line', 'hm-route-casing'].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
    fittedRouteKeyRef.current = '';
    return;
  }

  const coordinates = route.geometry.coordinates.filter(([lng, lat]) =>
    isInsideServiceCoverage(lng, lat)
  );
  if (coordinates.length < 2) return;

  const feature = {
    type: 'Feature',
    properties: {},
    geometry: { ...route.geometry, coordinates }
  };

  const source = map.getSource(ROUTE_SOURCE_ID);
  if (source) {
    source.setData(feature);
  } else {
    map.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data: feature });
    map.addLayer({
      id: 'hm-route-casing',
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.95 }
    });
    map.addLayer({
      id: 'hm-route-line',
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#0d5144', 'line-width': 6, 'line-opacity': 1 }
    });
  }

  const routeKey = route.origin?.lng + ',' + route.origin?.lat + '>' +
    route.destination?.lng + ',' + route.destination?.lat;

  if (fittedRouteKeyRef.current !== routeKey) {
    const bounds = new maplibre.LngLatBounds();
    coordinates.forEach((coordinate) => bounds.extend(coordinate));
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: { top: 120, right: 380, bottom: 100, left: 390 },
        duration: 650,
        maxZoom: 16
      });
    }
    fittedRouteKeyRef.current = routeKey;
  }
}

export default function MapView({
  places = [],
  selectedPlaceId,
  onSelectPlace,
  onUserLocation,
  userLocation,
  route,
  mapData = emptyFeatureCollection(),
  activeLayers = [],
  basemapMode = 'streets',
  onViewportChange
}) {
  const mapRef = useRef(null);
  const maplibreRef = useRef(null);
  const containerRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const fittedRouteKeyRef = useRef('');
  const latestMapDataRef = useRef(mapData);
  const latestActiveLayersRef = useRef(activeLayers);
  const latestRouteRef = useRef(route);

  const [interactiveReady, setInteractiveReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [locating, setLocating] = useState(false);
  const [usingLocalPmtiles, setUsingLocalPmtiles] = useState(false);
  const [usingSupplementalBuildings, setUsingSupplementalBuildings] = useState(false);
  const [basemapHealth, setBasemapHealth] = useState('checking');

  const validPlaces = useMemo(
    () => places.filter((place) =>
      Number.isFinite(Number(place.lng)) &&
      Number.isFinite(Number(place.lat)) &&
      isInsideServiceCoverage(place.lng, place.lat)
    ),
    [places]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    let cancelled = false;
    let idleHandle = null;

    const initialize = async () => {
      try {
        const [maplibre] = await Promise.all([
          import('maplibre-gl'),
          import('maplibre-gl/dist/maplibre-gl.css'),
          loadExternalScript('https://unpkg.com/pmtiles@4.5.0/dist/pmtiles.js', 'pmtiles'),
          loadExternalScript('https://unpkg.com/@protomaps/basemaps@5/dist/basemaps.js', 'basemaps')
        ]);
        if (cancelled || !containerRef.current) return;

        const pmtiles = window.pmtiles;
        const protocol = new pmtiles.Protocol();
        try {
          maplibre.addProtocol('pmtiles', protocol.tile);
        } catch {
          // Protocol may already exist after a hot reload.
        }

        const [hasLocalPmtiles, hasSupplementalBuildings] = await Promise.all([
          localPmtilesAvailable(),
          supplementalBuildingsAvailable()
        ]);
        if (cancelled) return;

        const canUseSupplementalBuildings = hasLocalPmtiles && hasSupplementalBuildings;
        setUsingLocalPmtiles(hasLocalPmtiles);
        setUsingSupplementalBuildings(canUseSupplementalBuildings);

        if (hasLocalPmtiles) {
          protocol.add(new pmtiles.PMTiles(PMTILES_URL));
        }
        if (canUseSupplementalBuildings) {
          protocol.add(new pmtiles.PMTiles(BUILDINGS_PMTILES_URL));
        }

        maplibreRef.current = maplibre;
        const map = new maplibre.Map({
          container: containerRef.current,
          style: (hasLocalPmtiles || basemapMode === 'satellite')
            ? createPmtilesStyle(basemapMode, {
                includeSupplementalBuildings: canUseSupplementalBuildings
              })
            : createFallbackStyle(),
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          maxBounds: MAP_COVERAGE_BOUNDS,
          renderWorldCopies: false,
          refreshExpiredTiles: false,
          fadeDuration: 0,
          maxTileCacheSize: 18
        });

        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ visualizePitch: false }), 'bottom-right');
        map.addControl(new maplibre.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-right');

        const notifyViewport = () => {
          const b = map.getBounds();
          onViewportChange?.({
            west: b.getWest(),
            south: b.getSouth(),
            east: b.getEast(),
            north: b.getNorth(),
            zoom: map.getZoom()
          });
        };

        map.on('load', () => {
          addCoverage(map);
          addDataLayers(map, mapData);
          setLayerVisibility(map, activeLayers);
          setInteractiveReady(true);
          notifyViewport();
          requestAnimationFrame(() => map.resize());

          if (basemapMode === 'satellite') {
            setBasemapHealth('ok');
            return;
          }

          if (!hasLocalPmtiles) {
            setBasemapHealth('fallback');
            return;
          }

          // A valid local archive is enough to keep the local renderer active.
          // Do not fall back merely because vector features have not rendered
          // within a short timeout: after a Vite restart / cold browser cache,
          // z15-z17 PMTiles can legitimately take longer than 1.8 seconds.
          setBasemapHealth('ok');
        });

        map.on('moveend', notifyViewport);
        let localSourceErrorCount = 0;

        map.on('error', (event) => {
          const message = event?.error?.message || '';
          const sourceId = event?.sourceId || event?.source?.id || '';

          if (message.toLowerCase().includes('webgl')) {
            setMapError('Trình duyệt hiện không hỗ trợ WebGL cho bản đồ.');
            return;
          }

          // Supplemental buildings are optional. If their archive is broken,
          // disable only that source instead of throwing away the whole local
          // basemap and all Overture/OSM detail.
          if (
            sourceId === 'overture-buildings' ||
            message.toLowerCase().includes('hoalac-buildings.pmtiles')
          ) {
            console.warn('[Hola Maps] Supplemental building archive failed:', message);
            setUsingSupplementalBuildings(false);
            return;
          }

          const isLocalPmtilesError =
            sourceId === 'protomaps' ||
            message.toLowerCase().includes('hoalac.pmtiles') ||
            message.toLowerCase().includes('pmtiles://');

          if (!isLocalPmtilesError) return;

          localSourceErrorCount += 1;
          console.warn('[Hola Maps] Local PMTiles source error', localSourceErrorCount, message);

          // Only abandon the local map after repeated real source failures.
          if (localSourceErrorCount < 3 || !mapRef.current) return;

          setBasemapHealth('broken');
          setUsingLocalPmtiles(false);
        });

        map.on('click', (event) => {
          const ids = Object.values(DATA_LAYER_IDS).filter((id) => map.getLayer(id));
          if (!ids.length) return;
          const features = map.queryRenderedFeatures(event.point, { layers: ids });
          const feature = features[0];
          if (!feature) return;

          const props = feature.properties || {};
          new maplibre.Popup({ closeButton: true, className: 'hm-data-popup' })
            .setLngLat(event.lngLat)
            .setHTML(
              '<div class="hm-popup-card">' +
              '<span>' + escapeHtml(props.layerType || 'DATA') + '</span>' +
              '<strong>' + escapeHtml(props.name || 'Dữ liệu Hola Maps') + '</strong>' +
              (props.description ? '<p>' + escapeHtml(props.description) + '</p>' : '') +
              '</div>'
            )
            .addTo(map);
        });
      } catch (error) {
        console.error('[Hola Maps] initialize error', error);
        setMapError('Không thể khởi tạo bản đồ cục bộ.');
      }
    };

    if ('requestIdleCallback' in window) {
      idleHandle = window.requestIdleCallback(initialize, { timeout: 100 });
    } else {
      requestAnimationFrame(initialize);
    }

    return () => {
      cancelled = true;
      if (idleHandle && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleHandle);
      removeMarkers(markersRef.current);
      userMarkerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
    };
  }, []);

  useEffect(() => {
    latestMapDataRef.current = mapData;
  }, [mapData]);

  useEffect(() => {
    latestActiveLayersRef.current = activeLayers;
  }, [activeLayers]);

  useEffect(() => {
    latestRouteRef.current = route;
  }, [route]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !interactiveReady) return undefined;

    let cancelled = false;

    const restoreHolaLayers = () => {
      if (cancelled) return;
      addCoverage(map);
      addDataLayers(map, latestMapDataRef.current);
      setLayerVisibility(map, latestActiveLayersRef.current);
      renderRoute(map, latestRouteRef.current, maplibre, fittedRouteKeyRef);
      setInteractiveReady(true);
      requestAnimationFrame(() => map.resize());
    };

    setInteractiveReady(false);
    map.once('style.load', restoreHolaLayers);
    const canRenderSelectedStyle = usingLocalPmtiles || basemapMode === 'satellite';

    map.setStyle(
      canRenderSelectedStyle
        ? createPmtilesStyle(basemapMode, {
            includeSupplementalBuildings: usingSupplementalBuildings
          })
        : createFallbackStyle(),
      { diff: false }
    );

    return () => {
      cancelled = true;
      map.off('style.load', restoreHolaLayers);
    };
  }, [basemapMode, usingLocalPmtiles, usingSupplementalBuildings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !interactiveReady) return;
    const source = map.getSource(DATA_SOURCE_ID);
    if (source) source.setData(mapData || emptyFeatureCollection());
  }, [mapData, interactiveReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !interactiveReady) return;
    setLayerVisibility(map, activeLayers);
  }, [activeLayers, interactiveReady]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !interactiveReady) return;

    removeMarkers(markersRef.current);
    markersRef.current = validPlaces.map((place) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = selectedPlaceId === place.id ? 'hm-place-pin active' : 'hm-place-pin';
      element.innerHTML = '<span>' + categoryIcon(place.category) + '</span>';
      element.title = place.name;
      element.addEventListener('click', () => onSelectPlace?.(place));

      return new maplibre.Marker({ element, anchor: 'bottom' })
        .setLngLat([Number(place.lng), Number(place.lat)])
        .setPopup(
          new maplibre.Popup({ offset: 18, closeButton: false, className: 'hm-data-popup' })
            .setHTML(
              '<div class="hm-popup-card"><span>' +
              escapeHtml(place.category || 'ĐỊA ĐIỂM') +
              '</span><strong>' + escapeHtml(place.name) +
              '</strong><p>' + escapeHtml(place.address || 'Hòa Lạc') + '</p></div>'
            )
        )
        .addTo(map);
    });
  }, [validPlaces, selectedPlaceId, onSelectPlace, interactiveReady]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !interactiveReady) return;

    if (
      !userLocation ||
      !Number.isFinite(Number(userLocation.lat)) ||
      !Number.isFinite(Number(userLocation.lng)) ||
      !isInsideServiceCoverage(userLocation.lng, userLocation.lat)
    ) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }

    userMarkerRef.current?.remove();
    const dot = document.createElement('div');
    dot.className = 'hm-user-location';
    dot.innerHTML = '<span></span>';

    userMarkerRef.current = new maplibre.Marker({ element: dot })
      .setLngLat([Number(userLocation.lng), Number(userLocation.lat)])
      .addTo(map);
  }, [userLocation, interactiveReady]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !interactiveReady) return;
    renderRoute(map, route, maplibre, fittedRouteKeyRef);
  }, [route, interactiveReady]);

  useEffect(() => {
    const map = mapRef.current;
    const selected = validPlaces.find((place) => place.id === selectedPlaceId);
    if (!map || !selected || route || !interactiveReady) return;
    map.flyTo({
      center: [Number(selected.lng), Number(selected.lat)],
      zoom: Math.max(map.getZoom(), 14.5),
      duration: 450
    });
  }, [selectedPlaceId, validPlaces, route, interactiveReady]);

  function locateUser() {
    if (!navigator.geolocation) return;
    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
          timestamp: position.timestamp
        };
        onUserLocation?.(location);
        if (isInsideServiceCoverage(location.lng, location.lat)) {
          mapRef.current?.flyTo({ center: [location.lng, location.lat], zoom: 15, duration: 500 });
        }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  return (
    <div className="hm-map-shell">
      {!interactiveReady && (
        <div className="hm-map-placeholder">
            <div className="hm-map-placeholder-grid" />
            <strong>HOLA MAPS</strong>
            <span>Đang mở bản đồ vector Hòa Lạc…</span>
      </div>
      )}

      <div ref={containerRef} className="hm-map-canvas" />

      <div className={'hm-map-provider health-' + basemapHealth}>
        {basemapMode === 'satellite' && 'SATELLITE IMAGERY'}
        {basemapMode === 'hybrid' && 'HYBRID · SATELLITE + LOCAL LABELS'}
        {!['satellite', 'hybrid'].includes(basemapMode) && basemapHealth === 'checking' && 'CHECKING LOCAL BASEMAP'}
        {!['satellite', 'hybrid'].includes(basemapMode) && basemapHealth === 'ok' && (
          usingSupplementalBuildings
            ? 'LOCAL PMTILES · OSM + OVERTURE BUILDINGS'
            : 'LOCAL PMTILES · OSM'
        )}
        {!['satellite', 'hybrid'].includes(basemapMode) && basemapHealth === 'broken' && 'LOCAL PMTILES ERROR'}
        {!['satellite', 'hybrid'].includes(basemapMode) && basemapHealth === 'fallback' && 'OPEN VECTOR FALLBACK'}
      </div>

      <button className="hm-locate" type="button" onClick={locateUser} disabled={locating}>
        <LocateFixed size={18} />
        {locating ? 'Đang định vị' : 'Vị trí của tôi'}
      </button>

      {mapError && (
        <div className="hm-map-error">
          <span>{mapError}</span>
          <button type="button" onClick={() => window.location.reload()}>
            <RefreshCcw size={14} /> Tải lại
          </button>
        </div>
      )}
    </div>
  );
}
