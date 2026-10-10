import { useEffect, useMemo, useState } from 'react';
import { Check, Crosshair, Loader2, MapPin, Search, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import LocationPicker from '../components/LocationPicker.jsx';
import { getPlaces } from '../services/api.js';
import { getBestBrowserLocation } from '../utils/geolocation.js';
import '../location-picker-embed.css';

const DEFAULT_LOCATION = { lat: 21.005, lng: 105.525 };

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

export default function LocationPickerPage() {
  const [searchParams] = useSearchParams();
  const initialLat = finite(searchParams.get('lat'), DEFAULT_LOCATION.lat);
  const initialLng = finite(searchParams.get('lng'), DEFAULT_LOCATION.lng);
  const initialLabel = searchParams.get('label') || '';
  const requestedOrigin = searchParams.get('origin') || '';

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
        const payload = await getPlaces({ q: term, limit: 8 }, { signal: controller.signal });
        setResults(normalizeItems(payload));
      } catch (nextError) {
        if (nextError?.name !== 'AbortError') {
          setResults([]);
          setError(nextError.message || 'Không tìm được địa điểm từ HOLA Maps.');
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const pickPlace = (place) => {
    const lat = Number(place?.lat);
    const lng = Number(place?.lng);
    if (!validLocation(lat, lng)) {
      setError('Địa điểm này chưa có tọa độ hợp lệ trên HOLA Maps.');
      return;
    }
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
      setLocation({ lat: current.lat, lng: current.lng });
      setLabel('Vị trí hiện tại');
      setAddress('');
      setPlaceId('');
      setPlaceSlug('');
      setSource('current_location');
      setQuery('');
      setResults([]);
    } catch (nextError) {
      setError(nextError.message || 'Không thể lấy vị trí hiện tại.');
    } finally {
      setLocating(false);
    }
  };

  const updatePinnedLocation = (next) => {
    if (!validLocation(next?.lat, next?.lng)) return;
    setLocation({ lat: Number(next.lat), lng: Number(next.lng) });
    if (source !== 'hola_place' && source !== 'current_location') {
      setLabel(label || 'Vị trí ghim trên HOLA Maps');
    }
    if (source === 'hola_place') {
      setLabel('Vị trí ghim trên HOLA Maps');
      setAddress('');
      setPlaceId('');
      setPlaceSlug('');
    }
    setSource('hola_picker');
  };

  const confirm = () => {
    if (!validLocation(location.lat, location.lng)) {
      setError('Vị trí chưa hợp lệ. Vui lòng chọn lại trên HOLA Maps.');
      return;
    }

    const payload = {
      lat: Number(location.lat),
      lng: Number(location.lng),
      label: label || 'Vị trí ghim trên HOLA Maps',
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

  return (
    <main className="hm-picker-page">
      <section className="hm-picker-shell">
        <header className="hm-picker-head">
          <div>
            <span>HOLA MAPS</span>
            <h1>Chọn địa điểm tác phẩm</h1>
            <p>Tìm địa điểm có sẵn, dùng vị trí hiện tại hoặc kéo bản đồ để ghim đúng điểm bạn chụp.</p>
          </div>
          <div className="hm-picker-coords">
            <MapPin size={16} />
            <span>{Number(location.lat).toFixed(6)}, {Number(location.lng).toFixed(6)}</span>
          </div>
        </header>

        <div className="hm-picker-search-wrap">
          <div className="hm-picker-search">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setError('');
              }}
              placeholder="Tìm địa điểm trên HOLA Maps..."
            />
            {query ? <button type="button" onClick={() => { setQuery(''); setResults([]); }} aria-label="Xóa tìm kiếm"><X size={16} /></button> : null}
            {searching ? <Loader2 className="spin" size={17} /> : null}
          </div>
          <button className="hm-picker-locate" type="button" onClick={locateMe} disabled={locating}>
            {locating ? <Loader2 className="spin" size={17} /> : <Crosshair size={17} />}
            Vị trí hiện tại
          </button>

          {results.length > 0 ? (
            <div className="hm-picker-results">
              {results.map((place) => (
                <button key={place.id} type="button" onClick={() => pickPlace(place)}>
                  <MapPin size={16} />
                  <span><b>{place.name}</b><small>{place.address || place.category || 'Hòa Lạc'}</small></span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {error ? <div className="hm-picker-error">{error}</div> : null}

        <LocationPicker lat={location.lat} lng={location.lng} onChange={updatePinnedLocation} />

        <footer className="hm-picker-footer">
          <div>
            <small>Địa điểm đã chọn</small>
            <strong>{label || 'Vị trí ghim trên HOLA Maps'}</strong>
            {address ? <span>{address}</span> : null}
          </div>
          <button type="button" onClick={confirm}>
            <Check size={18} /> {sent ? 'Đã gửi về HALO HOLA' : 'Dùng vị trí này'}
          </button>
        </footer>
      </section>
    </main>
  );
}
