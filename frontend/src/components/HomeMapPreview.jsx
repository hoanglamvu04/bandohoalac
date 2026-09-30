import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Map as MapIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as maplibre from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  DEFAULT_CENTER,
  MAP_COVERAGE_BOUNDS,
  createLocalBasemapStyle
} from '../mapConfig.js';

maplibre.setWorkerUrl(maplibreWorkerUrl);

function markerTone(category = '') {
  const value = String(category).toLocaleLowerCase('vi-VN');
  if (value.includes('cafe') || value.includes('cà phê')) return 'blue';
  if (value.includes('ăn')) return 'orange';
  if (value.includes('home') || value.includes('villa')) return 'purple';
  if (value.includes('trải') || value.includes('check')) return 'green';
  return 'blue';
}

export default function HomeMapPreview({ places = [] }) {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const resizeObserverRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  const validPlaces = useMemo(() => {
    const seen = new Set();

    return places
      .filter((place) => {
        const lng = Number(place?.lng);
        const lat = Number(place?.lat);
        const id = String(place?.id || '');
        if (!id || seen.has(id) || !Number.isFinite(lng) || !Number.isFinite(lat)) {
          return false;
        }
        seen.add(id);
        return true;
      })
      .slice(0, 10);
  }, [places]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = new maplibre.Map({
      container: containerRef.current,
      style: createLocalBasemapStyle('streets'),
      center: DEFAULT_CENTER,
      zoom: 12.65,
      minZoom: 12.1,
      maxZoom: 16,
      maxBounds: MAP_COVERAGE_BOUNDS,
      interactive: false,
      attributionControl: false,
      renderWorldCopies: false,
      fadeDuration: 0
    });

    mapRef.current = map;
    map.addControl(new maplibre.AttributionControl({ compact: true }), 'bottom-left');

    map.on('load', () => {
      setMapReady(true);
      requestAnimationFrame(() => map.resize());
    });

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserverRef.current = new ResizeObserver(() => {
        if (!mapRef.current) return;
        requestAnimationFrame(() => mapRef.current?.resize());
      });
      resizeObserverRef.current.observe(containerRef.current);
    }

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      setMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    validPlaces.forEach((place) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'home-live-place-marker ' + markerTone(place.category);
      element.title = place.name || 'Địa điểm Hola Maps';
      element.setAttribute('aria-label', 'Xem ' + (place.name || 'địa điểm'));
      element.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        navigate('/map?place=' + encodeURIComponent(place.id));
      });

      const marker = new maplibre.Marker({
        element,
        anchor: 'bottom'
      })
        .setLngLat([Number(place.lng), Number(place.lat)])
        .addTo(map);

      markersRef.current.push(marker);
    });

    if (validPlaces.length === 1) {
      map.jumpTo({
        center: [Number(validPlaces[0].lng), Number(validPlaces[0].lat)],
        zoom: 13.5
      });
      return;
    }

    if (validPlaces.length > 1) {
      const bounds = new maplibre.LngLatBounds();
      validPlaces.forEach((place) => {
        bounds.extend([Number(place.lng), Number(place.lat)]);
      });

      const camera = map.cameraForBounds(bounds, {
        padding: 54,
        maxZoom: 13.35
      });

      if (camera) {
        map.jumpTo({
          center: camera.center,
          // The raster preview source begins at z12. Never let the mobile
          // overview zoom below that threshold or the card becomes blank.
          zoom: Math.max(Number(camera.zoom) || 12.65, 12.2)
        });
      }
    }
  }, [validPlaces, navigate, mapReady]);

  return (
    <div className="reference-map-demo home-live-map-preview" aria-label="Bản đồ trực tiếp Hola Maps">
      <div ref={containerRef} className="home-live-map-canvas" />

      <div className="home-live-map-badge">
        <span className="home-live-map-dot" />
        <div>
          <b>BẢN ĐỒ TRỰC TIẾP</b>
          <small>Dữ liệu địa điểm thật</small>
        </div>
      </div>

      <div className="home-live-map-area">Hòa Lạc + 8 xã lân cận</div>

      <button
        className="home-live-map-open"
        type="button"
        onClick={() => navigate('/map')}
      >
        <MapIcon size={16} />
        Mở bản đồ đầy đủ
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
