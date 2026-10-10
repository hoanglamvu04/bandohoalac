import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Clock3,
  ExternalLink,
  Globe2,
  Images,
  MapPin,
  Navigation,
  Phone,
  Sparkles,
  Star,
  Users
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { client, getNearbyPlaces, getPlace } from '../services/api.js';
import PlaceContributionPanel from '../components/PlaceContributionPanel.jsx';
import PlaceReviews from '../components/PlaceReviews.jsx';

function uniqueImages(values = []) {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim())));
}

function distanceLabel(meters) {
  const value = Number(meters) || 0;
  if (!value) return '';
  return value >= 1000 ? (value / 1000).toFixed(1) + ' km' : Math.round(value) + ' m';
}

function normalizeWebsite(value) {
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : 'https://' + value;
}

export default function PlaceDetailV2() {
  const { id } = useParams();
  const [place, setPlace] = useState(null);
  const [status, setStatus] = useState('loading');
  const [nearby, setNearby] = useState([]);
  const [haloSpot, setHaloSpot] = useState(null);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setNearby([]);
    setHaloSpot(null);
    setActiveImage(0);

    getPlace(id)
      .then((data) => {
        if (!active) return;
        setPlace(data);
        setStatus('ready');

        if (Number.isFinite(Number(data?.lat)) && Number.isFinite(Number(data?.lng))) {
          getNearbyPlaces(data.lat, data.lng, 8000)
            .then((response) => {
              if (!active) return;
              const items = Array.isArray(response?.items) ? response.items : [];
              setNearby(items.filter((item) => String(item.id) !== String(data.id)).slice(0, 6));
            })
            .catch(() => {});
        }

        client.get('/halo/v1/places/' + encodeURIComponent(data.id), { params: { limit: 24 } })
          .then((response) => {
            if (active) setHaloSpot(response?.data?.item || null);
          })
          .catch(() => {});
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [id]);

  const images = useMemo(() => uniqueImages([
    ...(Array.isArray(place?.images) ? place.images : []),
    ...(Array.isArray(haloSpot?.media) ? haloSpot.media.map((item) => item?.url) : [])
  ]), [place, haloSpot]);

  if (status === 'loading') {
    return <main className="place-v2-state">Đang tải địa điểm...</main>;
  }

  if (status === 'error' || !place) {
    return (
      <main className="place-v2-state">
        <MapPin size={30} />
        <h1>Không tìm thấy địa điểm</h1>
        <Link to="/map">Quay lại bản đồ</Link>
      </main>
    );
  }

  const rating = Number(place.rating) || 0;
  const website = normalizeWebsite(place.website);
  const mapsUrl = Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lng))
    ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(place.lat + ',' + place.lng)
    : '';

  return (
    <main className="place-v2-page">
      <div className="place-v2-topbar">
        <Link to="/map" className="place-v2-back"><ArrowLeft size={18} /> Bản đồ</Link>
        <span className="place-v2-source"><BadgeCheck size={15} /> {place.source === 'ADMIN' ? 'Hola Maps' : 'Dữ liệu cộng đồng'}</span>
      </div>

      <section className="place-v2-hero">
        <div className="place-v2-heading">
          <span className="place-v2-kicker">{place.category || 'Địa điểm Hòa Lạc'}</span>
          <h1>{place.name}</h1>
          <div className="place-v2-rating-row">
            <span className="place-v2-rating"><Star size={17} fill="currentColor" /> {rating > 0 ? rating.toFixed(1) : 'Mới'}</span>
            <span>{place.reviews || 0} đánh giá</span>
            <span>•</span>
            <span><MapPin size={16} /> {place.address || 'Hòa Lạc, Hà Nội'}</span>
          </div>
        </div>

        <div className="place-v2-actions">
          {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer"><Navigation size={17} /> Chỉ đường</a>}
          {place.phone && <a href={'tel:' + place.phone}><Phone size={17} /> Gọi</a>}
          {website && <a href={website} target="_blank" rel="noreferrer"><Globe2 size={17} /> Website</a>}
        </div>
      </section>

      <section className="place-v2-gallery">
        <div className="place-v2-gallery-main">
          {images.length ? (
            <img src={images[Math.min(activeImage, images.length - 1)]} alt={place.name} />
          ) : (
            <div className="place-v2-gallery-empty"><Images size={36} /> Chưa có ảnh địa điểm</div>
          )}
          {images.length > 0 && <span className="place-v2-photo-count"><Camera size={15} /> {images.length} ảnh</span>}
        </div>
        {images.length > 1 && (
          <div className="place-v2-thumbs">
            {images.slice(0, 8).map((image, index) => (
              <button key={image + index} className={index === activeImage ? 'active' : ''} onClick={() => setActiveImage(index)} type="button">
                <img src={image} alt="" />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="place-v2-facts">
        <div><Clock3 size={19} /><span>Giờ mở cửa</span><strong>{place.openingHours || 'Chưa cập nhật'}</strong></div>
        <div><MapPin size={19} /><span>Khu vực</span><strong>{place.address || 'Hòa Lạc'}</strong></div>
        <div><Star size={19} /><span>Đánh giá</span><strong>{rating > 0 ? rating.toFixed(1) + '/5' : 'Mới'}</strong></div>
        <div><Users size={19} /><span>Ảnh HALO</span><strong>{haloSpot?.mediaCount || 0}</strong></div>
      </section>

      <div className="place-v2-grid">
        <section className="place-v2-card place-v2-about">
          <div className="place-v2-section-title"><Sparkles size={19} /><h2>Về địa điểm này</h2></div>
          <p>{place.description || 'Địa điểm này chưa có mô tả chi tiết. Bạn có thể đóng góp thêm thông tin để Hola Maps hữu ích hơn cho cộng đồng Hòa Lạc.'}</p>
          <div className="place-v2-contact-list">
            {place.phone && <a href={'tel:' + place.phone}><Phone size={17} /> {place.phone}</a>}
            {website && <a href={website} target="_blank" rel="noreferrer"><Globe2 size={17} /> {place.website} <ExternalLink size={14} /></a>}
          </div>
        </section>

        <section className="place-v2-card">
          <div className="place-v2-section-title"><MapPin size={19} /><h2>Thông tin địa phương</h2></div>
          <p><strong>Danh mục:</strong> {place.category || 'Địa điểm'}</p>
          <p><strong>Địa chỉ:</strong> {place.address || 'Chưa cập nhật'}</p>
          <p><strong>Tọa độ:</strong> {Number(place.lat).toFixed(5)}, {Number(place.lng).toFixed(5)}</p>
          {mapsUrl && <a className="place-v2-inline-action" href={mapsUrl} target="_blank" rel="noreferrer"><Navigation size={16} /> Mở chỉ đường</a>}
        </section>
      </div>

      {haloSpot?.media?.length > 0 && (
        <section className="place-v2-section">
          <div className="place-v2-section-head">
            <div>
              <span className="place-v2-kicker">HALO HOLA</span>
              <h2>Ảnh cộng đồng tại đây</h2>
              <p>Ảnh người dùng HALO HOLA đã gắn với đúng địa điểm trên Hola Maps.</p>
            </div>
            <Link to="/halo">Mở bản đồ cộng đồng</Link>
          </div>
          <div className="place-v2-halo-grid">
            {haloSpot.media.slice(0, 8).map((media) => (
              <article key={media.id}>
                <img src={media.thumbnailUrl || media.url} alt={media.caption || place.name} />
                <div>
                  <strong>{media.user?.name || 'Cộng đồng HALO'}</strong>
                  {media.caption && <p>{media.caption}</p>}
                  {media.sourceUrl && <a href={media.sourceUrl} target="_blank" rel="noreferrer">Xem bài gốc <ExternalLink size={13} /></a>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {nearby.length > 0 && (
        <section className="place-v2-section">
          <div className="place-v2-section-head">
            <div>
              <span className="place-v2-kicker">KHÁM PHÁ GẦN ĐÂY</span>
              <h2>Địa điểm quanh {place.name}</h2>
            </div>
            <Link to={'/map?place=' + encodeURIComponent(place.id)}>Xem trên bản đồ</Link>
          </div>
          <div className="place-v2-nearby-grid">
            {nearby.map((item) => (
              <Link to={'/place/' + encodeURIComponent(item.id)} key={item.id} className="place-v2-nearby-card">
                <div className="place-v2-nearby-image">
                  {item.cardImages?.[0] || item.images?.[0] ? <img src={item.cardImages?.[0] || item.images?.[0]} alt={item.name} /> : <MapPin size={28} />}
                </div>
                <div>
                  <span>{item.category || 'Địa điểm'}</span>
                  <strong>{item.name}</strong>
                  <small>{distanceLabel(item.distance)}</small>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="place-v2-section place-v2-community-tools">
        <PlaceReviews placeId={place.id} />
        <PlaceContributionPanel place={place} onChanged={() => {}} />
      </section>
    </main>
  );
}
