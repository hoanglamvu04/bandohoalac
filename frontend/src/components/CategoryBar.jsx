const items = [
  { value: 'all', label: 'Tất cả', icon: '✨' },
  { value: 'Cafe', label: 'Cafe', icon: '☕' },
  { value: 'Ăn uống', label: 'Ăn uống', icon: '🍜' },
  { value: 'Homestay', label: 'Homestay', icon: '🏡' },
  { value: 'Villa', label: 'Villa', icon: '🏘️' },
  { value: 'Check-in', label: 'Check-in', icon: '📸' },
  { value: 'Trải nghiệm', label: 'Trải nghiệm', icon: '🎡' }
];

export default function CategoryBar({ active = 'all', onChange = () => {}, compact = false }) {
  return (
    <div className={compact ? 'category-bar compact' : 'category-bar'}>
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
