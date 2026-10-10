import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GraduationCap,
  Landmark,
  LocateFixed,
  MapPin,
  Navigation,
  Route,
  Search,
  X
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { getNearbyPlaces, getPlaces } from '../services/api.js';
import { getBestBrowserLocation } from '../utils/geolocation.js';
import { focusHolaMapPoint } from '../mapInteractionBridge.js';

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

  const topResults = useMemo(() => results.slice(0, 8), [results]);

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) {
      setResults([]);
      setMeta(null);
      setError('');
      setLoading(false);
      return undefined;
    }

    const requestId = ++requestRef.current;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');

      try {
        let data;

        if (requiresUserLocation(needle)) {
          const location = await getBestBrowserLocation({ timeout: 9000, targetAccuracy: 80 });
          data = await nearbySearch(needle, location);
        } else {
          data = await getPlaces({ q: needle, limit: 40 }, { signal: controller.signal });
        }

        if (requestId !== requestRef.current) return;
        setResults(Array.isArray(data?.items) ? data.items : []);
        setMeta(data?.meta || null);
        setOpen(true);
      } catch (searchError) {
        if (searchError?.name !== 'AbortError' && requestId === requestRef.current) {
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
  }, [query]);

  function clearSearch() {
    requestRef.current += 1;
    setQuery('');
    setResults([]);
    setMeta(null);
    setError('');
    setOpen(false);
  }

  function chooseResult(item) {
    if (!item) return;
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
    setParams(next, { replace: true });
  }

  return (
    <div className="hm-search-v2-wrap">
      <div className={open ? 'hm-search-v2 active' : 'hm-search-v2'}>
        <Search size={19} />
        <input
          value={query}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm địa điểm, tên đường, cafe gần FPT, cafe gần tôi..."
          aria-label="Tìm kiếm Hola Maps"
        />
        {loading && <span className="hm-search-v2-loading" />}
        {query && !loading && (
          <button type="button" onClick={clearSearch} aria-label="Xóa tìm kiếm"><X size={16} /></button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="hm-search-v2-dropdown">
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
