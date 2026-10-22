import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Camera,
  Coffee,
  Home,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  UtensilsCrossed
} from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import SeoHead from '../components/SeoHead.jsx';
import { getPlaces } from '../services/api.js';

const VERTICALS = {
  housing: {
    eyebrow: 'HOLA HOUSING',
    title: 'Tìm phòng trọ ở Hòa Lạc',
    description: 'Tập trung phòng trọ, nhà ở và bất động sản quanh khu vực học tập – làm việc, ưu tiên dữ liệu có thể xác minh và mở thẳng trên bản đồ.',
    canonical: 'https://maps.dothihoalac.vn/phong-tro',
    searchPlaceholder: 'Tìm phòng trọ gần FPT, Thạch Hòa...',
    categories: [
      { slug: 'bat-dong-san', label: 'Phòng trọ & BĐS' }
    ],
    quickQueries: ['gần Đại học FPT', 'Thạch Hòa', 'Hòa Lạc'],
    primaryMapHref: '/map?category=bat-dong-san',
    emptyTitle: 'Chưa có phòng trọ phù hợp',
    emptyText: 'Dữ liệu phòng trọ sẽ được bổ sung dần qua đối tác và cộng đồng địa phương.',
    ownerText: 'Bạn có phòng trọ hoặc khu nhà cho thuê?',
    ownerHref: '/doi-tac',
    ownerCta: 'Đăng ký HOLA Partner',
    icon: Home
  },
  food: {
    eyebrow: 'HOLA FOOD',
    title: 'Ăn uống ở Hòa Lạc',
    description: 'Quán ăn và cafe quanh Hòa Lạc trong một danh sách dễ xem, có đánh giá, trạng thái đối tác và liên kết mở trực tiếp trên HOLA Maps.',
    canonical: 'https://maps.dothihoalac.vn/an-uong',
    searchPlaceholder: 'Tìm quán ăn, cafe, ăn đêm...',
    categories: [
      { slug: 'all', label: 'Tất cả' },
      { slug: 'an-uong', label: 'Quán ăn' },
      { slug: 'cafe', label: 'Cafe' }
    ],
    quickQueries: ['gần Đại học FPT', 'ăn đêm', 'cafe làm việc'],
    primaryMapHref: '/map?category=an-uong',
    emptyTitle: 'Chưa có địa điểm phù hợp',
    emptyText: 'Thử từ khóa khác hoặc mở bản đồ để xem toàn bộ địa điểm quanh Hòa Lạc.',
    ownerText: 'Bạn đang kinh doanh quán ăn hoặc cafe?',
    ownerHref: '/doi-tac',
    ownerCta: 'Đưa quán lên HOLA Maps',
    icon: UtensilsCrossed
  }
};

function coverOf(place) {
  return place?.cardImages?.[0]
    || place?.thumbnails?.[0]
    || place?.images?.[0]
    || null;
}

function formatVerified(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
}

function PlaceCard({ place }) {
  const cover = coverOf(place);
  const isMapFeature = Boolean(place?.resultType);

  if (isMapFeature) return null;

  return (
    <article className="local-market-card">
      <Link className="local-market-card-media" to={'/place/' + place.id}>
        {cover ? (
          <img src={cover} alt={place.name || 'Địa điểm Hòa Lạc'} loading="lazy" />
        ) : (
          <span className="local-market-card-empty">
            <Camera size={25} />
            <small>Chưa có ảnh thực tế</small>
          </span>
        )}
        {place.isPartner && (
          <span className="local-market-partner-badge">
            <BadgeCheck size={13} /> HOLA Partner
          </span>
        )}
      </Link>

      <div className="local-market-card-body">
        <div className="local-market-card-topline">
          <span>{place.category || 'Địa điểm'}</span>
          {Number(place.rating || 0) > 0 && (
            <strong><Star size={13} fill="currentColor" /> {Number(place.rating).toFixed(1)}</strong>
          )}
        </div>

        <Link className="local-market-card-title" to={'/place/' + place.id}>{place.name}</Link>
        <p className="local-market-card-address"><MapPin size={14} /> {place.address || 'Hòa Lạc, Hà Nội'}</p>

        {place.priceLevel && <div className="local-market-price">{place.priceLevel}</div>}

        <div className="local-market-card-foot">
          <span>
            {place.lastVerifiedAt
              ? <><ShieldCheck size={13} /> Xác minh {formatVerified(place.lastVerifiedAt)}</>
              : 'Dữ liệu cộng đồng'}
          </span>
          <Link to={'/map?place=' + encodeURIComponent(place.id)}>Xem bản đồ <ArrowRight size={14} /></Link>
        </div>
      </div>
    </article>
  );
}

