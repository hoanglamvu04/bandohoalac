import { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, RefreshCcw } from 'lucide-react';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MAP_COVERAGE_BOUNDS,
  isInsideServiceCoverage
} from '../mapConfig.js';

const GOOGLE_MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
const GOOGLE_MAP_ID = (import.meta.env.VITE_GOOGLE_MAP_ID || '').trim();

let googleMapsPromise;

function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_KEY) {
      reject(new Error('Thiếu VITE_GOOGLE_MAPS_API_KEY trong frontend/.env'));
      return;
    }

    const existing = document.querySelector('script[data-hola-google-maps]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google.maps), { once: true });
      existing.addEventListener('error', () => reject(new Error('Không tải được Google Maps JavaScript API.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    const params = new URLSearchParams({
      key: GOOGLE_MAPS_KEY,
      v: 'weekly',
      language: 'vi',
      region: 'VN'
    });

    script.src = 'https://maps.googleapis.com/maps/api/js?' + params.toString();
    script.async = true;
    script.defer = true;
    script.dataset.holaGoogleMaps = 'true';
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error('Không tải được Google Maps JavaScript API.'));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

function emptyFeatureCollection() {
  return { type: 'FeatureCollection', features: [] };
}

function boundsLiteral() {
  return {
    west: MAP_COVERAGE_BOUNDS[0][0],
    south: MAP_COVERAGE_BOUNDS[0][1],
    east: MAP_COVERAGE_BOUNDS[1][0],
    north: MAP_COVERAGE_BOUNDS[1][1]
  };
}

function getGoogleMapType(mode) {
  if (mode === 'satellite') return 'satellite';
  if (mode === 'hybrid') return 'hybrid';
  if (mode === 'terrain') return 'terrain';
  return 'roadmap';
}

function layerVisible(activeLayers, type) {
  return activeLayers.includes(type);
}

function featureStyle(feature, activeLayers) {
  const type = String(feature.getProperty('layerType') || '');
  if (!layerVisible(activeLayers, type)) return { visible: false };

  const severity = String(feature.getProperty('severity') || 'INFO');

  if (type === 'FLOOD') {
    const fillColor = severity === 'CRITICAL' ? '#be123c'
      : severity === 'HIGH' ? '#dc2626'
        : severity === 'MEDIUM' ? '#f59e0b'
          : '#38bdf8';

    return {
      visible: true,
      fillColor,
      fillOpacity: 0.25,
      strokeColor: fillColor,
      strokeOpacity: 0.9,
      strokeWeight: 2
    };
  }

  if (type === 'ROAD_CLOSURE') {
    return {
      visible: true,
      strokeColor: '#dc2626',
      strokeOpacity: 1,
      strokeWeight: 5
    };
  }

  if (type === 'ROAD') {
    return {
      visible: true,
      strokeColor: '#334155',
      strokeOpacity: 0.9,
      strokeWeight: 4
    };
  }

  if (type === 'WATER') {
    return {
      visible: true,
      fillColor: '#42a5c5',
      fillOpacity: 0.35,
      strokeColor: '#2587a4',
      strokeOpacity: 0.8,
      strokeWeight: 1.5
    };
  }

  if (type === 'BUILDING') {
    return {
      visible: true,
      fillColor: '#9d9488',
      fillOpacity: 0.18,
      strokeColor: '#756d63',
      strokeOpacity: 0.4,
      strokeWeight: 1
    };
  }

  if (type === 'PLANNING') {
    return {
      visible: true,
      fillColor: '#7c3aed',
      fillOpacity: 0.12,
      strokeColor: '#6d28d9',
      strokeOpacity: 0.85,
      strokeWeight: 2
    };
  }

  if (type === 'TERRAIN') {
    return {
      visible: true,
      fillColor: '#72a36b',
      fillOpacity: 0.09,
      strokeColor: '#5b8b56',
      strokeOpacity: 0.35,
      strokeWeight: 1
    };
  }

  if (type === 'ALERT') {
    return {
      visible: true,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#dc2626',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        scale: 7
      }
    };
  }

  if (type === 'EVENT') {
    return {
      visible: true,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#7c3aed',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        scale: 7
      }
    };
  }

  if (type === 'LANDMARK') {
    return {
      visible: true,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#0f766e',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        scale: 6
      }
    };
  }

  return { visible: true };
}

