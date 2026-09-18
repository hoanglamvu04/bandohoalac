import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker, NavigationControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function LocationPicker({ lat, lng, onChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty',
      center: [lng, lat],
      zoom: 16
    });
    map.addControl(new NavigationControl(), 'top-right');

    const marker = new Marker({ draggable: true, color: '#f6c453' })
      .setLngLat([lng, lat])
      .addTo(map);

    marker.on('dragend', () => {
      const { lat: newLat, lng: newLng } = marker.getLngLat();
      onChange({ lat: newLat, lng: newLng });
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      marker.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (markerRef.current) {
      const current = markerRef.current.getLngLat();
      if (Math.abs(current.lat - lat) > 1e-9 || Math.abs(current.lng - lng) > 1e-9) {
        markerRef.current.setLngLat([lng, lat]);
        mapRef.current?.setCenter([lng, lat]);
      }
    }
  }, [lat, lng]);

  return (
    <div className="location-picker">
      <div ref={containerRef} className="location-picker-map" />
      <span className="location-picker-hint">Kéo điểm vàng để chỉnh vị trí chính xác trước khi gửi.</span>
    </div>
  );
}
