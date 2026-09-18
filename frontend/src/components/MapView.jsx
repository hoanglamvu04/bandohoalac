import { useEffect, useMemo, useRef, useState } from 'react';
import { FullscreenControl, Map as MapLibreMap, Marker, NavigationControl, Popup } from 'maplibre-gl';
import { LocateFixed } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';

const DEFAULT_CENTER = [105.525, 21.005];

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
      zoom: 12,
      attributionControl: true
    });

    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new FullscreenControl(), 'top-right');
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
      element.className = selectedPlaceId === place.id ? 'map-pin active' : 'map-pin';
      element.type = 'button';
      element.setAttribute('aria-label', place.name);
      element.innerHTML = '<span></span>';
      element.addEventListener('click', () => onSelectPlace && onSelectPlace(place));

      const popup = new Popup({ offset: 24, closeButton: false }).setHTML(
        '<div class="map-popup"><strong>' + place.name + '</strong><small>' +
        (place.category || 'Khám phá') + ' · ⭐ ' + (place.rating || '4.8') + '</small></div>'
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
      zoom: Math.max(map.getZoom(), 14),
      duration: 850
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
          dot.className = 'user-location-dot';

          userMarkerRef.current = new Marker({ element: dot })
            .setLngLat([userLocation.lng, userLocation.lat])
            .setPopup(new Popup({ offset: 18 }).setHTML(
              '<div class="map-popup"><strong>Vị trí của bạn</strong><small>Độ chính xác ±' +
              userLocation.accuracy + ' m</small></div>'
            ))
            .addTo(map);

          map.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 14.2, duration: 900 });
        }

        if (onUserLocation) onUserLocation(userLocation);
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
    <div className="map-wrap">
      <div ref={containerRef} className="hola-map" />
      <button className="locate-button" type="button" onClick={locateUser} disabled={locating}>
        <LocateFixed size={18} />
        {locating ? 'Đang định vị...' : 'Vị trí của tôi'}
      </button>
      {locationError ? <div className="map-location-error">{locationError}</div> : null}
    </div>
  );
}