function makePlaceIcon(active) {
  return {
    path: 'M12 2C7.6 2 4 5.6 4 10c0 5.7 8 12 8 12s8-6.3 8-12c0-4.4-3.6-8-8-8zm0 11.2A3.2 3.2 0 1 1 12 6.8a3.2 3.2 0 0 1 0 6.4z',
    fillColor: active ? '#103f35' : '#f6c453',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 1.35,
    anchor: new google.maps.Point(12, 22)
  };
}

export default function MapView({
  places = [],
  selectedPlaceId,
  onSelectPlace,
  onUserLocation,
  userLocation,
  route,
  mapData = emptyFeatureCollection(),
  activeLayers = [],
  basemapMode = 'streets',
  onViewportChange
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const dataLayerRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const infoWindowRef = useRef(null);
  const activeLayersRef = useRef(activeLayers);

  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [locating, setLocating] = useState(false);

  const validPlaces = useMemo(
    () => places.filter((place) =>
      Number.isFinite(Number(place.lng)) &&
      Number.isFinite(Number(place.lat)) &&
      isInsideServiceCoverage(place.lng, place.lat)
    ),
    [places]
  );

  useEffect(() => {
    activeLayersRef.current = activeLayers;
    if (dataLayerRef.current) {
      dataLayerRef.current.setStyle((feature) => featureStyle(feature, activeLayersRef.current));
    }
  }, [activeLayers]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    let cancelled = false;
    let idleListener;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;

        const map = new google.maps.Map(containerRef.current, {
          center: { lat: DEFAULT_CENTER[1], lng: DEFAULT_CENTER[0] },
          zoom: Math.round(DEFAULT_ZOOM),
          mapTypeId: getGoogleMapType(basemapMode),
          mapId: GOOGLE_MAP_ID || undefined,
          restriction: {
            latLngBounds: boundsLiteral(),
            strictBounds: true
          },
          minZoom: 11,
          maxZoom: 20,
          fullscreenControl: true,
          mapTypeControl: false,
          streetViewControl: true,
          zoomControl: true,
          scaleControl: true,
          gestureHandling: 'greedy',
          clickableIcons: true,
          backgroundColor: '#eef1ec'
        });

        mapRef.current = map;
        infoWindowRef.current = new google.maps.InfoWindow();

        const dataLayer = new google.maps.Data({ map });
        dataLayer.setStyle((feature) => featureStyle(feature, activeLayersRef.current));
        dataLayer.addListener('click', (event) => {
          const type = event.feature.getProperty('layerType') || 'DATA';
          const name = event.feature.getProperty('name') || 'Dữ liệu Hola Maps';
          const description = event.feature.getProperty('description') || '';

          infoWindowRef.current.setContent(
            '<div class="hm-google-popup">' +
              '<span>' + String(type) + '</span>' +
              '<strong>' + String(name) + '</strong>' +
              (description ? '<p>' + String(description) + '</p>' : '') +
            '</div>'
          );
          infoWindowRef.current.setPosition(event.latLng);
          infoWindowRef.current.open({ map });
        });

        dataLayerRef.current = dataLayer;

        const notifyViewport = () => {
          const bounds = map.getBounds();
          if (!bounds) return;
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          onViewportChange?.({
            west: sw.lng(),
            south: sw.lat(),
            east: ne.lng(),
            north: ne.lat()
          });
        };

        idleListener = map.addListener('idle', notifyViewport);
        setReady(true);
        setMapError('');
      })
      .catch((error) => {
        console.error('[Hola Maps] Google Maps init failed:', error);
        if (!cancelled) setMapError(error.message || 'Không thể khởi tạo Google Maps.');
      });

    return () => {
      cancelled = true;
      if (idleListener) google.maps.event.removeListener(idleListener);
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      userMarkerRef.current?.setMap(null);
      routePolylineRef.current?.setMap(null);
      dataLayerRef.current?.setMap(null);
      mapRef.current = null;
      dataLayerRef.current = null;
      infoWindowRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !ready) return;
    mapRef.current.setMapTypeId(getGoogleMapType(basemapMode));
  }, [basemapMode, ready]);

  useEffect(() => {
    if (!dataLayerRef.current || !ready) return;

    dataLayerRef.current.forEach((feature) => {
      dataLayerRef.current.remove(feature);
    });

    if (mapData?.features?.length) {
      dataLayerRef.current.addGeoJson(mapData);
    }

    dataLayerRef.current.setStyle((feature) => featureStyle(feature, activeLayersRef.current));
  }, [mapData, ready]);

  useEffect(() => {
    if (!mapRef.current || !ready) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = validPlaces.map((place) => {
      const marker = new google.maps.Marker({
        map: mapRef.current,
        position: { lat: Number(place.lat), lng: Number(place.lng) },
        title: place.name,
        icon: makePlaceIcon(selectedPlaceId === place.id),
        optimized: true
      });

      marker.addListener('click', () => {
        onSelectPlace?.(place);
        infoWindowRef.current?.setContent(
          '<div class="hm-google-popup">' +
            '<span>' + String(place.category || 'ĐỊA ĐIỂM') + '</span>' +
            '<strong>' + String(place.name) + '</strong>' +
            '<p>' + String(place.address || 'Hòa Lạc, Hà Nội') + '</p>' +
          '</div>'
        );
        infoWindowRef.current?.open({ map: mapRef.current, anchor: marker });
      });

      return marker;
    });
  }, [validPlaces, selectedPlaceId, onSelectPlace, ready]);

  useEffect(() => {
    if (!mapRef.current || !ready) return;

    userMarkerRef.current?.setMap(null);
    userMarkerRef.current = null;

    if (!userLocation || !Number.isFinite(Number(userLocation.lat)) || !Number.isFinite(Number(userLocation.lng))) {
      return;
    }

    userMarkerRef.current = new google.maps.Marker({
      map: mapRef.current,
      position: { lat: Number(userLocation.lat), lng: Number(userLocation.lng) },
      title: 'Vị trí của tôi',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#2f7df6',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 4,
        scale: 8
      },
      zIndex: 999
    });
  }, [userLocation, ready]);

  useEffect(() => {
    if (!mapRef.current || !ready) return;

    routePolylineRef.current?.setMap(null);
    routePolylineRef.current = null;

    const coordinates = route?.geometry?.coordinates || [];
    if (coordinates.length < 2) return;

    const path = coordinates
      .filter(([lng, lat]) => Number.isFinite(Number(lng)) && Number.isFinite(Number(lat)))
      .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }));

    routePolylineRef.current = new google.maps.Polyline({
      map: mapRef.current,
      path,
      strokeColor: '#0d5144',
      strokeOpacity: 1,
      strokeWeight: 6,
      geodesic: true,
      zIndex: 50
    });

    const bounds = new google.maps.LatLngBounds();
    path.forEach((point) => bounds.extend(point));
    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, {
        top: 110,
        right: 360,
        bottom: 100,
        left: 390
      });
    }
  }, [route, ready]);

  useEffect(() => {
    if (!mapRef.current || !ready || route) return;
    const selected = validPlaces.find((place) => place.id === selectedPlaceId);
    if (!selected) return;

    mapRef.current.panTo({ lat: Number(selected.lat), lng: Number(selected.lng) });
    if ((mapRef.current.getZoom() || 0) < 16) mapRef.current.setZoom(16);
  }, [selectedPlaceId, validPlaces, route, ready]);

  function locateUser() {
    if (!navigator.geolocation) return;
    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
          timestamp: position.timestamp
        };

        onUserLocation?.(location);

        if (isInsideServiceCoverage(location.lng, location.lat) && mapRef.current) {
          mapRef.current.panTo({ lat: location.lat, lng: location.lng });
          mapRef.current.setZoom(16);
        }

        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  return (
    <div className="hm-map-shell hm-google-map-shell">
      <div ref={containerRef} className="hm-map-canvas hm-google-map-canvas" />

      {!ready && !mapError && (
        <div className="hm-map-placeholder">
          <strong>HOLA MAPS</strong>
          <span>Đang tải Google Maps…</span>
        </div>
      )}

      <div className="hm-map-provider">GOOGLE MAPS · HOLA DATA</div>

      <button className="hm-locate" type="button" onClick={locateUser} disabled={locating}>
        <LocateFixed size={18} />
        {locating ? 'Đang định vị' : 'Vị trí của tôi'}
      </button>

      {mapError && (
        <div className="hm-map-error">
          <span>{mapError}</span>
          <button type="button" onClick={() => window.location.reload()}>
            <RefreshCcw size={14} /> Tải lại
          </button>
        </div>
      )}
    </div>
  );
}
