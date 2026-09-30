import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  BadgePercent,
  Building2,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Heart,
  Image as ImageIcon,
  MapPin,
  Navigation,
  Phone,
  Share2,
  Star,
  Users,
  X
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import {
  addFavorite,
  getPlace,
  getPlaceMe,
  removeFavorite
} from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import PlaceReviews from '../components/PlaceReviews.jsx';
import PlaceContributionPanel from '../components/PlaceContributionPanel.jsx';

export default function PlaceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [place, setPlace] = useState(null);
  const [status, setStatus] = useState('loading');
  const [shareLabel, setShareLabel] = useState('Chia sẻ');
  const [favorite, setFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setActiveImageIndex(0);
    setGalleryOpen(false);

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

  useEffect(() => {
    if (!user || !id) {
      setFavorite(false);
      return;
    }

    getPlaceMe(id)
      .then((data) => setFavorite(Boolean(data?.favorite)))
      .catch(() => setFavorite(false));
  }, [id, user?.id]);

  const images = useMemo(() => (Array.isArray(place?.images) ? place.images.filter(Boolean) : []), [place]);
  const activeImage = images[activeImageIndex] || images[0] || null;

  useEffect(() => {
    if (!images.length) {
      setActiveImageIndex(0);
      setGalleryOpen(false);
      return;
    }

    if (activeImageIndex >= images.length) {
      setActiveImageIndex(0);
    }
  }, [images.length, activeImageIndex]);

  useEffect(() => {
    if (!galleryOpen || typeof window === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setGalleryOpen(false);
      } else if (event.key === 'ArrowLeft') {
        setActiveImageIndex((current) => (current - 1 + images.length) % images.length);
      } else if (event.key === 'ArrowRight') {
        setActiveImageIndex((current) => (current + 1) % images.length);
      }
    }

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [galleryOpen, images.length]);
  const rating = Number(place?.rating);
  const hasRating = Number.isFinite(rating) && rating > 0;

  function selectImage(index) {
    if (!images.length) return;
    setActiveImageIndex((index + images.length) % images.length);
  }

  function showPreviousImage(event) {
    event?.stopPropagation?.();
    if (images.length < 2) return;
    setActiveImageIndex((current) => (current - 1 + images.length) % images.length);
  }

  function showNextImage(event) {
    event?.stopPropagation?.();
    if (images.length < 2) return;
    setActiveImageIndex((current) => (current + 1) % images.length);
  }

  async function reloadPlace() {
    try {
      const data = await getPlace(id);
      setPlace(data);
    } catch {
      // Keep the current detail visible if a refresh fails.
    }
  }

  async function toggleFavorite() {
    if (!user) {
      showToast('Đăng nhập để lưu địa điểm.', 'info');
      return;
    }
    if (favoriteBusy) return;

    setFavoriteBusy(true);
    try {
      const data = favorite
        ? await removeFavorite(id)
        : await addFavorite(id);
      setFavorite(Boolean(data?.favorite));
      showToast(data?.favorite ? 'Đã lưu địa điểm.' : 'Đã bỏ lưu địa điểm.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setFavoriteBusy(false);
    }
  }

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
          <button
            type="button"
            className={favorite ? 'detail-favorite active' : 'detail-favorite'}
            onClick={toggleFavorite}
            disabled={favoriteBusy}
          >
            <Heart size={17} fill={favorite ? 'currentColor' : 'none'} />
            {favorite ? 'Đã lưu' : 'Lưu'}
          </button>
        </div>
      </div>

      <section className="place-detail-heading">
        <div>
          <div className="place-detail-badges">
            <span className="place-kicker">{place.category || 'Khám phá'}</span>
            {place.status === 'PUBLISHED' && (
              <span className="detail-published-badge"><BadgeCheck size={15} /> Đã xuất bản</span>
            )}
            {place.isPartner && (
              <Link className="detail-partner-badge" to="/rewards">
                <BadgePercent size={15} /> Đối tác Hola Maps
              </Link>
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
          {user ? (
            <Link className="detail-claim-place" to={'/claim-place/' + encodeURIComponent(place.id)}>
              <Building2 size={14} /> Bạn là chủ địa điểm này?
            </Link>
          ) : (
            <Link
              className="detail-claim-place"
              to="/login"
              state={{ from: { pathname: '/claim-place/' + place.id } }}
            >
              <Building2 size={14} /> Xác minh địa điểm
            </Link>
          )}
        </div>
      </section>

      <section className={galleryClass}>
        <div
          className={images.length ? 'gallery-main premium-gallery-main interactive' : 'gallery-main premium-gallery-main'}
          style={activeImage ? { backgroundImage: 'url("' + activeImage + '")' } : undefined}
          role={activeImage ? 'button' : undefined}
          tabIndex={activeImage ? 0 : undefined}
          aria-label={activeImage ? 'Mở ảnh ' + (activeImageIndex + 1) + ' toàn màn hình' : undefined}
          onClick={activeImage ? () => setGalleryOpen(true) : undefined}
          onKeyDown={activeImage ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setGalleryOpen(true);
            }
          } : undefined}
        >
          {!activeImage && (
            <div className="gallery-empty-state">
              <ImageIcon size={38} />
              <span>Chưa có ảnh đại diện</span>
            </div>
          )}

          {images.length > 1 && (
            <>
              <button
                className="detail-gallery-arrow prev"
                type="button"
                aria-label="Ảnh trước"
                onClick={showPreviousImage}
              >
                <ChevronLeft size={22} />
              </button>
              <button
                className="detail-gallery-arrow next"
                type="button"
                aria-label="Ảnh tiếp theo"
                onClick={showNextImage}
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          {images.length > 0 && (
            <span className="gallery-photo-count">
              <Camera size={15} /> {activeImageIndex + 1}/{images.length}
            </span>
          )}
        </div>

        {images.length > 1 && (
          <div className={'gallery-side premium-gallery-side side-count-' + Math.min(images.length - 1, 4)}>
            {images.slice(1, 5).map((image, offset) => {
              const index = offset + 1;
              return (
                <button
                  key={image + index}
                  type="button"
                  className={index === activeImageIndex ? 'gallery-side-cell active' : 'gallery-side-cell'}
                  style={{ backgroundImage: 'url("' + image + '")' }}
                  aria-label={'Xem ảnh ' + (index + 1)}
                  onClick={() => selectImage(index)}
                >
                  {index === activeImageIndex && <span>Đang xem</span>}
                </button>
              );
            })}
          </div>
        )}

        {images.length > 1 && (
          <div className="detail-mobile-gallery-strip" aria-label="Ảnh địa điểm">
            {images.map((image, index) => (
              <button
                type="button"
                key={image + index}
                className={index === activeImageIndex ? 'active' : ''}
                style={{ backgroundImage: 'url("' + image + '")' }}
                aria-label={'Xem ảnh ' + (index + 1)}
                aria-current={index === activeImageIndex ? 'true' : undefined}
                onClick={() => selectImage(index)}
              />
            ))}
          </div>
        )}
      </section>

      {galleryOpen && activeImage && (
        <div
          className="detail-gallery-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh địa điểm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setGalleryOpen(false);
          }}
        >
          <div className="detail-gallery-lightbox-shell">
            <button
              className="detail-gallery-lightbox-close"
              type="button"
              aria-label="Đóng"
              onClick={() => setGalleryOpen(false)}
            >
              <X size={22} />
            </button>

            <div className="detail-gallery-lightbox-stage">
              <img src={activeImage} alt={place.name + ' - ảnh ' + (activeImageIndex + 1)} />

              {images.length > 1 && (
                <>
                  <button
                    className="detail-gallery-lightbox-arrow prev"
                    type="button"
                    aria-label="Ảnh trước"
                    onClick={showPreviousImage}
                  >
                    <ChevronLeft size={26} />
                  </button>
                  <button
                    className="detail-gallery-lightbox-arrow next"
                    type="button"
                    aria-label="Ảnh tiếp theo"
                    onClick={showNextImage}
                  >
                    <ChevronRight size={26} />
                  </button>
                </>
              )}
            </div>

            <div className="detail-gallery-lightbox-footer">
              <strong>{activeImageIndex + 1} / {images.length}</strong>
              {images.length > 1 && (
                <div className="detail-gallery-lightbox-thumbs">
                  {images.map((image, index) => (
                    <button
                      type="button"
                      key={image + index}
                      className={index === activeImageIndex ? 'active' : ''}
                      onClick={() => selectImage(index)}
                      aria-label={'Xem ảnh ' + (index + 1)}
                    >
                      <img src={image} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="detail-fact-strip">
        <div><span><Clock3 size={18} /></span><small>Giờ mở cửa</small><b>{place.openingHours || 'Chưa cập nhật'}</b></div>
        <div><span><MapPin size={18} /></span><small>Khu vực</small><b>Hòa Lạc</b></div>
        <div><span><Star size={18} /></span><small>Đánh giá</small><b>{hasRating ? rating.toFixed(1) + '/5' : 'Mới'}</b></div>
        <div><span><Camera size={18} /></span><small>Ảnh cộng đồng</small><b>{images.length}</b></div>
      </section>

      <section className="detail-mobile-quick-actions">
        {place.lat && place.lng && (
          <a
            href={'https://www.google.com/maps/search/?api=1&query=' + place.lat + ',' + place.lng}
            target="_blank"
            rel="noreferrer"
          >
            <Navigation size={18} />
            <span>Chỉ đường</span>
          </a>
        )}
        <Link to={'/map?place=' + encodeURIComponent(place.id)}>
          <MapPin size={18} />
          <span>Xem bản đồ</span>
        </Link>
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

          <div className="detail-divider" />

          <PlaceReviews placeId={place.id} onChanged={reloadPlace} />

          <div className="detail-divider" />

          <PlaceContributionPanel place={place} />
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
