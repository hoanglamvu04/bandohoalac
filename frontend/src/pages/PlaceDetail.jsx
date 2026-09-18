import { useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, Clock3, Heart, MapPin, Navigation, Phone, Share2, Star, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getPlace } from '../services/api.js';

// DEMO-ONLY placeholder shown while the real place is loading or if the
// request fails. Never merged with production data from the API.
const DEMO_FALLBACK_PLACE = {
  name: 'Đang tải địa điểm...',
  category: '',
  rating: 0,
  reviews: 0,
  address: '',
  phone: '',
  openingHours: '',
  description: '',
  images: []
};

export default function PlaceDetail() {
  const { id } = useParams();
  const [place, setPlace] = useState(DEMO_FALLBACK_PLACE);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    setStatus('loading');
    getPlace(id)
      .then((data) => {
        setPlace(data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [id]);

  if (status === 'error') {
    return (
      <main className="detail-page">
        <div className="empty-state" style={{ margin: '60px auto', maxWidth: 420 }}>
          <MapPin size={26} />
          <b>Không tìm thấy địa điểm</b>
          <span>Địa điểm này có thể chưa được duyệt hoặc đã bị gỡ bỏ.</span>
          <Link to="/map" className="primary-action" style={{ marginTop: 12 }}>Quay lại bản đồ</Link>
        </div>
      </main>
    );
  }

  const cover = place.images?.[0];

  return (
    <main className="detail-page">
      <div className="detail-topbar">
        <Link to="/map" className="back-link"><ArrowLeft size={18} /> Quay lại bản đồ</Link>
        <div className="detail-actions">
          <button type="button"><Share2 size={17} /> Chia sẻ</button>
          <button type="button"><Heart size={17} /> Lưu</button>
        </div>
      </div>

      <section className="detail-gallery">
        <div className="gallery-main" style={cover ? { background: `url(${cover}) center/cover` } : undefined}>
          {!cover && <span>🌿</span>}
        </div>
        <div className="gallery-side">
          <div style={place.images?.[1] ? { background: `url(${place.images[1]}) center/cover` } : undefined}>{!place.images?.[1] && '☕'}</div>
          <div style={place.images?.[2] ? { background: `url(${place.images[2]}) center/cover` } : undefined}>{!place.images?.[2] && '🌄'}</div>
        </div>
      </section>

      <section className="detail-layout">
        <div className="detail-main">
          <span className="place-kicker">{place.category || 'Khám phá'}</span>
          <h1>{place.name}</h1>
          <div className="detail-rating">
            <Star size={18} fill="currentColor" />
            <b>{place.rating || '—'}</b>
            <span>{place.reviews || 0} đánh giá</span>
            {place.status === 'PUBLISHED' && (
              <>
                <span>•</span>
                <BadgeCheck size={17} />
                <span>Đã xác minh</span>
              </>
            )}
          </div>

          <div className="detail-address">
            <MapPin size={19} />
            <div><b>{place.address || 'Chưa có địa chỉ chi tiết'}</b><span>Khu vực Hòa Lạc, Hà Nội</span></div>
          </div>

          <div className="detail-divider" />
          <h2>Vì sao nên ghé?</h2>
          <p className="detail-description">{place.description || 'Chưa có mô tả cho địa điểm này.'}</p>

          <div className="detail-divider" />
          <div className="contributor-box">
            <div className="avatar-placeholder"><Users size={20} /></div>
            <div>
              <span className="eyebrow">NGUỒN DỮ LIỆU</span>
              <h3>{place.source === 'ADMIN' ? 'Hola Maps' : 'Cộng đồng Hola Explorer'}</h3>
              <p>Thông tin và ảnh đã được cộng đồng Hola Maps bổ sung và kiểm duyệt.</p>
            </div>
          </div>
        </div>

        <aside className="detail-info-card">
          <h3>Thông tin nhanh</h3>
          <div><Clock3 size={18} /><span><small>Giờ mở cửa</small><b>{place.openingHours || 'Chưa cập nhật'}</b></span></div>
          <div><Phone size={18} /><span><small>Điện thoại</small><b>{place.phone || 'Chưa cập nhật'}</b></span></div>
          <div><MapPin size={18} /><span><small>Khu vực</small><b>Hòa Lạc</b></span></div>
          {place.lat && place.lng && (
            <a className="primary-action wide" href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`} target="_blank" rel="noreferrer">
              <Navigation size={18} /> Mở chỉ đường
            </a>
          )}
        </aside>
      </section>
    </main>
  );
}
