import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FullscreenControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl
} from 'maplibre-gl';
import { LocateFixed } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';

const DEFAULT_CENTER = [105.525, 21.005];

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

export default function MapView({ places = [], selectedPlaceId, onSelectPlace, onUserLocation }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const validPlaces = useMemo(
    () => places.filter((place) => Number.isFinite(Number(place.lng)) && Number.isFinite(Number(place.lat))),
    [places]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty',
      center: DEFAULT_CENTER,
      zoom: 12.2,
      minZoom: 8,
      maxZoom: 19,
      attributionControl: true
    });

    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new FullscreenControl(), 'top-right');
    map.addControl(new ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-right');
    map.on('load', () => map.resize());

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      if (userMarkerRef.current) userMarkerRef.current.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());

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
      const popup = new Popup({ offset: 22, closeButton: false, className: 'hola-premium-popup' }).setHTML(
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
            .setPopup(new Popup({ offset: 18, className: 'hola-premium-popup' }).setHTML(
              '<div class="map-popup premium-map-popup">' +
                '<span class="map-popup-category">VỊ TRÍ HIỆN TẠI</span>' +
                '<strong>Bạn đang ở đây</strong>' +
                '<small>Độ chính xác ±' + escapeHtml(userLocation.accuracy) + ' m</small>' +
              '</div>'
            ))
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

  return (
    <div className="map-wrap premium-map-wrap">
      <div ref={containerRef} className="hola-map" />

      <button className="locate-button premium-locate-button" type="button" onClick={locateUser} disabled={locating}>
        <LocateFixed size={18} />
        {locating ? 'Đang định vị...' : 'Vị trí của tôi'}
      </button>

      {locationError ? <div className="map-location-error">{locationError}</div> : null}
    </div>
  );
}
