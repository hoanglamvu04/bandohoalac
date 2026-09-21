import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Compass,
  MapPinned,
  Navigation,
  Sparkles,
  Star,
  Users
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import CategoryBar from '../components/CategoryBar.jsx';
import PlaceCard from '../components/PlaceCard.jsx';
import SearchBox from '../components/SearchBox.jsx';
import { getCategories, getPlaces } from '../services/api.js';

export default function HomePage() {
  const navigate = useNavigate();
  const [places, setPlaces] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
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

  const featured = useMemo(() => places.filter((place) => {
    const categoryOk = category === 'all' || place.category === category;
    const haystack = (place.name + ' ' + (place.category || '') + ' ' + (place.address || '')).toLowerCase();
    const queryOk = !query.trim() || haystack.includes(query.trim().toLowerCase());
    return categoryOk && queryOk;
  }).slice(0, 8), [places, query, category]);

  const stats = useMemo(() => {
    const ratings = places.map((place) => Number(place.rating)).filter((rating) => Number.isFinite(rating) && rating > 0);
    const photoCount = places.reduce((sum, place) => sum + (Array.isArray(place.images) ? place.images.length : 0), 0);
    const categoryCount = new Set(places.map((place) => place.category).filter(Boolean)).size;

    return {
      places: places.length,
      photos: photoCount,
      categories: categoryCount,
      rating: ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : '—'
    };
  }, [places]);

  const heroPlaces = places.slice(0, 3);

  function search(term) {
    const params = new URLSearchParams();
    if (term) params.set('q', term);
    if (category !== 'all') params.set('category', category);
    navigate('/map?' + params.toString());
  }

  return (
    <main className="home-page premium-home">
      <section className="premium-hero">
        <div className="hero-noise" />
        <div className="hero-orbit hero-orbit-one" />
        <div className="hero-orbit hero-orbit-two" />

        <div className="premium-hero-copy">
          <div className="hero-badge">
            <span className="live-dot" />
            <span>Dữ liệu địa phương · Hòa Lạc</span>
          </div>

          <span className="eyebrow light"><Sparkles size={15} /> HOLA MAPS · LOCAL DISCOVERY</span>
          <h1>
            Khám phá Hòa Lạc
            <span> bằng trải nghiệm thật.</span>
          </h1>
          <p>
            Tìm quán cafe, homestay, villa, góc check-in và những địa điểm đáng thử
            trên một bản đồ được cập nhật bởi cộng đồng địa phương.
          </p>

          <SearchBox
            value={query}
            onChange={setQuery}
            onSubmit={search}
            placeholder="Tìm cafe, homestay, villa, địa điểm check-in..."
          />

          <div className="hero-actions-row">
            <Link to="/map" className="hero-primary-link">
              <Compass size={18} /> Mở bản đồ khám phá
            </Link>
            <Link to="/contribute" className="hero-secondary-link">
              <Camera size={18} /> Đóng góp địa điểm
            </Link>
          </div>

          <div className="hero-quick">
            <span>Đang được tìm:</span>
            <button onClick={() => search('cafe')}>Cafe</button>
            <button onClick={() => search('homestay')}>Homestay</button>
            <button onClick={() => search('villa')}>Villa</button>
            <button onClick={() => search('check-in')}>Check-in</button>
          </div>
        </div>

        <div className="hero-product-demo" aria-label="Xem trước Hola Maps">
          <div className="hero-map-surface">
            <span className="map-grid-line map-grid-a" />
            <span className="map-grid-line map-grid-b" />
            <span className="map-grid-line map-grid-c" />
            <span className="map-lake" />

            <div className="hero-map-topbar">
              <span><MapPinned size={15} /> Hola Maps</span>
              <b>Hòa Lạc</b>
            </div>

            {heroPlaces.map((place, index) => (
              <div className={'hero-place-dot hero-place-dot-' + (index + 1)} key={place.id}>
                <span>{index === 0 ? '☕' : index === 1 ? '🏡' : '📍'}</span>
              </div>
            ))}

            <div className="hero-map-card">
              <div className="hero-map-card-cover">
                {heroPlaces[0]?.images?.[0]
                  ? <img src={heroPlaces[0].images[0]} alt="" />
                  : <MapPinned size={25} />}
              </div>
              <div>
                <small>Đề xuất gần đây</small>
                <b>{heroPlaces[0]?.name || (loading ? 'Đang tải địa điểm...' : 'Khám phá Hòa Lạc')}</b>
                <span>
                  <Star size={13} fill="currentColor" />
                  {heroPlaces[0]?.rating || 'Mới'} · {heroPlaces[0]?.category || 'Local discovery'}
                </span>
              </div>
            </div>

            <div className="hero-map-compass">
              <Navigation size={17} />
            </div>
          </div>

          <div className="hero-floating-card verification-card">
            <BadgeCheck size={19} />
            <div><b>Community verified</b><span>Dữ liệu có nguồn đóng góp</span></div>
          </div>

          <div className="hero-floating-card explorer-card-mini">
            <Users size={19} />
            <div><b>Hola Explorer</b><span>Cùng xây bản đồ địa phương</span></div>
          </div>
        </div>
      </section>

      <section className="live-stats-strip">
        <div><strong>{stats.places}</strong><span>Địa điểm đang hiển thị</span></div>
        <div><strong>{stats.categories}</strong><span>Nhóm trải nghiệm</span></div>
        <div><strong>{stats.photos}</strong><span>Ảnh cộng đồng</span></div>
        <div><strong>{stats.rating}</strong><span>Điểm đánh giá TB</span></div>
      </section>

      <section className="home-section premium-category-section">
        <div className="section-heading premium-section-heading">
          <div>
            <span className="eyebrow">KHÁM PHÁ THEO SỞ THÍCH</span>
            <h2>Một Hòa Lạc, nhiều cách trải nghiệm.</h2>
            <p>Chọn nhanh một chủ đề để lọc những địa điểm phù hợp với chuyến đi của bạn.</p>
          </div>
          <Link to="/map">Xem toàn bản đồ <ArrowRight size={17} /></Link>
        </div>
        <CategoryBar active={category} onChange={setCategory} categories={categories} />
      </section>

      <section className="home-section premium-featured-section">
        <div className="section-heading premium-section-heading">
          <div>
            <span className="eyebrow">LOCAL PICKS</span>
            <h2>Địa điểm nổi bật quanh Hòa Lạc</h2>
            <p>Thông tin lấy trực tiếp từ hệ thống Hola Maps và dữ liệu đã được xuất bản.</p>
          </div>
          <span className="result-note">{featured.length} địa điểm phù hợp</span>
        </div>

        {loading && (
          <div className="premium-loading-grid">
            {Array.from({ length: 4 }).map((_, index) => <div className="premium-skeleton" key={index} />)}
          </div>
        )}

        {!loading && loadError && (
          <div className="premium-empty-block">
            <MapPinned size={28} />
            <div><b>Chưa kết nối được dữ liệu địa điểm</b><span>Kiểm tra backend rồi tải lại trang.</span></div>
          </div>
        )}

        {!loading && !loadError && !featured.length && (
          <div className="premium-empty-block">
            <Compass size={28} />
            <div><b>Chưa có địa điểm phù hợp</b><span>Thử đổi danh mục hoặc mở bản đồ để tìm rộng hơn.</span></div>
          </div>
        )}

        {!loading && featured.length > 0 && (
          <div className="place-grid premium-place-grid">
            {featured.map((place, index) => <PlaceCard key={place.id} place={place} index={index} />)}
          </div>
        )}
      </section>

      <section className="home-section trust-section">
        <div className="trust-copy">
          <span className="eyebrow">WHY HOLA MAPS</span>
          <h2>Bản đồ địa phương không chỉ là một danh sách địa chỉ.</h2>
          <p>Hola Maps tập trung vào thông tin thực tế: vị trí chính xác, ảnh tại chỗ, trải nghiệm cộng đồng và dữ liệu được kiểm duyệt.</p>
        </div>

        <div className="trust-grid">
          <article>
            <span><MapPinned size={22} /></span>
            <h3>GPS chính xác</h3>
            <p>Địa điểm được gắn tọa độ để tìm kiếm gần bạn và hiển thị trực tiếp trên MapLibre.</p>
          </article>
          <article>
            <span><Camera size={22} /></span>
            <h3>Ảnh thực tế</h3>
            <p>Khuyến khích Explorer bổ sung ảnh tại địa điểm thay vì chỉ dựa vào nội dung quảng cáo.</p>
          </article>
          <article>
            <span><BadgeCheck size={22} /></span>
            <h3>Có kiểm duyệt</h3>
            <p>Đóng góp mới đi qua luồng duyệt trước khi được xuất bản ra cộng đồng.</p>
          </article>
        </div>
      </section>

      <section className="community-banner premium-community-banner">
        <div className="community-icon"><Users size={32} /></div>
        <div>
          <span className="eyebrow light">HOLA EXPLORER</span>
          <h2>Biến trải nghiệm của bạn thành dữ liệu hữu ích cho cả cộng đồng.</h2>
          <p>Gửi địa điểm, ảnh, vị trí GPS và cập nhật thông tin. Điểm đóng góp được ghi nhận sau khi nội dung được duyệt.</p>
          <div className="community-features">
            <span><MapPinned size={16} /> Tạo địa điểm</span>
            <span><Camera size={16} /> Bổ sung ảnh thật</span>
            <span><BadgeCheck size={16} /> Xây uy tín Explorer</span>
          </div>
        </div>
        <Link className="primary-action premium-cta" to="/contribute">Bắt đầu đóng góp <ArrowRight size={18} /></Link>
      </section>
    </main>
  );
}
