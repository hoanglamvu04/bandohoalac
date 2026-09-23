import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  Clock3,
  Construction,
  ExternalLink,
  Landmark,
  Layers,
  Map as MapIcon,
  MapPin,
  Mountain,
  Navigation,
  Plus,
  Route,
  Search,
  TriangleAlert,
  Waves,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import MapView from '../components/MapView.jsx';
import { getDirections, getMapLayers, getPlaces } from '../services/api.js';

const LAYERS = [
  { type: 'TERRAIN', label: 'Địa hình', icon: Mountain, tone: 'green' },
  { type: 'ROAD', label: 'Đường nội bộ', icon: Route, tone: 'slate' },
  { type: 'WATER', label: 'Sông / hồ', icon: Waves, tone: 'blue' },
  { type: 'BUILDING', label: 'Công trình', icon: Building2, tone: 'stone' },
  { type: 'LANDMARK', label: 'Địa danh', icon: Landmark, tone: 'green' },
  { type: 'FLOOD', label: 'Vùng ngập', icon: Waves, tone: 'cyan' },
  { type: 'ROAD_CLOSURE', label: 'Đường cấm', icon: Construction, tone: 'red' },
  { type: 'ALERT', label: 'Cảnh báo', icon: TriangleAlert, tone: 'orange' },
  { type: 'PLANNING', label: 'Quy hoạch', icon: MapIcon, tone: 'violet' },
  { type: 'EVENT', label: 'Sự kiện', icon: CalendarDays, tone: 'purple' }
];

const DEFAULT_ACTIVE = ['TERRAIN', 'WATER', 'BUILDING', 'LANDMARK', 'FLOOD', 'ROAD_CLOSURE', 'ALERT'];

function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Trình duyệt không hỗ trợ định vị.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: Math.round(position.coords.accuracy),
        timestamp: position.timestamp
      }),
      () => reject(new Error('Không thể lấy vị trí hiện tại.')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  });
}

function formatDistance(meters) {
  const value = Number(meters) || 0;
  return value >= 1000 ? (value / 1000).toFixed(1) + ' km' : Math.round(value) + ' m';
}

function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round((Number(seconds) || 0) / 60));
  if (minutes < 60) return minutes + ' phút';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours + ' giờ' + (rest ? ' ' + rest + ' phút' : '');
}

