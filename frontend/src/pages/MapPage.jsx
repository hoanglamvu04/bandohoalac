import { useEffect, useMemo, useState } from 'react';
import {
  Clock3,
  Compass,
  ExternalLink,
  ListFilter,
  LoaderCircle,
  MapPin,
  Navigation,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Route,
  X
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import CategoryBar from '../components/CategoryBar.jsx';
import MapView from '../components/MapView.jsx';
import PlaceCard from '../components/PlaceCard.jsx';
import SearchBox from '../components/SearchBox.jsx';
import { getCategories, getDirections, getNearbyPlaces, getPlaces } from '../services/api.js';

function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Trình duyệt này không hỗ trợ định vị.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: Math.round(position.coords.accuracy),
        timestamp: position.timestamp
      }),
      (error) => {
        const messages = {
          1: 'Bạn cần cho phép truy cập vị trí để chỉ đường.',
          2: 'Không thể xác định vị trí hiện tại.',
          3: 'Yêu cầu định vị đã hết thời gian.'
        };

        reject(new Error(messages[error.code] || 'Không thể lấy vị trí hiện tại.'));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  });
}

function formatRouteDistance(meters) {
  const value = Number(meters) || 0;
  return value >= 1000 ? (value / 1000).toFixed(1) + ' km' : Math.round(value) + ' m';
}

function formatRouteDuration(seconds) {
  const minutes = Math.max(1, Math.round((Number(seconds) || 0) / 60));
  if (minutes < 60) return minutes + ' phút';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours + ' giờ' + (rest ? ' ' + rest + ' phút' : '');
}

