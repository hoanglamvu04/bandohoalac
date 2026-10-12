import '../mapInteractionBridge.js';
import '../map-experience-v2.css';
import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Coffee,
  GraduationCap,
  HeartPulse,
  Hotel,
  Layers3,
  MapPin,
  Route,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  X
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import MapPage from './MapPage.jsx';
import MapSearchV2 from '../components/MapSearchV2.jsx';
import MapPinOverlay from '../components/MapPinOverlay.jsx';
import { getHolaMapInstance } from '../mapInteractionBridge.js';

const THEMES = [
  { id: 'all', label: 'Tất cả', icon: MapPin, category: null },
  { id: 'food', label: 'Ăn uống', icon: UtensilsCrossed, category: 'an-uong' },
  { id: 'cafe', label: 'Cafe', icon: Coffee, category: 'cafe' },
  { id: 'education', label: 'Trường học', icon: GraduationCap, category: 'truong-hoc' },
  { id: 'health', label: 'Y tế', icon: HeartPulse, category: 'y-te' },
  { id: 'tourism', label: 'Du lịch', icon: Sparkles, category: 'khu-du-lich' },
  { id: 'stay', label: 'Lưu trú', icon: Hotel, category: 'homestay' },
  { id: 'shopping', label: 'Mua sắm', icon: ShoppingBag, category: 'sieu-thi' },
  { id: 'mobility', label: 'Di chuyển', icon: Route, category: 'giao-thong' },
  { id: 'property', label: 'Nhà đất', icon: Building2, category: 'bat-dong-san' }
];

const DESKTOP_ENGINE_GUTTER = 372;

function DesktopEnginePanelLayout() {
  useEffect(() => {
    const panel = document.querySelector('.hm-left-panel');
    if (!panel) return undefined;

    let lastPadding = null;

    const applyLayout = () => {
      const isDesktop = window.matchMedia('(min-width: 1100px)').matches;
      const panelOpen = panel.classList.contains('open');
      const nextPadding = isDesktop && panelOpen ? DESKTOP_ENGINE_GUTTER : 0;
      const map = getHolaMapInstance();

      if (!map || nextPadding === lastPadding) return;

      map.setPadding({
        top: 0,
        right: 0,
        bottom: 0,
        left: nextPadding
      });
      map.resize();
      lastPadding = nextPadding;
    };

    const observer = new MutationObserver(applyLayout);
    observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', applyLayout);

    const retryTimers = [0, 180, 450, 900, 1800, 3200].map((delay) =>
      window.setTimeout(applyLayout, delay)
    );

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', applyLayout);
      retryTimers.forEach((timer) => window.clearTimeout(timer));

      const map = getHolaMapInstance();
      if (map) {
        map.setPadding({ top: 0, right: 0, bottom: 0, left: 0 });
        map.resize();
      }
    };
  }, []);

  return null;
}

export default function MapDiscoveryPage() {
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const category = params.get('category') || 'all';
  const active = useMemo(
    () => THEMES.find((theme) => theme.category === category) || THEMES[0],
    [category]
  );

  function selectTheme(theme) {
    const next = new URLSearchParams(params);
    if (theme.category) next.set('category', theme.category);
    else next.delete('category');
    next.delete('place');
    next.delete('q');
    setParams(next, { replace: true });

    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches) {
      setOpen(false);
    }
  }

  return (
    <div className="map-discovery-v1 map-experience-v2">
      <MapPage />
      <MapSearchV2 />
      <MapPinOverlay />
      <DesktopEnginePanelLayout />

      <aside className={open ? 'theme-layer-dock open' : 'theme-layer-dock'} aria-label="Chuyên đề Hòa Lạc">
        <button className="theme-layer-toggle" type="button" onClick={() => setOpen((value) => !value)}>
          {open ? <X size={17} /> : <Layers3 size={18} />}
          <span>{open ? 'Đóng' : category === 'all' ? 'Chuyên đề' : active.label}</span>
        </button>

        {open && (
          <div className="theme-layer-panel">
            <div className="theme-layer-heading">
              <span><Layers3 size={18} /> Lớp chuyên đề</span>
              <small>Lọc nhanh địa điểm theo nhu cầu tại Hòa Lạc</small>
            </div>
            <div className="theme-layer-chips">
              {THEMES.map((theme) => {
                const Icon = theme.icon;
                const selected = active.id === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    className={selected ? 'active' : ''}
                    onClick={() => selectTheme(theme)}
                    aria-pressed={selected}
                  >
                    <Icon size={16} />
                    <span>{theme.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="theme-layer-note">
              Các lớp dữ liệu nền như quy hoạch, cảnh báo, ngập, công trình vẫn dùng nút Layers hiện có trên bản đồ.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
