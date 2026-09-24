import {
  Camera,
  Coffee,
  FerrisWheel,
  Home,
  Sparkles,
  Utensils,
  Building2,
  MapPin
} from 'lucide-react';

const DEFAULT_ITEMS = [
  { value: 'Ăn uống', label: 'Ăn uống', icon: Utensils },
  { value: 'Cafe', label: 'Cafe', icon: Coffee },
  { value: 'Check-in', label: 'Check-in', icon: Camera },
  { value: 'Homestay', label: 'Homestay', icon: Home },
  { value: 'Trải nghiệm', label: 'Trải nghiệm', icon: FerrisWheel },
  { value: 'Villa', label: 'Villa', icon: Building2 }
];

export default function CategoryBar({ active = 'all', onChange = () => {}, compact = false, categories = [] }) {
  const items = categories.length
    ? categories.map((category) => ({
      value: category.name,
      label: category.name,
      icon: MapPin
    }))
    : DEFAULT_ITEMS;

  return (
    <div className={compact ? 'category-bar compact modern-category-bar' : 'category-bar modern-category-bar'}>
      <button
        className={active === 'all' ? 'category-chip active' : 'category-chip'}
        onClick={() => onChange('all')}
        type="button"
      >
        <span className="category-icon"><Sparkles size={18} /></span>
        Tất cả
      </button>

      {items.map((item) => {
        const Icon = item.icon;

        return (
          <button
            key={item.value}
            className={active === item.value ? 'category-chip active' : 'category-chip'}
            onClick={() => onChange(item.value)}
            type="button"
          >
            <span className="category-icon"><Icon size={18} /></span>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
