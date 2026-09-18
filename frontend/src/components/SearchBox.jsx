import { Search, SlidersHorizontal } from 'lucide-react';

export default function SearchBox({
  value = '',
  onChange = () => {},
  onSubmit = () => {},
  compact = false,
  placeholder = 'Tìm cafe, villa, homestay, địa điểm...'
}) {
  function submit(event) {
    event.preventDefault();
    onSubmit(value.trim());
  }

  return (
    <form className={compact ? 'search-box compact' : 'search-box'} onSubmit={submit}>
      <Search size={21} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Tìm địa điểm"
      />
      {!compact && (
        <button className="search-filter" type="button" aria-label="Bộ lọc">
          <SlidersHorizontal size={18} />
        </button>
      )}
      <button className="search-submit" type="submit">Tìm</button>
    </form>
  );
}
