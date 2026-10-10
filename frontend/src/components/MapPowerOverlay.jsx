import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  Camera,
  ChevronDown,
  ChevronUp,
  CircleUserRound,
  ExternalLink,
  Images,
  MapPin,
  MessageSquarePlus,
  PencilLine,
  Sparkles,
  Star,
  Store,
  Users,
  X
} from 'lucide-react';
import { getPlace } from '../services/api.js';
import { getHaloSpots } from '../services/haloHolaApi.js';
import { useAuth } from '../context/AuthContext.jsx';

function currentRoute() {
  if (typeof window === 'undefined') return { pathname: '', search: '' };
  return { pathname: window.location.pathname, search: window.location.search };
}

function useBrowserRoute() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    let previous = window.location.pathname + window.location.search;
    const sync = () => {
      const next = window.location.pathname + window.location.search;
      if (next === previous) return;
      previous = next;
      setRoute(currentRoute());
    };

    const timer = window.setInterval(sync, 220);
    window.addEventListener('popstate', sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  return route;
}

function haloItemsFromGeoJson(data) {
  const features = Array.isArray(data?.features) ? data.features : [];
  return features
    .map((feature) => {
      const props = feature?.properties || {};
      const coords = feature?.geometry?.coordinates || [];
      return {
        id: props.haloSpotId || String(feature?.id || '').replace(/^halo-/, ''),
        name: props.name || 'Check-in HALO HOLA',
        address: props.address || 'Hòa Lạc',
        coverUrl: props.coverUrl || '',
        postCount: Number(props.postCount || 0),
        mediaCount: Number(props.mediaCount || 0),
        lat: Number(coords[1]),
        lng: Number(coords[0])
      };
    })
    .filter((item) => item.id && Number.isFinite(item.lat) && Number.isFinite(item.lng))
    .slice(0, 8);
}

