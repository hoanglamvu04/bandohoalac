import { useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, Clock3, Heart, MapPin, Navigation, Phone, Share2, Star, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getPlace } from '../services/api.js';

const fallback = {
  id: '1',
  name: 'The Lake Coffee',
  category: 'Cafe',
  rating: 4.8,
  reviews: 126,
  address: 'Thạch Hòa, Hòa Lạc, Hà Nội',
  phone: '0900 000 000',
  openingHours: '07:00 - 22:00',
  description: 'Không gian nhiều cây xanh, view mở và phù hợp cho một buổi chiều chậm rãi ở Hòa Lạc.',
  contributor: 'Chinh Explorer',
  highlights: ['View thoáng', 'Có chỗ đỗ ô tô', 'Không gian ngoài trời', 'Phù hợp nhóm bạn']
};

export default function PlaceDetail() {
  const { id } = useParams();
  const [place, setPlace] = useState(fallback);

  useEffect(() => {
    getPlace(id).then((data) => data && setPlace({ ...fallback, ...data })).catch(() => {});
  }, [id]);

  return (
    <main className="detail-page">
      <div className="detail-topbar">
        <Link to="/map" className="back-link"><ArrowLeft size={18} /> Quay lại bản đồ</Link>
        <div className="detail-actions">
          <button><Share2 size={17} /> Chia sẻ</button>
          <button><Heart size={17} /> Lưu</button>
        </div>
      </div>

      <section className="detail-gallery">
        <div className="gallery-main"><span>🌿</span></div>
        <div className="gallery-side"><div>☕</div><div>🌄</div></div>
      </section>

      <section className="detail-layout">
        <div className="detail-main">
          <span className="place-kicker">{place.category}</span>
          <h1>{place.name}</h1>
          <div className="detail-rating">
            <Star size={18} fill="currentColor" />
            <b>{place.rating}</b>
            <span>{place.reviews} đánh giá</span>
            <span>•</span>
            <BadgeCheck size={17} />
            <span>Đã xác minh</span>
          </div>

          <div className="detail-address">
            <MapPin size={19} />
            <div><b>{place.address}</b><span>Khu vực Hòa Lạc, Hà Nội</span></div>
          </div>

          <div className="detail-divider" />
          <h2>Vì sao nên ghé?</h2>
          <p className="detail-description">{place.description}</p>
          <div className="highlight-grid">
            {place.highlights?.map((item) => <span key={item}>✓ {item}</span>)}
          </div>

          <div className="detail-divider" />
          <div className="contributor-box">
            <div className="avatar-placeholder">CE</div>
            <div>
              <span className="eyebrow">NGƯỜI ĐÓNG GÓP</span>
              <h3>{place.contributor}</h3>
              <p>Thông tin và ảnh đã được cộng đồng Hola Maps bổ sung.</p>
            </div>
            <Users size={24} />
          </div>
        </div>

        <aside className="detail-info-card">
          <h3>Thông tin nhanh</h3>
          <div><Clock3 size={18} /><span><small>Giờ mở cửa</small><b>{place.openingHours}</b></span></div>
          <div><Phone size={18} /><span><small>Điện thoại</small><b>{place.phone}</b></span></div>
          <div><MapPin size={18} /><span><small>Khu vực</small><b>Hòa Lạc</b></span></div>
          <a className="primary-action wide" href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place.address)} target="_blank" rel="noreferrer">
            <Navigation size={18} /> Mở chỉ đường
          </a>
        </aside>
      </section>
    </main>
  );
}