export default function MapPage() {
  const [places, setPlaces] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [activeLayers, setActiveLayers] = useState(DEFAULT_ACTIVE);
  const [mapData, setMapData] = useState({ type: 'FeatureCollection', features: [] });
  const [viewport, setViewport] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [userLocation, setUserLocation] = useState(null);

  const [routeDestination, setRouteDestination] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');

  useEffect(() => {
    let active = true;
    getPlaces({ limit: 100 })
      .then((data) => {
        if (active) setPlaces(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        if (active) setPlaces([]);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!viewport || !activeLayers.length) {
      setMapData({ type: 'FeatureCollection', features: [] });
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setDataLoading(true);
      getMapLayers({ types: activeLayers, bounds: viewport })
        .then((data) => {
          if (active && data?.type === 'FeatureCollection') setMapData(data);
        })
        .catch(() => {
          if (active) setMapData({ type: 'FeatureCollection', features: [] });
        })
        .finally(() => {
          if (active) setDataLoading(false);
        });
    }, 140);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [viewport, activeLayers]);

  const filteredPlaces = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return places;
    return places.filter((place) => {
      const haystack = [
        place.name,
        place.category,
        place.address,
        place.description
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [places, query]);

  const selectedPlace = useMemo(
    () => places.find((place) => place.id === selectedId) || null,
    [places, selectedId]
  );

  function toggleLayer(type) {
    setActiveLayers((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type]
    );
  }

  async function startDirections(place) {
    if (!place) return;

    setSelectedId(place.id);
    setRouteDestination(place);
    setRouteLoading(true);
    setRouteError('');

    try {
      const origin = userLocation || await getBrowserLocation();
      setUserLocation(origin);

      const route = await getDirections({
        originLat: origin.lat,
        originLng: origin.lng,
        destinationLat: Number(place.lat),
        destinationLng: Number(place.lng),
        profile: 'driving'
      });

      setRouteData(route);
    } catch (error) {
      setRouteData(null);
      setRouteError(error.message || 'Không tính được tuyến đường.');
    } finally {
      setRouteLoading(false);
    }
  }

  function clearRoute() {
    setRouteData(null);
    setRouteDestination(null);
    setRouteError('');
  }

  const googleDirectionsUrl = routeDestination && userLocation
    ? 'https://www.google.com/maps/dir/?api=1&origin=' +
      userLocation.lat + ',' + userLocation.lng +
      '&destination=' + routeDestination.lat + ',' + routeDestination.lng +
      '&travelmode=driving'
    : '';

  return (
    <main className="hm-workspace">
      <MapView
        places={filteredPlaces}
        selectedPlaceId={selectedId}
        onSelectPlace={(place) => setSelectedId(place.id)}
        onUserLocation={setUserLocation}
        userLocation={userLocation}
        route={routeData}
        mapData={mapData}
        activeLayers={activeLayers}
        onViewportChange={setViewport}
      />

      <header className="hm-map-topbar">
        <button
          className="hm-map-menu"
          type="button"
          onClick={() => setLeftOpen((value) => !value)}
          aria-label="Mở lớp dữ liệu"
        >
          <Layers size={19} />
        </button>

        <div className="hm-map-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm địa điểm, tuyến đường, khu vực..."
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Xóa tìm kiếm">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="hm-topbar-status">
          <span className="hm-live-dot" />
          <b>LOCAL DATA</b>
          <span>{dataLoading ? 'Đang đồng bộ…' : mapData.features.length + ' đối tượng'}</span>
        </div>

        <Link className="hm-add-place" to="/contribute">
          <Plus size={17} /> Thêm địa điểm
        </Link>
      </header>

      <aside className={leftOpen ? 'hm-left-panel open' : 'hm-left-panel'}>
        <div className="hm-panel-heading">
          <div>
            <span>HOLA MAPS ENGINE</span>
            <h1>Bản đồ Hòa Lạc</h1>
          </div>
          <button type="button" onClick={() => setLeftOpen(false)}><X size={17} /></button>
        </div>

        <section className="hm-panel-section">
          <div className="hm-section-title">
            <span>LỚP DỮ LIỆU</span>
            <b>{activeLayers.length}/{LAYERS.length}</b>
          </div>

          <div className="hm-layer-grid">
            {LAYERS.map(({ type, label, icon: Icon, tone }) => {
              const active = activeLayers.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  className={active ? 'hm-layer-card active ' + tone : 'hm-layer-card ' + tone}
                  onClick={() => toggleLayer(type)}
                >
                  <span className="hm-layer-icon"><Icon size={17} /></span>
                  <span>
                    <b>{label}</b>
                    <small>{active ? 'Đang hiển thị' : 'Đang ẩn'}</small>
                  </span>
                  <i />
                </button>
              );
            })}
          </div>
        </section>

        <section className="hm-panel-section hm-place-results">
          <div className="hm-section-title">
            <span>ĐỊA ĐIỂM</span>
            <b>{filteredPlaces.length}</b>
          </div>

          <div className="hm-place-list">
            {filteredPlaces.slice(0, 30).map((place) => (
              <button
                key={place.id}
                type="button"
                className={selectedId === place.id ? 'hm-place-row active' : 'hm-place-row'}
                onClick={() => setSelectedId(place.id)}
              >
                <span className="hm-place-thumb">
                  {place.images?.[0]
                    ? <img src={place.images[0]} alt="" />
                    : <MapPin size={17} />}
                </span>
                <span className="hm-place-copy">
                  <small>{place.category || 'Địa điểm'}</small>
                  <b>{place.name}</b>
                  <em>{place.address || 'Hòa Lạc, Hà Nội'}</em>
                </span>
                <span className="hm-place-rating">★ {Number(place.rating || 0).toFixed(1)}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      {selectedPlace && !routeDestination && (
        <section className="hm-place-inspector">
          <button className="hm-inspector-close" type="button" onClick={() => setSelectedId(null)}>
            <X size={16} />
          </button>

          <div className="hm-inspector-kicker">
            <MapPin size={14} /> {selectedPlace.category || 'ĐỊA ĐIỂM'}
          </div>
          <h2>{selectedPlace.name}</h2>
          <p>{selectedPlace.address || 'Hòa Lạc, Hà Nội'}</p>

          <div className="hm-inspector-stats">
            <span><b>★ {Number(selectedPlace.rating || 0).toFixed(1)}</b><small>Đánh giá</small></span>
            <span><b>{selectedPlace.priceLevel || '—'}</b><small>Mức giá</small></span>
          </div>

          <div className="hm-inspector-actions">
            <button type="button" onClick={() => startDirections(selectedPlace)}>
              <Navigation size={16} /> Chỉ đường
            </button>
            <Link to={'/place/' + selectedPlace.id}>
              Chi tiết
            </Link>
          </div>
        </section>
      )}

      {routeDestination && (
        <aside className="hm-route-panel">
          <div className="hm-route-head">
            <span className="hm-route-icon"><Route size={20} /></span>
            <div>
              <small>HOLA ROUTING</small>
              <h2>{routeDestination.name}</h2>
            </div>
            <button type="button" onClick={clearRoute}><X size={17} /></button>
          </div>

          {routeLoading && <div className="hm-route-state">Đang tính tuyến đường nội bộ…</div>}
          {routeError && <div className="hm-route-error">{routeError}</div>}

          {routeData && !routeLoading && (
            <>
              <div className="hm-route-metrics">
                <span><Navigation size={16} /><b>{formatDistance(routeData.distanceMeters)}</b><small>Khoảng cách</small></span>
                <span><Clock3 size={16} /><b>{formatDuration(routeData.durationSeconds)}</b><small>Dự kiến</small></span>
              </div>

              <div className="hm-route-source">
                <span>ENGINE</span>
                <b>{routeData.provider || 'OSRM'}</b>
                <small>Routing riêng của Hola Maps</small>
              </div>

              <div className="hm-route-actions">
                <a href={googleDirectionsUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} /> Mở tiếp bằng Google Maps
                </a>
              </div>
            </>
          )}
        </aside>
      )}

      <div className="hm-map-legend">
        <span><i className="flood" /> Ngập</span>
        <span><i className="closure" /> Đường cấm</span>
        <span><i className="alert" /> Cảnh báo</span>
        <span><i className="planning" /> Quy hoạch</span>
      </div>
    </main>
  );
}
