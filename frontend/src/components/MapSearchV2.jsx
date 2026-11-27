import { readSearchPreferences, normalizeSearchPreferences, rememberSearch, SEARCH_PREFS_KEY, SEARCH_CATEGORIES } from '../lib/searchPreferences.js';
import { parseHousingIntent } from '../lib/housingIntent.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GraduationCap,
  House,
  Landmark,
  LocateFixed,
  MapPin,
  Navigation,
  Route,
  Search,
  UtensilsCrossed,
  X
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { getHousingListings, getNearbyPlaces, getPlaces } from '../services/api.js';
import { getBestBrowserLocation } from '../utils/geolocation.js';
import { focusHolaMapPoint } from '../mapInteractionBridge.js';
import { trackXHubEvent } from '../lib/xhubAnalytics.js';

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function requiresUserLocation(query) {
  const value = fold(query);
  return value.includes('gan toi') || value.includes('quanh toi') || value.includes('vi tri cua toi');
}

function inferVerticalIntent(query) {
  const value = fold(query);
  if (parseHousingIntent(query).recognized || /(phong tro|nha tro|phong cho thue|nha cho thue|tim tro)/.test(value)) return 'housing';
  if (/(an uong|quan an|nha hang|cafe|coffee|ca phe|an dem|do an)/.test(value)) return 'food';
  return '';
}

