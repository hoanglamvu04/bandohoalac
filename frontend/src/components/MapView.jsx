import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FullscreenControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl
} from 'maplibre-gl';
import { AlertTriangle, LocateFixed, RefreshCcw } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';

const DEFAULT_CENTER = [105.525, 21.005];
const DEFAULT_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const FALLBACK_RASTER_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors'
    }
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm'
    }
  ]
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
  if (normalized.includes('trải')) return '🎡';
  return '📍';
}

function removeMarkers(markers) {
  markers.forEach((marker) => marker.remove());
}

export default function MapView({ places = [], selectedPlaceId, onSelectPlace, onUserLocation }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const fallbackAppliedRef = useRef(false);
  const styleTimerRef = useRef(null);

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
    setMapStatus('loading');
    setMapError('');

    try {
      map.setStyle(import.meta.env.VITE_MAP_STYLE_URL || DEFAULT_STYLE_URL);

      window.clearTimeout(styleTimerRef.current);
      styleTimerRef.current = window.setTimeout(() => {
        if (!map.isStyleLoaded()) applyFallbackStyle(map);
      }, 5000);
    } catch (error) {
      console.error('[Hola Maps] Could not reload map style:', error);
      applyFallbackStyle(map, 'Nguồn bản đồ chính gặp lỗi. Đang dùng bản đồ dự phòng.');
    }
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map;

    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: import.meta.env.VITE_MAP_STYLE_URL || DEFAULT_STYLE_URL,
        center: DEFAULT_CENTER,
        zoom: 12.2,
        minZoom: 8,
        maxZoom: 19,
        attributionControl: true
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
      setMapStatus(fallbackAppliedRef.current ? 'fallback-ready' : 'ready');
      if (!fallbackAppliedRef.current) setMapError('');
      window.setTimeout(() => map.resize(), 50);
    };

    const handleStyleData = () => {
      if (map.isStyleLoaded()) {
        window.clearTimeout(styleTimerRef.current);
        setMapStatus(fallbackAppliedRef.current ? 'fallback-ready' : 'ready');
      }
    };

    const handleError = (event) => {
      const message = event?.error?.message || 'Map style request failed.';
      console.error('[Hola Maps] MapLibre error:', event?.error || event);

      if (!fallbackAppliedRef.current && !map.isStyleLoaded()) {
        applyFallbackStyle(map, 'Không tải được nền OpenFreeMap. Hola Maps đã tự chuyển sang nền OpenStreetMap dự phòng.');
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
    map.on('styledata', handleStyleData);
    map.on('error', handleError);

    styleTimerRef.current = window.setTimeout(() => {
      if (!map.isStyleLoaded()) {
        applyFallbackStyle(map, 'Nền bản đồ tải quá lâu. Hola Maps đã chuyển sang nguồn dự phòng.');
      }
    }, 5000);

    return () => {
      window.clearTimeout(styleTimerRef.current);
      removeMarkers(markersRef.current);
      markersRef.current = [];

      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }

      map.off('load', handleLoad);
      map.off('styledata', handleStyleData);
      map.off('error', handleError);
      map.remove();
      mapRef.current = null;
      fallbackAppliedRef.current = false;
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
    const selected = validPlaces.find((place) => place.id === selectedPlaceId);
    if (!map || !selected) return;

    map.flyTo({
      center: [Number(selected.lng), Number(selected.lat)],
      zoom: Math.max(map.getZoom(), 14.4),
      duration: 850,
      essential: true
    });
  }, [selectedPlaceId, validPlaces]);

  function locateUser() {
    if (!navigator.geolocation) {
      setLocationError('Trình duyệt này không hỗ trợ định vị.');
      return;
    }

    setLocating(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
          timestamp: position.timestamp
        };

        const map = mapRef.current;

        if (map) {
          if (userMarkerRef.current) userMarkerRef.current.remove();

          const dot = document.createElement('div');
          dot.className = 'user-location-dot premium-user-location-dot';
          dot.innerHTML = '<span></span>';

          userMarkerRef.current = new Marker({ element: dot })
            .setLngLat([userLocation.lng, userLocation.lat])
            .setPopup(
              new Popup({ offset: 18, className: 'hola-premium-popup' }).setHTML(
                '<div class="map-popup premium-map-popup">' +
                  '<span class="map-popup-category">VỊ TRÍ HIỆN TẠI</span>' +
                  '<strong>Bạn đang ở đây</strong>' +
                  '<small>Độ chính xác ±' + escapeHtml(userLocation.accuracy) + ' m</small>' +
                '</div>'
              )
            )
            .addTo(map);

          map.flyTo({
            center: [userLocation.lng, userLocation.lat],
            zoom: 14.6,
            duration: 900,
            essential: true
          });
        }

        onUserLocation?.(userLocation);
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
        <div className="map-provider-status loading">
          <span className="map-provider-spinner" />
          Đang tải nền bản đồ...
        </div>
      )}

      {showFallback && (
        <div className="map-provider-status fallback">
          <AlertTriangle size={15} />
          <span>{mapError || 'Đang dùng nền bản đồ dự phòng.'}</span>
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