export default function MapPowerOverlay() {
  const { user } = useAuth();
  const route = useBrowserRoute();
  const [place, setPlace] = useState(null);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [haloOpen, setHaloOpen] = useState(false);
  const [haloLoading, setHaloLoading] = useState(false);
  const [haloItems, setHaloItems] = useState([]);
  const [dismissedPlaceId, setDismissedPlaceId] = useState('');

  const onMap = route.pathname === '/map';
  const selectedPlaceId = useMemo(() => {
    if (!onMap) return '';
    const value = new URLSearchParams(route.search).get('place') || '';
    return value.startsWith('map:') ? '' : value;
  }, [onMap, route.search]);

  useEffect(() => {
    if (!onMap) {
      setPlace(null);
      return;
    }
    if (!selectedPlaceId || selectedPlaceId === dismissedPlaceId) {
      setPlace(null);
      return;
    }

    let active = true;
    setPlaceLoading(true);
    getPlace(selectedPlaceId)
      .then((data) => {
        if (active) setPlace(data?.id ? data : null);
      })
      .catch(() => {
        if (active) setPlace(null);
      })
      .finally(() => {
        if (active) setPlaceLoading(false);
      });

    return () => {
      active = false;
    };
  }, [onMap, selectedPlaceId, dismissedPlaceId]);

  useEffect(() => {
    if (!onMap) return undefined;
    let active = true;
    const controller = new AbortController();
    setHaloLoading(true);
    getHaloSpots({}, { signal: controller.signal })
      .then((data) => {
        if (active) setHaloItems(haloItemsFromGeoJson(data));
      })
      .catch((error) => {
        if (active && error?.name !== 'AbortError') setHaloItems([]);
      })
      .finally(() => {
        if (active) setHaloLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [onMap]);

  if (!onMap) return null;

  const cover = place?.cardImages?.[0] || place?.images?.[0] || '';
  const rating = Number(place?.rating || 0);
  const reviews = Number(place?.reviews || 0);

  return (
    <div className="hm-power-overlay" aria-live="polite">
      <section className={haloOpen ? 'hm-halo-live open' : 'hm-halo-live'}>
        <button
          type="button"
          className="hm-halo-live-trigger"
          onClick={() => setHaloOpen((value) => !value)}
          aria-expanded={haloOpen}
        >
          <span className="hm-halo-live-dot" />
          <span><b>HALO Live</b><small>{haloLoading ? 'Đang tải…' : haloItems.length + ' điểm cộng đồng'}</small></span>
          {haloOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>

        {haloOpen && (
          <div className="hm-halo-live-panel">
            <div className="hm-halo-live-head">
              <div>
                <span><Sparkles size={14} /> CỘNG ĐỒNG SỐNG</span>
                <strong>Ảnh & check-in HALO HOLA</strong>
              </div>
              <a href="/halo">Mở bản đồ HALO <ExternalLink size={13} /></a>
            </div>

            {haloItems.length ? (
              <div className="hm-halo-live-grid">
                {haloItems.slice(0, 6).map((item) => (
                  <a href={'/halo?spot=' + encodeURIComponent(item.id)} key={item.id} className="hm-halo-live-item">
                    <span className="hm-halo-live-cover">
                      {item.coverUrl ? <img src={item.coverUrl} alt="" loading="lazy" /> : <Camera size={18} />}
                    </span>
                    <span>
                      <b>{item.name}</b>
                      <small><Images size={12} /> {item.mediaCount} ảnh · {item.postCount} bài</small>
                      <em>{item.address}</em>
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="hm-halo-live-empty">
                <Users size={20} />
                <span>Chưa có check-in HALO trong dữ liệu hiện tại.</span>
              </div>
            )}
          </div>
        )}
      </section>

      {(place || placeLoading) && selectedPlaceId !== dismissedPlaceId && (
        <aside className="hm-map-preview-card">
          <button
            type="button"
            className="hm-map-preview-close"
            onClick={() => {
              setDismissedPlaceId(selectedPlaceId);
              setPlace(null);
            }}
            aria-label="Đóng xem nhanh"
          >
            <X size={15} />
          </button>

          {placeLoading && !place ? (
            <div className="hm-map-preview-loading">Đang tải xem nhanh…</div>
          ) : place && (
            <>
              <div className="hm-map-preview-main">
                <span className="hm-map-preview-cover">
                  {cover ? <img src={cover} alt={place.name} /> : <MapPin size={28} />}
                </span>
                <div className="hm-map-preview-copy">
                  <small>{place.category || 'Địa điểm Hòa Lạc'}</small>
                  <strong>{place.name}</strong>
                  <span className="hm-map-preview-meta">
                    {rating > 0 ? <><Star size={13} fill="currentColor" /> {rating.toFixed(1)} · {reviews} đánh giá</> : 'Địa điểm mới'}
                  </span>
                  <p>{place.address || 'Hòa Lạc, Hà Nội'}</p>
                </div>
              </div>

              <div className="hm-map-preview-actions">
                <a className="primary" href={'/place/' + encodeURIComponent(place.id)}>
                  <Building2 size={14} /> Chi tiết
                </a>
                <a href={'/place/' + encodeURIComponent(place.id) + '#contribute'}>
                  <PencilLine size={14} /> Đề xuất sửa
                </a>
                <a href={'/claim-place/' + encodeURIComponent(place.id)}>
                  <Store size={14} /> {user ? 'Nhận quản lý' : 'Chủ địa điểm'}
                </a>
              </div>

              <div className="hm-map-preview-trust">
                <BadgeCheck size={14} />
                <span>Thông tin chuẩn được giữ riêng; đề xuất cộng đồng phải qua kiểm duyệt.</span>
              </div>
            </>
          )}
        </aside>
      )}

      <nav className="hm-map-contribution-dock" aria-label="Đóng góp nhanh">
        <a href="/contribute"><MessageSquarePlus size={16} /><span>Thêm địa điểm</span></a>
        <a href="/halo"><Camera size={16} /><span>HALO</span></a>
        <a href={user ? '/profile' : '/login'}><CircleUserRound size={16} /><span>{user ? 'Đóng góp của tôi' : 'Đăng nhập'}</span></a>
      </nav>
    </div>
  );
}
