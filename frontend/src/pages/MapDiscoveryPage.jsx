import '../mapInteractionBridge.js';
import '../map-experience-v2.css';
import { useMemo, useState } from 'react';
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
