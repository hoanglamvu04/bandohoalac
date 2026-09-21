import { useEffect, useMemo, useState } from 'react';
import {
  Compass,
  ListFilter,
  MapPin,
  Navigation,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import CategoryBar from '../components/CategoryBar.jsx';
import MapView from '../components/MapView.jsx';
import PlaceCard from '../components/PlaceCard.jsx';
import SearchBox from '../components/SearchBox.jsx';
import { getCategories, getNearbyPlaces, getPlaces } from '../services/api.js';

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
    if (selectedId && !filtered.some((place) => place.id === selectedId)) {
      setSelectedId(filtered[0]?.id || null);
    }
  }, [filtered, selectedId]);

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
            {userLocation && <span><Navigation size={15} /> Ưu tiên gần bạn</span>}
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

        <MapView
          places={filtered}
          selectedPlaceId={selectedId}
          onSelectPlace={(place) => setSelectedId(place.id)}
          onUserLocation={handleUserLocation}
        />
      </div>
    </main>
  );
}
