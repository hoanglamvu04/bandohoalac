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
  const lastValidRef = useRef({ lat, lng });
  const onChangeRef = useRef(onChange);
  const syncingRef = useRef(false);
  const userDraggingRef = useRef(false);
  const [warning, setWarning] = useState('');
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    let cancelled = false;

    (async () => {
      const [maplibre] = await Promise.all([
        import('maplibre-gl'),
        import('maplibre-gl/dist/maplibre-gl.css')
      ]);

      if (cancelled || !containerRef.current || mapRef.current) return;

      const { Map: MapLibreMap, NavigationControl } = maplibre;
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
        maxTileCacheSize: 12,
        dragRotate: false,
        pitchWithRotate: false
      });

      map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      map.touchZoomRotate.disableRotation();

      lastValidRef.current = {
        lat: initialCenter[1],
        lng: initialCenter[0]
      };

      map.on('dragstart', () => {
        userDraggingRef.current = true;
        setMoving(true);
        setWarning('');
      });

      map.on('moveend', () => {
        setMoving(false);

        if (syncingRef.current) {
          syncingRef.current = false;
          return;
        }

        if (!userDraggingRef.current) return;
        userDraggingRef.current = false;

        const next = map.getCenter();

        if (!isInsideServiceCoverage(next.lng, next.lat)) {
          const last = lastValidRef.current;
          syncingRef.current = true;
          map.easeTo({
            center: [last.lng, last.lat],
            duration: 280,
            essential: true
          });
          setWarning('Chỉ được đặt điểm trong vùng hoạt động của Hola Maps.');
          return;
        }

        lastValidRef.current = { lat: next.lat, lng: next.lng };
        setWarning('');
        onChangeRef.current?.({ lat: next.lat, lng: next.lng });
      });

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isInsideServiceCoverage(lng, lat)) return;

    const current = map.getCenter();
    const changed =
      Math.abs(current.lat - lat) > 1e-7 ||
      Math.abs(current.lng - lng) > 1e-7;

    lastValidRef.current = { lat, lng };
    setWarning('');

    if (changed) {
      syncingRef.current = true;
      map.easeTo({
        center: [lng, lat],
        duration: 300,
        essential: true
      });
    }
  }, [lat, lng]);

  return (
    <div className={moving ? 'location-picker is-moving' : 'location-picker'}>
      <div className="location-picker-stage">
        <div ref={containerRef} className="location-picker-map" />
        <div className="location-picker-center-pin" aria-hidden="true">
          <span />
        </div>
        <span className="location-picker-mode">Di chuyển bản đồ để chỉnh vị trí</span>
      </div>
      <span className="location-picker-hint">
        {moving
          ? 'Thả tay để chốt vị trí ở tâm bản đồ…'
          : 'Pin được giữ ở giữa màn hình. Kéo bản đồ tới đúng cổng hoặc vị trí cần đánh dấu.'}
      </span>
      {warning ? <span className="location-picker-warning">{warning}</span> : null}
    </div>
  );
}