export default function LocalMarketplacePage() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const mode = location.pathname.startsWith('/an-uong') ? 'food' : 'housing';
  const config = VERTICALS[mode];
  const Icon = config.icon;

  const query = params.get('q') || '';
  const requestedType = params.get('type') || 'all';
  const activeType = config.categories.some((item) => item.slug === requestedType)
    ? requestedType
    : config.categories[0].slug;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    const categorySlugs = mode === 'food'
      ? (activeType === 'all' ? ['an-uong', 'cafe'] : [activeType])
      : ['bat-dong-san'];

    Promise.all(
      categorySlugs.map((category) => getPlaces({
        category,
        q: query || undefined,
        limit: 36
      }, { signal: controller.signal }))
    )
      .then((results) => {
        const seen = new Set();
        const merged = [];

        for (const result of results) {
          for (const item of Array.isArray(result?.items) ? result.items : []) {
            if (item?.resultType || seen.has(String(item.id))) continue;
            seen.add(String(item.id));
            merged.push(item);
          }
        }

        merged.sort((a, b) => {
          if (Boolean(a.isPartner) !== Boolean(b.isPartner)) return a.isPartner ? -1 : 1;
          const ratingDiff = Number(b.rating || 0) - Number(a.rating || 0);
          if (ratingDiff) return ratingDiff;
          return Number(b.reviews || 0) - Number(a.reviews || 0);
        });

        setItems(merged);
      })
      .catch((requestError) => {
        if (requestError?.name !== 'AbortError') {
          setError(requestError?.message || 'Không tải được dữ liệu.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [mode, activeType, query]);

  const partnerCount = useMemo(
    () => items.filter((item) => item.isPartner).length,
    [items]
  );

  function updateType(nextType) {
    const next = new URLSearchParams(params);
    if (!nextType || nextType === 'all') next.delete('type');
    else next.set('type', nextType);
    setParams(next, { replace: true });
  }

  function updateQuery(value) {
    const next = new URLSearchParams(params);
    const cleaned = String(value || '').trim();
    if (cleaned) next.set('q', cleaned);
    else next.delete('q');
    setParams(next, { replace: true });
  }

  function submitSearch(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    updateQuery(form.get('q'));
  }

  return (
    <main className={'local-market-page local-market-page-' + mode}>
      <SeoHead
        title={mode === 'housing' ? 'Phòng trọ Hòa Lạc' : 'Ăn uống Hòa Lạc'}
        description={config.description}
        canonical={config.canonical}
      />

      <section className="local-market-hero">
        <div className="local-market-shell local-market-hero-grid">
          <div>
            <span className="local-market-kicker"><Icon size={15} /> {config.eyebrow}</span>
            <h1>{config.title}</h1>
            <p>{config.description}</p>

            <form className="local-market-search" onSubmit={submitSearch}>
              <Search size={18} />
              <input
                name="q"
                defaultValue={query}
                key={query}
                placeholder={config.searchPlaceholder}
                aria-label={config.searchPlaceholder}
              />
              <button type="submit">Tìm</button>
            </form>

            <div className="local-market-quick">
              {config.quickQueries.map((item) => (
                <button type="button" key={item} onClick={() => updateQuery(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="local-market-hero-side">
            <div className="local-market-hero-symbol"><Icon size={31} /></div>
            <strong>Dữ liệu địa phương, mở trực tiếp trên bản đồ.</strong>
            <p>Ưu tiên địa điểm đối tác và thông tin được cộng đồng cập nhật gần đây.</p>
            <Link to={config.primaryMapHref}>Mở HOLA Maps <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      <section className="local-market-shell local-market-content">
        <div className="local-market-toolbar">
          <div className="local-market-tabs" aria-label="Bộ lọc">
            {config.categories.map((item) => (
              <button
                key={item.slug}
                type="button"
                className={activeType === item.slug ? 'active' : ''}
                onClick={() => updateType(item.slug)}
              >
                {item.slug === 'cafe' && <Coffee size={14} />}
                {item.slug === 'an-uong' && <UtensilsCrossed size={14} />}
                {item.slug === 'bat-dong-san' && <Building2 size={14} />}
                {item.label}
              </button>
            ))}
          </div>

          <div className="local-market-count">
            <b>{items.length}</b> địa điểm
            {partnerCount > 0 && <span> · {partnerCount} Partner</span>}
          </div>
        </div>

        {error && <div className="local-market-state error">{error}</div>}
        {loading && <div className="local-market-state">Đang tải dữ liệu Hòa Lạc…</div>}

        {!loading && !error && items.length > 0 && (
          <div className="local-market-grid">
            {items.map((place) => <PlaceCard key={place.id} place={place} />)}
          </div>
        )}

        {!loading && !error && !items.length && (
          <div className="local-market-empty">
            <Icon size={28} />
            <h2>{config.emptyTitle}</h2>
            <p>{config.emptyText}</p>
            <div>
              <Link to={config.primaryMapHref}>Mở bản đồ</Link>
              <Link to="/contribute">Thêm địa điểm</Link>
            </div>
          </div>
        )}
      </section>

      <section className="local-market-owner">
        <div className="local-market-shell local-market-owner-inner">
          <div>
            <span>DÀNH CHO CHỦ KINH DOANH</span>
            <h2>{config.ownerText}</h2>
            <p>Claim địa điểm, cập nhật thông tin và tham gia chương trình đối tác trên cùng hệ thống HOLA Maps.</p>
          </div>
          <Link to={config.ownerHref}>{config.ownerCta} <ArrowRight size={16} /></Link>
        </div>
      </section>
    </main>
  );
}
