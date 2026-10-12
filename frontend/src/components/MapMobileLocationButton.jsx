import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LocateFixed } from 'lucide-react';

export default function MapMobileLocationButton() {
  const [target, setTarget] = useState(null);
  const [mobile, setMobile] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const media = window.matchMedia('(max-width: 760px)');
    const syncMobile = () => setMobile(media.matches);
    syncMobile();
    media.addEventListener?.('change', syncMobile);

    return () => media.removeEventListener?.('change', syncMobile);
  }, []);

  useEffect(() => {
    if (!mobile || typeof document === 'undefined') {
      setTarget(null);
      return undefined;
    }

    const syncTarget = () => {
      setTarget(document.querySelector('.hm-discovery-filters'));
    };

    syncTarget();
    const frame = window.requestAnimationFrame(syncTarget);

    return () => window.cancelAnimationFrame(frame);
  }, [mobile]);

  useEffect(() => {
    if (!mobile || !target || typeof document === 'undefined') return undefined;

    const nativeButton = document.querySelector('.hm-locate');
    if (!nativeButton) return undefined;

    const syncLocating = () => {
      setLocating(
        nativeButton.disabled ||
        String(nativeButton.textContent || '').toLowerCase().includes('đang lấy gps')
      );
    };

    syncLocating();
    const observer = new MutationObserver(syncLocating);
    observer.observe(nativeButton, {
      attributes: true,
      attributeFilter: ['disabled'],
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, [mobile, target]);

  if (!mobile || !target) return null;

  const locate = () => {
    const nativeButton = document.querySelector('.hm-locate');
    if (!nativeButton || nativeButton.disabled) return;
    nativeButton.click();
  };

  return createPortal(
    <button
      type="button"
      className="hm-quick-filter hm-my-location-filter"
      onClick={locate}
      disabled={locating}
      aria-label="Đưa bản đồ tới vị trí của tôi"
      title="Đưa bản đồ tới vị trí hiện tại"
    >
      <LocateFixed size={14} />
      <span>{locating ? 'Đang định vị' : 'Vị trí của tôi'}</span>
    </button>,
    target
  );
}
