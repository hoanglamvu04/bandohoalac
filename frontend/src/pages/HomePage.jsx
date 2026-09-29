import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Camera,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Compass,
  GraduationCap,
  Heart,
  Home,
  Layers3,
  LocateFixed,
  Map,
  MapPin,
  Navigation,
  Plus,
  Search,
  Sparkles,
  Star,
  TreePine,
  Trophy,
  UtensilsCrossed,
  UsersRound,
  Waves
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  addFavorite,
  getHomePlaceSections,
  getLeaderboard,
  getMyFavorites,
  removeFavorite
} from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

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

const CATEGORY_ORDER = [
  'cafe',
  'trai-nghiem',
  'an-uong',
  'homestay',
  'villa',
  'check-in'
];

const CATEGORY_META = {
  cafe: {
    icon: Coffee,
    tone: 'blue',
    description: 'Quán cà phê, góc làm việc và những nơi đáng ngồi lâu.'
  },
  'trai-nghiem': {
    icon: Sparkles,
    tone: 'green',
    description: 'Hoạt động, trải nghiệm địa phương và những điều nên thử.'
  },
  'an-uong': {
    icon: UtensilsCrossed,
    tone: 'orange',
    description: 'Quán ăn, nhà hàng và những món ngon quanh Hòa Lạc.'
  },
  homestay: {
    icon: Home,
    tone: 'purple',
    description: 'Chỗ nghỉ cuối tuần, homestay và không gian thư giãn.'
  },
  villa: {
    icon: Building2,
    tone: 'green',
    description: 'Villa, nhà vườn và lựa chọn nghỉ dưỡng cho nhóm đông.'
  },
  'check-in': {
    icon: Camera,
    tone: 'blue',
    description: 'Điểm ngắm cảnh, chụp ảnh và những góc check-in đẹp.'
  }
};

function categoryMeta(category) {
  return CATEGORY_META[category?.slug] || {
    icon: MapPin,
    tone: 'blue',
    description: 'Những địa điểm đáng khám phá tại Hòa Lạc.'
  };
}

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

