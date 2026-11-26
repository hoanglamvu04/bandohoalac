import { detailRows, AMENITIES } from '../lib/propertyDetails.js';
import { estimateHousingCosts } from '../lib/housingCosts.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChevronDown, GitCompareArrows, Plus, Trash2, X, ChartColumnIncreasing, MapPinned } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  compareHousing, createHousingSavedSearch, deleteHousingSavedSearch,
  listHousingSavedSearches, toggleHousingSavedSearch,
  getHousingMarketInsights, getHousingPublicAmenities, getHousingListings
} from '../services/api.js';
import '../housing-intelligence.css';

const FILTER_KEYS = [
  'q', 'listingType', 'propertyType', 'subtype', 'furnishing', 'minRent', 'maxRent',
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
  user, places = [], currentFilters = {}, viewport = null, onApplySavedSearch
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
  const insightsRequestRef = useRef(0);
  const amenitiesRequestRef = useRef(0);
  const [market, setMarket] = useState(null);
  const [marketBusy, setMarketBusy] = useState(false);
  const [marketError, setMarketError] = useState('');
  const [amenityPlaceId, setAmenityPlaceId] = useState('');
  const [amenities, setAmenities] = useState(null);
  const [amenitiesBusy, setAmenitiesBusy] = useState(false);
  const [amenitiesError, setAmenitiesError] = useState('');
  const [amenityRadius, setAmenityRadius] = useState('1000');
  const viewportRequestRef = useRef(0);
  const [viewportResults, setViewportResults] = useState(null);
  const [viewportCriteria, setViewportCriteria] = useState(null);
  const [viewportBusy, setViewportBusy] = useState(false);
  const [viewportError, setViewportError] = useState('');

  const candidates = useMemo(() => places.filter((p) =>
    p?.housing && /^\d+$/.test(String(p.id)) &&
    p.housing?.listingStatus !== 'EXPIRED'
  ).slice(0, 30), [places]);
  const availableToAdd = candidates.filter((place) =>
    !selected.includes(String(place.id)));
  const filterCount = Object.keys(cleanSavedFilters(currentFilters)).length;

  useEffect(() => {
    setSaved([]);
    setLoaded(false);
    if (!open || !user?.id) return undefined;
    let active = true;
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
    setComparing(false);
    setSelected((current) => [...current, id]);
    setComparison(null);
    setComparisonError('');
  }

  function removeProperty(id) {
    comparingRef.current += 1;
    setComparing(false);
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

  async function loadMarket() {
    const requestId = ++insightsRequestRef.current;
    setMarketBusy(true);
    setMarketError('');
    setMarket(null);
    const params = {
      listingType: currentFilters.listingType || 'SALE',
      propertyType: currentFilters.propertyType || undefined
    };
    // A small explicit current viewport can narrow the statistics.
    // No user GPS, history, contact, price filter or search keyword is sent.
    if (viewport && ['west','east','south','north'].every((key) => Number.isFinite(Number(viewport[key]))) &&
        Number(viewport.east) > Number(viewport.west) &&
        Number(viewport.north) > Number(viewport.south) &&
        Number(viewport.east) - Number(viewport.west) <= 0.6 &&
        Number(viewport.north) - Number(viewport.south) <= 0.6) {
      for (const key of ['west','east','south','north']) params[key] = Number(viewport[key]).toFixed(5);
    }
    try {
      const result = await getHousingMarketInsights(params);
      if (requestId === insightsRequestRef.current) setMarket(result);
    } catch (error) {
      if (requestId === insightsRequestRef.current)
        setMarketError(error.message || 'Không thể tải thống kê giá.');
    } finally {
      if (requestId === insightsRequestRef.current) setMarketBusy(false);
    }
  }

  async function loadAmenities() {
    const target = amenityPlaceId || String(candidates[0]?.id || '');
    if (!target) return;
    const requestId = ++amenitiesRequestRef.current;
    setAmenitiesBusy(true);
    setAmenitiesError('');
    setAmenities(null);
    try {
      const result = await getHousingPublicAmenities(target, Number(amenityRadius));
      if (requestId === amenitiesRequestRef.current) setAmenities(result);
    } catch (error) {
      if (requestId === amenitiesRequestRef.current)
        setAmenitiesError(error.message || 'Không thể tải tiện ích gần tin.');
    } finally {
      if (requestId === amenitiesRequestRef.current) setAmenitiesBusy(false);
    }
  }

  function currentMapBounds() {
    if (!viewport) return null;
    const keys = ['west','south','east','north'];
    if (!keys.every((key) => Number.isFinite(Number(viewport[key])))) return null;
    const result = Object.fromEntries(keys.map((key) =>
      [key, Number(Number(viewport[key]).toFixed(5))]));
    if (result.west >= result.east || result.south >= result.north ||
        result.east - result.west > 0.6 ||
        result.north - result.south > 0.6) return null;
    return result;
  }

  async function loadViewportHousing(more = false) {
    const criteria = more ? viewportCriteria :
      { ...currentFilters, ...currentMapBounds(), limit: 20 };
    if (!more && !currentMapBounds()) {
      setViewportError('Hãy phóng tới khu vực cần tìm trên bản đồ trước.');
      return;
    }
    if (!criteria || (more && !viewportResults?.meta?.hasMore)) return;
    const requestId = ++viewportRequestRef.current;
    setViewportBusy(true);
    setViewportError('');
    if (!more) setViewportResults(null);
    const offset = more ? viewportResults.items.length : 0;
    try {
      const result = await getHousingListings({ ...criteria, offset });
      if (requestId !== viewportRequestRef.current) return;
      const data = {
        items: more ? [...viewportResults.items, ...(result.items || [])] : (result.items || []),
        meta: result.meta || {}
      };
      setViewportResults(data);
      if (!more) setViewportCriteria(criteria);
    } catch (error) {
      if (requestId === viewportRequestRef.current)
        setViewportError(error.message || 'Không thể tải tin ở khu vực này.');
    } finally {
      if (requestId === viewportRequestRef.current) setViewportBusy(false);
    }
  }

  const comparisonItems = comparison?.items || [];
  const unusualPrices = market?.sufficientSample && market.quartiles
    ? comparisonItems.flatMap((item) => {
      if (item.housing?.listingType !== market.listingType ||
          (market.propertyType && item.housing?.propertyType !== market.propertyType)) return [];
      const price = Number(item.pricePerM2Vnd);
      if (!Number.isFinite(price) || price <= 0) return [];
      if (price < market.quartiles.p25 * 0.6) return [{ name: item.name, direction: 'thấp' }];
      if (price > market.quartiles.p75 * 1.6) return [{ name: item.name, direction: 'cao' }];
      return [];
    }) : [];
  const rows = [
    ['Loại giao dịch', (item) => item.housing?.listingType === 'SALE' ? 'Cần bán' : 'Cho thuê'],
    ['Giá niêm yết', priceFor],
    ['Diện tích', (item) => item.housing?.areaM2 ? item.housing.areaM2 + ' m²' : 'Chưa có'],
    ['Giá / m²', (item) => vnMoney(item.pricePerM2Vnd,
      item.housing?.listingType === 'SALE' ? 'đ/m²' : 'đ/m²/tháng')],
    ['Loại tài sản', (item) => PROPERTY_TYPES[item.housing?.propertyType] || 'Chưa rõ'],
    ['Đặc điểm', (item) => detailRows(item.housing?.details||{}).filter(([label])=>!label.startsWith('Pháp lý')).map(([label,value])=>label+': '+value).join(' · ')||'Chưa có'],
    ['Tiện nghi', (item) => AMENITIES.filter(([key])=>item.housing?.[key]===true).map(([,label])=>label).join(', ')||'Chưa có thông tin có tiện nghi'],
    ['Chi phí tháng (1 người, 80 kWh, 1 xe)',(item)=>{
      if(item.housing?.listingType!=='RENT')return 'Không áp dụng';
      const estimate=estimateHousingCosts(item.housing);
      return vnMoney(estimate.knownMonthly)+(estimate.missingMonthly.length?' (chưa đủ phí)':'');
    }],
    ['Tháng đầu gồm cọc (cùng giả định)',(item)=>{
      if(item.housing?.listingType!=='RENT')return 'Không áp dụng';
      const estimate=estimateHousingCosts(item.housing);
      return vnMoney(estimate.knownFirstMonth)+(estimate.missingFirstMonth.length?' (chưa đủ phí)':'');
    }],
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
          {unusualPrices.length > 0 && <p className="hm-intel-hint" role="status">
            Giá chào/m² của {unusualPrices.map((item) => item.name + ' ' + item.direction).join(', ')}
            {' '}khác đáng kể so với dải thống kê tham khảo. Đây không phải kết luận tin sai hoặc gian lận.
          </p>}
        </div>}

        <div className="hm-intel-divider" />
        <div className="hm-intel-section-head"><strong>Tin trong khung bản đồ</strong><MapPinned size={15}/></div>
        <p className="hm-intel-hint">Di chuyển bản đồ tới khu vực cần xem rồi bấm tìm. Kết quả được lấy trực tiếp bằng PostGIS, theo các bộ lọc BĐS đang chọn, không chỉ lọc các ghim đã tải.</p>
        <button className="hm-intel-primary" type="button"
          disabled={viewportBusy || !viewport} onClick={() => loadViewportHousing(false)}>
          {viewportBusy ? 'Đang tìm trong vùng…' : 'Tìm tin trong vùng bản đồ'}
        </button>
        {viewportError && <p className="hm-intel-error" role="alert">{viewportError}</p>}
        {viewportResults && <div className="hm-intel-market" data-testid="housing-viewport-results">
          <strong>{viewportResults.meta.total || viewportResults.items.length} tin phù hợp trong vùng đã chọn</strong>
          <small>Đã tải {viewportResults.items.length} tin. Di chuyển bản đồ rồi bấm tìm lại để cập nhật.</small>
          {viewportResults.items.map((place) => (
            <div className="hm-intel-amenity-row" key={place.id}>
              <Link to={'/place/' + encodeURIComponent(place.id)}>{place.name}</Link>
              <small>{priceFor(place)}</small>
            </div>
          ))}
          {!viewportResults.items.length && <p className="hm-intel-hint">Chưa tìm thấy tin phù hợp trong vùng này.</p>}
          {viewportResults.meta.hasMore && <button className="hm-intel-save" type="button"
            disabled={viewportBusy} onClick={() => loadViewportHousing(true)}>
            {viewportBusy ? 'Đang tải…' : 'Xem thêm tin trong vùng'}
          </button>}
        </div>}

        <div className="hm-intel-divider" />
        <div className="hm-intel-section-head"><strong>Giá chào tham khảo</strong><ChartColumnIncreasing size={15}/></div>
        <p className="hm-intel-hint">Dùng tin đã duyệt, còn hiệu lực; chỉ theo bán/thuê và loại tài sản đang chọn. Dữ liệu được giới hạn theo vùng bản đồ nếu vùng đủ nhỏ. Không áp dụng bộ lọc từ khóa hoặc ngân sách.</p>
        <button className="hm-intel-primary" type="button" onClick={loadMarket} disabled={marketBusy}>
          {marketBusy ? 'Đang tính thống kê…' : 'Xem thống kê giá/m²'}
        </button>
        {marketError && <p className="hm-intel-error" role="alert">{marketError}</p>}
        {market && <div className="hm-intel-market" data-testid="housing-market-insights">
          <strong>{market.listingType === 'RENT' ? 'Giá thuê chào / m² / tháng' : 'Giá chào bán / m²'}</strong>
          <small>{market.areaBasis === 'MAP_VIEWPORT' ? 'Trong vùng bản đồ hiện tại' : 'Toàn bộ vùng dữ liệu HOLA Maps'}
            {' · '}{market.sampleCount} tin đủ dữ liệu</small>
          {market.sufficientSample && market.quartiles ? <dl>
            <div><dt>Phân vị 25%</dt><dd>{vnMoney(market.quartiles.p25)}</dd></div>
            <div><dt>Trung vị</dt><dd>{vnMoney(market.quartiles.median)}</dd></div>
            <div><dt>Phân vị 75%</dt><dd>{vnMoney(market.quartiles.p75)}</dd></div>
          </dl> : <p className="hm-intel-hint">Cần ít nhất {market.minSample} tin hợp lệ để hiển thị phân vị. Không suy đoán khi ít dữ liệu.</p>}
          <p className="hm-intel-hint">{market.disclaimer}</p>
        </div>}

        <div className="hm-intel-divider" />
        <div className="hm-intel-section-head"><strong>Tiện ích quanh bất động sản</strong><MapPinned size={15}/></div>
        <p className="hm-intel-hint">Tra cứu theo ghim đã công khai, không sử dụng GPS của bạn. Khoảng cách chỉ tính đường thẳng.</p>
        <label className="hm-intel-select-label">
          <span>Chọn bất động sản</span>
          <select aria-label="Bất động sản để xem tiện ích" value={amenityPlaceId}
            onChange={(e) => { ++amenitiesRequestRef.current; setAmenities(null); setAmenityPlaceId(e.target.value); }}>
            <option value="">Tin đầu tiên trong kết quả</option>
            {candidates.map((place) =>
              <option key={place.id} value={String(place.id)}>{place.name}</option>)}
          </select>
        </label>
        <label className="hm-intel-select-label">
          <span>Bán kính đường thẳng</span>
          <select aria-label="Bán kính tiện ích" value={amenityRadius}
            onChange={(e) => { ++amenitiesRequestRef.current; setAmenities(null); setAmenityRadius(e.target.value); }}>
            <option value="500">500 m</option><option value="1000">1 km</option><option value="2000">2 km</option>
          </select>
        </label>
        <button className="hm-intel-save" type="button" onClick={loadAmenities}
          disabled={!candidates.length || amenitiesBusy}>
          {amenitiesBusy ? 'Đang tìm tiện ích…' : 'Xem tiện ích gần tin'}
        </button>
        {amenitiesError && <p className="hm-intel-error" role="alert">{amenitiesError}</p>}
        {amenities && <div className="hm-intel-market" data-testid="housing-amenities">
          <strong>{amenities.matchedCount} địa điểm đã công khai trong {amenities.radiusM} m
            {amenities.capped ? ' (danh sách giới hạn)' : ''}</strong>
          {amenities.categories.length > 0
            ? <div className="hm-intel-amenity-tags">{amenities.categories.map((item) =>
              <span key={item.categorySlug}>{item.name}: {item.count}</span>)}</div>
            : <p className="hm-intel-hint">Chưa có tiện ích được ghi nhận trong phạm vi này.</p>}
          {amenities.places.map((place) => <div className="hm-intel-amenity-row" key={place.id}>
            <Link to={'/place/' + encodeURIComponent(place.id)}>{place.name}</Link>
            <small>{place.distanceM} m</small>
          </div>)}
          <p className="hm-intel-hint">{amenities.disclaimer}</p>
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
