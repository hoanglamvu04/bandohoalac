import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, LocateFixed, RefreshCcw } from 'lucide-react';

const DEFAULT_CENTER = [105.525, 21.005];
const DEFAULT_ZOOM = 13.15;
const MIN_ZOOM = 11.8;

// Core Hola Maps coverage: Hòa Lạc, Yên Xuân, Thạch Thất, Tây Phương,
// Hạ Bằng, Phú Cát and the nearby parts of Ba Vì, Quốc Oai, Hoài Đức.
// MapLibre only requests tiles for the current viewport; these bounds keep
// the product focused on western Hà Nội instead of encouraging world-scale
// browsing and unnecessary tile requests.
const WEST_HANOI_BOUNDS = [
  [105.24, 20.82],
  [105.79, 21.25]
];

const MAPTILER_KEY = (import.meta.env.VITE_MAPTILER_KEY || '').trim();
const MAPTILER_MAP_ID = (import.meta.env.VITE_MAPTILER_MAP_ID || 'streets-v4').trim();
// Keep the default basemap raster-only. Vector styles such as OpenFreeMap
// download style JSON, fonts, sprites and multiple vector sources before the
// first useful paint, which is unnecessary for this local discovery map.

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

const LIGHT_RASTER_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      minzoom: 11,
      maxzoom: 18,
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

const PRIMARY_STYLE = MAPTILER_RASTER_STYLE || LIGHT_RASTER_STYLE;
const PRIMARY_PROVIDER_NAME = MAPTILER_RASTER_STYLE ? 'MapTiler Raster' : 'OpenStreetMap Raster';
const MAP_FALLBACK_DELAY_MS = 1800;
const MAPTILER_STATIC_PREVIEW_URL = MAPTILER_KEY
  ? 'https://api.maptiler.com/maps/' + encodeURIComponent(MAPTILER_MAP_ID) +
    '/static/' + DEFAULT_CENTER[0] + ',' + DEFAULT_CENTER[1] +
    ',' + DEFAULT_ZOOM + '/1200x800.webp?attribution=false&key=' + encodeURIComponent(MAPTILER_KEY)
  : '';
