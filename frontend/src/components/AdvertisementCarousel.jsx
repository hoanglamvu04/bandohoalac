import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  EyeOff,
  LogIn,
  Megaphone,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getAdvertisements,
  hideAdvertisementsToday
} from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function AdvertisementCarousel() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const viewportRef = useRef(null);
  const [items, setItems] = useState([]);
  const [hidden, setHidden] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [hideBusy, setHideBusy] = useState(false);

  useEffect(() => {
    let active = true;

    getAdvertisements()
      .then((data) => {
        if (!active) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setHidden(Boolean(data?.hiddenToday));
        setActiveIndex(0);
      })
      .catch(() => {
        if (active) setItems([]);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  if (hidden || !items.length) return null;

  function goTo(index) {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const safeIndex = (index + items.length) % items.length;
    const slide = viewport.children[safeIndex];
    if (!slide) return;

    viewport.scrollTo({
      left: slide.offsetLeft - viewport.offsetLeft,
      behavior: 'smooth'
    });
    setActiveIndex(safeIndex);
  }

  function syncActiveSlide() {
    const viewport = viewportRef.current;
    if (!viewport?.children?.length) return;

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    Array.from(viewport.children).forEach((slide, index) => {
      const distance = Math.abs(slide.offsetLeft - viewport.scrollLeft);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    setActiveIndex(nearestIndex);
  }

  async function hideToday() {
    if (!user) {
      setLoginPrompt(true);
      showToast('Đăng nhập để tắt quảng cáo trong hôm nay.', 'info');
      return;
    }

    if (hideBusy) return;
    setHideBusy(true);
    try {
      await hideAdvertisementsToday();
      setHidden(true);
      showToast('Đã ẩn quảng cáo đến hết hôm nay.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setHideBusy(false);
    }
  }

  return (
    <section className="home-ad-section" aria-label="Quảng cáo">
      <div className="home-ad-heading">
        <span><Megaphone size={14} /> Nội dung tài trợ</span>
        <button type="button" onClick={hideToday} disabled={hideBusy}>
          <EyeOff size={14} />
          {hideBusy ? 'Đang ẩn...' : 'Ẩn quảng cáo hôm nay'}
        </button>
      </div>

      <div className="home-ad-carousel">
        <div
          className="home-ad-viewport"
          ref={viewportRef}
          onScroll={syncActiveSlide}
        >
          {items.map((ad) => {
            const external = /^https?:\/\//i.test(ad.targetUrl || '');
            return (
              <a
                className="home-ad-slide"
                href={ad.targetUrl}
                target={external ? '_blank' : undefined}
                rel={external ? 'noreferrer' : undefined}
                key={ad.id}
                aria-label={ad.title}
              >
                <img
                  src={ad.imageUrl}
                  alt={ad.altText || ad.title}
                  loading="lazy"
                />
                <span className="home-ad-label">Quảng cáo</span>
              </a>
            );
          })}
        </div>

        {items.length > 1 && (
          <>
            <button
              className="home-ad-arrow prev"
              type="button"
              aria-label="Quảng cáo trước"
              onClick={() => goTo(activeIndex - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="home-ad-arrow next"
              type="button"
              aria-label="Quảng cáo tiếp theo"
              onClick={() => goTo(activeIndex + 1)}
            >
              <ChevronRight size={18} />
            </button>

            <div className="home-ad-dots" aria-label="Chọn quảng cáo">
              {items.map((ad, index) => (
                <button
                  type="button"
                  className={index === activeIndex ? 'active' : ''}
                  aria-label={'Xem quảng cáo ' + (index + 1)}
                  onClick={() => goTo(index)}
                  key={ad.id}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {loginPrompt && (
        <div className="home-ad-login-prompt">
          <div>
            <LogIn size={18} />
            <span>
              <b>Đăng nhập để ẩn quảng cáo</b>
              <small>Sau khi đăng nhập, bạn có thể tắt toàn bộ quảng cáo đến hết hôm nay.</small>
            </span>
          </div>
          <div>
            <Link to="/login">Đăng nhập</Link>
            <button type="button" onClick={() => setLoginPrompt(false)} aria-label="Đóng">
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
