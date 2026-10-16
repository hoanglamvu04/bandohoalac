import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Loader2, MapPin, Navigation, Star, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { getPlace } from '../services/api.js';
import { getHolaMapInstance } from '../mapInteractionBridge.js';

const PLACE_LAYER_IDS = [
  'hm-place-cluster-point',
  'hm-place-cluster-point-label',
  'hm-place-name-label'
];

function placeIdFromClick(map, event) {
  if (!map || !event?.point) return '';
  const layers = PLACE_LAYER_IDS.filter((id) => map.getLayer?.(id));
  if (!layers.length) return '';

  try {
    const hits = map.queryRenderedFeatures(event.point, { layers }) || [];
    const hit = hits.find((feature) => feature?.properties?.placeId != null);
    return hit?.properties?.placeId == null ? '' : String(hit.properties.placeId);
  } catch {
    return '';
  }
}

function firstImage(place) {
  const values = [
    place?.cardImages?.[0],
    place?.images?.[0],
    place?.thumbnail,
    place?.image
  ];
  return values.find((value) => typeof value === 'string' && value.trim()) || '';
}

export default function MapMobilePlaceFallback() {
  const location = useLocation();
  const mapRef = useRef(null);
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches
  );
  const [activePlaceId, setActivePlaceId] = useState('');
  const [dismissedPlaceId, setDismissedPlaceId] = useState('');
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(false);
  const [nativeDetailVisible, setNativeDetailVisible] = useState(false);

  const queryPlaceId = useMemo(() => {
    try {
      return new URLSearchParams(location.search).get('place') || '';
    } catch {
      return '';
    }
  }, [location.search]);

  useEffect(() => {
    if (!queryPlaceId) return;
    setActivePlaceId(String(queryPlaceId));
    setDismissedPlaceId('');
  }, [queryPlaceId]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(max-width: 760px)');
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    if (!mobile || typeof document === 'undefined') return undefined;

    const sync = () => {
      const nativeInspector = document.querySelector('.hm-place-inspector.discovery-v3');
      const powerPreview = document.querySelector('.hm-map-preview-card');
      setNativeDetailVisible(Boolean(nativeInspector || powerPreview));
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [mobile]);

  useEffect(() => {
    if (!mobile) return undefined;
    let cancelled = false;
    let timer = 0;

    const attach = () => {
      if (cancelled) return;
      const map = getHolaMapInstance();
      if (!map) {
        timer = window.setTimeout(attach, 180);
        return;
      }

      mapRef.current = map;
      const onClick = (event) => {
        const placeId = placeIdFromClick(map, event);
        if (placeId) {
          setActivePlaceId(placeId);
          setDismissedPlaceId('');
          return;
        }

        // A deliberate tap on empty map space closes only the fallback card.
        setActivePlaceId('');
        setPlace(null);
      };

      map.on('click', onClick);
      mapRef.current.__holaMobileFallbackClick = onClick;
    };

    attach();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      const map = mapRef.current;
      const handler = map?.__holaMobileFallbackClick;
      if (map && handler) {
        try { map.off('click', handler); } catch {}
        delete map.__holaMobileFallbackClick;
      }
      mapRef.current = null;
    };
  }, [mobile]);

  useEffect(() => {
    if (!mobile || !activePlaceId || activePlaceId === dismissedPlaceId || nativeDetailVisible) {
      return undefined;
    }

    let active = true;
    setLoading(true);
    getPlace(activePlaceId)
      .then((data) => {
        if (active) setPlace(data?.id ? data : null);
      })
      .catch(() => {
        if (active) setPlace(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [mobile, activePlaceId, dismissedPlaceId, nativeDetailVisible]);

  if (!mobile || !activePlaceId || activePlaceId === dismissedPlaceId || nativeDetailVisible) {
    return null;
  }

  const cover = firstImage(place);
  const rating = Number(place?.rating || 0);
  const reviews = Number(place?.reviews || place?.ratingCount || 0);
  const lat = Number(place?.lat);
  const lng = Number(place?.lng);
  const mapsUrl = Number.isFinite(lat) && Number.isFinite(lng)
    ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(lat + ',' + lng)
    : '';

  return (
    <aside className="hm-mobile-place-fallback" aria-live="polite" aria-label="Thông tin địa điểm đã chọn">
      <span className="hm-mobile-place-fallback-handle" aria-hidden="true" />
      <button
        type="button"
        className="hm-mobile-place-fallback-close"
        onClick={() => setDismissedPlaceId(activePlaceId)}
        aria-label="Đóng thông tin địa điểm"
      >
        <X size={17} />
      </button>

      {loading && !place ? (
        <div className="hm-mobile-place-fallback-loading">
          <Loader2 size={19} className="spin" /> Đang tải địa điểm…
        </div>
      ) : place ? (
        <>
          <div className="hm-mobile-place-fallback-main">
            <span className={cover ? 'hm-mobile-place-fallback-cover has-image' : 'hm-mobile-place-fallback-cover'}>
              {cover ? <img src={cover} alt="" /> : <MapPin size={26} />}
            </span>
            <div className="hm-mobile-place-fallback-copy">
              <small>{place.category || 'Địa điểm Hòa Lạc'}</small>
              <strong>{place.name || 'Địa điểm'}</strong>
              <span>
                {rating > 0 ? <><Star size={13} fill="currentColor" /> {rating.toFixed(1)} · {reviews} đánh giá</> : 'Địa điểm trên HOLA Maps'}
              </span>
              <p><MapPin size={13} /> {place.address || 'Hòa Lạc, Hà Nội'}</p>
            </div>
          </div>

          <div className="hm-mobile-place-fallback-actions">
            <Link className="primary" to={'/place/' + encodeURIComponent(place.id)}>
              Xem chi tiết <ChevronRight size={15} />
            </Link>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noreferrer">
                <Navigation size={15} /> Chỉ đường
              </a>
            )}
          </div>
        </>
      ) : (
        <div className="hm-mobile-place-fallback-loading">
          <MapPin size={18} /> Chưa tải được thông tin địa điểm.
        </div>
      )}
    </aside>
  );
}