function stripHousingIntent(query) {
  return String(query || '')
    .replace(/(?:phòng|phong)\s*(?:trọ|tro)/gi, ' ')
    .replace(/(?:nhà|nha)\s*(?:trọ|tro)/gi, ' ')
    .replace(/(?:phòng|phong|nhà|nha)\s*(?:cho\s*)?(?:thuê|thue)/gi, ' ')
    .replace(/(?:tìm|tim)\s*(?:trọ|tro)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferNearbyCategory(query) {
  const value = fold(query);
  if (/(cafe|coffee|ca phe)/.test(value)) return 'cafe';
  if (/(nha hang|quan an|an uong|do an)/.test(value)) return 'an-uong';
  if (/(truong|dai hoc|hoc vien|mam non)/.test(value)) return 'truong-hoc';
  if (/(benh vien|phong kham|y te|nha thuoc)/.test(value)) return 'y-te';
  if (/(sieu thi|cua hang|tap hoa)/.test(value)) return 'sieu-thi';
  if (/(ngan hang|atm)/.test(value)) return 'ngan-hang-atm';
  if (/(homestay|luu tru|khach san)/.test(value)) return 'homestay';
  if (/(du lich|tham quan|check in)/.test(value)) return 'khu-du-lich';
  if (/(cay xang|tram xang|tram sac)/.test(value)) return 'nhien-lieu-sac';
  return undefined;
}

function isRoad(item) {
  return item?.searchEntityType === 'ROAD' || item?.mapLayerType === 'ROAD' || item?.resultType === 'road';
}

function isLandmark(item) {
  return item?.searchEntityType === 'LANDMARK' || item?.mapLayerType === 'LANDMARK' || item?.resultType === 'landmark';
}

function iconFor(item) {
  if (isRoad(item)) return Route;
  if (isLandmark(item)) return Landmark;
  const category = fold(item?.category + ' ' + item?.categorySlug + ' ' + item?.name);
  if (category.includes('dai hoc') || category.includes('truong') || category.includes('university')) {
    return GraduationCap;
  }
  return MapPin;
}

function resultType(item) {
  if (isRoad(item)) return 'Tuyến đường';
  if (isLandmark(item)) return 'Địa danh';
  return item?.category || 'Địa điểm';
}

async function nearbySearch(query, location) {
  const category = inferNearbyCategory(query);
  let items = [];
  let radius = 2500;

  for (const candidateRadius of [2500, 5000, 12000]) {
    radius = candidateRadius;
    const data = await getNearbyPlaces(location.lat, location.lng, radius, { category });
    items = Array.isArray(data?.items) ? data.items : [];
    if (items.length >= 5 || candidateRadius === 12000) break;
  }

  return {
    items,
    meta: {
      mode: 'near-anchor',
      anchorMode: 'user-location',
      anchor: { name: 'Vị trí của tôi', lat: location.lat, lng: location.lng },
      radius,
      interpretedCategory: category || null
    }
  };
}

export default function MapSearchV2() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const requestRef = useRef(0);
  const rootRef = useRef(null);
  const [preferences,setPreferences]=useState(()=>{try{return readSearchPreferences(window.localStorage);}catch{return normalizeSearchPreferences({});}});
  function changePreferences(next){const v=normalizeSearchPreferences(next);setPreferences(v);try{window.localStorage.setItem(SEARCH_PREFS_KEY,JSON.stringify(v));}catch{/* storage unavailable */}}
  function remember(value){if(preferences.remember)changePreferences(rememberSearch(preferences,value));}
  useEffect(()=>{function dismiss(e){if(rootRef.current&&!rootRef.current.contains(e.target))setOpen(false);}document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss);},[]);

  const topResults = useMemo(() => results.slice(0, 8), [results]);
  const verticalIntent = useMemo(() => inferVerticalIntent(query), [query]);
  const activeVertical = params.get('vertical') || '';

  useEffect(() => {
    if (params.get('q')) return;
    setQuery('');
    setResults([]);
    setMeta(null);
    setError('');
    setOpen(false);
  }, [activeVertical]);

  useEffect(() => {
    const needle = query.trim();
    const requestId = ++requestRef.current;
    if (needle.length < 2) {
      setResults([]);
      setMeta(null);
      setError('');
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');

      try {
        let data;

        if (requiresUserLocation(needle)) {
          const location = await getBestBrowserLocation({ timeout: 9000, targetAccuracy: 80 });
          data = await nearbySearch(needle, location);
        } else if (inferVerticalIntent(needle) === 'housing' || activeVertical === 'housing') {
          const parsed = parseHousingIntent(needle,{force:true});
          if(parsed.invalid)throw new Error('Ngân sách tìm kiếm mâu thuẫn. Hãy kiểm tra lại.');
          data = await getHousingListings(
            { ...parsed.filters, q: parsed.q || undefined, limit: 40 },
            { signal: controller.signal }
          );
        } else {
          data = await getPlaces({ q: needle, limit: 40 }, { signal: controller.signal });
        }

        if (controller.signal.aborted || requestId !== requestRef.current) return;
        setResults(Array.isArray(data?.items) ? data.items : []);
        setMeta(data?.meta || null);
        setOpen(true);
      } catch (searchError) {
        if (!controller.signal.aborted && searchError?.name !== 'AbortError' && requestId === requestRef.current) {
          setResults([]);
          setMeta(null);
          setOpen(true);
          setError(searchError?.message || 'Không tìm kiếm được lúc này.');
        }
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, activeVertical]);

  function clearSearch() {
    requestRef.current += 1;
    setQuery('');
    setResults([]);
    setMeta(null);
    setError('');
    setOpen(false);
  }

  function openVertical(intent = verticalIntent) {
    if (!intent) return;
    // One explicit vertical-filter action; do not double-count a search.
    void trackXHubEvent('filter_used');

    const next = new URLSearchParams(params);
    next.delete('place');
    next.delete('q');

    if (intent === 'housing') {
      next.set('vertical', 'housing');
      next.set('category', 'bat-dong-san');
      const parsed=parseHousingIntent(query,{force:true});
      if(parsed.invalid){setError('Ngân sách tìm kiếm mâu thuẫn.');return;}
      for(const key of ['listingType','propertyType','subtype','furnishing','minRent','maxRent','minPrice','maxPrice','minArea','maxArea','maxDistanceFpt','availability','availableOnly','privateBathroom','parking','partnerOnly','sort'])next.delete(key);
      for(const [key,value] of Object.entries(parsed.filters))next.set(key,value);
      if(parsed.q)next.set('q',parsed.q);
    } else if (intent === 'food') {
      next.set('vertical', 'food');
      next.delete('category');
    }

    remember(query);
    requestRef.current++;
    setQuery('');
    setResults([]);
    setMeta(null);
    setOpen(false);
    setParams(next, { replace: true });
  }

  function chooseResult(item) {
    if (!item) return;
    remember(query);
    requestRef.current++;
    void trackXHubEvent('search_used');
    setOpen(false);

    if (isRoad(item) || isLandmark(item)) {
      focusHolaMapPoint({ lat: item.lat, lng: item.lng, zoom: isRoad(item) ? 16.4 : 16 });
      window.dispatchEvent(new CustomEvent('hola-map-pin', {
        detail: {
          lat: Number(item.lat),
          lng: Number(item.lng),
          title: item.name,
          subtitle: resultType(item),
          source: 'search'
        }
      }));
      return;
    }

    const next = new URLSearchParams(params);
    next.set('place', String(item.id));
    next.delete('q');

    if (item?.categorySlug === 'bat-dong-san' || verticalIntent === 'housing') {
      next.set('vertical', 'housing');
      next.set('category', 'bat-dong-san');
    } else if (['cafe','an-uong'].includes(item?.categorySlug) || verticalIntent === 'food') {
      next.set('vertical', 'food');
      if (item?.categorySlug === 'cafe') next.set('category', 'cafe');
      else if (item?.categorySlug === 'an-uong') next.set('category', 'an-uong');
    }

    if (item?.categorySlug && !['cafe','an-uong','bat-dong-san'].includes(item.categorySlug)) {
      next.delete('vertical'); next.set('category',item.categorySlug);
    }
    setParams(next, { replace: true });
  }

  return (
    <div className="hm-search-v2-wrap" ref={rootRef}>
      <div className={open ? 'hm-search-v2 active' : 'hm-search-v2'}>
        <Search size={19} />
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if(event.key==='Escape'){setOpen(false);return;}
            if (event.key === 'Enter' && (verticalIntent || activeVertical==='housing')) {
              event.preventDefault();
              openVertical(verticalIntent || 'housing');
            } else if(event.key==='Enter'&&query.trim().length>=2&&!requiresUserLocation(query)){
              event.preventDefault();remember(query);requestRef.current++;
              const next=new URLSearchParams(params);next.set('q',query.trim());next.delete('place');setParams(next,{replace:true});setOpen(false);
            }
          }}
          placeholder={activeVertical === 'housing'
            ? 'Tìm phòng trọ, khu vực...'
            : activeVertical === 'food'
              ? 'Tìm quán ăn, cafe...'
              : 'Tìm địa điểm...'}
          aria-label="Tìm kiếm Hola Maps"
        />
        {loading && <span className="hm-search-v2-loading" />}
        {query && !loading && (
          <button type="button" onClick={clearSearch} aria-label="Xóa tìm kiếm"><X size={16} /></button>
        )}
      </div>

      {open && query.trim().length < 2 && <div className="hm-search-v2-dropdown hm-search-preferences">
        <strong>Tìm kiếm nhanh</strong>
        <div className="hm-search-chips">{SEARCH_CATEGORIES.filter(([key])=>preferences.categories.includes(key)).map(([key,label])=><button type="button" key={key} onClick={()=>{const next=new URLSearchParams(params);next.delete('q');next.delete('place');next.set('category',key);if(key==='bat-dong-san')next.set('vertical','housing');else if(['an-uong','cafe'].includes(key))next.set('vertical','food');else next.delete('vertical');setParams(next,{replace:true});setOpen(false);}}>{label}</button>)}</div>
        {preferences.history.length>0&&<><small>Tìm kiếm gần đây</small><div className="hm-search-chips">{preferences.history.map(s=><button type="button" key={s} onClick={()=>setQuery(s)}>{s}</button>)}</div><button type="button" onClick={()=>changePreferences({...preferences,history:[]})}>Xóa lịch sử</button></>}
        <details><summary>Tùy chọn trên thiết bị</summary><label><input type="checkbox" checked={preferences.remember} onChange={e=>changePreferences({...preferences,remember:e.target.checked,history:e.target.checked?preferences.history:[]})}/> Lưu tối đa 8 từ khóa khi chủ động tìm/chọn kết quả</label><p>Không gửi lịch sử/sở thích lên máy chủ. Có thể xóa bất cứ lúc nào.</p><div className="hm-search-chips">{SEARCH_CATEGORIES.map(([key,label])=><button type="button" key={key} aria-pressed={preferences.categories.includes(key)} onClick={()=>changePreferences({...preferences,categories:preferences.categories.includes(key)?preferences.categories.filter(x=>x!==key):[...preferences.categories,key].slice(0,5)})}>{label}</button>)}</div></details>
      </div>}
      {open && query.trim().length >= 2 && (
        <div className="hm-search-v2-dropdown">
          {verticalIntent && (
            <button
              className={'hm-search-v2-vertical hm-search-v2-vertical-' + verticalIntent}
              type="button"
              onClick={() => openVertical(verticalIntent)}
            >
              <span className="hm-search-v2-icon">
                {verticalIntent === 'housing' ? <House size={18} /> : <UtensilsCrossed size={18} />}
              </span>
              <span className="hm-search-v2-copy">
                <strong>
                  {verticalIntent === 'housing'
                    ? 'Xem phòng trọ trực tiếp trên bản đồ'
                    : 'Xem ăn uống trực tiếp trên bản đồ'}
                </strong>
                <small>
                  {verticalIntent === 'housing'
                    ? (parseHousingIntent(query,{force:true}).labels.join(' · ') || 'Giá · còn phòng · khoảng cách FPT · tiện ích')
                    : 'Quán ăn · cafe · đang mở · gần bạn'}
                </small>
              </span>
              <Navigation size={16} />
            </button>
          )}

          {meta?.mode === 'near-anchor' && meta?.anchor?.name && (
            <div className="hm-search-v2-context">
              <Navigation size={14} />
              <span>
                Đang tìm quanh <strong>{meta.anchor.name}</strong>
                {meta.radius ? ' · ' + (meta.radius >= 1000 ? (meta.radius / 1000).toFixed(meta.radius % 1000 ? 1 : 0) + ' km' : meta.radius + ' m') : ''}
              </span>
            </div>
          )}

          {error && <div className="hm-search-v2-empty">{error}</div>}

          {!error && !loading && topResults.length === 0 && (
            <div className="hm-search-v2-empty">
              <LocateFixed size={20} />
              <span>Chưa thấy kết quả trong phạm vi Hola Maps.</span>
            </div>
          )}

          {topResults.map((item) => {
            const Icon = iconFor(item);
            return (
              <button className="hm-search-v2-result" type="button" key={String(item.id)} onClick={() => chooseResult(item)}>
                <span className="hm-search-v2-icon"><Icon size={18} /></span>
                <span className="hm-search-v2-copy">
                  <strong>{item.name}</strong>
                  <small>{resultType(item)}{item.address ? ' · ' + item.address : ''}</small>
                </span>
                {Number.isFinite(Number(item.distance)) && <b>{Number(item.distance) >= 1000 ? (Number(item.distance) / 1000).toFixed(1) + ' km' : Math.max(1, Math.round(Number(item.distance))) + ' m'}</b>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
