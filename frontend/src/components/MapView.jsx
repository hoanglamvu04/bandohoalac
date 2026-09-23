import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, LocateFixed, RefreshCcw } from 'lucide-react';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  MAP_COVERAGE_BOUNDS,
  SERVICE_AREAS_GEOJSON,
  STATIC_PREVIEW_URL,
  TILE_PROVIDER,
  createLocalBasemapStyle,
  isInsideServiceCoverage
} from '../mapConfig.js';

const ROUTE_SOURCE_ID = 'hola-route-source';
const ROUTE_CASING_LAYER_ID = 'hola-route-casing';
const ROUTE_LAYER_ID = 'hola-route-line';
const COVERAGE_SOURCE_ID = 'hola-service-areas';
const COVERAGE_LINE_LAYER_ID = 'hola-service-areas-line';

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
  if (normalized.includes('trải')) return '🎡';
  return '📍';
}

function removeMarkers(markers) {
  markers.forEach((marker) => marker.remove());
}

function removeRouteLayers(map) {
  if (!map || !map.isStyleLoaded()) return;
  if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
  if (map.getLayer(ROUTE_CASING_LAYER_ID)) map.removeLayer(ROUTE_CASING_LAYER_ID);
  if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
}

function toFeature(geometry) {
  return { type: 'Feature', properties: {}, geometry };
}

function addCoverageOutline(map) {
  if (!map?.isStyleLoaded() || map.getSource(COVERAGE_SOURCE_ID)) return;

  map.addSource(COVERAGE_SOURCE_ID, {
    type: 'geojson',
    data: SERVICE_AREAS_GEOJSON
  });

  map.addLayer({
    id: COVERAGE_LINE_LAYER_ID,
    type: 'line',
    source: COVERAGE_SOURCE_ID,
    paint: {
      'line-color': '#0f4a3d',
      'line-width': 1.25,
      'line-opacity': 0.24,
      'line-dasharray': [2, 2]
    }
  });
}

