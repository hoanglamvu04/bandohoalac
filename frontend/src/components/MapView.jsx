import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FullscreenControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl
} from 'maplibre-gl';
import { AlertTriangle, LocateFixed, RefreshCcw } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';

const DEFAULT_CENTER = [105.525, 21.005];

// Core Hola Maps coverage: Hòa Lạc, Yên Xuân, Thạch Thất, Tây Phương,
// Hạ Bằng, Phú Cát and the nearby parts of Ba Vì, Quốc Oai, Hoài Đức.
// MapLibre only requests tiles for the current viewport; these bounds keep
// the product focused on western Hà Nội instead of encouraging world-scale
// browsing and unnecessary tile requests.
const WEST_HANOI_BOUNDS = [
  [105.14, 20.76],
  [105.86, 21.41]
];

const MAPTILER_KEY = (import.meta.env.VITE_MAPTILER_KEY || '').trim();
const MAPTILER_MAP_ID = (import.meta.env.VITE_MAPTILER_MAP_ID || 'streets-v4').trim();
const CUSTOM_STYLE_URL = (import.meta.env.VITE_MAP_STYLE_URL || '').trim();
const DEFAULT_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const MAPTILER_RASTER_TILE_URL = MAPTILER_KEY
  ? 'https://api.maptiler.com/maps/' + encodeURIComponent(MAPTILER_MAP_ID) +
    '/256/{z}/{x}/{y}.webp?key=' + encodeURIComponent(MAPTILER_KEY)
  : '';

const MAPTILER_RASTER_STYLE = MAPTILER_RASTER_TILE_URL
  ? {
      version: 8,
      sources: {
        maptiler: {
          type: 'raster',
          tiles: [MAPTILER_RASTER_TILE_URL],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 18,
          attribution: '&copy; MapTiler &copy; OpenStreetMap contributors'
        }
      },
      layers: [
        {
          id: 'maptiler-raster',
          type: 'raster',
          source: 'maptiler',
          paint: {
            'raster-fade-duration': 0
          }
        }
      ]
    }
  : null;

const PRIMARY_STYLE = MAPTILER_RASTER_STYLE || CUSTOM_STYLE_URL || DEFAULT_STYLE_URL;
const PRIMARY_PROVIDER_NAME = MAPTILER_RASTER_STYLE
  ? 'MapTiler Raster'
  : (CUSTOM_STYLE_URL ? 'Custom map' : 'OpenFreeMap');
const MAP_FALLBACK_DELAY_MS = MAPTILER_RASTER_STYLE ? 1200 : 1600;
const PROVIDER_CACHE_KEY = 'hola_maps_map_provider_v3';
const PROVIDER_CACHE_TTL_MS = 15 * 60 * 1000;

const FALLBACK_RASTER_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
      paint: {
        'raster-fade-duration': 0
      }
    }
  ]
};

const ROUTE_SOURCE_ID = 'hola-route-source';
const ROUTE_CASING_LAYER_ID = 'hola-route-casing';
const ROUTE_LAYER_ID = 'hola-route-line';

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
  return {
    type: 'Feature',
    properties: {},
    geometry
  };
}

function rememberProvider(provider) {
  try {
    sessionStorage.setItem(PROVIDER_CACHE_KEY, JSON.stringify({
      provider,
      savedAt: Date.now()
    }));
  } catch {
    // Storage may be disabled; map still works without this optimization.
  }
}

