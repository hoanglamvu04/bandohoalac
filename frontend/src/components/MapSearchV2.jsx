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
import { getPlaces } from '../services/api.js';
import { getBestBrowserLocation } from '../utils/geolocation.js';
import { focusHolaMapPoint } from '../mapInteractionBridge.js';

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[đĐ]/g, 'd')
    .trim();
}

function requiresUserLocation(query) {
  const value = fold(query);
  return value.includes('gan toi') || value.includes('quanh toi') || value.includes('vi tri cua toi');
}

function iconFor(item) {
  if (item?.searchEntityType === 'ROAD') return Route;
  if (item?.searchEntityType === 'LANDMARK') return Landmark;
  const category = fold(item?.category + ' ' + item?.categorySlug + ' ' + item?.name);
  if (category.includes('dai hoc') || category.includes('truong') || category.includes('university')) {
    return GraduationCap;
  }
  return MapPin;
}

function resultType(item) {
  if (item?.searchEntityType === 'ROAD') return 'Tuyến đường';
  if (item?.searchEntityType === 'LANDMARK') return 'Địa danh';
  return item?.category || 'Địa điểm';
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
        let location = null;
        if (requiresUserLocation(needle)) {
          try {
            location = await getBestBrowserLocation({ timeout: 9000, targetAccuracy: 80 });
          } catch (locationError) {
            if (requestId === requestRef.current) {
              setError(locationError?.message || 'Hãy bật vị trí để tìm kiếm gần bạn.');
            }
          }
        }

        const data = await getPlaces({
          q: needle,
          limit: 40,
          lat: location?.lat,
          lng: location?.lng
        }, { signal: controller.signal });

        if (requestId !== requestRef.current) return;
        setResults(Array.isArray(data?.items) ? data.items : []);
        setMeta(data?.meta || null);
        setOpen(true);
      } catch (searchError) {
        if (searchError?.name !== 'AbortError' && requestId === requestRef.current) {
          setResults([]);
          setMeta(null);
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

    if (item.searchEntityType === 'ROAD' || item.searchEntityType === 'LANDMARK') {
      focusHolaMapPoint({ lat: item.lat, lng: item.lng, zoom: item.searchEntityType === 'ROAD' ? 16.4 : 16 });
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
          placeholder="Tìm địa điểm, tên đường, cafe gần FPT, gần tôi..."
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
                {meta.radius ? ' · ' + Math.round(meta.radius / 1000) + ' km' : ''}
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
                {Number.isFinite(Number(item.distance)) && <b>{Math.max(1, Math.round(Number(item.distance)))} m</b>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
