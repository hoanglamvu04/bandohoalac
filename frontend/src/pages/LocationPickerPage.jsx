import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Crosshair, Loader2, MapPin, Search, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import LocationPicker from '../components/LocationPicker.jsx';
import { getPlaces } from '../services/api.js';
import { getBestBrowserLocation } from '../utils/geolocation.js';
import { reverseGeocodeLocation } from '../utils/reverseGeocoding.js';
import '../location-picker-embed.css';

const DEFAULT_LOCATION = { lat: 21.005, lng: 105.525 };
const QUICK_SEARCHES = ['Quán cafe', 'Đường 420', 'FPT', 'Hạ Bằng'];

function finite(value, fallback) {
  if (value === null || value === undefined || String(value).trim() === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function validLocation(lat, lng) {
  const y = Number(lat);
  const x = Number(lng);
  return Number.isFinite(y) && Number.isFinite(x) &&
    y >= -90 && y <= 90 && x >= -180 && x <= 180;
}

function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function resultMeta(place) {
  return place.address || place.category || place.categorySlug || 'Địa điểm tại Hòa Lạc';
}

export default function LocationPickerPage() {
  const [searchParams] = useSearchParams();
  const initialLat = finite(searchParams.get('lat'), DEFAULT_LOCATION.lat);
  const initialLng = finite(searchParams.get('lng'), DEFAULT_LOCATION.lng);
  const initialLabel = searchParams.get('label') || '';
  const requestedOrigin = searchParams.get('origin') || '';
  const embedded = typeof window !== 'undefined' && window.parent !== window;
  const reverseRequestRef = useRef(0);

  const [location, setLocation] = useState({ lat: initialLat, lng: initialLng });
  const [label, setLabel] = useState(initialLabel);
  const [address, setAddress] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [placeSlug, setPlaceSlug] = useState('');
  const [source, setSource] = useState(initialLabel ? 'halo_hola' : 'hola_picker');
  const [query, setQuery] = useState(initialLabel);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const targetOrigin = useMemo(() => {
    try {
      const parsed = new URL(requestedOrigin);
      return /^https?:$/.test(parsed.protocol) ? parsed.origin : '*';
    } catch {
      return '*';
    }
  }, [requestedOrigin]);

  useEffect(() => {
    if (window.parent === window) return;
    window.parent.postMessage({ type: 'HOLA_MAP_PICKER_READY' }, targetOrigin);
  }, [targetOrigin]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setError('');
      try {
        const payload = await getPlaces({ q: term, limit: 10 }, { signal: controller.signal });
        setResults(normalizeItems(payload));
      } catch (nextError) {
        if (nextError?.name !== 'AbortError') {
          setResults([]);
          setError(nextError.message || 'Không tìm được địa điểm từ HOLA Maps.');
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 240);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const resolvePinnedAddress = async (lat, lng, fallbackLabel = 'Vị trí đã ghim') => {
    const requestId = ++reverseRequestRef.current;
    setResolvingAddress(true);
    try {
      const resolved = await reverseGeocodeLocation(lat, lng);
      if (requestId !== reverseRequestRef.current) return;
      const nextAddress = resolved?.label || '';
      setAddress(nextAddress);
      setLabel(resolved?.shortLabel || nextAddress || fallbackLabel);
    } finally {
      if (requestId === reverseRequestRef.current) setResolvingAddress(false);
    }
  };

  const pickPlace = (place) => {
    const lat = Number(place?.lat);
    const lng = Number(place?.lng);
    if (!validLocation(lat, lng)) {
      setError('Địa điểm này chưa có tọa độ hợp lệ trên HOLA Maps.');
      return;
    }
    reverseRequestRef.current += 1;
    setLocation({ lat, lng });
    setLabel(place.name || place.address || 'Địa điểm trên HOLA Maps');
    setAddress(place.address || '');
    setPlaceId(String(place.id || ''));
    setPlaceSlug(place.slug || '');
    setSource('hola_place');
    setQuery(place.name || '');
    setResults([]);
    setError('');
  };

  const locateMe = async () => {
    setLocating(true);
    setError('');
    try {
      const current = await getBestBrowserLocation({ timeout: 10000, targetAccuracy: 50 });
      if (!validLocation(current?.lat, current?.lng)) {
        throw new Error('Thiết bị trả về tọa độ không hợp lệ.');
      }
      const next = { lat: Number(current.lat), lng: Number(current.lng) };
      setLocation(next);
      setLabel('Vị trí hiện tại');
      setAddress('');
      setPlaceId('');
      setPlaceSlug('');
      setSource('current_location');
      setQuery('');
      setResults([]);
      await resolvePinnedAddress(next.lat, next.lng, 'Vị trí hiện tại');
    } catch (nextError) {
      setError(nextError.message || 'Không thể lấy vị trí hiện tại.');
    } finally {
      setLocating(false);
    }
  };

  const updatePinnedLocation = (next) => {
    if (!validLocation(next?.lat, next?.lng)) return;
    const lat = Number(next.lat);
    const lng = Number(next.lng);
    setLocation({ lat, lng });

    if (next.initial) return;

    setPlaceId('');
    setPlaceSlug('');
    setSource('hola_picker');
    setAddress('');
    setLabel('Vị trí đã ghim');
    setQuery('');
    setResults([]);
    setError('');
    resolvePinnedAddress(lat, lng, 'Vị trí đã ghim');
  };

  const confirm = () => {
    if (!validLocation(location.lat, location.lng)) {
      setError('Vị trí chưa hợp lệ. Vui lòng chọn lại trên HOLA Maps.');
      return;
    }

    const payload = {
      lat: Number(location.lat),
      lng: Number(location.lng),
      label: label || 'Vị trí đã ghim',
      address,
      placeId,
      placeSlug,
      source
    };

    if (window.parent !== window) {
      window.parent.postMessage({ type: 'HOLA_MAP_LOCATION_SELECTED', payload }, targetOrigin);
      setSent(true);
      window.setTimeout(() => setSent(false), 1600);
    } else {
      setSent(true);
    }
  };

  const hasQuery = query.trim().length >= 2;
  const selectionTitle = label || 'Vị trí đã ghim';
  const selectionSubtitle = address || `${Number(location.lat).toFixed(5)}, ${Number(location.lng).toFixed(5)}`;

  return (
    <main className={embedded ? 'hm-picker-page is-embedded' : 'hm-picker-page'}>
      <section className="hm-picker-shell">
        {!embedded ? (
          <header className="hm-picker-head">
            <div>
              <span>HOLA MAPS</span>
              <h1>Chọn địa điểm tác phẩm</h1>
              <p>Tìm địa điểm, tên đường hoặc kéo bản đồ đến đúng nơi bạn thực hiện tác phẩm.</p>
            </div>
            <div className="hm-picker-coords"><MapPin size={16} />{Number(location.lat).toFixed(6)}, {Number(location.lng).toFixed(6)}</div>
          </header>
        ) : null}

        <div className="hm-picker-map-area">
          <LocationPicker lat={location.lat} lng={location.lng} onChange={updatePinnedLocation} />

          <div className="hm-picker-search-wrap">
            <div className="hm-picker-search-row">
              <div className="hm-picker-search">
                <Search size={19} />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setError('');
                  }}
                  placeholder="Tìm địa điểm, tên đường, quán cafe..."
                  autoFocus={embedded}
                  autoComplete="off"
                />
                {query ? <button type="button" onClick={() => { setQuery(''); setResults([]); }} aria-label="Xóa tìm kiếm"><X size={17} /></button> : null}
                {searching ? <Loader2 className="spin" size={17} /> : null}
              </div>
              <button className="hm-picker-locate" type="button" onClick={locateMe} disabled={locating} title="Dùng vị trí hiện tại">
                {locating ? <Loader2 className="spin" size={18} /> : <Crosshair size={18} />}
                <span>Vị trí của tôi</span>
              </button>
            </div>

            {!hasQuery && !embedded ? (
              <div className="hm-picker-quick">
                <small>Thử tìm nhanh</small>
                {QUICK_SEARCHES.map((item) => <button type="button" key={item} onClick={() => setQuery(item)}>{item}</button>)}
              </div>
            ) : null}

            {hasQuery && !searching && results.length === 0 ? (
              <div className="hm-picker-empty">Không thấy kết quả phù hợp. Bạn vẫn có thể kéo bản đồ và ghim thủ công.</div>
            ) : null}

            {results.length > 0 ? (
              <div className="hm-picker-results">
                <div className="hm-picker-results-head"><b>Kết quả trên HOLA Maps</b><span>{results.length} địa điểm</span></div>
                {results.map((place) => (
                  <button key={place.id || place.slug || `${place.lat}-${place.lng}`} type="button" onClick={() => pickPlace(place)}>
                    <span className="hm-picker-result-icon"><MapPin size={17} /></span>
                    <span className="hm-picker-result-copy">
                      <b>{place.name || 'Địa điểm HOLA Maps'}</b>
                      <small>{resultMeta(place)}</small>
                    </span>
                    {place.category ? <em>{place.category}</em> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="hm-picker-map-tip">Kéo bản đồ để ghim chính xác vị trí</div>
          {error ? <div className="hm-picker-error">{error}</div> : null}
        </div>

        <footer className="hm-picker-footer">
          <div className="hm-picker-selection">
            <span className="hm-picker-selection-pin"><MapPin size={18} /></span>
            <div>
              <small>{placeId ? 'Địa điểm HOLA Maps' : source === 'current_location' ? 'Vị trí hiện tại' : 'Vị trí đang chọn'}</small>
              <strong>{resolvingAddress ? 'Đang xác định địa chỉ…' : selectionTitle}</strong>
              <span>{selectionSubtitle}</span>
            </div>
          </div>
          <button type="button" onClick={confirm} disabled={resolvingAddress}>
            {resolvingAddress ? <Loader2 className="spin" size={18} /> : <Check size={18} />}
            {sent ? 'Đã chọn vị trí' : 'Chọn vị trí này'}
          </button>
        </footer>
      </section>
    </main>
  );
}
