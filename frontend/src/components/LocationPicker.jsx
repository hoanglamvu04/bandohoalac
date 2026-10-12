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
  createFallbackStyle
} from '../localBasemap.js';

// Keep the picker on exactly the same MapLibre worker/runtime as the main map.
// Without this explicit worker URL the iframe can boot MapLibre but fail to
// decode vector tiles in production, leaving only the blank background layer.
maplibre.setWorkerUrl(maplibreWorkerUrl);

const DEFAULT_PICKER_LOCATION = { lat: 21.005, lng: 105.525 };
const BASEMAP_RETRY_LIMIT = 1;
const BASEMAP_VERIFY_DELAYS = [1200, 4200, 8000];

function validCoordinatePair(lat, lng) {
  const y = Number(lat);
  const x = Number(lng);
  return Number.isFinite(y) && Number.isFinite(x) &&
    y >= -90 && y <= 90 && x >= -180 && x <= 180;
}

function withTimeout(promise, timeoutMs, message) {
  let timer = null;

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]).finally(() => {
    if (timer) window.clearTimeout(timer);
  });
}

async function openPmtilesArchive(url, timeoutMs = 6000) {
  const archive = new PMTiles(url);
  await withTimeout(
    archive.getHeader(),
    timeoutMs,
    'PMTiles header timed out: ' + url
  );
  return archive;
}

