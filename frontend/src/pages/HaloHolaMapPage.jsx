import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Images,
  Map as MapIcon,
  MapPin,
  RefreshCw,
  Sparkles,
  X
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import MapView from '../components/MapView.jsx';
import { getHaloSpot, getHaloSpots } from '../services/haloHolaApi.js';

const EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] };
const STORY_LIMIT = 20;

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

function detailToPlace(detail) {
  if (!detail) return null;
  const lat = Number(detail.lat);
  const lng = Number(detail.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const media = Array.isArray(detail.media) ? detail.media : [];
  const cover = media[0]?.thumbnailUrl || media[0]?.url || null;
  return {
    id: 'halo-' + String(detail.id || ''),
    haloSpotId: String(detail.id || ''),
    name: detail.label || 'Điểm ảnh HALO HOLA',
    address: detail.address || 'Hòa Lạc, Hà Nội',
    lat,
    lng,
    category: 'Check-in',
    categorySlug: 'check-in',
    image: cover,
    images: cover ? [cover] : [],
    placeId: detail.placeId || null,
    haloPostCount: 0,
    haloMediaCount: Number(detail.mediaCount || media.length || 0)
  };
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

function overviewFocus(places) {
  if (!places.length) return null;
  const lngs = places.map((item) => Number(item.lng)).filter(Number.isFinite);
  const lats = places.map((item) => Number(item.lat)).filter(Number.isFinite);
  if (!lngs.length || !lats.length) return null;

  const west = Math.min(...lngs);
  const east = Math.max(...lngs);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const span = Math.max(east - west, north - south);
  let zoom = 12.3;
  if (places.length === 1 || span <= 0.004) zoom = 15.3;
  else if (span <= 0.012) zoom = 14.5;
  else if (span <= 0.028) zoom = 13.7;
  else if (span <= 0.055) zoom = 12.9;

  return {
    id: 'halo-overview-' + places.map((item) => item.haloSpotId).sort().join('-'),
    center: [(west + east) / 2, (south + north) / 2],
    zoom
  };
}

function mediaTitle(item) {
  return item?.metadata?.title || item?.code || 'Góc nhìn HALO HOLA';
}

export default function HaloHolaMapPage() {
  const location = useLocation();
  const embedded = location.pathname.startsWith('/embed/');
  const querySpotId = useMemo(
    () => new URLSearchParams(location.search).get('spot') || '',
    [location.search]
  );
  const [viewport, setViewport] = useState(null);
  const [spotsPayload, setSpotsPayload] = useState(EMPTY_GEOJSON);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [initialFocus, setInitialFocus] = useState(null);
  const lastBoundsKeyRef = useRef('');
  const overviewAppliedRef = useRef(false);

  const places = useMemo(() => spotsToPlaces(spotsPayload), [spotsPayload]);
  const mapPlaces = useMemo(() => {
    if (!selectedPlace) return places;
    const exists = places.some((item) => String(item.id) === String(selectedPlace.id));
    return exists ? places : [selectedPlace, ...places];
  }, [places, selectedPlace]);
  const media = Array.isArray(detail?.media) ? detail.media : [];
  const activeMedia = media[galleryIndex] || media[0] || null;
  const focusRegion = useMemo(() => {
    if (detail && Number.isFinite(Number(detail.lng)) && Number.isFinite(Number(detail.lat))) {
      return {
        id: 'halo-selected-' + String(detail.id),
        center: [Number(detail.lng), Number(detail.lat)],
        zoom: 16.1
      };
    }
    return initialFocus;
  }, [detail, initialFocus]);

  useEffect(() => {
    if (!querySpotId) return undefined;
    const controller = new AbortController();
    let cancelled = false;

    setDetailLoading(true);
    setError('');
    getHaloSpot(querySpotId, { signal: controller.signal })
      .then((item) => {
        if (cancelled) return;
        const place = detailToPlace(item);
        if (!place) throw new Error('Điểm HALO HOLA chưa có tọa độ hợp lệ.');
        setSelectedPlace(place);
        setDetail(item);
        setGalleryIndex(0);
        setInitialFocus({
          id: 'halo-deeplink-' + String(item.id),
          center: [Number(item.lng), Number(item.lat)],
          zoom: 16.1
        });
      })
      .catch((nextError) => {
        if (nextError?.name !== 'AbortError' && !cancelled) {
          setError(nextError.message || 'Không mở được góc nhìn HALO HOLA này.');
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [querySpotId]);

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

  useEffect(() => {
    if (querySpotId || overviewAppliedRef.current || !places.length) return;
    const nextFocus = overviewFocus(places);
    if (!nextFocus) return;
    overviewAppliedRef.current = true;
    setInitialFocus(nextFocus);
  }, [places, querySpotId]);

  async function selectSpot(place) {
    if (!place?.haloSpotId) return;
    if (selectedPlace?.haloSpotId === place.haloSpotId) {
      closeDetail();
      return;
    }

    setSelectedPlace(place);
    setDetail(null);
    setGalleryIndex(0);
    setDetailLoading(true);
    setError('');
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
    <main className={selectedPlace ? 'halo-map-page has-selection' : 'halo-map-page'}>
      <MapView
        places={mapPlaces}
        selectedPlaceId={selectedPlace?.id || null}
        hoveredPlaceId={hoveredPlaceId}
        onSelectPlace={selectSpot}
        onHoverPlace={setHoveredPlaceId}
        onSelectStatusFeature={() => {}}
        mapData={EMPTY_GEOJSON}
        activeLayers={[]}
        basemapMode="streets"
        onViewportChange={setViewport}
        focusRegion={focusRegion}
      />

      <aside className="halo-story-rail">
        <header className="halo-story-head">
          <div className="halo-story-brand-row">
            <div className="halo-story-brand-icon"><Camera size={19} /></div>
            <div>
              <span>HALO HOLA × HOLA MAPS</span>
              <h1>Góc nhìn Hòa Lạc</h1>
            </div>
            <div className="halo-story-count" title="Số điểm trong vùng đang xem">
              <b>{places.length}</b>
              <small>điểm</small>
            </div>
          </div>
          <p>Ảnh và câu chuyện cộng đồng được đặt đúng nơi chúng diễn ra.</p>
          <div className="halo-story-actions">
            {embedded ? (
              <Link to="/embed"><ArrowLeft size={15} /> Bản đồ</Link>
            ) : (
              <Link to="/map"><MapIcon size={15} /> Bản đồ chính</Link>
            )}
            <a href="https://halohola.vn/" target="_blank" rel="noreferrer">
              HALO HOLA <ExternalLink size={14} />
            </a>
          </div>
        </header>

        <div className="halo-story-list-heading">
          <div>
            <span>TRONG VÙNG ĐANG XEM</span>
            <strong>{loading ? 'Đang cập nhật…' : `${places.length} góc nhìn`}</strong>
          </div>
          {loading ? <RefreshCw className="spin" size={15} /> : <Sparkles size={15} />}
        </div>

        <div className="halo-story-list">
          {places.slice(0, STORY_LIMIT).map((place) => {
            const active = String(selectedPlace?.id) === String(place.id);
            return (
              <button
                key={place.id}
                type="button"
                className={active ? 'halo-story-card active' : 'halo-story-card'}
                onClick={() => selectSpot(place)}
                onMouseEnter={() => setHoveredPlaceId(place.id)}
                onMouseLeave={() => setHoveredPlaceId(null)}
              >
                <div className="halo-story-card-media">
                  {place.image ? (
                    <img src={place.image} alt="" loading="lazy" />
                  ) : (
                    <Camera size={22} />
                  )}
                  {place.haloMediaCount > 1 && <span><Images size={11} /> {place.haloMediaCount}</span>}
                </div>
                <div className="halo-story-card-copy">
                  <span>HALO HOLA</span>
                  <strong>{place.name}</strong>
                  <small><MapPin size={12} /> {place.address || 'Hòa Lạc'}</small>
                  <em>{place.haloPostCount || 1} câu chuyện · {place.haloMediaCount || 1} ảnh</em>
                </div>
                <ChevronRight size={17} />
              </button>
            );
          })}

          {!loading && !error && places.length === 0 && (
            <div className="halo-story-empty">
              <Camera size={24} />
              <strong>Chưa có Góc nhìn ở khu vực này</strong>
              <span>Kéo bản đồ sang khu vực khác để khám phá câu chuyện gần đó.</span>
            </div>
          )}
        </div>

        <footer className="halo-story-foot" aria-live="polite">
          {error ? <span>{error}</span> : <span>Kéo bản đồ để cập nhật các Góc nhìn quanh bạn.</span>}
        </footer>
      </aside>

      {selectedPlace && (
        <aside className="halo-story-detail">
          <button className="halo-gallery-close" type="button" onClick={closeDetail} aria-label="Đóng gallery">
            <X size={18} />
          </button>

          <div className="halo-gallery-heading">
            <span><Sparkles size={14} /> HALO HOLA</span>
            <h2>{detail?.label || selectedPlace.name}</h2>
            <p><MapPin size={14} /> {detail?.address || selectedPlace.address}</p>
          </div>

          {detailLoading ? (
            <div className="halo-gallery-loading"><RefreshCw className="spin" size={18} /> Đang tải câu chuyện…</div>
          ) : media.length ? (
            <>
              <div className="halo-gallery-hero">
                <img src={activeMedia?.url || activeMedia?.thumbnailUrl} alt={mediaTitle(activeMedia)} />
                {media.length > 1 && (
                  <>
                    <button type="button" className="prev" onClick={previous} aria-label="Ảnh trước"><ChevronLeft size={20} /></button>
                    <button type="button" className="next" onClick={next} aria-label="Ảnh tiếp"><ChevronRight size={20} /></button>
                  </>
                )}
                <span><Images size={13} /> {galleryIndex + 1}/{media.length}</span>
              </div>

              <div className="halo-detail-story-title">
                <span>{activeMedia?.metadata?.theme || activeMedia?.metadata?.type || 'Góc nhìn cộng đồng'}</span>
                <h3>{mediaTitle(activeMedia)}</h3>
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

              {media.length > 1 && (
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
              )}

              <div className="halo-gallery-footer">
                <span><b>{detail?.mediaCount || media.length}</b> ảnh tại điểm này</span>
                {detail?.placeId && (
                  <Link to={embedded ? '/embed?place=' + detail.placeId : '/place/' + detail.placeId}>
                    Mở địa điểm <ExternalLink size={14} />
                  </Link>
                )}
              </div>
            </>
          ) : (
            <div className="halo-gallery-empty">Chưa có ảnh công khai tại điểm này.</div>
          )}
        </aside>
      )}

      <div className="halo-map-status" aria-live="polite">
        {loading ? <><RefreshCw className="spin" size={14} /> Đang cập nhật vùng bản đồ…</> : null}
        {!loading && error ? <span>{error}</span> : null}
      </div>
    </main>
  );
}
