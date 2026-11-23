import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChevronDown, GitCompareArrows, Plus, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  compareHousing, createHousingSavedSearch, deleteHousingSavedSearch,
  listHousingSavedSearches, toggleHousingSavedSearch
} from '../services/api.js';
import '../housing-intelligence.css';

const FILTER_KEYS = [
  'q', 'listingType', 'propertyType', 'minRent', 'maxRent',
  'minPrice', 'maxPrice', 'minArea', 'maxArea',
  'availability', 'availableOnly', 'partnerOnly',
  'privateBathroom', 'parking', 'maxDistanceFpt'
];

function cleanSavedFilters(filters = {}) {
  return Object.fromEntries(FILTER_KEYS
    .filter((key) => filters[key] !== undefined && filters[key] !== null &&
      filters[key] !== '' && filters[key] !== false)
    .map((key) => [key, filters[key]]));
}

function vnMoney(amount, unit = 'đ') {
  if (amount === null || amount === undefined || amount === '') return 'Chưa có';
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 'Chưa có';
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n) + ' ' + unit;
}

function priceFor(item) {
  return item.housing?.listingType === 'SALE'
    ? vnMoney(item.housing?.totalPriceVnd)
    : vnMoney(item.housing?.monthlyRent, 'đ/tháng');
}

const PROPERTY_TYPES = {
  LAND: 'Đất', HOUSE: 'Nhà', APARTMENT: 'Chung cư',
  VILLA: 'Biệt thự', COMMERCIAL: 'Thương mại', OTHER: 'Khác'
};

