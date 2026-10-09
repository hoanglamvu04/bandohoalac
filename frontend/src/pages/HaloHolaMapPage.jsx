import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Images,
  MapPin,
  RefreshCw,
  Sparkles,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import MapView from '../components/MapView.jsx';
import { getHaloSpot, getHaloSpots } from '../services/haloHolaApi.js';

const EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] };

function spotsToPlaces(payload) {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  return features.map((feature) => {
    const props = feature?.properties || {};
    const coordinates = feature?.geometry?.coordinates || [];
    return {
      id: 'halo-' + String(props.haloSpotId || feature.id || ''),
      haloSpotId: String(props.haloSpotId || ''),
      name: props.name || 'Điểm ảnh HALO HOLA',
      address: props.address || 'Hòa Lạc, Hà Nội',
      lat: Number(coordinates[1]),
      lng: Number(coordinates[0]),
      category: 'Check-in',
      categorySlug: 'check-in',
      image: props.coverUrl || null,
      images: props.coverUrl ? [props.coverUrl] : [],
      placeId: props.placeId || null,
      haloPostCount: Number(props.postCount || 0),
      haloMediaCount: Number(props.mediaCount || 0)
    };
  }).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return '';
  }
}

export default function HaloHolaMapPage() {
  const [viewport, setViewport] = useState(null);
  const [spotsPayload, setSpotsPayload] = useState(EMPTY_GEOJSON);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const lastBoundsKeyRef = useRef('');

  const places = useMemo(() => spotsToPlaces(spotsPayload), [spotsPayload]);
  const media = Array.isArray(detail?.media) ? detail.media : [];
  const activeMedia = media[galleryIndex] || media[0] || null;

  useEffect(() => {
    if (!viewport) return undefined;
    const bounds = {
      west: Number(viewport.west).toFixed(5),
      south: Number(viewport.south).toFixed(5),
      east: Number(viewport.east).toFixed(5),
      north: Number(viewport.north).toFixed(5)
    };
    const key = Object.values(bounds).join(':');
    if (lastBoundsKeyRef.current === key) return undefined;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      lastBoundsKeyRef.current = key;
      setLoading(true);
      setError('');
      try {
        const data = await getHaloSpots(bounds, { signal: controller.signal });
        setSpotsPayload(data?.type === 'FeatureCollection' ? data : EMPTY_GEOJSON);
      } catch (nextError) {
        if (nextError?.name !== 'AbortError') {
          setError(nextError.message || 'Không tải được ảnh HALO HOLA.');
        }
      } finally {
        setLoading(false);
      }
    }, 260);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [viewport?.west, viewport?.south, viewport?.east, viewport?.north]);

  async function selectSpot(place) {
    if (!place?.haloSpotId) return;
    if (selectedPlace?.haloSpotId === place.haloSpotId) {
      setSelectedPlace(null);
      setDetail(null);
      return;
    }

    setSelectedPlace(place);
    setDetail(null);
    setGalleryIndex(0);
    setDetailLoading(true);
    try {
      setDetail(await getHaloSpot(place.haloSpotId));
    } catch (nextError) {
      setError(nextError.message || 'Không tải được gallery HALO HOLA.');
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedPlace(null);
    setDetail(null);
    setGalleryIndex(0);
  }

  function previous() {
    if (media.length < 2) return;
    setGalleryIndex((value) => (value - 1 + media.length) % media.length);
  }

  function next() {
    if (media.length < 2) return;
    setGalleryIndex((value) => (value + 1) % media.length);
  }

  return (
    <main className="halo-map-page">
      <MapView
        places={places}
        selectedPlaceId={selectedPlace?.id || null}
        hoveredPlaceId={null}
        onSelectPlace={selectSpot}
        onHoverPlace={() => {}}
        onSelectStatusFeature={() => {}}
        mapData={EMPTY_GEOJSON}
        activeLayers={[]}
        basemapMode="streets"
        onViewportChange={setViewport}
      />

      <section className="halo-map-brand-card">
        <div className="halo-map-brand-icon"><Camera size={20} /></div>
        <div>
          <span>HALO HOLA × HOLA MAPS</span>
          <h1>Ảnh cộng đồng theo địa điểm</h1>
          <p>Chạm vào một điểm để xem ảnh người dùng đã gửi tại đúng vị trí đó.</p>
        </div>
        <div className="halo-map-count">
          <b>{places.length}</b>
          <small>điểm trong vùng đang xem</small>
        </div>
      </section>

      <div className="halo-map-status" aria-live="polite">
        {loading ? <><RefreshCw className="spin" size={14} /> Đang tải ảnh cộng đồng…</> : null}
        {!loading && error ? <span>{error}</span> : null}
        {!loading && !error && places.length === 0 ? <span>Chưa có ảnh HALO HOLA trong vùng đang xem.</span> : null}
      </div>

      {selectedPlace && (
        <aside className="halo-gallery-panel">
          <button className="halo-gallery-close" type="button" onClick={closeDetail} aria-label="Đóng gallery">
            <X size={18} />
          </button>

          <div className="halo-gallery-heading">
            <span><Sparkles size={14} /> HALO HOLA</span>
            <h2>{detail?.label || selectedPlace.name}</h2>
            <p><MapPin size={14} /> {detail?.address || selectedPlace.address}</p>
          </div>

          {detailLoading ? (
            <div className="halo-gallery-loading"><RefreshCw className="spin" size={18} /> Đang tải gallery…</div>
          ) : media.length ? (
            <>
              <div className="halo-gallery-hero">
                <img src={activeMedia?.url || activeMedia?.thumbnailUrl} alt={detail?.label || 'Ảnh HALO HOLA'} />
                {media.length > 1 && (
                  <>
                    <button type="button" className="prev" onClick={previous} aria-label="Ảnh trước"><ChevronLeft size={20} /></button>
                    <button type="button" className="next" onClick={next} aria-label="Ảnh tiếp"><ChevronRight size={20} /></button>
                  </>
                )}
                <span><Images size={13} /> {galleryIndex + 1}/{media.length}</span>
              </div>

              <div className="halo-gallery-meta">
                <div>
                  <b>{activeMedia?.user?.name || 'Thành viên HALO HOLA'}</b>
                  <small>{formatDate(activeMedia?.postedAt)}</small>
                </div>
                {activeMedia?.sourceUrl && (
                  <a href={activeMedia.sourceUrl} target="_blank" rel="noreferrer">
                    Xem bài gốc <ExternalLink size={13} />
                  </a>
                )}
              </div>

              {activeMedia?.caption && <p className="halo-gallery-caption">{activeMedia.caption}</p>}

              <div className="halo-gallery-thumbs">
                {media.slice(0, 24).map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={index === galleryIndex ? 'active' : ''}
                    onClick={() => setGalleryIndex(index)}
                    aria-label={'Mở ảnh ' + (index + 1)}
                  >
                    <img src={item.thumbnailUrl || item.url} alt="" loading="lazy" />
                  </button>
                ))}
              </div>

              <div className="halo-gallery-footer">
                <span><b>{detail?.mediaCount || media.length}</b> ảnh cộng đồng</span>
                {detail?.placeId && (
                  <Link to={'/place/' + detail.placeId}>
                    Mở địa điểm Hola Maps <ExternalLink size={14} />
                  </Link>
                )}
              </div>
            </>
          ) : (
            <div className="halo-gallery-empty">Chưa có ảnh công khai tại điểm này.</div>
          )}
        </aside>
      )}
    </main>
  );
}
