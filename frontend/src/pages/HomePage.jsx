import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Camera,
  Compass,
  GraduationCap,
  Heart,
  Layers3,
  LocateFixed,
  Map,
  MapPin,
  Navigation,
  Plus,
  Search,
  Star,
  TreePine,
  Trophy,
  UtensilsCrossed,
  UsersRound,
  Waves
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getLeaderboard, getPlaces } from '../services/api.js';

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=900&q=84',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=84',
  'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=900&q=84',
  'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=84'
];

const DEMO_PLACES = [
  {
    id: 'demo-fpt',
    name: 'Đại học FPT Hòa Lạc',
    category: 'Giáo dục',
    address: 'Hòa Lạc, Thạch Thất',
    description: 'Khuôn viên hiện đại, không gian xanh rộng lớn.',
    rating: 4.8,
    reviews: 125,
    images: [FALLBACK_IMAGES[0]]
  },
  {
    id: 'demo-dong-mo',
    name: 'Hồ Đồng Mô',
    category: 'Thiên nhiên',
    address: 'Hòa Lạc, Thạch Thất',
    description: 'Điểm đến lý tưởng cho dã ngoại, nghỉ dưỡng cuối tuần.',
    rating: 4.6,
    reviews: 89,
    images: [FALLBACK_IMAGES[1]]
  },
  {
    id: 'demo-lake-coffee',
    name: 'The Lake Coffee',
    category: 'Ẩm thực',
    address: 'Hòa Lạc, Thạch Thất',
    description: 'Quán cà phê view hồ, không gian thoáng đãng.',
    rating: 4.7,
    reviews: 64,
    images: [FALLBACK_IMAGES[2]]
  },
  {
    id: 'demo-hi-tech',
    name: 'Khu Công nghệ cao Hòa Lạc',
    category: 'Công nghệ',
    address: 'Hòa Lạc, Thạch Thất',
    description: 'Trung tâm công nghệ và đổi mới sáng tạo của Việt Nam.',
    rating: 4.5,
    reviews: 98,
    images: [FALLBACK_IMAGES[3]]
  }
];

const FEATURE_CARDS = [
  {
    icon: MapPin,
    title: 'Địa điểm nổi bật',
    text: 'Khám phá các địa điểm quan trọng, tiện ích xung quanh Hòa Lạc.',
    tone: 'blue',
    to: '/map'
  },
  {
    icon: Layers3,
    title: 'Lớp dữ liệu',
    text: 'Xem bản đồ theo nhiều lớp dữ liệu: địa hình, công trình, sông hồ, quy hoạch...',
    tone: 'green',
    to: '/map'
  },
  {
    icon: UsersRound,
    title: 'Cộng đồng Explorer',
    text: 'Kết nối những người cùng quan tâm và xây dựng Hòa Lạc tốt hơn.',
    tone: 'orange',
    to: '/leaderboard'
  },
  {
    icon: Navigation,
    title: 'Dẫn đường thông minh',
    text: 'Tìm đường nhanh chóng với thông tin giao thông cập nhật.',
    tone: 'purple',
    to: '/map'
  }
];

const MAP_LAYERS = [
  { icon: TreePine, label: 'Địa hình', active: true },
  { icon: Navigation, label: 'Đường nội bộ', active: false },
  { icon: Waves, label: 'Sông / hồ', active: true },
  { icon: Building2, label: 'Công trình', active: true },
  { icon: MapPin, label: 'Địa danh', active: true },
  { icon: Navigation, label: 'Đường cấm', active: false }
];

const MAP_TILES = [
  [6496, 3606], [6497, 3606], [6498, 3606],
  [6496, 3607], [6497, 3607], [6498, 3607]
];

function initials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'HM';
}

