const DEFAULT_ITEMS = [
  { value: 'Cafe', label: 'Cafe', icon: '☕' },
  { value: 'Ăn uống', label: 'Ăn uống', icon: '🍜' },
  { value: 'Homestay', label: 'Homestay', icon: '🏡' },
  { value: 'Villa', label: 'Villa', icon: '🏘️' },
  { value: 'Check-in', label: 'Check-in', icon: '📸' },
  { value: 'Trải nghiệm', label: 'Trải nghiệm', icon: '🎡' }
];

const ICON_BY_SLUG = {
  coffee: '☕',
  utensils: '🍜',
  home: '🏡',
  building: '🏘️',
  camera: '📸',
  'ferris-wheel': '🎡'
};

export default function CategoryBar({ active = 'all', onChange = () => {}, compact = false, categories = [] }) {
  const items = categories.length
    ? categories.map((category) => ({
      value: category.name,
      label: category.name,
      icon: ICON_BY_SLUG[category.icon] || '📍'
    }))
    : DEFAULT_ITEMS;

  return (
    <div className={compact ? 'category-bar compact' : 'category-bar'}>
      <button className={active === 'all' ? 'category-chip active' : 'category-chip'} onClick={() => onChange('all')} type="button">
        <span>✨</span> Tất cả
      </button>
      {items.map((item) => (
        <button
          key={item.value}
          className={active === item.value ? 'category-chip active' : 'category-chip'}
          onClick={() => onChange(item.value)}
          type="button"
        >
          <span>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}