const PROVIDER_CACHE_KEY = 'hola_maps_map_provider_v4';
const PROVIDER_CACHE_TTL_MS = 15 * 60 * 1000;
const FALLBACK_RASTER_STYLE = LIGHT_RASTER_STYLE;

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
  const maplibreRef = useRef(null);
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
  const [interactiveReady, setInteractiveReady] = useState(false);

  const validPlaces = useMemo(
    () => places.filter((place) => Number.isFinite(Number(place.lng)) && Number.isFinite(Number(place.lat))),
    [places]
  );

  function applyFallbackStyle(map, reason = '') {
    if (!map || fallbackAppliedRef.current) return;

    fallbackAppliedRef.current = true;
    rememberProvider('raster');
    setInteractiveReady(false);
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
    setInteractiveReady(false);
    setMapStatus('loading');
    setMapError('');

    try {
      map.setStyle(PRIMARY_STYLE);

      window.clearTimeout(styleTimerRef.current);
      if (MAPTILER_RASTER_STYLE) {
        styleTimerRef.current = window.setTimeout(() => {
          if (!map.isStyleLoaded()) applyFallbackStyle(map);
        }, MAP_FALLBACK_DELAY_MS);
      }
    } catch (error) {
      console.error('[Hola Maps] Could not reload map style:', error);
      applyFallbackStyle(map, 'Nguồn bản đồ chính gặp lỗi. Đang dùng bản đồ dự phòng.');
    }
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    let cancelled = false;
    let paintTimer = null;
    let idleHandle = null;
    let initializedMap = null;

    const initializeMap = async () => {
      if (cancelled || mapRef.current || !containerRef.current) return;

      try {
        // Keep MapLibre out of the initial JS path. The lightweight Hòa Lạc
        // preview paints first; MapLibre + its CSS are fetched immediately
        // after that first paint.
        const [maplibre] = await Promise.all([
          import('maplibre-gl'),
          import('maplibre-gl/dist/maplibre-gl.css')
        ]);

        if (cancelled || mapRef.current || !containerRef.current) return;

        maplibreRef.current = maplibre;
        const {
          Map: MapLibreMap,
          NavigationControl,
          FullscreenControl,
          ScaleControl
        } = maplibre;

        const rememberedProvider = getRememberedProvider();
        const startWithRaster = Boolean(MAPTILER_RASTER_STYLE && rememberedProvider === 'raster');
        fallbackAppliedRef.current = startWithRaster;

        const map = new MapLibreMap({
          container: containerRef.current,
          style: startWithRaster ? FALLBACK_RASTER_STYLE : PRIMARY_STYLE,
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          minZoom: MIN_ZOOM,
          maxZoom: 17.5,
          maxBounds: WEST_HANOI_BOUNDS,
          attributionControl: true,
          fadeDuration: 0,
          refreshExpiredTiles: false,
          renderWorldCopies: false,
          maxTileCacheSize: 24
        });

        initializedMap = map;
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

          setInteractiveReady(true);
          window.requestAnimationFrame(() => map.resize());
        };

        const handleIdle = () => {
          if (map.isStyleLoaded()) {
            window.clearTimeout(styleTimerRef.current);
            setMapStatus(fallbackAppliedRef.current ? 'fallback-ready' : 'ready');
            setInteractiveReady(true);
          }
        };

        const handleError = (event) => {
          const message = event?.error?.message || 'Map style request failed.';
          console.error('[Hola Maps] MapLibre error:', event?.error || event);

          if (MAPTILER_RASTER_STYLE && !fallbackAppliedRef.current && !map.isStyleLoaded()) {
            applyFallbackStyle(
              map,
              'Không tải được nền ' + PRIMARY_PROVIDER_NAME + '. Hola Maps đã chuyển sang OpenStreetMap raster nhẹ.'
            );
            return;
          }

          if (!map.isStyleLoaded()) {
            setMapStatus('error');
            setMapError('Không tải được dữ liệu bản đồ. Kiểm tra mạng, VPN hoặc tiện ích chặn nội dung.');
          } else if (message.toLowerCase().includes('webgl')) {
            setMapStatus('error');
            setMapError('WebGL đang bị tắt hoặc không khả dụng trên trình duyệt này.');
          }
        };

        map.__holaHandlers = { handleLoad, handleIdle, handleError };
        map.on('load', handleLoad);
        map.on('idle', handleIdle);
        map.on('error', handleError);

        if (MAPTILER_RASTER_STYLE && !startWithRaster) {
          styleTimerRef.current = window.setTimeout(() => {
            if (!map.isStyleLoaded()) {
              applyFallbackStyle(
                map,
                'MapTiler phản hồi chậm. Hola Maps đã chuyển ngay sang OpenStreetMap raster nhẹ.'
              );
            }
          }, MAP_FALLBACK_DELAY_MS);
        }
      } catch (error) {
        console.error('[Hola Maps] Lazy MapLibre initialization failed:', error);
        if (!cancelled) {
          setMapStatus('error');
          setMapError('Trình duyệt không khởi tạo được MapLibre/WebGL.');
        }
      }
    };

    const startAfterFirstPaint = () => {
      paintTimer = window.setTimeout(initializeMap, 0);
    };

    if ('requestIdleCallback' in window) {
      idleHandle = window.requestIdleCallback(startAfterFirstPaint, { timeout: 180 });
    } else {
      window.requestAnimationFrame(startAfterFirstPaint);
    }

    return () => {
      cancelled = true;
      if (paintTimer) window.clearTimeout(paintTimer);
      if (idleHandle && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleHandle);
      window.clearTimeout(styleTimerRef.current);

      removeMarkers(markersRef.current);
      markersRef.current = [];

      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }

      const map = mapRef.current || initializedMap;
      if (map) {
        const handlers = map.__holaHandlers;
        if (handlers) {
          map.off('load', handlers.handleLoad);
          map.off('idle', handlers.handleIdle);
          map.off('error', handlers.handleError);
        }
        map.remove();
      }

      mapRef.current = null;
      maplibreRef.current = null;
      fallbackAppliedRef.current = false;
      fittedRouteKeyRef.current = '';
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !interactiveReady) return;

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
            '<small>' +
              (userLocation.accuracy ? 'Độ chính xác ±' + escapeHtml(userLocation.accuracy) + ' m' : 'Điểm bắt đầu') +
            '</small>' +
          '</div>'
        )
      )
      .addTo(map);
  }, [userLocation, interactiveReady]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !interactiveReady) return;

    const { LngLatBounds } = maplibre;

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
  }, [route, mapStatus, interactiveReady]);

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
      {!interactiveReady && (
        MAPTILER_STATIC_PREVIEW_URL ? (
          <img
            className="map-static-preview"
            src={MAPTILER_STATIC_PREVIEW_URL}
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
