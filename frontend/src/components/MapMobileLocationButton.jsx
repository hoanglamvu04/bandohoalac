import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, LocateFixed } from 'lucide-react';

export default function MapMobileLocationButton() {
  const [target, setTarget] = useState(null);
  const [locating, setLocating] = useState(false);
  const [located, setLocated] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const syncTarget = () => {
      setTarget(document.querySelector('.hm-discovery-filters'));
    };

    syncTarget();
    const frame = window.requestAnimationFrame(syncTarget);
    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!target || typeof document === 'undefined') return undefined;

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
  }, [target]);

  if (!target) return null;

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
      aria-label={label}
      title={label}
    >
      {located && !locating ? <Check size={14} /> : <LocateFixed size={14} />}
      <span>{label}</span>
    </button>,
    target
  );
}