export default function HousingIntelligencePanel({
  user, places = [], currentFilters = {}, onApplySavedSearch
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [comparisonError, setComparisonError] = useState('');
  const [saved, setSaved] = useState([]);
  const [savedName, setSavedName] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedError, setSavedError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const comparingRef = useRef(0);

  const candidates = useMemo(() => places.filter((p) =>
    p?.housing && /^\d+$/.test(String(p.id)) &&
    p.housing?.listingStatus !== 'EXPIRED'
  ).slice(0, 30), [places]);
  const availableToAdd = candidates.filter((place) =>
    !selected.includes(String(place.id)));
  const filterCount = Object.keys(cleanSavedFilters(currentFilters)).length;

  useEffect(() => {
    if (!open || !user?.id) return undefined;
    let active = true;
    setLoaded(false);
    listHousingSavedSearches()
      .then((data) => {
        if (active) setSaved(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {
        if (active) setSavedError('Không tải được bộ lọc đã lưu.');
      })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [open, user?.id]);

  function chooseProperty(id) {
    if (!id || selected.includes(id) || selected.length >= 4) return;
    comparingRef.current += 1;
    setSelected((current) => [...current, id]);
    setComparison(null);
    setComparisonError('');
  }

  function removeProperty(id) {
    comparingRef.current += 1;
    setSelected((current) => current.filter((value) => value !== id));
    setComparison(null);
  }

  async function compare() {
    if (selected.length < 2 || selected.length > 4) return;
    const requestId = ++comparingRef.current;
    setComparing(true);
    setComparisonError('');
    setComparison(null);
    try {
      const data = await compareHousing({ ids: selected });
      if (comparingRef.current !== requestId) return;
      setComparison(data);
    } catch (error) {
      if (comparingRef.current === requestId) {
        setComparisonError(error.message || 'Không thể so sánh các tin đã chọn.');
      }
    } finally {
      if (comparingRef.current === requestId) setComparing(false);
    }
  }

  async function saveCurrentSearch() {
    if (!user) return;
    const filters = cleanSavedFilters(currentFilters);
    if (!Object.keys(filters).length) {
      setSavedError('Hãy chọn ít nhất một tiêu chí tìm kiếm trước khi lưu.');
      return;
    }
    const name = savedName.trim();
    if (name.length < 2 || name.length > 80) {
      setSavedError('Đặt tên cho bộ lọc từ 2 đến 80 ký tự.');
      return;
    }
    setSaving(true);
    setSavedError('');
    try {
      const { item } = await createHousingSavedSearch(name, filters);
      setSaved((current) => [item, ...current]);
      setSavedName('');
    } catch (error) {
      setSavedError(error.message || 'Không lưu được bộ lọc.');
    } finally { setSaving(false); }
  }

  async function flipSaved(item) {
    setSavedError('');
    try {
      const { item: updated } = await toggleHousingSavedSearch(item.id, !item.enabled);
      setSaved((current) => current.map((s) => s.id === updated.id ? updated : s));
    } catch (error) { setSavedError(error.message || 'Không cập nhật được cảnh báo.'); }
  }

  async function removeSaved(item) {
    setSavedError('');
    try {
      await deleteHousingSavedSearch(item.id);
      setSaved((current) => current.filter((s) => s.id !== item.id));
    } catch (error) { setSavedError(error.message || 'Không xóa được bộ lọc.'); }
  }

  const comparisonItems = comparison?.items || [];
  const rows = [
    ['Loại giao dịch', (item) => item.housing?.listingType === 'SALE' ? 'Cần bán' : 'Cho thuê'],
    ['Giá niêm yết', priceFor],
    ['Diện tích', (item) => item.housing?.areaM2 ? item.housing.areaM2 + ' m²' : 'Chưa có'],
    ['Giá / m²', (item) => vnMoney(item.pricePerM2Vnd,
      item.housing?.listingType === 'SALE' ? 'đ/m²' : 'đ/m²/tháng')],
    ['Loại tài sản', (item) => PROPERTY_TYPES[item.housing?.propertyType] || 'Chưa rõ'],
    ['Cách FPT (đường thẳng)', (item) =>
      Number.isFinite(Number(item.distanceToFptM)) &&
      item.distanceToFptM !== null && item.distanceToFptM !== undefined
        ? new Intl.NumberFormat('vi-VN').format(Number(item.distanceToFptM)) + ' m'
        : 'Chưa có'],
    ['Trạng thái', (item) => item.housing?.listingStatus === 'ACTIVE' ? 'Đang hiển thị' : 'Chưa rõ'],
    ['Xác minh lần cuối', (item) => item.housing?.lastVerifiedAt
      ? new Date(item.housing.lastVerifiedAt).toLocaleDateString('vi-VN') : 'Chưa xác minh']
  ];

  return (
    <section className="hm-housing-intel" data-testid="housing-intelligence"
      aria-label="So sánh và lưu tìm kiếm bất động sản">
      <button type="button" className="hm-housing-intel-heading"
        onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <GitCompareArrows size={18} />
        <span><strong>So sánh & theo dõi tin mới</strong>
          <small>So sánh 2–4 tin · lưu bộ lọc để nhận thông báo</small></span>
        <ChevronDown size={15} className={open ? 'expanded' : ''} />
      </button>

      {open && <div className="hm-housing-intel-body">
        <div className="hm-intel-section-head"><strong>So sánh bất động sản</strong>
          <small>{selected.length}/4 tin</small></div>
        <p className="hm-intel-hint">Chọn các tin đang có trong danh sách bản đồ, tối đa 4 tin.</p>
        {candidates.length === 0 && <p className="hm-intel-hint">Chưa tải tin nào. Hãy di chuyển bản đồ hoặc bỏ bớt bộ lọc.</p>}
        <label className="hm-intel-select-label">
          <span>Chọn tin để so sánh</span>
          <select aria-label="Chọn bất động sản để so sánh"
            disabled={selected.length >= 4 || availableToAdd.length === 0}
            value=""
            onChange={(e) => chooseProperty(e.target.value)}>
            <option value="">— Chọn từ kết quả đã tải —</option>
            {availableToAdd.map((place) =>
              <option key={place.id} value={String(place.id)}>{place.name}</option>)}
          </select>
        </label>
        {!!selected.length && <div className="hm-intel-selected">
          {selected.map((id) => {
            const place = candidates.find((p) => String(p.id) === id);
            return <span key={id}>
              <span>{place?.name || 'Tin #' + id}</span>
              <button type="button" onClick={() => removeProperty(id)}
                aria-label={'Bỏ tin ' + id}><X size={12}/></button>
            </span>;
          })}
        </div>}
        <button className="hm-intel-primary" type="button"
          disabled={selected.length < 2 || comparing}
          onClick={compare}>{comparing ? 'Đang đối chiếu…' : 'So sánh ' + selected.length + ' tin'}</button>
        {comparisonError && <p role="alert" className="hm-intel-error">{comparisonError}</p>}
        {comparison && <div className="hm-intel-compare-scroll">
          {comparison.unavailableCount > 0 && <p className="hm-intel-hint" role="status">
            {comparison.unavailableCount} tin đã bị ẩn, hết hạn hoặc không còn được công khai.
          </p>}
          {comparisonItems.length > 0 && <table className="hm-intel-table">
            <thead><tr><th scope="col">Tiêu chí</th>
              {comparisonItems.map((item) => <th key={item.id} scope="col">
                <Link to={'/place/' + encodeURIComponent(item.id)}>{item.name}</Link>
              </th>)}</tr></thead>
            <tbody>{rows.map(([label, render]) => <tr key={label}>
              <th scope="row">{label}</th>
              {comparisonItems.map((item) => <td key={item.id}>{render(item)}</td>)}
            </tr>)}</tbody>
          </table>}
          <p className="hm-intel-hint">Giá/m² tính từ giá và diện tích người đăng cung cấp, không phải định giá thị trường. Khoảng cách FPT là đường thẳng.</p>
        </div>}

        <div className="hm-intel-divider" />
        <div className="hm-intel-section-head"><strong>Lưu tìm kiếm & cảnh báo</strong><Bell size={15}/></div>
        <p className="hm-intel-hint">Chỉ thông báo trong tài khoản khi có tin mới phù hợp đã được duyệt. Không gửi SMS hoặc email.</p>
        {!user ? <p className="hm-intel-hint">
          <Link to="/login">Đăng nhập</Link> để lưu bộ lọc và theo dõi tin mới.
        </p> : <>
          <label className="hm-intel-select-label">
            <span>Tên bộ lọc</span>
            <input aria-label="Tên bộ lọc bất động sản" value={savedName}
              onChange={(event) => setSavedName(event.target.value)}
              maxLength={80} placeholder="VD: Đất dưới 2 tỷ gần FPT" />
          </label>
          <button className="hm-intel-save" type="button" onClick={saveCurrentSearch}
            disabled={saving || filterCount === 0}>
            <Plus size={14}/> {saving ? 'Đang lưu…' : 'Lưu bộ lọc đang chọn'}
          </button>
          {filterCount === 0 && <p className="hm-intel-hint">
            Hãy chọn giá, loại giao dịch, khoảng cách hoặc gõ từ khóa trước.
          </p>}
          {savedError && <p role="alert" className="hm-intel-error">{savedError}</p>}
          {!loaded && <p className="hm-intel-hint">Đang tải bộ lọc…</p>}
          <div className="hm-intel-saved-list" aria-label="Bộ lọc bất động sản đã lưu">
            {saved.map((item) => <div className="hm-intel-saved-row" key={item.id}>
              <div><strong>{item.name}</strong><small>{item.enabled ? 'Đang nhận tin mới' : 'Đã tạm dừng'}</small></div>
              <button type="button" onClick={() => onApplySavedSearch?.(item.filters)}>Áp dụng</button>
              <button type="button" onClick={() => flipSaved(item)}
                aria-label={item.enabled ? 'Tạm dừng ' + item.name : 'Bật cảnh báo ' + item.name}>
                {item.enabled ? 'Tạm dừng' : 'Bật lại'}
              </button>
              <button type="button" onClick={() => removeSaved(item)}
                aria-label={'Xóa bộ lọc ' + item.name}><Trash2 size={14}/></button>
            </div>)}
            {loaded && saved.length === 0 && <p className="hm-intel-hint">Bạn chưa lưu bộ lọc nào.</p>}
          </div>
        </>}
      </div>}
    </section>
  );
}