export default function MapView({
  places = [],
  selectedPlaceId,
  onSelectPlace,
  onUserLocation,
  userLocation,
  route
}) {
  const mapRef = useRef(null);
  const maplibreRef = useRef(null);
  const containerRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const fittedRouteKeyRef = useRef('');

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [mapStatus, setMapStatus] = useState('loading');
  const [mapError, setMapError] = useState('');
  const [interactiveReady, setInteractiveReady] = useState(false);

  const validPlaces = useMemo(
    () => places.filter((place) => {
      const lng = Number(place.lng);
      const lat = Number(place.lat);
      return Number.isFinite(lng) && Number.isFinite(lat) && isInsideServiceCoverage(lng, lat);
    }),
    [places]
  );

  function reloadMap() {
    window.location.reload();
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    let cancelled = false;
    let idleHandle = null;
    let paintTimer = null;

    const initializeMap = async () => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      try {
        const [maplibre] = await Promise.all([
          import('maplibre-gl'),
          import('maplibre-gl/dist/maplibre-gl.css')
        ]);

        if (cancelled || !containerRef.current || mapRef.current) return;

        maplibreRef.current = maplibre;
        const {
          Map: MapLibreMap,
          NavigationControl,
          FullscreenControl,
          ScaleControl
        } = maplibre;

        const map = new MapLibreMap({
          container: containerRef.current,
          style: createLocalBasemapStyle(),
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          maxBounds: MAP_COVERAGE_BOUNDS,
          attributionControl: true,
          fadeDuration: 0,
          refreshExpiredTiles: false,
          renderWorldCopies: false,
          maxTileCacheSize: 18,
          cooperativeGestures: false
        });

        mapRef.current = map;
        map.addControl(new NavigationControl({ visualizePitch: false }), 'top-right');
        map.addControl(new FullscreenControl(), 'top-right');
        map.addControl(new ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-right');

        const handleLoad = () => {
          addCoverageOutline(map);
          setMapStatus('ready');
          setMapError('');
          setInteractiveReady(true);
          window.requestAnimationFrame(() => map.resize());
        };

        const handleError = (event) => {
          const message = event?.error?.message || '';
          console.error('[Hola Maps] Local map error:', event?.error || event);

          if (message.toLowerCase().includes('webgl')) {
            setMapStatus('error');
            setMapError('WebGL đang bị tắt hoặc không khả dụng trên trình duyệt này.');
          }
        };

        map.__holaHandlers = { handleLoad, handleError };
        map.on('load', handleLoad);
        map.on('error', handleError);
      } catch (error) {
        console.error('[Hola Maps] Map initialization failed:', error);
        if (!cancelled) {
          setMapStatus('error');
          setMapError('Không thể khởi tạo bản đồ cục bộ.');
        }
      }
    };

    const start = () => {
      paintTimer = window.setTimeout(initializeMap, 0);
    };

    if ('requestIdleCallback' in window) {
      idleHandle = window.requestIdleCallback(start, { timeout: 120 });
    } else {
      window.requestAnimationFrame(start);
    }

    return () => {
      cancelled = true;
      if (paintTimer) window.clearTimeout(paintTimer);
      if (idleHandle && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleHandle);

      removeMarkers(markersRef.current);
      markersRef.current = [];

      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }

      const map = mapRef.current;
      if (map) {
        const handlers = map.__holaHandlers;
        if (handlers) {
          map.off('load', handlers.handleLoad);
          map.off('error', handlers.handleError);
        }
        map.remove();
      }

      mapRef.current = null;
      maplibreRef.current = null;
      fittedRouteKeyRef.current = '';
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !interactiveReady) return undefined;

    const { Marker, Popup } = maplibre;
    removeMarkers(markersRef.current);

    markersRef.current = validPlaces.map((place) => {
      const element = document.createElement('button');
      const active = selectedPlaceId === place.id;
      element.className = active ? 'map-pin premium-map-pin active' : 'map-pin premium-map-pin';
      element.type = 'button';
      element.setAttribute('aria-label', place.name);

      const icon = document.createElement('span');
      icon.className = 'premium-map-pin-icon';
      icon.textContent = categoryIcon(place.category);

      const label = document.createElement('span');
      label.className = 'premium-map-pin-label';
      label.textContent = place.name;

      element.append(icon, label);
      element.addEventListener('click', () => onSelectPlace?.(place));

      const rating = Number(place.rating);
      const ratingLabel = Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : 'Mới';

      const popup = new Popup({
        offset: 22,
        closeButton: false,
        className: 'hola-premium-popup'
      }).setHTML(
        '<div class="map-popup premium-map-popup">' +
          '<span class="map-popup-category">' + escapeHtml(place.category || 'Khám phá') + '</span>' +
          '<strong>' + escapeHtml(place.name) + '</strong>' +
          '<small>' + escapeHtml(place.address || 'Hòa Lạc, Hà Nội') + '</small>' +
          '<div><b>★ ' + escapeHtml(ratingLabel) + '</b>' +
          (place.priceLevel ? '<span>' + escapeHtml(place.priceLevel) + '</span>' : '') +
          '</div>' +
        '</div>'
      );

      return new Marker({ element, anchor: 'bottom' })
        .setLngLat([Number(place.lng), Number(place.lat)])
        .setPopup(popup)
        .addTo(map);
    });

    return undefined;
  }, [validPlaces, selectedPlaceId, onSelectPlace, interactiveReady]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !interactiveReady) return;

    const { Marker, Popup } = maplibre;

    if (!userLocation || !Number.isFinite(Number(userLocation.lat)) || !Number.isFinite(Number(userLocation.lng))) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }

    if (userMarkerRef.current) userMarkerRef.current.remove();

    const dot = document.createElement('div');
    dot.className = 'user-location-dot premium-user-location-dot hola-route-start-marker';
    dot.innerHTML = '<span></span>';

    userMarkerRef.current = new Marker({ element: dot })
      .setLngLat([Number(userLocation.lng), Number(userLocation.lat)])
      .setPopup(
        new Popup({ offset: 18, className: 'hola-premium-popup' }).setHTML(
          '<div class="map-popup premium-map-popup">' +
            '<span class="map-popup-category">VỊ TRÍ HIỆN TẠI</span>' +
            '<strong>Bạn đang ở đây</strong>' +
          '</div>'
        )
      )
      .addTo(map);
  }, [userLocation, interactiveReady]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !interactiveReady) return undefined;

    const { LngLatBounds } = maplibre;

    const renderRoute = () => {
      if (!map.isStyleLoaded()) return;

      if (!route?.geometry?.coordinates?.length) {
        removeRouteLayers(map);
        fittedRouteKeyRef.current = '';
        return;
      }

      const localCoordinates = route.geometry.coordinates.filter(
        ([lng, lat]) => isInsideServiceCoverage(lng, lat)
      );

      if (localCoordinates.length < 2) {
        removeRouteLayers(map);
        return;
      }

      const localGeometry = {
        ...route.geometry,
        coordinates: localCoordinates
      };

      const feature = toFeature(localGeometry);
      const source = map.getSource(ROUTE_SOURCE_ID);

      if (source) {
        source.setData(feature);
      } else {
        map.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data: feature });

        map.addLayer({
          id: ROUTE_CASING_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#ffffff',
            'line-width': 9,
            'line-opacity': 0.96
          }
        });

        map.addLayer({
          id: ROUTE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#d59a29',
            'line-width': 5.5,
            'line-opacity': 1
          }
        });
      }

      const routeKey =
        route.origin?.lng + ',' + route.origin?.lat + '>' +
        route.destination?.lng + ',' + route.destination?.lat;

      if (fittedRouteKeyRef.current !== routeKey) {
        const bounds = new LngLatBounds();
        localCoordinates.forEach((coordinate) => bounds.extend(coordinate));

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, {
            padding: { top: 110, right: 80, bottom: 80, left: 80 },
            duration: 650,
            maxZoom: 16
          });
        }

        fittedRouteKeyRef.current = routeKey;
      }
    };

    renderRoute();
    map.on('styledata', renderRoute);
    return () => map.off('styledata', renderRoute);
  }, [route, interactiveReady]);

  useEffect(() => {
    const map = mapRef.current;
    const selected = validPlaces.find((place) => place.id === selectedPlaceId);

    if (!map || !selected || route || !interactiveReady) return;

    map.flyTo({
      center: [Number(selected.lng), Number(selected.lat)],
      zoom: Math.max(map.getZoom(), 14.4),
      duration: 500,
      essential: true
    });
  }, [selectedPlaceId, validPlaces, route, interactiveReady]);

  function locateUser() {
    if (!navigator.geolocation) {
      setLocationError('Trình duyệt này không hỗ trợ định vị.');
      return;
    }

    setLocating(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
          timestamp: position.timestamp
        };

        if (!isInsideServiceCoverage(location.lng, location.lat)) {
          setLocationError('Bạn đang ở ngoài vùng bản đồ Hola Maps. Vẫn có thể mở chỉ đường bằng Google Maps.');
        } else {
          mapRef.current?.flyTo({
            center: [location.lng, location.lat],
            zoom: 14.6,
            duration: 500,
            essential: true
          });
        }

        onUserLocation?.(location);
        setLocating(false);
      },
      (error) => {
        const messages = {
          1: 'Bạn chưa cấp quyền truy cập vị trí.',
          2: 'Không thể xác định vị trí hiện tại.',
          3: 'Yêu cầu định vị đã hết thời gian.'
        };
        setLocationError(messages[error.code] || 'Không thể lấy vị trí.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  const showLoading = mapStatus === 'loading';
  const showError = mapStatus === 'error';

  return (
    <div className="map-wrap premium-map-wrap">
      {!interactiveReady && (
        STATIC_PREVIEW_URL ? (
          <img
            className="map-static-preview"
            src={STATIC_PREVIEW_URL}
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        ) : (
          <div className="map-instant-preview" aria-hidden="true">
            <span className="preview-road preview-road-1" />
            <span className="preview-road preview-road-2" />
            <span className="preview-road preview-road-3" />
            <span className="preview-water" />
            <span className="preview-label preview-label-hola">HÒA LẠC</span>
            <span className="preview-label preview-label-thachthat">THẠCH THẤT</span>
            <span className="preview-label preview-label-quocoai">QUỐC OAI</span>
            <span className="preview-pin"><b>●</b><small>Hòa Lạc</small></span>
          </div>
        )
      )}

      <div ref={containerRef} className="hola-map" />

      {showLoading && (
        <div className="map-provider-status loading">
          <span className="map-provider-spinner" />
          Đang mở bản đồ cục bộ...
        </div>
      )}

      {interactiveReady && (
        <div className="map-local-provider-badge">
          LOCAL MAP · {TILE_PROVIDER}
        </div>
      )}

      {showError && (
        <div className="map-provider-status error">
          <AlertTriangle size={16} />
          <span>{mapError}</span>
          <button type="button" onClick={reloadMap}>
            <RefreshCcw size={14} /> Thử lại
          </button>
        </div>
      )}

      <button
        className="locate-button premium-locate-button"
        type="button"
        onClick={locateUser}
        disabled={locating}
      >
        <LocateFixed size={18} />
        {locating ? 'Đang định vị...' : 'Vị trí của tôi'}
      </button>

      {locationError ? <div className="map-location-error">{locationError}</div> : null}
    </div>
  );
}
