import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  ChevronRight,
  ExternalLink,
  Globe2,
  MapPin,
  MapPinned,
  Navigation,
  Share2,
  Star
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import MapView from '../components/MapView.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getPublicCollection } from '../services/api.js';

function collectionFocus(places, slug) {
  if (!places.length) {
    return { id: 'collection-' + slug + '-' + places.length, center: [105.52, 21.02], zoom: 11.7 };
  }
  const lngs = places.map((place) => Number(place.lng)).filter(Number.isFinite);
  const lats = places.map((place) => Number(place.lat)).filter(Number.isFinite);
  if (!lngs.length || !lats.length) {
    return { id: 'collection-' + slug + '-' + places.length, center: [105.52, 21.02], zoom: 11.7 };
  }
  const center = [
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
    (Math.min(...lats) + Math.max(...lats)) / 2
  ];
  const spread = Math.max(
    Math.max(...lngs) - Math.min(...lngs),
    Math.max(...lats) - Math.min(...lats)
  );
  const zoom = spread > 0.08 ? 11.5 : spread > 0.035 ? 12.2 : spread > 0.012 ? 13 : 14;
  return { id: 'collection-' + slug + '-' + places.length, center, zoom };
}

export default function PublicCollectionPage() {
  const { slug = '' } = useParams();
  const { showToast } = useToast();
  const [collection, setCollection] = useState(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPublicCollection(slug)
      .then((data) => {
        if (!active) return;
        setCollection(data);
        setSelectedPlaceId(data?.places?.[0]?.id || null);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Không tải được bộ sưu tập.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [slug]);

  const places = useMemo(
    () => Array.isArray(collection?.places) ? collection.places : [],
    [collection?.places]
  );
  const focusRegion = useMemo(
    () => collectionFocus(places, slug),
    [places, slug]
  );

  async function shareCollection() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Đã sao chép link bộ sưu tập.', 'success');
    } catch {
      showToast('Không thể sao chép link. Hãy kiểm tra quyền clipboard.', 'error');
    }
  }

  if (loading) {
    return <main className="hc-public-page page-container"><div className="hc-public-loading">Đang mở bộ sưu tập…</div></main>;
  }

  if (error || !collection) {
    return (
      <main className="hc-public-page page-container">
        <div className="hc-public-not-found">
          <Bookmark size={34} />
          <h1>Không tìm thấy bộ sưu tập</h1>
          <p>{error || 'Bộ sưu tập này không tồn tại hoặc đã chuyển về chế độ riêng tư.'}</p>
          <Link to="/map">Khám phá HOLA MAP <ArrowLeft size={15} /></Link>
        </div>
      </main>
    );
  }

  return (
    <main className="hc-public-page page-container">
      <header className="hc-public-hero">
        <div>
          <span className="hc-eyebrow"><Globe2 size={14} /> HOLA COLLECTIONS · BỘ SƯU TẬP CÔNG KHAI</span>
          <h1>{collection.title}</h1>
          <p>{collection.description || 'Một danh sách địa điểm được chọn lọc trên bản đồ Hòa Lạc.'}</p>
          <div className="hc-public-meta">
            <span><MapPin size={14} /> {places.length} địa điểm</span>
            <span><Bookmark size={14} /> {collection.owner?.name || 'Thành viên HOLA MAP'}</span>
          </div>
        </div>
        <button type="button" className="hc-public-share" onClick={shareCollection}><Share2 size={16} /> Chia sẻ</button>
      </header>

      <section className="hc-public-map-section" id="collection-map">
        <div className="hc-public-map-heading">
          <div><span className="hc-eyebrow">MỞ TRỰC TIẾP TRÊN BẢN ĐỒ</span><h2>Khám phá các điểm đến</h2></div>
          <span><MapPinned size={15} /> {places.length} điểm ghé thăm</span>
        </div>
        <div className="hc-public-map">
          <MapView
            places={places}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={(place) => setSelectedPlaceId(String(place.id))}
            tripStops={places}
            focusRegion={focusRegion}
            activeLayers={[]}
            basemapMode="streets"
          />
        </div>
        <div className="hc-map-legend">
          <span><i className="start" /> Điểm đầu tiên</span>
          <span><i /> Thứ tự ghé thăm</span>
          <small>Chọn marker hoặc địa điểm bên dưới để xem vị trí.</small>
        </div>
      </section>

      <section className="hc-public-places">
        <div className="hc-public-places-heading">
          <div><span className="hc-eyebrow">DANH SÁCH ĐỊA ĐIỂM</span><h2>Các điểm trong bộ sưu tập</h2></div>
          <span>{places.length} địa điểm</span>
        </div>
        {!places.length ? (
          <div className="hc-empty-state"><MapPin size={28} /><b>Bộ sưu tập chưa có địa điểm</b></div>
        ) : (
          <div className="hc-public-place-grid">
            {places.map((place, index) => (
              <article className={String(selectedPlaceId) === String(place.id) ? 'hc-public-place-card active' : 'hc-public-place-card'} key={place.id}>
                <button type="button" className="hc-public-place-select" onClick={() => {
                  setSelectedPlaceId(String(place.id));
                  document.getElementById('collection-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}>
                  <span className="hc-public-place-image">
                    {place.coverImage || place.images?.[0]
                      ? <img src={place.coverImage || place.images[0]} alt="" />
                      : <MapPin size={24} />}
                    <b>{index + 1}</b>
                  </span>
                  <span className="hc-public-place-copy">
                    <small>{place.category || 'Địa điểm'}</small>
                    <strong>{place.name}</strong>
                    <em>{place.address || 'Hòa Lạc, Hà Nội'}</em>
                    {place.rating > 0 && <span className="hc-public-rating"><Star size={12} fill="currentColor" /> {Number(place.rating).toFixed(1)} · {place.reviews || 0} đánh giá</span>}
                  </span>
                </button>
                <div className="hc-public-place-links">
                  <Link to={'/place/' + place.id}>Chi tiết <ExternalLink size={12} /></Link>
                  <Link to={'/map?place=' + place.id}><Navigation size={12} /> Chỉ đường</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="hc-public-footer">
        <span>Được chia sẻ từ <b>HOLA MAPS</b> · Khám phá Hòa Lạc</span>
        <Link to="/map">Mở bản đồ HOLA <ChevronRight size={14} /></Link>
      </footer>
    </main>
  );
}
