import { useEffect, useRef, useState } from 'react';
import * as maplibre from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { PMTiles, Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  MAP_COVERAGE_BOUNDS,
  isInsideServiceCoverage
} from '../mapConfig.js';
import {
  PMTILES_URL,
  BUILDINGS_PMTILES_URL,
  createPmtilesStyle,
  createFallbackStyle,
  localPmtilesAvailable,
  supplementalBuildingsAvailable
} from '../localBasemap.js';

// Keep the picker on exactly the same MapLibre worker/runtime as the main map.
// Without this explicit worker URL the iframe can boot MapLibre but fail to
// decode vector tiles in production, leaving only the blank background layer.
maplibre.setWorkerUrl(maplibreWorkerUrl);

const DEFAULT_PICKER_LOCATION = { lat: 21.005, lng: 105.525 };

function validCoordinatePair(lat, lng) {
  const y = Number(lat);
  const x = Number(lng);
  return Number.isFinite(y) && Number.isFinite(x) &&
    y >= -90 && y <= 90 && x >= -180 && x <= 180;
}

export default function LocationPicker({ lat, lng, onChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const protocolRef = useRef(null);
  const lastValidRef = useRef({ lat, lng });
  const onChangeRef = useRef(onChange);
  const syncingRef = useRef(false);
  const userDraggingRef = useRef(false);
  const [warning, setWarning] = useState('');
  const [moving, setMoving] = useState(false);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    let cancelled = false;
    let resizeObserver = null;
    let resizeHandler = null;
    let mapInstance = null;
    const resizeTimers = [];

    const clearResizeHooks = () => {
      resizeObserver?.disconnect();
      resizeTimers.forEach((timer) => window.clearTimeout(timer));
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        window.removeEventListener('orientationchange', resizeHandler);
        window.visualViewport?.removeEventListener('resize', resizeHandler);
      }
    };

    (async () => {
      try {
        const sameOriginBasemap = PMTILES_URL.startsWith('/');
        const sameOriginBuildings = BUILDINGS_PMTILES_URL.startsWith('/');
        const [hasLocalPmtiles, hasSupplementalBuildings] = await Promise.all([
          sameOriginBasemap ? Promise.resolve(true) : localPmtilesAvailable(),
          sameOriginBuildings ? Promise.resolve(true) : supplementalBuildingsAvailable()
        ]);

        if (cancelled || !containerRef.current || mapRef.current) return;

        const protocol = new Protocol();
        protocolRef.current = protocol;
        try {
          maplibre.addProtocol('pmtiles', protocol.tile);
        } catch {
          // Protocol may already exist after hot reload/navigation.
        }

        const canUseSupplementalBuildings = hasLocalPmtiles && hasSupplementalBuildings;
        if (hasLocalPmtiles) protocol.add(new PMTiles(PMTILES_URL));
        if (canUseSupplementalBuildings) protocol.add(new PMTiles(BUILDINGS_PMTILES_URL));

        const requestedInside = validCoordinatePair(lat, lng) && isInsideServiceCoverage(lng, lat);
        const initialCenter = requestedInside
          ? [Number(lng), Number(lat)]
          : [DEFAULT_PICKER_LOCATION.lng, DEFAULT_PICKER_LOCATION.lat];

        const map = new maplibre.Map({
          container: containerRef.current,
          style: hasLocalPmtiles
            ? createPmtilesStyle('streets', { includeSupplementalBuildings: canUseSupplementalBuildings })
            : createFallbackStyle(),
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
          pitchWithRotate: false,
          attributionControl: false
        });

        mapInstance = map;
        mapRef.current = map;

        const resizeMap = () => {
          if (cancelled || !mapRef.current) return;
          window.requestAnimationFrame(() => {
            if (!cancelled && mapRef.current) mapRef.current.resize();
          });
        };
        resizeHandler = resizeMap;

        // iOS browsers often report a smaller iframe/map size on the first
        // paint, then expand it after the browser chrome and 100dvh settle.
        // Observe the actual element and resize MapLibre whenever that happens.
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(resizeMap);
          resizeObserver.observe(containerRef.current);
          if (containerRef.current.parentElement) {
            resizeObserver.observe(containerRef.current.parentElement);
          }
        }
        window.addEventListener('resize', resizeMap, { passive: true });
        window.addEventListener('orientationchange', resizeMap, { passive: true });
        window.visualViewport?.addEventListener('resize', resizeMap, { passive: true });

        [0, 80, 180, 360, 700, 1200].forEach((delay) => {
          resizeTimers.push(window.setTimeout(resizeMap, delay));
        });

        map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
        map.touchZoomRotate.disableRotation();

        map.on('load', () => {
          setMapError('');
          resizeMap();
          resizeTimers.push(window.setTimeout(resizeMap, 120));
          resizeTimers.push(window.setTimeout(resizeMap, 420));
        });

        map.on('error', (event) => {
          const message = event?.error?.message || '';
          if (/pmtiles|source|tile|style/i.test(message)) {
            setMapError('Bản đồ nền đang tải lỗi. Bạn vẫn có thể tìm địa điểm hoặc thử tải lại cửa sổ chọn vị trí.');
          }
        });

        lastValidRef.current = {
          lat: initialCenter[1],
          lng: initialCenter[0]
        };

        if (!requestedInside) {
          onChangeRef.current?.({
            lat: initialCenter[1],
            lng: initialCenter[0],
            initial: true
          });
        }

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
      } catch (error) {
        if (!cancelled) {
          console.error('Hola Maps picker failed to initialize:', error);
          setMapError('Không tải được bản đồ HOLA Maps. Vui lòng tải lại hoặc tìm địa điểm bằng ô tìm kiếm.');
        }
      }
    })();

    return () => {
      cancelled = true;
      clearResizeHooks();
      mapInstance?.remove();
      if (mapRef.current === mapInstance) mapRef.current = null;
      protocolRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !validCoordinatePair(lat, lng) || !isInsideServiceCoverage(lng, lat)) return;

    const nextLat = Number(lat);
    const nextLng = Number(lng);
    const current = map.getCenter();
    const changed =
      Math.abs(current.lat - nextLat) > 1e-7 ||
      Math.abs(current.lng - nextLng) > 1e-7;

    lastValidRef.current = { lat: nextLat, lng: nextLng };
    setWarning('');

    if (changed) {
      syncingRef.current = true;
      map.easeTo({
        center: [nextLng, nextLat],
        zoom: Math.max(map.getZoom(), 16.2),
        duration: 420,
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
        {mapError ? <div className="location-picker-map-error">{mapError}</div> : null}
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