function FeaturedPlaceCard({ place, index, tone, initialFavorite = false }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [favorite, setFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const cover = place.images?.[0] || place.image || null;
  const categoryTone = tone || ['blue', 'green', 'orange', 'purple'][index % 4];
  const detailHref = '/place/' + place.id;
  const canFavorite = true;

  useEffect(() => {
    setFavorite(Boolean(user && canFavorite && initialFavorite));
  }, [user?.id, place.id, canFavorite, initialFavorite]);

  async function toggleFavorite(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!canFavorite) return;
    if (!user) {
      showToast('Đăng nhập để lưu địa điểm.', 'info');
      return;
    }
    if (favoriteBusy) return;

    setFavoriteBusy(true);
    try {
      const data = favorite
        ? await removeFavorite(place.id)
        : await addFavorite(place.id);
      setFavorite(Boolean(data?.favorite));
      showToast(data?.favorite ? 'Đã lưu địa điểm.' : 'Đã bỏ lưu địa điểm.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setFavoriteBusy(false);
    }
  }

  return (
    <article className="home-place-card">
      <div className="home-place-cover">
        {cover ? (
          <img src={cover} alt={place.name || 'Ảnh địa điểm'} loading="lazy" />
        ) : (
          <div className="home-place-cover-empty" aria-label="Địa điểm chưa có ảnh thực tế">
            <Camera size={28} />
            <b>Chưa có ảnh thực tế</b>
            <span>Ảnh sẽ xuất hiện sau khi được cộng đồng đóng góp và duyệt.</span>
          </div>
        )}
        <span className={'home-place-category ' + categoryTone}>{place.category || 'Khám phá'}</span>
        <button
          className={favorite ? 'home-place-heart active' : 'home-place-heart'}
          type="button"
          aria-label={favorite ? 'Bỏ lưu địa điểm' : 'Lưu địa điểm'}
          onClick={toggleFavorite}
          disabled={favoriteBusy}
        >
          <Heart size={17} fill={favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="home-place-content">
        <Link to={detailHref} className="home-place-title">{place.name}</Link>
        <span className="home-place-address"><MapPin size={13} /> {place.address || 'Hòa Lạc, Thạch Thất'}</span>
        <p>{place.description || 'Địa điểm đáng khám phá tại Hòa Lạc và 8 xã lân cận.'}</p>
        <div className="home-place-footer">
          <strong>
            <Star size={14} fill="currentColor" />
            {Number(place.rating || 0).toFixed(1)}
            <small>({Number(place.reviews || place.ratingCount || 0)} đánh giá)</small>
          </strong>
          <span><Heart size={13} /> {Number(place.favoriteCount || 0)} lượt lưu</span>
        </div>
      </div>
    </article>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sections, setSections] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    Promise.allSettled([getHomePlaceSections(10), getLeaderboard(3, 'month')])
      .then(([sectionsResult, leaderboardResult]) => {
        if (!active) return;

        if (sectionsResult.status === 'fulfilled') {
          setSections(
            Array.isArray(sectionsResult.value?.sections)
              ? sectionsResult.value.sections
              : []
          );
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

  useEffect(() => {
    let active = true;

    if (!user) {
      setFavoriteIds(new Set());
      return () => {
        active = false;
      };
    }

    getMyFavorites()
      .then((data) => {
        if (!active) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setFavoriteIds(new Set(items.map((place) => String(place.id))));
      })
      .catch(() => {
        if (active) setFavoriteIds(new Set());
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const displaySections = useMemo(
    () => [...sections].sort((a, b) => {
      const aIndex = CATEGORY_ORDER.indexOf(a?.category?.slug);
      const bIndex = CATEGORY_ORDER.indexOf(b?.category?.slug);
      const safeA = aIndex === -1 ? CATEGORY_ORDER.length : aIndex;
      const safeB = bIndex === -1 ? CATEGORY_ORDER.length : bIndex;

      if (safeA !== safeB) return safeA - safeB;
      return String(a?.category?.name || '').localeCompare(
        String(b?.category?.name || ''),
        'vi'
      );
    }),
    [sections]
  );

  const displayLeaders = useMemo(
    () => leaders.slice(0, 3),
    [leaders]
  );

  function scrollCategoryRow(categorySlug, direction) {
    const row = document.getElementById('home-category-' + categorySlug);
    if (!row) return;

    row.scrollBy({
      left: direction * Math.max(row.clientWidth * 0.82, 280),
      behavior: 'smooth'
    });
  }

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
          <span className="reference-kicker">Bản đồ cộng đồng Hòa Lạc</span>
          <h1>Mọi điều về Hòa Lạc,<br />trên một bản đồ.</h1>
          <p>
            Khám phá địa điểm, tuyến đường và những trải nghiệm đáng chú ý
            tại Hòa Lạc và 8 xã lân cận. Cùng cộng đồng đóng góp, cập nhật
            dữ liệu để bản đồ ngày càng đầy đủ, chính xác và hữu ích hơn.
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

      <section className="reference-category-discovery">
        <div className="reference-section-head home-discovery-heading">
          <div>
            <span className="reference-kicker">Khám phá theo sở thích</span>
            <h2>Mỗi danh mục, một hành trình riêng</h2>
            <p>Vuốt ngang từng hàng để xem thêm địa điểm cùng loại tại Hòa Lạc.</p>
          </div>
          <Link to="/map">Xem toàn bộ bản đồ <ArrowRight size={16} /></Link>
        </div>

        {loading && !displaySections.length ? (
          <div className="home-category-loading">
            {Array.from({ length: 3 }).map((_, sectionIndex) => (
              <div className="home-category-skeleton-section" key={sectionIndex}>
                <div className="home-category-skeleton-title" />
                <div className="home-category-track skeleton">
                  {Array.from({ length: 4 }).map((__, cardIndex) => (
                    <div className="home-card-skeleton" key={cardIndex} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : displaySections.length ? (
          <div className="home-category-sections">
            {displaySections.map((section, sectionIndex) => {
              const meta = categoryMeta(section.category);
              const CategoryIcon = meta.icon;
              const slug = section.category?.slug || 'other';

              return (
                <section className="home-category-section" key={slug}>
                  <div className="home-category-heading">
                    <div className="home-category-title">
                      <span className={'home-category-icon ' + meta.tone}>
                        <CategoryIcon size={20} />
                      </span>
                      <div>
                        <span>KHÁM PHÁ</span>
                        <h3>{section.category?.name || 'Địa điểm'}</h3>
                        <p>{meta.description}</p>
                      </div>
                    </div>

                    <div className="home-category-actions">
                      <small>{Number(section.category?.totalCount || section.items?.length || 0)} địa điểm</small>
                      <span className="home-category-scroll-buttons">
                        <button
                          type="button"
                          aria-label={'Lùi danh mục ' + (section.category?.name || '')}
                          onClick={() => scrollCategoryRow(slug, -1)}
                        >
                          <ChevronLeft size={17} />
                        </button>
                        <button
                          type="button"
                          aria-label={'Xem thêm danh mục ' + (section.category?.name || '')}
                          onClick={() => scrollCategoryRow(slug, 1)}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </span>
                      <Link to={'/map?category=' + encodeURIComponent(slug)}>
                        Xem tất cả <ArrowRight size={15} />
                      </Link>
                    </div>
                  </div>

                  <div
                    className="home-category-track"
                    id={'home-category-' + slug}
                    aria-label={'Danh sách ' + (section.category?.name || 'địa điểm')}
                  >
                    {(section.items || []).map((place, placeIndex) => (
                      <FeaturedPlaceCard
                        place={place}
                        index={sectionIndex + placeIndex}
                        tone={meta.tone}
                        initialFavorite={favoriteIds.has(String(place.id))}
                        key={place.id}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="reference-featured-empty">
            <MapPin size={24} />
            <div>
              <b>Chưa có địa điểm theo danh mục</b>
              <p>Khi địa điểm đã duyệt được gắn danh mục, Hola Maps sẽ tự tạo từng hàng khám phá tại đây.</p>
            </div>
            <Link to="/contribute">Đóng góp địa điểm <ArrowRight size={15} /></Link>
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
            {!loading && !displayLeaders.length && (
              <div className="reference-top-empty">
                Chưa có hoạt động được duyệt trong tháng này.
              </div>
            )}
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
