import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Clock3,
  Heart,
  Image as ImageIcon,
  MapPin,
  Navigation,
  Phone,
  Share2,
  Star,
  Users
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getPlace } from '../services/api.js';

export default function PlaceDetail() {
  const { id } = useParams();
  const [place, setPlace] = useState(null);
  const [status, setStatus] = useState('loading');
  const [shareLabel, setShareLabel] = useState('Chia sẻ');

  useEffect(() => {
    let active = true;
    setStatus('loading');

    getPlace(id)
      .then((data) => {
        if (!active) return;
        setPlace(data);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [id]);

  const images = useMemo(() => (Array.isArray(place?.images) ? place.images.filter(Boolean) : []), [place]);
  const rating = Number(place?.rating);
  const hasRating = Number.isFinite(rating) && rating > 0;

  async function sharePlace() {
    if (!place) return;

    const payload = {
      title: place.name,
      text: 'Xem địa điểm này trên Hola Maps',
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }

      await navigator.clipboard.writeText(window.location.href);
      setShareLabel('Đã sao chép');
      window.setTimeout(() => setShareLabel('Chia sẻ'), 1600);
    } catch {
      setShareLabel('Chia sẻ');
    }
  }

  if (status === 'loading') {
    return (
      <main className="detail-page premium-detail-page">
        <div className="detail-loading-shell">
          <div className="detail-loading-line short" />
          <div className="detail-loading-line title" />
          <div className="detail-loading-gallery" />
          <div className="detail-loading-columns">
            <div className="detail-loading-panel" />
            <div className="detail-loading-panel small" />
          </div>
        </div>
      </main>
    );
  }

  if (status === 'error' || !place) {
    return (
      <main className="detail-page premium-detail-page">
        <div className="empty-state premium-detail-error">
          <MapPin size={28} />
          <b>Không tìm thấy địa điểm</b>
          <span>Địa điểm này có thể chưa được duyệt hoặc đã bị gỡ khỏi hệ thống.</span>
          <Link to="/map" className="primary-action">Quay lại bản đồ</Link>
        </div>
      </main>
    );
  }

  const galleryClass = 'detail-gallery premium-detail-gallery image-count-' + Math.min(images.length, 5);

  return (
    <main className="detail-page premium-detail-page">
      <div className="detail-topbar">
        <Link to="/map" className="back-link"><ArrowLeft size={18} /> Quay lại bản đồ</Link>
        <div className="detail-actions">
          <button type="button" onClick={sharePlace}><Share2 size={17} /> {shareLabel}</button>
          <button type="button"><Heart size={17} /> Lưu</button>
        </div>
      </div>

      <section className="place-detail-heading">
        <div>
          <div className="place-detail-badges">
            <span className="place-kicker">{place.category || 'Khám phá'}</span>
            {place.status === 'PUBLISHED' && (
              <span className="detail-published-badge"><BadgeCheck size={15} /> Đã xuất bản</span>
            )}
          </div>

          <h1>{place.name}</h1>

          <div className="detail-rating">
            <Star size={18} fill={hasRating ? 'currentColor' : 'none'} />
            <b>{hasRating ? rating.toFixed(1) : 'Mới'}</b>
            <span>{place.reviews || 0} đánh giá</span>
            <span>•</span>
            <MapPin size={17} />
            <span>{place.address || 'Hòa Lạc, Hà Nội'}</span>
          </div>
        </div>

        <div className="detail-heading-side">
          <span className="detail-source-pill">{place.source === 'ADMIN' ? 'Hola Maps' : 'Cộng đồng đóng góp'}</span>
        </div>
      </section>

      <section className={galleryClass}>
        <div
          className="gallery-main premium-gallery-main"
          style={images[0] ? { backgroundImage: 'url("' + images[0] + '")' } : undefined}
        >
          {!images[0] && (
            <div className="gallery-empty-state">
              <ImageIcon size={38} />
              <span>Chưa có ảnh đại diện</span>
            </div>
          )}
          {images.length > 0 && <span className="gallery-photo-count"><Camera size={15} /> {images.length} ảnh</span>}
        </div>

        <div className="gallery-side premium-gallery-side">
          {[1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className="gallery-side-cell"
              style={images[index] ? { backgroundImage: 'url("' + images[index] + '")' } : undefined}
            >
              {!images[index] && <ImageIcon size={22} />}
            </div>
          ))}
        </div>
      </section>

      <section className="detail-fact-strip">
        <div><span><Clock3 size={18} /></span><small>Giờ mở cửa</small><b>{place.openingHours || 'Chưa cập nhật'}</b></div>
        <div><span><MapPin size={18} /></span><small>Khu vực</small><b>Hòa Lạc</b></div>
        <div><span><Star size={18} /></span><small>Đánh giá</small><b>{hasRating ? rating.toFixed(1) + '/5' : 'Mới'}</b></div>
        <div><span><Camera size={18} /></span><small>Ảnh cộng đồng</small><b>{images.length}</b></div>
      </section>

      <section className="detail-layout premium-detail-layout">
        <div className="detail-main">
          <section className="detail-content-block">
            <span className="eyebrow">TRẢI NGHIỆM</span>
            <h2>Điều cần biết trước khi ghé</h2>
            <p className="detail-description">
              {place.description || 'Địa điểm này chưa có mô tả chi tiết. Bạn có thể đóng góp thêm thông tin sau khi trải nghiệm.'}
            </p>
          </section>

          <div className="detail-divider" />

          <section className="detail-content-block">
            <span className="eyebrow">DỮ LIỆU ĐỊA PHƯƠNG</span>
            <h2>Thông tin được cộng đồng xây dựng</h2>
            <div className="contributor-box premium-contributor-box">
              <div className="avatar-placeholder"><Users size={20} /></div>
              <div>
                <h3>{place.source === 'ADMIN' ? 'Đội ngũ Hola Maps' : 'Cộng đồng Hola Explorer'}</h3>
                <p>Thông tin được đưa vào hệ thống, kiểm tra và xuất bản trước khi hiển thị công khai.</p>
              </div>
              <BadgeCheck size={23} />
            </div>
          </section>
        </div>

        <aside className="detail-info-card premium-detail-info-card">
          <div className="detail-card-head">
            <div>
              <span className="eyebrow">QUICK INFO</span>
              <h3>Thông tin nhanh</h3>
            </div>
            <BadgeCheck size={22} />
          </div>

          <div className="detail-info-row">
            <Clock3 size={18} />
            <span><small>Giờ hoạt động</small><b>{place.openingHours || 'Chưa cập nhật'}</b></span>
          </div>

          <div className="detail-info-row">
            <Phone size={18} />
            <span><small>Điện thoại</small><b>{place.phone || 'Chưa cập nhật'}</b></span>
          </div>

          <div className="detail-info-row">
            <MapPin size={18} />
            <span><small>Địa chỉ</small><b>{place.address || 'Hòa Lạc, Hà Nội'}</b></span>
          </div>

          {place.priceLevel && (
            <div className="detail-price-box">
              <small>Khoảng giá tham khảo</small>
              <strong>{place.priceLevel}</strong>
            </div>
          )}

          {place.lat && place.lng && (
            <a
              className="primary-action wide premium-direction-button"
              href={'https://www.google.com/maps/search/?api=1&query=' + place.lat + ',' + place.lng}
              target="_blank"
              rel="noreferrer"
            >
              <Navigation size={18} /> Mở chỉ đường
            </a>
          )}
        </aside>
      </section>
    </main>
  );
}
