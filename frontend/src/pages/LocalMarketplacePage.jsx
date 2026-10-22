import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Camera,
  Coffee,
  Home,
  MapPin,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  UtensilsCrossed
} from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import SeoHead from '../components/SeoHead.jsx';
import {
  getHousingListings,
  getPlaces
} from '../services/api.js';

const VERTICALS = {
  housing: {
    eyebrow: 'HOLA HOUSING',
    title: 'Tìm phòng trọ ở Hòa Lạc',
    description: 'Lọc phòng theo giá, diện tích, tiện ích, trạng thái còn phòng và khoảng cách tới Đại học FPT. Dữ liệu Partner được đóng dấu thời điểm xác minh gần nhất.',
    canonical: 'https://maps.dothihoalac.vn/phong-tro',
    searchPlaceholder: 'Tìm phòng trọ gần FPT, Thạch Hòa...',
    quickQueries: ['phòng trọ gần Đại học FPT', 'phòng trọ Thạch Hòa', 'phòng trọ Hòa Lạc'],
    primaryMapHref: '/map?category=bat-dong-san',
    emptyTitle: 'Chưa có phòng trọ phù hợp',
    emptyText: 'Hãy nới bộ lọc hoặc mở bản đồ để xem toàn bộ địa điểm Bất động sản quanh Hòa Lạc.',
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
    quickQueries: ['quán ăn gần Đại học FPT', 'ăn đêm', 'cafe làm việc'],
    primaryMapHref: '/map?category=an-uong',
    emptyTitle: 'Chưa có địa điểm phù hợp',
    emptyText: 'Thử từ khóa khác hoặc mở bản đồ để xem toàn bộ địa điểm quanh Hòa Lạc.',
    ownerText: 'Bạn đang kinh doanh quán ăn hoặc cafe?',
    ownerHref: '/doi-tac',
    ownerCta: 'Đưa quán lên HOLA Maps',
    icon: UtensilsCrossed
  }
};

const FOOD_CATEGORIES = [
  { slug: 'all', label: 'Tất cả' },
  { slug: 'an-uong', label: 'Quán ăn' },
  { slug: 'cafe', label: 'Cafe' }
];

const HOUSING_FILTER_KEYS = [
  'q',
  'minRent',
  'maxRent',
  'minArea',
  'maxArea',
  'minAvailableRooms',
  'maxDistanceFpt',
  'verifiedWithinDays',
  'availability',
  'availableOnly',
  'airConditioner',
  'waterHeater',
  'privateBathroom',
  'loft',
  'balcony',
  'parking',
  'pets',
  'sort'
];

const AVAILABILITY_LABELS = {
  AVAILABLE: 'Còn phòng',
  LIMITED: 'Sắp hết',
  FULL: 'Hết phòng',
  UNKNOWN: 'Chưa xác nhận'
};

function coverOf(place) {
  return place?.cardImages?.[0]
    || place?.thumbnails?.[0]
    || place?.images?.[0]
    || null;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return new Intl.NumberFormat('vi-VN').format(number) + 'đ';
}

function formatRent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Chưa cập nhật giá';
  if (number >= 1000000) {
    return (number / 1000000).toLocaleString('vi-VN', {
      maximumFractionDigits: 1
    }) + ' triệu/tháng';
  }
  return formatMoney(number) + '/tháng';
}

function formatDistance(value) {
  const meters = Number(value);
  if (!Number.isFinite(meters) || meters <= 0) return '';
  if (meters < 1000) return Math.round(meters) + ' m tới FPT';
  return (meters / 1000).toLocaleString('vi-VN', {
    maximumFractionDigits: 1
  }) + ' km tới FPT';
}

