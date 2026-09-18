import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BadgeCheck, Camera, MapPinned, Sparkles, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import CategoryBar from '../components/CategoryBar.jsx';
import PlaceCard from '../components/PlaceCard.jsx';
import SearchBox from '../components/SearchBox.jsx';
import { getCategories, getPlaces } from '../services/api.js';
import { DEMO_FALLBACK_PLACES } from '../data/fallbackPlaces.js';

export default function HomePage() {
  const navigate = useNavigate();
  const [places, setPlaces] = useState(DEMO_FALLBACK_PLACES);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    getPlaces()
      .then((data) => {
        if (Array.isArray(data.items) && data.items.length) setPlaces(data.items);
      })
      .catch(() => {});
    getCategories().then((data) => setCategories(data.items || [])).catch(() => {});
  }, []);

  const featured = useMemo(() => places.filter((place) => {
    const categoryOk = category === 'all' || place.category === category;
    const queryOk = !query || (place.name + ' ' + place.category + ' ' + (place.address || '')).toLowerCase().includes(query.toLowerCase());
    return categoryOk && queryOk;
  }).slice(0, 8), [places, query, category]);

  function search(term) {
    const params = new URLSearchParams();
    if (term) params.set('q', term);
    if (category !== 'all') params.set('category', category);
    navigate('/map?' + params.toString());
  }

  return (
    <main className="home-page">
      <section className="hero-section">
        <div className="hero-glow one" />
        <div className="hero-glow two" />

        <div className="hero-content">
          <span className="eyebrow"><Sparkles size={15} /> BẢN ĐỒ KHÁM PHÁ HÒA LẠC</span>
          <h1>Đi đâu ở Hòa Lạc?<br /><span>Hỏi người đã thực sự đến.</span></h1>
          <p className="hero-copy">Ảnh thực tế, kinh nghiệm địa phương và những địa điểm đáng thử — được cập nhật bởi cộng đồng Hola Explorer.</p>
          <SearchBox value={query} onChange={setQuery} onSubmit={search} />

          <div className="hero-quick">
            <span>Gợi ý nhanh:</span>
            <button onClick={() => search('cafe view đẹp')}>Cafe view đẹp</button>
            <button onClick={() => search('villa')}>Villa cuối tuần</button>
            <button onClick={() => search('check-in')}>Check-in</button>
          </div>
        </div>

        <div className="hero-preview">
          <div className="preview-map">
            <span className="preview-road r1" />
            <span className="preview-road r2" />
            <span className="preview-road r3" />
            <span className="preview-water" />
            <span className="preview-pin p1">☕</span>
            <span className="preview-pin p2">🏡</span>
            <span className="preview-pin p3">📸</span>

            <div className="preview-card">
              <span className="preview-thumb">🌿</span>
              <div><b>The Lake Coffee</b><small>⭐ 4.8 · đã khảo sát</small></div>
            </div>
          </div>

          <div className="floating-stat"><BadgeCheck size={18} /><div><b>Địa điểm thật</b><small>Cộng đồng xác minh</small></div></div>
        </div>
      </section>

      <section className="home-section category-section">
        <div className="section-heading">
          <div><span className="eyebrow">KHÁM PHÁ THEO SỞ THÍCH</span><h2>Hôm nay bạn muốn đi đâu?</h2></div>
          <Link to="/map">Xem bản đồ <ArrowRight size={17} /></Link>
        </div>
        <CategoryBar active={category} onChange={setCategory} categories={categories} />
      </section>

      <section className="home-section">
        <div className="section-heading">
          <div><span className="eyebrow">ĐƯỢC CỘNG ĐỒNG YÊU THÍCH</span><h2>Địa điểm nổi bật quanh Hòa Lạc</h2></div>
          <span className="result-note">{featured.length} gợi ý phù hợp</span>
        </div>

        <div className="place-grid">
          {featured.map((place, index) => <PlaceCard key={place.id} place={place} index={index} />)}
        </div>
      </section>

      <section className="community-banner">
        <div className="community-icon"><Users size={32} /></div>
        <div>
          <span className="eyebrow">HOLA EXPLORER</span>
          <h2>Không chỉ xem bản đồ. Hãy cùng xây dựng nó.</h2>
          <p>Đến một quán mới? Chụp ảnh, xác định GPS, chia sẻ trải nghiệm và nhận điểm đóng góp.</p>
          <div className="community-features">
            <span><MapPinned size={16} /> +20 điểm thêm địa điểm</span>
            <span><Camera size={16} /> Điểm cho ảnh thực tế</span>
            <span><BadgeCheck size={16} /> Huy hiệu Explorer</span>
          </div>
        </div>
        <Link className="primary-action" to="/contribute">Bắt đầu đóng góp <ArrowRight size={18} /></Link>
      </section>
    </main>
  );
}
