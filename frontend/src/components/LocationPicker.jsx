import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  MAP_COVERAGE_BOUNDS,
  createLocalBasemapStyle,
  isInsideServiceCoverage
} from '../mapConfig.js';

export default function LocationPicker({ lat, lng, onChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const lastValidRef = useRef({ lat, lng });
  const [warning, setWarning] = useState('');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    let cancelled = false;

    (async () => {
      const [maplibre] = await Promise.all([
        import('maplibre-gl'),
        import('maplibre-gl/dist/maplibre-gl.css')
      ]);

      if (cancelled || !containerRef.current || mapRef.current) return;

      const { Map: MapLibreMap, Marker, NavigationControl } = maplibre;
      const initialInside = isInsideServiceCoverage(lng, lat);
      const initialCenter = initialInside ? [lng, lat] : [105.525, 21.005];

      const map = new MapLibreMap({
        container: containerRef.current,
        style: createLocalBasemapStyle(),
        center: initialCenter,
        zoom: Math.max(DEFAULT_ZOOM, 15.2),
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        maxBounds: MAP_COVERAGE_BOUNDS,
        renderWorldCopies: false,
        refreshExpiredTiles: false,
        fadeDuration: 0,
        maxTileCacheSize: 12
      });

      map.addControl(new NavigationControl(), 'top-right');

      const marker = new Marker({ draggable: true, color: '#f6c453' })
        .setLngLat(initialCenter)
        .addTo(map);

      lastValidRef.current = {
        lat: initialCenter[1],
        lng: initialCenter[0]
      };

      marker.on('dragend', () => {
        const next = marker.getLngLat();

        if (!isInsideServiceCoverage(next.lng, next.lat)) {
          const last = lastValidRef.current;
          marker.setLngLat([last.lng, last.lat]);
          setWarning('Chỉ được đặt điểm trong vùng hoạt động của Hola Maps.');
          return;
        }

        lastValidRef.current = { lat: next.lat, lng: next.lng };
        setWarning('');
        onChange({ lat: next.lat, lng: next.lng });
      });

      mapRef.current = map;
      markerRef.current = marker;
    })();

    return () => {
      cancelled = true;
      markerRef.current?.remove();
      mapRef.current?.remove();
      markerRef.current = null;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!markerRef.current || !isInsideServiceCoverage(lng, lat)) return;

    const current = markerRef.current.getLngLat();
    if (Math.abs(current.lat - lat) > 1e-9 || Math.abs(current.lng - lng) > 1e-9) {
      markerRef.current.setLngLat([lng, lat]);
      mapRef.current?.setCenter([lng, lat]);
      lastValidRef.current = { lat, lng };
      setWarning('');
    }
  }, [lat, lng]);

  return (
    <div className="location-picker">
      <div ref={containerRef} className="location-picker-map" />
      <span className="location-picker-hint">
        Kéo điểm vàng để chỉnh vị trí chính xác trong vùng hoạt động Hola Maps.
      </span>
      {warning ? <span className="location-picker-warning">{warning}</span> : null}
    </div>
  );
}
