import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  CircleAlert,
  Database,
  LocateFixed,
  LogIn,
  MapPin,
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
        message: 'Đã gửi đóng góp. Bạn sẽ nhận +20 điểm khi được duyệt.'
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

  return (
    <form className="contribution-form" onSubmit={submit}>
      <div className="form-heading">
        <div>
          <span className="eyebrow">CONTRIBUTOR WORKSPACE</span>
          <h2>Thêm địa điểm mới</h2>
          <p>Chia sẻ một địa điểm bạn vừa trải nghiệm tại Hòa Lạc.</p>
        </div>
        <span className="reward-pill">+20 điểm</span>
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

          <label>
            Danh mục
            <select
              name="categorySlug"
              value={form.categorySlug}
              onChange={updateField}
            >
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

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
            <small>Tối đa 8 ảnh. Ảnh rõ và đúng địa điểm sẽ được ưu tiên.</small>
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