function housingAmenities(housing) {
  if (!housing) return [];
  return [
    [housing.hasAirConditioner, 'Điều hòa'],
    [housing.hasWaterHeater, 'Nóng lạnh'],
    [housing.hasPrivateBathroom, 'Khép kín'],
    [housing.hasLoft, 'Gác'],
    [housing.hasBalcony, 'Ban công'],
    [housing.hasParking, 'Chỗ để xe'],
    [housing.allowsPets, 'Cho nuôi thú cưng']
  ].filter(([enabled]) => enabled === true).map(([, label]) => label);
}

function freshnessText(value) {
  if (!value) return 'Chưa xác minh gần đây';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa xác minh gần đây';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  if (days === 0) return 'Xác minh hôm nay';
  if (days === 1) return 'Xác minh hôm qua';
  if (days < 30) return 'Xác minh ' + days + ' ngày trước';
  return 'Xác minh ' + formatDate(value);
}

function PlaceCard({ place, mode }) {
  const cover = coverOf(place);
  const housing = place.housing || null;
  const amenities = housingAmenities(housing);

  return (
    <article className={'local-market-card ' + (mode === 'housing' ? 'housing-card' : '')}>
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

        {mode === 'housing' && housing && (
          <span className={'housing-availability status-' + String(housing.availabilityStatus || 'UNKNOWN').toLowerCase()}>
            {AVAILABILITY_LABELS[housing.availabilityStatus] || 'Chưa xác nhận'}
            {Number.isFinite(Number(housing.availableRooms)) && housing.availableRooms > 0
              ? ' · ' + housing.availableRooms + ' phòng'
              : ''}
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

        {mode === 'housing' ? (
          <>
            <div className="housing-card-price">{formatRent(housing?.monthlyRent)}</div>

            <div className="housing-card-metrics">
              {housing?.areaM2 && <span>{housing.areaM2} m²</span>}
              {place.distanceToFptM > 0 && <span>{formatDistance(place.distanceToFptM)}</span>}
            </div>

            {!!amenities.length && (
              <div className="housing-amenities">
                {amenities.slice(0, 5).map((item) => <span key={item}>{item}</span>)}
                {amenities.length > 5 && <span>+{amenities.length - 5}</span>}
              </div>
            )}

            {(housing?.electricityPricePerKwh || housing?.waterPricePerPersonMonth) && (
              <div className="housing-utilities">
                {housing.electricityPricePerKwh && (
                  <span>Điện {formatMoney(housing.electricityPricePerKwh)}/kWh</span>
                )}
                {housing.waterPricePerPersonMonth && (
                  <span>Nước {formatMoney(housing.waterPricePerPersonMonth)}/người</span>
                )}
              </div>
            )}
          </>
        ) : (
          place.priceLevel && <div className="local-market-price">{place.priceLevel}</div>
        )}

        <div className="local-market-card-foot">
          <span>
            {mode === 'housing'
              ? <><ShieldCheck size={13} /> {freshnessText(housing?.lastVerifiedAt)}</>
              : place.lastVerifiedAt
                ? <><ShieldCheck size={13} /> Xác minh {formatDate(place.lastVerifiedAt)}</>
                : 'Dữ liệu cộng đồng'}
          </span>
          <Link to={'/map?place=' + encodeURIComponent(place.id)}>Xem bản đồ <ArrowRight size={14} /></Link>
        </div>
      </div>
    </article>
  );
}

function HousingFilters({ params, onSubmit, onReset }) {
  const key = params.toString();

  return (
    <form className="housing-filter-panel" onSubmit={onSubmit} key={key}>
      <div className="housing-filter-head">
        <div>
          <SlidersHorizontal size={18} />
          <span>
            <b>Lọc phòng trọ</b>
            <small>Giá · diện tích · khoảng cách · tiện ích · độ mới dữ liệu</small>
          </span>
        </div>
        <button type="button" onClick={onReset}><RotateCcw size={14} /> Đặt lại</button>
      </div>

      <div className="housing-filter-grid">
        <label className="housing-filter-search">
          <span>Từ khóa</span>
          <input name="q" defaultValue={params.get('q') || ''} placeholder="FPT, Thạch Hòa, khu CNC..." />
        </label>

        <label>
          <span>Giá từ</span>
          <input name="minRent" inputMode="numeric" defaultValue={params.get('minRent') || ''} placeholder="1.500.000" />
        </label>

        <label>
          <span>Giá đến</span>
          <input name="maxRent" inputMode="numeric" defaultValue={params.get('maxRent') || ''} placeholder="3.000.000" />
        </label>

        <label>
          <span>Diện tích từ</span>
          <input name="minArea" inputMode="decimal" defaultValue={params.get('minArea') || ''} placeholder="20" />
        </label>

        <label>
          <span>Tối đa tới FPT</span>
          <select name="maxDistanceFpt" defaultValue={params.get('maxDistanceFpt') || ''}>
            <option value="">Mọi khoảng cách</option>
            <option value="1000">1 km</option>
            <option value="2000">2 km</option>
            <option value="3000">3 km</option>
            <option value="5000">5 km</option>
            <option value="10000">10 km</option>
          </select>
        </label>

        <label>
          <span>Xác minh trong</span>
          <select name="verifiedWithinDays" defaultValue={params.get('verifiedWithinDays') || ''}>
            <option value="">Không giới hạn</option>
            <option value="3">3 ngày</option>
            <option value="7">7 ngày</option>
            <option value="14">14 ngày</option>
            <option value="30">30 ngày</option>
          </select>
        </label>

        <label>
          <span>Trạng thái</span>
          <select name="availability" defaultValue={params.get('availability') || ''}>
            <option value="">Tất cả</option>
            <option value="AVAILABLE">Còn phòng</option>
            <option value="LIMITED">Sắp hết</option>
            <option value="FULL">Hết phòng</option>
            <option value="UNKNOWN">Chưa xác nhận</option>
          </select>
        </label>

        <label>
          <span>Sắp xếp</span>
          <select name="sort" defaultValue={params.get('sort') || 'recommended'}>
            <option value="recommended">Đề xuất</option>
            <option value="rent_asc">Giá thấp trước</option>
            <option value="rent_desc">Giá cao trước</option>
            <option value="distance">Gần FPT trước</option>
            <option value="area_desc">Diện tích lớn trước</option>
            <option value="freshest">Mới xác minh trước</option>
          </select>
        </label>
      </div>

      <div className="housing-filter-toggles">
        {[
          ['availableOnly', 'Chỉ còn phòng'],
          ['airConditioner', 'Điều hòa'],
          ['waterHeater', 'Nóng lạnh'],
          ['privateBathroom', 'Khép kín'],
          ['loft', 'Có gác'],
          ['balcony', 'Ban công'],
          ['parking', 'Chỗ để xe'],
          ['pets', 'Cho nuôi thú cưng']
        ].map(([name, label]) => (
          <label key={name}>
            <input
              type="checkbox"
              name={name}
              value="true"
              defaultChecked={params.get(name) === 'true'}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="housing-filter-actions">
        <button type="submit">Áp dụng bộ lọc</button>
      </div>
    </form>
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
  const activeType = FOOD_CATEGORIES.some((item) => item.slug === requestedType)
    ? requestedType
    : 'all';

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    const request = mode === 'housing'
      ? getHousingListings(
          Object.fromEntries(
            HOUSING_FILTER_KEYS
              .map((key) => [key, params.get(key)])
              .filter(([, value]) => value !== null && value !== '')
          ),
          { signal: controller.signal }
        )
      : Promise.all(
          (activeType === 'all' ? ['an-uong', 'cafe'] : [activeType]).map((category) =>
            getPlaces({
              category,
              q: query || undefined,
              limit: 36
            }, { signal: controller.signal })
          )
        ).then((results) => {
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
          return { items: merged, meta: {} };
        });

    request
      .then((result) => {
        setItems(Array.isArray(result?.items) ? result.items : []);
        setMeta(result?.meta || {});
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
  }, [mode, activeType, params.toString(), query]);

  const partnerCount = useMemo(
    () => mode === 'housing'
      ? Number(meta.partnerCount || 0)
      : items.filter((item) => item.isPartner).length,
    [items, meta.partnerCount, mode]
  );

  const activeHousingFilters = useMemo(
    () => HOUSING_FILTER_KEYS.filter((key) => {
      if (key === 'q' || key === 'sort') return false;
      const value = params.get(key);
      return value !== null && value !== '';
    }).length,
    [params]
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

  function submitFoodSearch(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    updateQuery(form.get('q'));
  }

  function submitHousingFilters(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();

    for (const key of HOUSING_FILTER_KEYS) {
      const value = String(form.get(key) || '').trim();
      if (!value) continue;
      if (key === 'sort' && value === 'recommended') continue;
      next.set(key, value.replace(/[.,\s]/g, (match) => {
        if (['minRent', 'maxRent'].includes(key)) return '';
        return match;
      }));
    }

    setParams(next, { replace: true });
  }

  function resetHousingFilters() {
    setParams(new URLSearchParams(), { replace: true });
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

            {mode === 'food' && (
              <form className="local-market-search" onSubmit={submitFoodSearch}>
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
            )}

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
            <strong>
              {mode === 'housing'
                ? 'Giá thật, tiện ích rõ, biết lần cuối phòng được xác minh.'
                : 'Dữ liệu địa phương, mở trực tiếp trên bản đồ.'}
            </strong>
            <p>
              {mode === 'housing'
                ? 'Khoảng cách tới Đại học FPT được tính trực tiếp từ tọa độ địa điểm trên HOLA Maps.'
                : 'Ưu tiên địa điểm đối tác và thông tin được cộng đồng cập nhật gần đây.'}
            </p>
            <Link to={config.primaryMapHref}>Mở HOLA Maps <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      <section className="local-market-shell local-market-content">
        {mode === 'housing' ? (
          <HousingFilters
            params={params}
            onSubmit={submitHousingFilters}
            onReset={resetHousingFilters}
          />
        ) : (
          <div className="local-market-toolbar">
            <div className="local-market-tabs" aria-label="Bộ lọc">
              {FOOD_CATEGORIES.map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  className={activeType === item.slug ? 'active' : ''}
                  onClick={() => updateType(item.slug)}
                >
                  {item.slug === 'cafe' && <Coffee size={14} />}
                  {item.slug === 'an-uong' && <UtensilsCrossed size={14} />}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="local-market-toolbar local-market-results-toolbar">
          <div className="local-market-count">
            <b>{items.length}</b> địa điểm
            {partnerCount > 0 && <span> · {partnerCount} Partner</span>}
            {mode === 'housing' && Number(meta.structuredCount || 0) > 0 && (
              <span> · {meta.structuredCount} hồ sơ Housing V2</span>
            )}
          </div>

          {mode === 'housing' && activeHousingFilters > 0 && (
            <button className="housing-active-filter-count" type="button" onClick={resetHousingFilters}>
              {activeHousingFilters} bộ lọc đang bật · Xóa
            </button>
          )}
        </div>

        {error && <div className="local-market-state error">{error}</div>}
        {loading && <div className="local-market-state">Đang tải dữ liệu Hòa Lạc…</div>}

        {!loading && !error && items.length > 0 && (
          <div className="local-market-grid">
            {items.map((place) => <PlaceCard key={place.id} place={place} mode={mode} />)}
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
            <p>
              {mode === 'housing'
                ? 'Claim địa điểm để tự cập nhật giá, số phòng trống, điện nước, tiện ích và xác minh tình trạng còn phòng.'
                : 'Claim địa điểm, cập nhật thông tin và tham gia chương trình đối tác trên cùng hệ thống HOLA Maps.'}
            </p>
          </div>
          <Link to={config.ownerHref}>{config.ownerCta} <ArrowRight size={16} /></Link>
        </div>
      </section>
    </main>
  );
}