function FeaturedPlaceCard({ place, index }) {
  const cover = place.images?.[0] || place.image || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
  const categoryTone = ['blue', 'green', 'orange', 'purple'][index % 4];
  const detailHref = String(place.id).startsWith('demo-') ? '/map' : '/place/' + place.id;

  return (
    <article className="home-place-card">
      <div className="home-place-cover">
        <img src={cover} alt="" loading="lazy" />
        <span className={'home-place-category ' + categoryTone}>{place.category || 'Khám phá'}</span>
        <button className="home-place-heart" type="button" aria-label="Lưu địa điểm">
          <Heart size={17} />
        </button>
      </div>
      <div className="home-place-content">
        <Link to={detailHref} className="home-place-title">{place.name}</Link>
        <span className="home-place-address"><MapPin size={13} /> {place.address || 'Hòa Lạc, Thạch Thất'}</span>
        <p>{place.description || 'Địa điểm đáng khám phá trong khu vực Hòa Lạc và vùng phụ cận.'}</p>
        <div className="home-place-footer">
          <strong><Star size={14} fill="currentColor" /> {Number(place.rating || 4.8).toFixed(1)}</strong>
          <span><Camera size={13} /> {Number(place.reviews || place.ratingCount || 0)} đóng góp</span>
        </div>
      </div>
    </article>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [places, setPlaces] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    Promise.allSettled([getPlaces({ limit: 12 }), getLeaderboard(3)])
      .then(([placesResult, leaderboardResult]) => {
        if (!active) return;

        if (placesResult.status === 'fulfilled') {
          setPlaces(Array.isArray(placesResult.value?.items) ? placesResult.value.items : []);
        }

        if (leaderboardResult.status === 'fulfilled') {
          setLeaders(Array.isArray(leaderboardResult.value?.items) ? leaderboardResult.value.items : []);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const displayPlaces = useMemo(() => {
    const source = places.length ? places : DEMO_PLACES;
    return source.slice(0, 4);
  }, [places]);

  const displayLeaders = useMemo(() => {
    if (leaders.length) return leaders.slice(0, 3);

    return [
      { id: 'demo-1', rank: 1, name: 'Chinh Explorer', placesCount: 5, photosCount: 0, points: 1280 },
      { id: 'demo-2', rank: 2, name: 'Diep Local Guide', placesCount: 0, photosCount: 0, points: 40 },
      { id: 'demo-3', rank: 3, name: 'Hola Admin', placesCount: 0, photosCount: 0, points: 0 }
    ];
  }, [leaders]);

  function submitSearch(event) {
    event?.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    navigate('/map' + (params.toString() ? '?' + params.toString() : ''));
  }

  return (
    <main className="reference-home">
      <section className="reference-home-hero">
        <div className="reference-hero-copy">
          <span className="reference-kicker">Bản đồ Hòa Lạc</span>
          <h1>Khám phá Hòa Lạc<br />thông minh hơn.</h1>
          <p>
            Bản đồ số khu vực Hòa Lạc - Thạch Thất và vùng phụ cận.
            Khám phá địa điểm, kết nối cộng đồng và cùng xây dựng
            bản đồ phong phú, chính xác hơn mỗi ngày.
          </p>

          <form className="reference-search" onSubmit={submitSearch}>
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm địa điểm, tuyến đường, khu vực..."
            />
          </form>

          <div className="reference-hero-actions">
            <Link to="/map" className="reference-primary-action">
              <Map size={19} /> Mở bản đồ <ArrowRight size={17} />
            </Link>
            <Link to="/contribute" className="reference-secondary-action">
              <Plus size={20} /> Đóng góp địa điểm
            </Link>
          </div>

          <div className="reference-proof-grid">
            <div>
              <span className="proof-icon"><MapPin size={21} /></span>
              <p><b>Hàng trăm<br />địa điểm</b><small>Được cộng đồng đóng góp</small></p>
            </div>
            <div>
              <span className="proof-icon"><UsersRound size={21} /></span>
              <p><b>Cộng đồng<br />đang phát triển</b><small>Cùng xây dựng Hòa Lạc</small></p>
            </div>
            <div>
              <span className="proof-icon"><Layers3 size={21} /></span>
              <p><b>Đa dạng<br />lớp dữ liệu</b><small>Phục vụ học tập, làm việc</small></p>
            </div>
          </div>
        </div>

        <div className="reference-map-demo" aria-label="Xem trước bản đồ Hola Maps">
          <div className="home-map-tiles" aria-hidden="true">
            {MAP_TILES.map(([x, y]) => (
              <img
                key={x + '-' + y}
                src={'https://tile.openstreetmap.org/13/' + x + '/' + y + '.png'}
                alt=""
              />
            ))}
          </div>
          <div className="home-map-wash" />

          <div className="home-map-search">
            <Search size={16} />
            <span>Tìm địa điểm, tuyến đường, khu vực...</span>
          </div>

          <div className="home-map-status"><i /> LOCAL DATA <span>⌄</span></div>

          <div className="home-layer-panel">
            <div className="home-layer-title">
              <span>LỚP DỮ LIỆU</span><b>7/10</b>
            </div>
            {MAP_LAYERS.map(({ icon: Icon, label, active }) => (
              <div className={active ? 'home-layer-row active' : 'home-layer-row'} key={label}>
                <span><Icon size={15} /></span>
                <div><b>{label}</b><small>{active ? 'Đang hiển thị' : 'Đang ẩn'}</small></div>
                <i />
              </div>
            ))}
          </div>

          <span className="map-demo-pin pin-yellow"><Building2 size={17} /></span>
          <span className="map-demo-pin pin-green"><TreePine size={17} /></span>
          <span className="map-demo-pin pin-blue"><GraduationCap size={17} /></span>
          <span className="map-demo-pin pin-orange"><UtensilsCrossed size={17} /></span>

          <div className="home-map-modes">
            <button className="active" type="button"><Map size={15} /><span>Bản đồ</span></button>
            <button type="button"><Waves size={15} /><span>Vệ tinh</span></button>
            <button type="button"><TreePine size={15} /><span>Địa hình</span></button>
          </div>

          <button className="home-map-locate" type="button"><LocateFixed size={17} /> Vị trí của tôi</button>
          <small className="home-map-attribution">© OpenStreetMap</small>
        </div>
      </section>

      <section className="reference-feature-grid">
        {FEATURE_CARDS.map(({ icon: Icon, title, text, tone, to }) => (
          <Link to={to} className="reference-feature-card" key={title}>
            <span className={'reference-feature-icon ' + tone}><Icon size={25} /></span>
            <div><h3>{title}</h3><p>{text}</p></div>
            <span className="reference-card-arrow"><ArrowRight size={16} /></span>
          </Link>
        ))}
      </section>

      <section className="reference-featured-section">
        <div className="reference-section-head">
          <div>
            <h2>Khám phá nổi bật</h2>
            <p>Những địa điểm được cộng đồng yêu thích tại Hòa Lạc</p>
          </div>
          <Link to="/map">Xem tất cả địa điểm <ArrowRight size={16} /></Link>
        </div>

        {loading && !places.length ? (
          <div className="reference-place-grid">
            {Array.from({ length: 4 }).map((_, index) => <div className="home-card-skeleton" key={index} />)}
          </div>
        ) : (
          <div className="reference-place-grid">
            {displayPlaces.map((place, index) => (
              <FeaturedPlaceCard place={place} index={index} key={place.id} />
            ))}
          </div>
        )}
      </section>

      <section className="reference-community-card">
        <div className="reference-community-copy">
          <div>
            <span className="reference-community-trophy"><Trophy size={24} /></span>
            <span className="reference-kicker">Cộng đồng Hola Explorer</span>
          </div>
          <h2>Cùng xây dựng bản đồ Hòa Lạc</h2>
          <p>
            Mỗi đóng góp của bạn đều giúp bản đồ chính xác và hữu ích hơn cho cộng đồng.
            Tham gia ngay để trở thành một phần của Hola Explorer!
          </p>
          <div className="reference-community-actions">
            <Link to="/leaderboard" className="reference-community-primary">
              <UsersRound size={17} /> Tham gia cộng đồng
            </Link>
            <Link to="/leaderboard" className="reference-community-secondary">Tìm hiểu thêm</Link>
          </div>

          <div className="reference-route-art" aria-hidden="true">
            <span className="route-line" />
            <span className="route-node one"><MapPin size={19} /></span>
            <span className="route-node two"><UsersRound size={19} /></span>
            <span className="route-node three"><MapPin size={19} /></span>
          </div>
        </div>

        <div className="reference-top-explorer">
          <div className="reference-top-head">
            <div><span><Trophy size={17} /></span><b>Top Explorer</b></div>
            <small>Tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}⌄</small>
          </div>

          <div className="reference-top-list">
            {displayLeaders.map((person, index) => (
              <div className="reference-top-row" key={person.id}>
                <span className={'reference-mini-medal medal-' + (index + 1)}>{index + 1}</span>
                <span className="reference-mini-avatar">{initials(person.name)}</span>
                <div>
                  <b>{person.name}</b>
                  <small><MapPin size={10} /> {Number(person.placesCount) || 0} địa điểm <Camera size={10} /> {Number(person.photosCount) || 0} ảnh</small>
                </div>
                <strong>{Number(person.points || 0).toLocaleString('vi-VN')} <small>điểm</small></strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
