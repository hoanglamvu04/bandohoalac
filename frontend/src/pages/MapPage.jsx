import { useEffect, useMemo, useState } from 'react';
import { ListFilter, MapPin, Navigation, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import CategoryBar from '../components/CategoryBar.jsx';
import MapView from '../components/MapView.jsx';
import PlaceCard from '../components/PlaceCard.jsx';
import SearchBox from '../components/SearchBox.jsx';
import { getNearbyPlaces, getPlaces } from '../services/api.js';

const fallbackPlaces = [
  { id: '1', name: 'The Lake Coffee', category: 'Cafe', rating: 4.8, address: 'Thạch Hòa, Hòa Lạc', lat: 21.007, lng: 105.525 },
  { id: '2', name: 'Forest View Homestay', category: 'Homestay', rating: 4.9, address: 'Yên Bình, Hòa Lạc', lat: 21.028, lng: 105.497 },
  { id: '3', name: 'Lucia Villa', category: 'Villa', rating: 4.7, address: 'Tiến Xuân, Hòa Lạc', lat: 20.994, lng: 105.478 },
  { id: '4', name: 'Đồi ngắm hoàng hôn', category: 'Check-in', rating: 4.8, address: 'Hòa Lạc, Hà Nội', lat: 21.014, lng: 105.548 },
  { id: '5', name: 'Bếp Nhà Đồi', category: 'Ăn uống', rating: 4.6, address: 'Thạch Hòa, Hòa Lạc', lat: 21.001, lng: 105.512 }
];

export default function MapPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [places, setPlaces] = useState(fallbackPlaces);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [selectedId, setSelectedId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getPlaces()
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.items;
        if (Array.isArray(list) && list.length) setPlaces(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => places.filter((place) => {
    const categoryOk = category === 'all' || place.category === category;
    const searchable = (place.name + ' ' + (place.category || '') + ' ' + (place.address || '')).toLowerCase();
    return categoryOk && searchable.includes(query.trim().toLowerCase());
  }), [places, category, query]);

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

  async function handleUserLocation(location) {
    setUserLocation(location);
    try {
      const data = await getNearbyPlaces(location.lat, location.lng);
      const list = Array.isArray(data) ? data : data?.items;
      if (Array.isArray(list) && list.length) setPlaces(list);
    } catch {
      // Keep local data when the backend is offline.
    }
  }

  return (
    <main className="map-page">
      <aside className={sidebarOpen ? 'map-sidebar open' : 'map-sidebar'}>
        <div className="map-sidebar-head">
          <div><span className="eyebrow">DISCOVERY MAP</span><h1>Khám phá Hòa Lạc</h1></div>
          <button className="icon-button desktop-only" onClick={() => setSidebarOpen(false)} title="Ẩn danh sách"><PanelLeftClose size={20} /></button>
        </div>

        <SearchBox compact value={query} onChange={setQuery} onSubmit={applySearch} />
        <CategoryBar compact active={category} onChange={changeCategory} />

        <div className="map-result-meta">
          <span><ListFilter size={16} /> {filtered.length} địa điểm</span>
          {userLocation && <span><Navigation size={15} /> Đang ưu tiên gần bạn</span>}
        </div>

        <div className="map-list">
          {loading ? <div className="loading-card">Đang tải địa điểm...</div> : null}
          {!loading && !filtered.length ? <div className="empty-state"><MapPin size={25} /><b>Chưa thấy địa điểm phù hợp</b><span>Thử đổi từ khóa hoặc danh mục.</span></div> : null}

          {filtered.map((place, index) => (
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
        <button className="open-sidebar-button" onClick={() => setSidebarOpen(true)}>
          <PanelLeftOpen size={18} /> Danh sách
        </button>
      )}

      <MapView
        places={filtered}
        selectedPlaceId={selectedId}
        onSelectPlace={(place) => setSelectedId(place.id)}
        onUserLocation={handleUserLocation}
      />
    </main>
  );
}