export default function MapPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [places, setPlaces] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [selectedId, setSelectedId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [routeData, setRouteData] = useState(null);
  const [routeDestination, setRouteDestination] = useState(null);
  const [routeLoadingId, setRouteLoadingId] = useState(null);
  const [routeError, setRouteError] = useState('');

  useEffect(() => {
    let active = true;

    Promise.allSettled([getPlaces(), getCategories()])
      .then(([placesResult, categoriesResult]) => {
        if (!active) return;

        if (placesResult.status === 'fulfilled') {
          setPlaces(Array.isArray(placesResult.value?.items) ? placesResult.value.items : []);
          setLoadError(false);
        } else {
          setPlaces([]);
          setLoadError(true);
        }

        if (categoriesResult.status === 'fulfilled') {
          setCategories(categoriesResult.value?.items || []);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => places.filter((place) => {
    const categoryOk = category === 'all' || place.category === category;
    const searchable = (place.name + ' ' + (place.category || '') + ' ' + (place.address || '')).toLowerCase();
    return categoryOk && searchable.includes(query.trim().toLowerCase());
  }), [places, category, query]);

  useEffect(() => {
    if (!selectedId && filtered.length) setSelectedId(filtered[0].id);

    if (selectedId && !filtered.some((place) => place.id === selectedId) && !routeDestination) {
      setSelectedId(filtered[0]?.id || null);
    }
  }, [filtered, selectedId, routeDestination]);

  function applySearch(term) {
    const params = new URLSearchParams(searchParams);
    if (term) params.set('q', term); else params.delete('q');
    if (category !== 'all') params.set('category', category); else params.delete('category');
    setSearchParams(params);
  }

  function changeCategory(next) {
    setCategory(next);
    const params = new URLSearchParams(searchParams);
    if (next !== 'all') params.set('category', next); else params.delete('category');
    setSearchParams(params);
  }

  function resetFilters() {
    setQuery('');
    setCategory('all');
    setSearchParams({});
  }

  async function handleUserLocation(location) {
    setUserLocation(location);

    try {
      const data = await getNearbyPlaces(location.lat, location.lng);
      const list = Array.isArray(data) ? data : data?.items;

      if (Array.isArray(list)) {
        setPlaces(list);
        setLoadError(false);
      }
    } catch {
      setLoadError(true);
    }
  }

  async function handleDirections(place) {
    if (!Number.isFinite(Number(place.lat)) || !Number.isFinite(Number(place.lng))) {
      setRouteError('Địa điểm này chưa có tọa độ hợp lệ.');
      return;
    }

    setSelectedId(place.id);
    setRouteDestination(place);
    setRouteLoadingId(place.id);
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
      setSidebarOpen(false);
    } catch (error) {
      setRouteData(null);
      setRouteError(error.message || 'Không thể tính tuyến đường.');
    } finally {
      setRouteLoadingId(null);
    }
  }

  function clearDirections() {
    setRouteData(null);
    setRouteDestination(null);
    setRouteError('');
  }

  const googleDirectionsUrl = routeData && routeDestination
    ? 'https://www.google.com/maps/dir/?api=1&origin=' +
      routeData.origin.lat + ',' + routeData.origin.lng +
      '&destination=' + routeDestination.lat + ',' + routeDestination.lng +
      '&travelmode=driving'
    : '';

  return (
    <main className="map-page premium-map-page">
      <aside className={sidebarOpen ? 'map-sidebar premium-map-sidebar open' : 'map-sidebar premium-map-sidebar'}>
        <div className="map-sidebar-head premium-map-sidebar-head">
          <div>
            <span className="map-live-label"><span className="live-dot" /> LIVE DISCOVERY</span>
            <h1>Khám phá Hòa Lạc</h1>
            <p>Chọn một địa điểm để xem ngay trên bản đồ.</p>
          </div>
          <button className="icon-button desktop-only" onClick={() => setSidebarOpen(false)} title="Ẩn danh sách">
            <PanelLeftClose size={20} />
          </button>
        </div>

        <SearchBox compact value={query} onChange={setQuery} onSubmit={applySearch} />
        <CategoryBar compact active={category} onChange={changeCategory} categories={categories} />

        <div className="map-result-toolbar">
          <div className="map-result-meta">
            <span><ListFilter size={16} /> {filtered.length} địa điểm</span>
            {userLocation && <span><Navigation size={15} /> Đã có vị trí của bạn</span>}
          </div>

          {(query || category !== 'all') && (
            <button className="map-reset-filter" type="button" onClick={resetFilters}>
              <RotateCcw size={14} /> Xóa lọc
            </button>
          )}
        </div>

        <div className="map-list premium-map-list">
          {loading && (
            <>
              <div className="map-card-skeleton" />
              <div className="map-card-skeleton" />
              <div className="map-card-skeleton" />
            </>
          )}

          {!loading && loadError && (
            <div className="empty-state premium-map-empty">
              <Compass size={25} />
              <b>Chưa lấy được dữ liệu bản đồ</b>
              <span>Kiểm tra backend hoặc kết nối database rồi tải lại.</span>
            </div>
          )}

          {!loading && !loadError && !filtered.length && (
            <div className="empty-state premium-map-empty">
              <MapPin size={25} />
              <b>Chưa thấy địa điểm phù hợp</b>
              <span>Thử đổi từ khóa hoặc chọn một danh mục khác.</span>
            </div>
          )}

          {!loading && filtered.map((place, index) => (
            <PlaceCard
              key={place.id}
              place={place}
              index={index}
              compact
              selected={selectedId === place.id}
              onSelect={(item) => setSelectedId(item.id)}
              onDirections={handleDirections}
              directionsActive={routeDestination?.id === place.id && Boolean(routeData)}
              directionsLoading={routeLoadingId === place.id}
            />
          ))}
        </div>
      </aside>

      {!sidebarOpen && (
        <button className="open-sidebar-button premium-open-sidebar" onClick={() => setSidebarOpen(true)}>
          <PanelLeftOpen size={18} /> Danh sách
        </button>
      )}

      <div className="map-stage">
        <div className="map-stage-label">
          <span><MapPin size={15} /> Hòa Lạc</span>
          <b>{filtered.length} điểm đang hiển thị</b>
        </div>

        {routeDestination && (
          <div className="directions-panel">
            <div className="directions-panel-head">
              <div className="directions-icon"><Route size={20} /></div>
              <div>
                <span>CHỈ ĐƯỜNG TỪ VỊ TRÍ CỦA BẠN</span>
                <strong>{routeDestination.name}</strong>
              </div>
              <button type="button" onClick={clearDirections} aria-label="Đóng chỉ đường">
                <X size={17} />
              </button>
            </div>

            {routeLoadingId && (
              <div className="directions-loading">
                <LoaderCircle size={17} className="spin" />
                Đang lấy GPS và tính tuyến đường...
              </div>
            )}

            {routeError && !routeLoadingId && (
              <div className="directions-error">{routeError}</div>
            )}

            {routeData && !routeLoadingId && (
              <>
                <div className="directions-stats">
                  <div><Navigation size={16} /><span><small>Khoảng cách</small><b>{formatRouteDistance(routeData.distanceMeters)}</b></span></div>
                  <div><Clock3 size={16} /><span><small>Dự kiến</small><b>{formatRouteDuration(routeData.durationSeconds)}</b></span></div>
                </div>

                <div className="directions-actions">
                  <button type="button" onClick={() => setSidebarOpen(true)}>
                    <ListFilter size={15} /> Xem danh sách
                  </button>
                  <a href={googleDirectionsUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} /> Mở Google Maps
                  </a>
                </div>
              </>
            )}
          </div>
        )}

        <MapView
          places={filtered}
          selectedPlaceId={selectedId}
          onSelectPlace={(place) => setSelectedId(place.id)}
          onUserLocation={handleUserLocation}
          userLocation={userLocation}
          route={routeData}
        />
      </div>
    </main>
  );
}
