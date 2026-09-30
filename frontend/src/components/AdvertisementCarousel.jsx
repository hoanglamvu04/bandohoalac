import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

const SESSION_DISMISS_KEY = 'hola_ads_modal_dismissed_session';

function isSessionDismissed() {
  try {
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberSessionDismissal() {
  try {
    sessionStorage.setItem(SESSION_DISMISS_KEY, '1');
  } catch {
    // Ignore storage restrictions.
  }
}

export default function AdvertisementCarousel() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const viewportRef = useRef(null);
  const [items, setItems] = useState([]);
  const [hidden, setHidden] = useState(false);
  const [dismissed, setDismissed] = useState(() => isSessionDismissed());
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

  const visible = !hidden && !dismissed && items.length > 0;

  useEffect(() => {
    if (!visible || typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        rememberSessionDismissal();
        setDismissed(true);
      }
    }

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  if (!visible || typeof document === 'undefined') return null;

  function dismissModal() {
    rememberSessionDismissal();
    setDismissed(true);
  }

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

  const modal = (
    <div
      className="ad-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismissModal();
      }}
    >
      <section
        className="ad-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Quảng cáo"
      >
        <header className="ad-modal-header">
          <span className="ad-modal-sponsored">
            <Megaphone size={15} />
            Nội dung tài trợ
          </span>

          <button
            className="ad-modal-close"
            type="button"
            onClick={dismissModal}
            aria-label="Đóng quảng cáo"
          >
            <X size={18} />
          </button>
        </header>

        <div className="ad-modal-carousel">
          <div
            className="ad-modal-viewport"
            ref={viewportRef}
            onScroll={syncActiveSlide}
          >
            {items.map((ad) => {
              const external = /^https?:\/\//i.test(ad.targetUrl || '');

              return (
                <a
                  className="ad-modal-slide"
                  href={ad.targetUrl}
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noreferrer' : undefined}
                  key={ad.id}
                  aria-label={ad.title}
                >
                  <img
                    src={ad.imageUrl}
                    alt={ad.altText || ad.title}
                  />
                  <span className="ad-modal-ad-label">Quảng cáo</span>
                </a>
              );
            })}
          </div>

          {items.length > 1 && (
            <>
              <button
                className="ad-modal-arrow prev"
                type="button"
                aria-label="Quảng cáo trước"
                onClick={() => goTo(activeIndex - 1)}
              >
                <ChevronLeft size={20} />
              </button>

              <button
                className="ad-modal-arrow next"
                type="button"
                aria-label="Quảng cáo tiếp theo"
                onClick={() => goTo(activeIndex + 1)}
              >
                <ChevronRight size={20} />
              </button>

              <div className="ad-modal-dots" aria-label="Chọn quảng cáo">
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

        <footer className="ad-modal-footer">
          <div className="ad-modal-counter">
            <b>{activeIndex + 1}</b>
            <span>/ {items.length}</span>
          </div>

          <button
            className="ad-modal-hide-today"
            type="button"
            onClick={hideToday}
            disabled={hideBusy}
          >
            <EyeOff size={15} />
            {hideBusy ? 'Đang ẩn...' : 'Ẩn quảng cáo hôm nay'}
          </button>
        </footer>

        {loginPrompt && (
          <div className="ad-modal-login-prompt">
            <div className="ad-modal-login-copy">
              <span className="ad-modal-login-icon">
                <LogIn size={18} />
              </span>
              <span>
                <b>Đăng nhập để ẩn quảng cáo</b>
                <small>
                  Đăng nhập một lần để tắt toàn bộ quảng cáo đến hết hôm nay.
                </small>
              </span>
            </div>

            <div className="ad-modal-login-actions">
              <Link
                to="/login"
                state={{ from: { pathname: '/' } }}
              >
                Đăng nhập
              </Link>
              <button
                type="button"
                onClick={() => setLoginPrompt(false)}
                aria-label="Đóng yêu cầu đăng nhập"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );

  return createPortal(modal, document.body);
}
