import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Database,
  LocateFixed,
  LogIn,
  MapPin,
  Search,
  Send
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  createContribution,
  getCategories,
  getNearbyPlaces
} from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  DEFAULT_CENTER,
  isInsideServiceCoverage
} from '../mapConfig.js';
import { getBestBrowserLocation } from '../utils/geolocation.js';
import { reverseGeocodeLocation } from '../utils/reverseGeocoding.js';
import LocationPicker from './LocationPicker.jsx';

const initialForm = {
  name: '',
  categorySlug: '',
  address: '',
  description: '',
  price: '',
  openingHours: '',
  phone: ''
};

function foldCategoryText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

function formatNearbyDistance(place) {
  const distance = Number(
    place?.distanceMeters ??
    place?.distance ??
    place?.distance_meters
  );

  if (!Number.isFinite(distance)) return '';
  return distance >= 1000
    ? (distance / 1000).toFixed(1) + ' km'
    : Math.max(1, Math.round(distance)) + ' m';
}

export default function AddPlace() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [categories, setCategories] = useState([]);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [form, setForm] = useState(initialForm);
  const [location, setLocation] = useState(null);
  const [locationContext, setLocationContext] = useState({
    loading: false,
    geocode: null,
    nearby: null
  });
  const [needsManualConfirm, setNeedsManualConfirm] = useState(false);
  const [locating, setLocating] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  const addressDirtyRef = useRef(false);
  const lookupIdRef = useRef(0);
  const categoryMenuRef = useRef(null);

  useEffect(() => {
    getCategories()
      .then((data) => {
        setCategories(data.items || []);
        setForm((current) => (
          current.categorySlug
            ? current
            : { ...current, categorySlug: data.items?.[0]?.slug || '' }
        ));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function closeCategoryMenu(event) {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target)) {
        setCategoryMenuOpen(false);
        setCategoryQuery('');
      }
    }

    document.addEventListener('pointerdown', closeCategoryMenu);
    return () => document.removeEventListener('pointerdown', closeCategoryMenu);
  }, []);

  function selectCategory(categorySlug) {
    setForm((current) => ({
      ...current,
      categorySlug
    }));
    setCategoryMenuOpen(false);
    setCategoryQuery('');
  }

  function updateField(event) {
    if (event.target.name === 'address') {
      addressDirtyRef.current = true;
    }

    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  }

  async function resolveLocationContext(nextLocation, {
    autoFillAddress = true
  } = {}) {
    const lookupId = ++lookupIdRef.current;

    setLocationContext((current) => ({
      ...current,
      loading: true
    }));

    const [geocodeResult, nearbyResult] = await Promise.allSettled([
      reverseGeocodeLocation(nextLocation.lat, nextLocation.lng),
      getNearbyPlaces(nextLocation.lat, nextLocation.lng, 1200)
    ]);

    if (lookupId !== lookupIdRef.current) return;

    const geocode = geocodeResult.status === 'fulfilled'
      ? geocodeResult.value
      : null;

    const nearbyPayload = nearbyResult.status === 'fulfilled'
      ? nearbyResult.value
      : null;

    const nearbyItems = Array.isArray(nearbyPayload?.items)
      ? nearbyPayload.items
      : (Array.isArray(nearbyPayload) ? nearbyPayload : []);

    const nearby = nearbyItems.find((item) =>
      Number.isFinite(Number(item?.lat)) &&
      Number.isFinite(Number(item?.lng))
    ) || null;

    setLocationContext({
      loading: false,
      geocode,
      nearby
    });

    if (
      autoFillAddress &&
      geocode?.label &&
      !addressDirtyRef.current
    ) {
      setForm((current) => ({
        ...current,
        address: geocode.label
      }));
    }
  }

  async function getLocation() {
    if (locating) return;

    setStatus({ type: '', message: '' });
    setLocating(true);

    try {
      const candidate = await getBestBrowserLocation({
        timeout: 10000,
        targetAccuracy: 40
      });

      if (!isInsideServiceCoverage(candidate.lng, candidate.lat)) {
        setStatus({
          type: 'error',
          message:
            'Thiết bị đang trả về vị trí ngoài vùng Hòa Lạc (' +
            candidate.lat.toFixed(5) + ', ' +
            candidate.lng.toFixed(5) +
            '). Hãy bật vị trí chính xác trên Windows/trình duyệt hoặc chọn thủ công trên bản đồ.'
        });
        return;
      }

      const nextLocation = {
        ...candidate,
        manuallyAdjusted: false
      };

      setLocation(nextLocation);
      setNeedsManualConfirm(false);
      if (Number(candidate.accuracy) > 120) {
        setStatus({
          type: 'info',
          message:
            'GPS đã lấy được vị trí nhưng sai số khoảng ±' +
            Math.round(candidate.accuracy) +
            ' m. Bạn nên kéo pin tới đúng cổng/địa điểm trước khi gửi.'
        });
      }

      await resolveLocationContext(nextLocation);
    } catch (error) {
      setStatus({
        type: 'error',
        message: error?.message || 'Không thể lấy vị trí hiện tại.'
      });
    } finally {
      setLocating(false);
    }
  }

  function openManualPicker() {
    const initial = location && isInsideServiceCoverage(location.lng, location.lat)
      ? location
      : {
          lat: DEFAULT_CENTER[1],
          lng: DEFAULT_CENTER[0],
          accuracy: 0,
          timestamp: Date.now(),
          manuallyAdjusted: true
        };

    setLocation(initial);
    setNeedsManualConfirm(true);
    setLocationContext({
      loading: false,
      geocode: null,
      nearby: null
    });
    setStatus({
      type: 'info',
      message: 'Kéo pin vàng tới đúng vị trí địa điểm để xác nhận.'
    });
  }

  function updateLocationFromPicker({ lat, lng }) {
    const nextLocation = {
      ...(location || {}),
      lat,
      lng,
      accuracy: 0,
      timestamp: Date.now(),
      manuallyAdjusted: true
    };

    setLocation(nextLocation);
    setNeedsManualConfirm(false);
    setStatus({ type: '', message: '' });
    resolveLocationContext(nextLocation);
  }

  function selectPhotos(event) {
    setPhotos(Array.from(event.target.files || []).slice(0, 8));
  }

  async function submit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setStatus({ type: 'error', message: 'Vui lòng nhập tên địa điểm.' });
      return;
    }

    if (!location || needsManualConfirm) {
      setStatus({
        type: 'error',
        message: needsManualConfirm
          ? 'Hãy kéo pin vàng tới đúng vị trí để xác nhận trước khi gửi.'
          : 'Hãy lấy hoặc chọn vị trí địa điểm trước khi gửi.'
      });
      return;
    }

    if (!isInsideServiceCoverage(location.lng, location.lat)) {
      setStatus({
        type: 'error',
        message: 'Vị trí đang nằm ngoài vùng nhận đóng góp của Hola Maps.'
      });
      return;
    }

    setSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      await createContribution({
        type: 'CREATE_PLACE',
        location: {
          lat: location.lat,
          lng: location.lng,
          accuracy: location.accuracy || 0,
          timestamp: location.timestamp
        },
        place: form,
        photos
      });

      setStatus({
        type: 'success',
        message: 'Đã gửi đóng góp. Nếu được duyệt, bạn có thể nhận tối đa +20 điểm; số điểm thực nhận do Admin chấm theo chất lượng.'
      });
      showToast('Đóng góp đã được gửi để chờ duyệt!', 'success');

      setForm((current) => ({
        ...initialForm,
        categorySlug: current.categorySlug
      }));
      addressDirtyRef.current = false;
      setPhotos([]);
      setLocation(null);
      setNeedsManualConfirm(false);
      setLocationContext({
        loading: false,
        geocode: null,
        nearby: null
      });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div className="contribution-form auth-required">
        <LogIn size={30} />
        <h2>Đăng nhập để đóng góp</h2>
        <p>Bạn cần có tài khoản Hola Explorer để gửi địa điểm mới và nhận điểm thưởng.</p>
        <Link className="primary-action" to="/login">Đăng nhập ngay</Link>
      </div>
    );
  }

  const locationQuality = location?.manuallyAdjusted
    ? 'Đã chỉnh thủ công'
    : (location?.accuracy
      ? 'GPS ±' + Math.round(location.accuracy) + ' m'
      : 'GPS');

  const selectedCategory = categories.find((category) => category.slug === form.categorySlug) || null;
  const foldedCategoryQuery = foldCategoryText(categoryQuery);
  const filteredCategories = categories.filter((category) =>
    !foldedCategoryQuery ||
    foldCategoryText(category.name).includes(foldedCategoryQuery) ||
    foldCategoryText(category.slug).includes(foldedCategoryQuery)
  );
  const popularCategorySlugs = ['an-uong', 'cafe', 'bat-dong-san', 'homestay', 'check-in', 'dich-vu'];
  const popularCategories = popularCategorySlugs
    .map((slug) => categories.find((category) => category.slug === slug))
    .filter(Boolean);

  return (
    <form className="contribution-form" onSubmit={submit}>
      <div className="form-heading">
        <div>
          <span className="eyebrow">CONTRIBUTOR WORKSPACE</span>
          <h2>Thêm địa điểm mới</h2>
          <p>Chia sẻ một địa điểm bạn vừa trải nghiệm tại Hòa Lạc.</p>
        </div>
        <span className="reward-pill">Tối đa +20 điểm</span>
      </div>

      <div className="form-section">
        <div className="section-title">
          <MapPin size={19} />
          <div>
            <b>1. Xác minh vị trí</b>
            <small>GPS chỉ được lấy khi bạn chủ động bấm nút. Địa chỉ tra cứu chỉ dùng để hỗ trợ xác minh.</small>
          </div>
        </div>

        <div className="location-actions">
          <button
            className="location-capture"
            type="button"
            onClick={getLocation}
            disabled={locating}
          >
            <LocateFixed size={18} />
            {locating
              ? 'Đang lấy GPS chính xác…'
              : (location ? 'Cập nhật vị trí hiện tại' : 'Lấy vị trí hiện tại')}
          </button>

          <button
            className="location-manual"
            type="button"
            onClick={openManualPicker}
          >
            <MapPin size={17} />
            {location ? 'Chỉnh pin trên bản đồ' : 'Chọn thủ công'}
          </button>
        </div>

        {location && (
          <>
            <div className={needsManualConfirm ? 'gps-card needs-confirm' : 'gps-card'}>
              {needsManualConfirm
                ? <CircleAlert size={18} />
                : <CheckCircle2 size={18} />}

              <div className="gps-card-main">
                <b>
                  {needsManualConfirm
                    ? 'Chưa xác nhận vị trí'
                    : (locationContext.geocode?.shortLabel || 'Đã xác định vị trí')}
                </b>

                {locationContext.loading && (
                  <span>Đang xác định xã/phường và địa chỉ gần nhất…</span>
                )}

                {!locationContext.loading && locationContext.geocode?.label && (
                  <span className="gps-address">{locationContext.geocode.label}</span>
                )}

                <small>
                  {Number(location.lat).toFixed(6)}, {Number(location.lng).toFixed(6)}
                  {' · '}
                  {locationQuality}
                </small>
              </div>
            </div>

            {!needsManualConfirm && (
              <div className="location-context-card">
                <div className="location-context-row">
                  <MapPin size={15} />
                  <div>
                    <b>Khu vực tham khảo</b>
                    <span>
                      {locationContext.loading
                        ? 'Đang tra cứu…'
                        : (locationContext.geocode?.shortLabel || 'Chưa xác định được tên khu vực')}
                    </span>
                  </div>
                </div>

                {locationContext.nearby && (
                  <div className="location-context-row">
                    <Database size={15} />
                    <div>
                      <b>Dữ liệu Hola Maps gần đây</b>
                      <span>
                        Gần {locationContext.nearby.name}
                        {formatNearbyDistance(locationContext.nearby)
                          ? ' · ' + formatNearbyDistance(locationContext.nearby)
                          : ''}
                      </span>
                    </div>
                  </div>
                )}

                {locationContext.geocode?.source && (
                  <div className="location-source-note">
                    Nguồn địa chỉ: {locationContext.geocode.source}. Kết quả chỉ để tham khảo; hãy kiểm tra pin trước khi gửi.
                  </div>
                )}
              </div>
            )}

            <LocationPicker
              lat={location.lat}
              lng={location.lng}
              onChange={updateLocationFromPicker}
            />
          </>
        )}
      </div>

      <div className="form-section">
        <div className="section-title">
          <span className="step-dot">2</span>
          <div>
            <b>Thông tin địa điểm</b>
            <small>Thông tin càng rõ, việc duyệt càng nhanh.</small>
          </div>
        </div>

        <div className="form-grid">
          <label className="full">
            Tên địa điểm
            <input
              name="name"
              value={form.name}
              onChange={updateField}
              placeholder="Ví dụ: The Lake Coffee"
            />
          </label>

          <div className="contribution-category-field">
            <span className="contribution-field-label">Danh mục</span>

            <div className="contribution-category-picker" ref={categoryMenuRef}>
              <button
                type="button"
                className={categoryMenuOpen ? 'category-picker-trigger open' : 'category-picker-trigger'}
                onClick={() => setCategoryMenuOpen((value) => !value)}
                aria-expanded={categoryMenuOpen}
                aria-haspopup="listbox"
              >
                <span className="category-picker-initial">
                  {(selectedCategory?.name || 'D').trim().charAt(0).toUpperCase()}
                </span>
                <span className="category-picker-selected">
                  <strong>{selectedCategory?.name || 'Chọn danh mục'}</strong>
                  <small>Chọn nhóm phù hợp nhất với địa điểm</small>
                </span>
                <ChevronDown size={17} />
              </button>

              {categoryMenuOpen && (
                <div className="category-picker-menu">
                  <div className="category-picker-search">
                    <Search size={16} />
                    <input
                      value={categoryQuery}
                      onChange={(event) => setCategoryQuery(event.target.value)}
                      placeholder="Tìm danh mục..."
                      autoFocus
                      aria-label="Tìm danh mục"
                    />
                  </div>

                  {!categoryQuery && popularCategories.length > 0 && (
                    <div className="category-picker-popular">
                      <span>Phổ biến</span>
                      <div>
                        {popularCategories.map((category) => (
                          <button
                            key={category.slug}
                            type="button"
                            className={form.categorySlug === category.slug ? 'active' : ''}
                            onClick={() => selectCategory(category.slug)}
                          >
                            {category.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="category-picker-list" role="listbox" aria-label="Danh sách danh mục">
                    {filteredCategories.map((category) => {
                      const active = form.categorySlug === category.slug;
                      return (
                        <button
                          key={category.slug}
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={active ? 'category-picker-option active' : 'category-picker-option'}
                          onClick={() => selectCategory(category.slug)}
                        >
                          <span className="category-picker-option-icon">
                            {category.name.trim().charAt(0).toUpperCase()}
                          </span>
                          <span>
                            <strong>{category.name}</strong>
                            <small>{category.slug.replaceAll('-', ' ')}</small>
                          </span>
                          {active && <Check size={16} />}
                        </button>
                      );
                    })}

                    {!filteredCategories.length && (
                      <div className="category-picker-empty">
                        Không tìm thấy danh mục phù hợp.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <label>
            Mức giá
            <input
              name="price"
              value={form.price}
              onChange={updateField}
              placeholder="30.000 - 70.000đ"
            />
          </label>

          <label className="full">
            Địa chỉ mô tả
            <input
              name="address"
              value={form.address}
              onChange={updateField}
              placeholder="Tự gợi ý từ vị trí; bạn có thể chỉnh lại cho chính xác."
            />
          </label>

          <label>
            Số điện thoại
            <input
              name="phone"
              value={form.phone}
              onChange={updateField}
              placeholder="Nếu có"
            />
          </label>

          <label>
            Giờ mở cửa
            <input
              name="openingHours"
              value={form.openingHours}
              onChange={updateField}
              placeholder="07:00 - 22:00"
            />
          </label>

          <label className="full">
            Trải nghiệm thực tế
            <textarea
              name="description"
              value={form.description}
              onChange={updateField}
              rows="4"
              placeholder="View, chỗ đỗ xe, không gian, lưu ý khi đến..."
            />
          </label>
        </div>
      </div>

      <div className="form-section">
        <div className="section-title">
          <Camera size={19} />
          <div>
            <b>3. Ảnh thực tế</b>
            <small>Tối đa 8 ảnh. Ảnh rõ, mới và thể hiện đúng không gian sẽ giúp đóng góp được chấm điểm cao hơn.</small>
          </div>
        </div>

        <label className="photo-drop">
          <Camera size={23} />
          <b>Chọn ảnh từ thiết bị</b>
          <span>{photos.length ? photos.length + ' ảnh đã chọn' : 'JPG, PNG hoặc WEBP'}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={selectPhotos}
          />
        </label>
      </div>

      {status.message && (
        <div className={'form-status ' + status.type}>
          {status.message}
        </div>
      )}

      <button
        className="primary-action wide"
        disabled={submitting}
        type="submit"
      >
        <Send size={18} />
        {submitting ? 'Đang gửi...' : 'Gửi đóng góp để duyệt'}
      </button>
    </form>
  );
}