function hasStreetStyleContract(map) {
  const style = map?.getStyle?.();
  const layers = Array.isArray(style?.layers) ? style.layers : [];
  const hasRoadLayer = layers.some((layer) =>
    layer.source === 'protomaps' &&
    layer['source-layer'] === 'roads' &&
    layer.type === 'line'
  );
  const hasLabelLayer = layers.some((layer) =>
    layer.source === 'protomaps' && layer.type === 'symbol'
  );

  return Boolean(map?.getSource?.('protomaps')) && hasRoadLayer && hasLabelLayer;
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
    let basemapRetryCount = 0;
    let localSourceErrorCount = 0;
    let fallbackActive = false;
    let supplementalBuildingsEnabled = false;
    let basemapArchive = null;
    let buildingsArchive = null;
    const resizeTimers = [];
    const basemapVerifyTimers = [];

    const clearResizeHooks = () => {
      resizeObserver?.disconnect();
      resizeTimers.forEach((timer) => window.clearTimeout(timer));
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        window.removeEventListener('orientationchange', resizeHandler);
        window.visualViewport?.removeEventListener('resize', resizeHandler);
      }
    };

    const clearBasemapVerifyTimers = () => {
      basemapVerifyTimers.splice(0).forEach((timer) => window.clearTimeout(timer));
    };

    (async () => {
      try {
        const protocol = new Protocol();
        protocolRef.current = protocol;
        try {
          maplibre.addProtocol('pmtiles', protocol.tile);
        } catch {
          // Protocol may already exist after hot reload/navigation. The normal
          // production picker loads in its own iframe/window, so this is mostly
          // a development safeguard.
        }

        // Validate the actual PMTiles header instead of assuming a same-origin
        // archive is healthy. This catches a broken range response/reverse proxy
        // before MapLibre ends up rendering only the supplemental buildings.
        try {
          basemapArchive = await openPmtilesArchive(PMTILES_URL);
          if (cancelled) return;
          protocol.add(basemapArchive);
        } catch (error) {
          console.warn('[Hola Maps picker] Base PMTiles preflight failed:', error);
          basemapArchive = null;
        }

        if (basemapArchive) {
          try {
            buildingsArchive = await openPmtilesArchive(BUILDINGS_PMTILES_URL, 5000);
            if (cancelled) return;
            protocol.add(buildingsArchive);
            supplementalBuildingsEnabled = true;
          } catch (error) {
            console.warn('[Hola Maps picker] Supplemental buildings unavailable:', error);
            buildingsArchive = null;
            supplementalBuildingsEnabled = false;
          }
        }

        if (cancelled || !containerRef.current || mapRef.current) return;

        const requestedInside = validCoordinatePair(lat, lng) && isInsideServiceCoverage(lng, lat);
        const initialCenter = requestedInside
          ? [Number(lng), Number(lat)]
          : [DEFAULT_PICKER_LOCATION.lng, DEFAULT_PICKER_LOCATION.lat];

        const map = new maplibre.Map({
          container: containerRef.current,
          style: basemapArchive
            ? createPmtilesStyle('streets', {
                includeSupplementalBuildings: supplementalBuildingsEnabled
              })
            : createFallbackStyle(),
          center: initialCenter,
          zoom: Math.max(DEFAULT_ZOOM, 15.2),
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          maxBounds: MAP_COVERAGE_BOUNDS,
          renderWorldCopies: false,
          refreshExpiredTiles: false,
          fadeDuration: 0,
          maxTileCacheSize: 18,
          dragRotate: false,
          pitchWithRotate: false,
          attributionControl: false
        });

        fallbackActive = !basemapArchive;
        mapInstance = map;
        mapRef.current = map;

        const resizeMap = () => {
          if (cancelled || !mapRef.current) return;
          window.requestAnimationFrame(() => {
            if (!cancelled && mapRef.current) mapRef.current.resize();
          });
        };
        resizeHandler = resizeMap;

        const applyFallback = (reason) => {
          if (cancelled || fallbackActive || !mapRef.current) return;
          fallbackActive = true;
          clearBasemapVerifyTimers();
          console.warn('[Hola Maps picker] Falling back from local basemap:', reason);
          setMapError('Bản đồ nền HOLA Maps đang gặp lỗi. Đã chuyển sang nền dự phòng để bạn vẫn chọn được vị trí.');

          try {
            map.setStyle(createFallbackStyle(), { diff: false });
          } catch (error) {
            console.error('[Hola Maps picker] Fallback style failed:', error);
            setMapError('Không tải được bản đồ nền. Vui lòng tải lại cửa sổ chọn vị trí.');
          }
        };

        const retryLocalBasemap = (reason) => {
          if (cancelled || fallbackActive || !mapRef.current) return;

          if (basemapRetryCount >= BASEMAP_RETRY_LIMIT) {
            applyFallback(reason);
            return;
          }

          basemapRetryCount += 1;
          localSourceErrorCount = 0;
          clearBasemapVerifyTimers();
          setMapError('Bản đồ nền đang tải lại…');
          console.warn('[Hola Maps picker] Retrying local basemap:', reason);

          try {
            // Re-register fresh archive instances with the same protocol so a
            // failed/cached reader cannot leave roads/labels stuck while the
            // optional building archive keeps rendering.
            basemapArchive = new PMTiles(PMTILES_URL);
            protocol.add(basemapArchive);
            if (supplementalBuildingsEnabled) {
              buildingsArchive = new PMTiles(BUILDINGS_PMTILES_URL);
              protocol.add(buildingsArchive);
            }

            map.setStyle(
              createPmtilesStyle('streets', {
                includeSupplementalBuildings: supplementalBuildingsEnabled
              }),
              { diff: false }
            );
          } catch (error) {
            console.error('[Hola Maps picker] Local basemap retry failed:', error);
            applyFallback(error?.message || reason);
          }
        };

        const verifyLocalBasemap = (finalAttempt = false) => {
          if (cancelled || fallbackActive || !mapRef.current) return;

          if (!hasStreetStyleContract(map)) {
            retryLocalBasemap('street style is missing the protomaps roads/label contract');
            return;
          }

          let sourceLoaded = false;
          try {
            sourceLoaded = map.isSourceLoaded('protomaps');
          } catch {
            sourceLoaded = false;
          }

          if (sourceLoaded) {
            localSourceErrorCount = 0;
            clearBasemapVerifyTimers();
            setMapError('');
            return;
          }

          if (finalAttempt) {
            retryLocalBasemap('protomaps source did not finish loading');
          }
        };

        const scheduleBasemapVerification = () => {
          if (fallbackActive || !basemapArchive) return;
          clearBasemapVerifyTimers();

          BASEMAP_VERIFY_DELAYS.forEach((delay, index) => {
            basemapVerifyTimers.push(window.setTimeout(() => {
              verifyLocalBasemap(index === BASEMAP_VERIFY_DELAYS.length - 1);
            }, delay));
          });
        };

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
          resizeMap();
          resizeTimers.push(window.setTimeout(resizeMap, 120));
          resizeTimers.push(window.setTimeout(resizeMap, 420));

          if (fallbackActive) {
            setMapError('Bản đồ HOLA Maps tạm thời không khả dụng. Đang dùng nền dự phòng để chọn vị trí.');
          } else {
            scheduleBasemapVerification();
          }
        });

        map.on('style.load', () => {
          resizeMap();
          if (!fallbackActive && basemapArchive) {
            scheduleBasemapVerification();
          }
        });

        map.on('sourcedata', (event) => {
          if (fallbackActive || event?.sourceId !== 'protomaps') return;
          if (!event.isSourceLoaded) return;

          localSourceErrorCount = 0;
          clearBasemapVerifyTimers();
          setMapError('');
        });

        map.on('error', (event) => {
          const message = event?.error?.message || '';
          const lowerMessage = message.toLowerCase();
          const sourceId = event?.sourceId || event?.source?.id || '';

          if (lowerMessage.includes('webgl')) {
            setMapError('Trình duyệt hiện không hỗ trợ WebGL cho bản đồ.');
            return;
          }

          // Buildings are optional. Their failure must never hide roads/labels.
          if (
            sourceId === 'overture-buildings' ||
            lowerMessage.includes('hoalac-buildings.pmtiles')
          ) {
            if (!supplementalBuildingsEnabled || fallbackActive) return;
            supplementalBuildingsEnabled = false;
            console.warn('[Hola Maps picker] Supplemental buildings failed:', message);

            try {
              map.setStyle(
                createPmtilesStyle('streets', { includeSupplementalBuildings: false }),
                { diff: false }
              );
            } catch (error) {
              console.error('[Hola Maps picker] Could not remove broken building source:', error);
            }
            return;
          }

          const isLocalPmtilesError =
            sourceId === 'protomaps' ||
            lowerMessage.includes('hoalac.pmtiles') ||
            lowerMessage.includes('pmtiles://');

          if (!isLocalPmtilesError || fallbackActive) return;

          localSourceErrorCount += 1;
          console.warn(
            '[Hola Maps picker] Local PMTiles source error',
            localSourceErrorCount,
            message
          );

          // Match the main map's tolerance for transient source errors, but the
          // picker adds one explicit style retry before moving to fallback.
          if (localSourceErrorCount >= 3) {
            retryLocalBasemap(message || 'repeated protomaps source errors');
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
      clearBasemapVerifyTimers();
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
