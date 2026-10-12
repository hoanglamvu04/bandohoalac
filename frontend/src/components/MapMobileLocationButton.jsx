import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, LocateFixed } from 'lucide-react';

export default function MapMobileLocationButton() {
  const [target, setTarget] = useState(null);
  const [mobile, setMobile] = useState(false);
  const [locating, setLocating] = useState(false);
  const [located, setLocated] = useState(false);

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

    const syncState = () => {
      const nativeButton = document.querySelector('.hm-locate');
      const successNotice = document.querySelector('.hm-location-notice.success');
      const errorNotice = document.querySelector('.hm-location-notice.error');

      if (nativeButton) {
        setLocating(
          nativeButton.disabled ||
          String(nativeButton.textContent || '').toLowerCase().includes('đang lấy gps')
        );
      }

      if (successNotice) setLocated(true);
      if (errorNotice) setLocated(false);
    };

    syncState();
    const observer = new MutationObserver(syncState);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['disabled', 'class'],
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

  const label = locating ? 'Đang định vị' : located ? 'Đã định vị' : 'Vị trí của tôi';

  return createPortal(
    <button
      type="button"
      className={'hm-quick-filter hm-my-location-filter' + (located ? ' located' : '')}
      onClick={locate}
      disabled={locating}
      aria-label="Đưa bản đồ tới vị trí của tôi"
      title="Đưa bản đồ tới vị trí hiện tại"
    >
      {located && !locating ? <Check size={14} /> : <LocateFixed size={14} />}
      <span>{label}</span>
    </button>,
    target
  );
}