function getRememberedProvider() {
  try {
    const raw = sessionStorage.getItem(PROVIDER_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.provider || !parsed?.savedAt) return null;

    if (Date.now() - parsed.savedAt > PROVIDER_CACHE_TTL_MS) {
      sessionStorage.removeItem(PROVIDER_CACHE_KEY);
      return null;
    }

    return parsed.provider;
  } catch {
    return null;
  }
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
  const containerRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const fallbackAppliedRef = useRef(false);
  const styleTimerRef = useRef(null);
  const fittedRouteKeyRef = useRef('');

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [mapStatus, setMapStatus] = useState('loading');
  const [mapError, setMapError] = useState('');

  const validPlaces = useMemo(
    () => places.filter((place) => Number.isFinite(Number(place.lng)) && Number.isFinite(Number(place.lat))),
    [places]
  );

  function applyFallbackStyle(map, reason = '') {
    if (!map || fallbackAppliedRef.current) return;

    fallbackAppliedRef.current = true;
    rememberProvider('raster');
    setMapStatus('fallback');
    setMapError(reason || 'Nguồn bản đồ chính chưa tải được. Đang chuyển sang nền bản đồ dự phòng.');

    try {
      map.setStyle(FALLBACK_RASTER_STYLE);
    } catch (error) {
      console.error('[Hola Maps] Could not apply fallback map style:', error);
      setMapStatus('error');
      setMapError('Không thể khởi tạo nền bản đồ. Hãy kiểm tra kết nối mạng rồi thử lại.');
    }
  }

  function reloadMapStyle() {
    const map = mapRef.current;

    if (!map) {
      window.location.reload();
      return;
    }

    fallbackAppliedRef.current = false;
    rememberProvider('primary');
    setMapStatus('loading');
    setMapError('');

    try {
      map.setStyle(PRIMARY_STYLE);

      window.clearTimeout(styleTimerRef.current);
      styleTimerRef.current = window.setTimeout(() => {
        if (!map.isStyleLoaded()) applyFallbackStyle(map);
      }, MAP_FALLBACK_DELAY_MS);
    } catch (error) {
      console.error('[Hola Maps] Could not reload map style:', error);
      applyFallbackStyle(map, 'Nguồn bản đồ chính gặp lỗi. Đang dùng bản đồ dự phòng.');
    }
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const rememberedProvider = getRememberedProvider();
    const startWithRaster = rememberedProvider === 'raster';
    fallbackAppliedRef.current = startWithRaster;

    let map;

    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: startWithRaster
          ? FALLBACK_RASTER_STYLE
          : (PRIMARY_STYLE),
        center: DEFAULT_CENTER,
        zoom: 11.7,
        minZoom: 9.5,
        maxZoom: 18,
        maxBounds: WEST_HANOI_BOUNDS,
        attributionControl: true,
        fadeDuration: 0,
        refreshExpiredTiles: false,
        renderWorldCopies: false,
        maxTileCacheSize: 64
      });
    } catch (error) {
      console.error('[Hola Maps] MapLibre initialization failed:', error);
      setMapStatus('error');
      setMapError('Trình duyệt không khởi tạo được MapLibre/WebGL.');
      return undefined;
    }

    mapRef.current = map;

    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new FullscreenControl(), 'top-right');
    map.addControl(new ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-right');

    const handleLoad = () => {
      window.clearTimeout(styleTimerRef.current);

      if (fallbackAppliedRef.current) {
        rememberProvider('raster');
        setMapStatus('fallback-ready');
      } else {
        rememberProvider('primary');
        setMapStatus('ready');
        setMapError('');
      }

      window.requestAnimationFrame(() => map.resize());
    };

    const handleIdle = () => {
      if (map.isStyleLoaded()) {
        window.clearTimeout(styleTimerRef.current);
        setMapStatus(fallbackAppliedRef.current ? 'fallback-ready' : 'ready');
      }
    };

    const handleError = (event) => {
      const message = event?.error?.message || 'Map style request failed.';
      console.error('[Hola Maps] MapLibre error:', event?.error || event);

      if (!fallbackAppliedRef.current && !map.isStyleLoaded()) {
        applyFallbackStyle(
          map,
          'Không tải được nền ' + PRIMARY_PROVIDER_NAME + '. Hola Maps đã tự chuyển sang OpenStreetMap để hiển thị nhanh hơn.'
        );
        return;
      }

      if (fallbackAppliedRef.current && !map.isStyleLoaded()) {
        setMapStatus('error');
        setMapError('Không tải được dữ liệu bản đồ. Kiểm tra mạng, VPN hoặc tiện ích chặn nội dung.');
      } else if (message.toLowerCase().includes('webgl')) {
        setMapStatus('error');
        setMapError('WebGL đang bị tắt hoặc không khả dụng trên trình duyệt này.');
      }
    };

    map.on('load', handleLoad);
    map.on('idle', handleIdle);
    map.on('error', handleError);

    if (!startWithRaster) {
      styleTimerRef.current = window.setTimeout(() => {
        if (!map.isStyleLoaded()) {
          applyFallbackStyle(
            map,
            'Nền bản đồ chính tải quá lâu. Hola Maps đã chuyển sang OpenStreetMap để vào nhanh hơn.'
          );
        }
      }, MAP_FALLBACK_DELAY_MS);
    }

    return () => {
      window.clearTimeout(styleTimerRef.current);
      removeMarkers(markersRef.current);
      markersRef.current = [];

      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }

      map.off('load', handleLoad);
      map.off('idle', handleIdle);
      map.off('error', handleError);
      map.remove();
      mapRef.current = null;
      fallbackAppliedRef.current = false;
      fittedRouteKeyRef.current = '';
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

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
  }, [validPlaces, selectedPlaceId, onSelectPlace]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

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
            '<small>' +
              (userLocation.accuracy ? 'Độ chính xác ±' + escapeHtml(userLocation.accuracy) + ' m' : 'Điểm bắt đầu') +
            '</small>' +
          '</div>'
        )
      )
      .addTo(map);
  }, [userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const renderRoute = () => {
      if (!map.isStyleLoaded()) return;

      if (!route?.geometry?.coordinates?.length) {
        removeRouteLayers(map);
        fittedRouteKeyRef.current = '';
        return;
      }

      const feature = toFeature(route.geometry);
      const source = map.getSource(ROUTE_SOURCE_ID);

      if (source) {
        source.setData(feature);
      } else {
        map.addSource(ROUTE_SOURCE_ID, {
          type: 'geojson',
          data: feature
        });

        map.addLayer({
          id: ROUTE_CASING_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
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
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
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
        route.geometry.coordinates.forEach((coordinate) => bounds.extend(coordinate));

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, {
            padding: { top: 110, right: 80, bottom: 80, left: 80 },
            duration: 900,
            maxZoom: 16
          });
        }

        fittedRouteKeyRef.current = routeKey;
      }
    };

    renderRoute();
    map.on('styledata', renderRoute);

    return () => {
      map.off('styledata', renderRoute);
    };
  }, [route, mapStatus]);

  useEffect(() => {
    const map = mapRef.current;
    const selected = validPlaces.find((place) => place.id === selectedPlaceId);

    if (!map || !selected || route) return;

    map.flyTo({
      center: [Number(selected.lng), Number(selected.lat)],
      zoom: Math.max(map.getZoom(), 14.4),
      duration: 650,
      essential: true
    });
  }, [selectedPlaceId, validPlaces, route]);

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

        const map = mapRef.current;

        if (map) {
          map.flyTo({
            center: [location.lng, location.lat],
            zoom: 14.6,
            duration: 650,
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
  const showFallback = mapStatus === 'fallback' || mapStatus === 'fallback-ready';
  const showError = mapStatus === 'error';

  return (
    <div className="map-wrap premium-map-wrap">
      <div ref={containerRef} className="hola-map" />

      {showLoading && (
        <div className="map-loading-skeleton" aria-hidden="true">
          <span className="skeleton-road road-1" />
          <span className="skeleton-road road-2" />
          <span className="skeleton-road road-3" />
          <span className="skeleton-water" />
          <span className="skeleton-block block-1" />
          <span className="skeleton-block block-2" />
          <span className="skeleton-block block-3" />
        </div>
      )}

      {showLoading && (
        <div className="map-provider-status loading">
          <span className="map-provider-spinner" />
          Đang tải bản đồ Hòa Lạc...
        </div>
      )}

      {showFallback && (
        <div className="map-provider-status fallback">
          <AlertTriangle size={15} />
          <span>{mapError || 'Đang dùng OpenStreetMap để tải nhanh hơn.'}</span>
        </div>
      )}

      {showError && (
        <div className="map-provider-status error">
          <AlertTriangle size={16} />
          <span>{mapError}</span>
          <button type="button" onClick={reloadMapStyle}>
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
