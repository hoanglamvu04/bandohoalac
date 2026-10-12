import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ChevronRight } from 'lucide-react';
import '../map-halo-filter.css';

export default function MapHaloFilterPortal() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    let currentSlot = null;

    const sync = () => {
      const popover = document.querySelector('.hm-filter-popover');
      if (!popover) {
        setTarget(null);
        currentSlot = null;
        return;
      }

      let slot = popover.querySelector(':scope > .hm-halo-filter-slot');
      if (!slot) {
        slot = document.createElement('div');
        slot.className = 'hm-halo-filter-slot';
        const footer = popover.querySelector('.hm-filter-popover-footer');
        popover.insertBefore(slot, footer || null);
      }

      currentSlot = slot;
      setTarget((existing) => existing === slot ? existing : slot);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (currentSlot?.isConnected) currentSlot.remove();
    };
  }, []);

  if (!target) return null;

  return createPortal(
    <a className="hm-halo-filter-link" href="/halo">
      <span className="hm-halo-filter-icon"><Camera size={18} /></span>
      <span className="hm-halo-filter-copy">
        <strong>HALO HOLA</strong>
        <small>Ảnh & check-in cộng đồng</small>
      </span>
      <ChevronRight size={17} />
    </a>,
    target
  );
}
