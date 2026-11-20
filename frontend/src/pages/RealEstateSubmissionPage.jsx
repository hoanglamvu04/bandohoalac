import { useState } from 'react';
import { ArrowLeft, BadgeCheck, CheckCircle2, LocateFixed, MapPin, Send, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import LocationPicker from '../components/LocationPicker.jsx';
import { createContribution } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { DEFAULT_CENTER, isInsideServiceCoverage } from '../mapConfig.js';
import { getBestBrowserLocation } from '../utils/geolocation.js';
import '../real-estate-submission.css';

const PROPERTY_TYPES = [
  { value: 'LAND', label: 'Đất' },
  { value: 'HOUSE', label: 'Nhà ở / Nhà phố' },
  { value: 'APARTMENT', label: 'Căn hộ' },
  { value: 'VILLA', label: 'Biệt thự' },
  { value: 'COMMERCIAL', label: 'Mặt bằng kinh doanh' },
  { value: 'OTHER', label: 'Bất động sản khác' }
];

const INITIAL_FORM = {
  transactionType: 'SALE',
  propertyType: 'HOUSE',
  name: '',
  address: '',
  areaM2: '',
  priceVnd: '',
  description: '',
  contactName: '',
  phone: ''
};

function initialPosition(search) {
  const params = new URLSearchParams(search);
  if (params.has('lat') && params.has('lng')) {
    const lat = Number(params.get('lat'));
    const lng = Number(params.get('lng'));
    if (isInsideServiceCoverage(lng, lat)) return { lat, lng };
  }
  return { lat: DEFAULT_CENTER[1], lng: DEFAULT_CENTER[0] };
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) return '';
  return new Intl.NumberFormat('vi-VN').format(number) + ' đ';
}

export default function RealEstateSubmissionPage() {
  const { search } = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [form, setForm] = useState(INITIAL_FORM);
  const [position, setPosition] = useState(() => initialPosition(search));
  const [positionConfirmed, setPositionConfirmed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState(null);
  const [error, setError] = useState('');

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError('');
  }

  function updatePosition({ lat, lng }) {
    setPosition({ lat: Number(lat), lng: Number(lng) });
    setPositionConfirmed(false);
    setError('');
  }

  async function useMyLocation() {
    if (locating) return;
    setLocating(true);
    setError('');
    try {
      const point = await getBestBrowserLocation({ timeout: 10000, targetAccuracy: 60 });
      if (!isInsideServiceCoverage(point.lng, point.lat)) {
        throw new Error('Vị trí hiện tại nằm ngoài vùng bản đồ Hòa Lạc.');
      }
      updatePosition(point);
    } catch (err) {
      setError(err.message || 'Chưa lấy được vị trí. Hãy kéo bản đồ để chọn thủ công.');
    } finally {
      setLocating(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setError('');

    if (!isInsideServiceCoverage(position.lng, position.lat) || !positionConfirmed) {
      setError('Hãy kéo bản đồ tới đúng bất động sản và nhấn "Xác nhận vị trí" trước khi gửi.');
      return;
    }

    const price = Number(form.priceVnd);
    const area = Number(form.areaM2);
    if (!Number.isSafeInteger(price) || price <= 0 || (form.transactionType === 'RENT' && price > 100000000)) {
      setError('Vui lòng nhập giá hợp lệ bằng đồng Việt Nam.');
      return;
    }
    if (!Number.isFinite(area) || area <= 0 || area > 99999.99) {
      setError('Diện tích phải lớn hơn 0 và không vượt quá 99.999,99 m².');
      return;
    }

    setSubmitting(true);
    try {
      const realEstate = {
        transactionType: form.transactionType,
        propertyType: form.propertyType,
        areaM2: area,
        contactName: form.contactName.trim(),
        ...(form.transactionType === 'SALE'
          ? { totalPriceVnd: price }
          : { monthlyRentVnd: price })
      };
      const result = await createContribution({
        type: 'CREATE_PLACE',
        location: { lat: position.lat, lng: position.lng },
        place: {
          name: form.name.trim(),
          categorySlug: 'bat-dong-san',
          address: form.address.trim(),
          description: form.description.trim(),
          phone: form.phone.trim(),
          realEstate
        },
        photos
      });
      setSubmittedId(result.id);
      showToast('Đã gửi tin bất động sản vào hàng chờ duyệt.', 'success');
    } catch (err) {
      setError(err.message || 'Chưa gửi được tin. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="estate-submit-page">
      <div className="estate-submit-wrap">
        <Link className="estate-back-link" to="/map?vertical=housing&category=bat-dong-san">
          <ArrowLeft size={16} /> Quay lại bản đồ bất động sản
        </Link>

        <header className="estate-submit-head">
          <span className="estate-eyebrow"><MapPin size={15} /> HOLA MAPS · BẤT ĐỘNG SẢN</span>
          <h1>Gửi tin bất động sản lên bản đồ</h1>
          <p>Ghim đúng vị trí, điền thông tin bán hoặc cho thuê. Tin chỉ xuất hiện công khai khi quản trị viên chấp thuận.</p>
          <div className="estate-submit-promises">
            <span><ShieldCheck size={16} /> Kiểm duyệt trước khi hiển thị</span>
            <span><BadgeCheck size={16} /> Không tự động đăng tin</span>
          </div>
        </header>

        {!user ? (
          <section className="estate-submit-notice" data-testid="estate-login-required">
            <h2>Đăng nhập để gửi yêu cầu</h2>
            <p>Hãy đăng nhập tài khoản HOLA Maps để gửi tin và theo dõi trạng thái duyệt.</p>
            <Link to="/login" className="estate-primary-link">Đăng nhập</Link>
          </section>
        ) : submittedId ? (
          <section className="estate-submit-notice estate-submit-success" role="status" data-testid="estate-submitted">
            <CheckCircle2 size={36} />
            <h2>Đã gửi yêu cầu #{submittedId}</h2>
            <p>Thông tin hiện đang <b>CHỜ DUYỆT</b>. Quản trị viên sẽ kiểm tra; tin chỉ lên bản đồ sau khi được duyệt.</p>
            <div className="estate-submit-next">
              <Link className="estate-primary-link" to="/profile">Theo dõi đóng góp</Link>
              <Link to="/map?vertical=housing&category=bat-dong-san">Về bản đồ bất động sản</Link>
            </div>
          </section>
        ) : (
          <form className="estate-submit-form" onSubmit={submit} data-testid="estate-submission-form">
            <section className="estate-section">
              <div className="estate-section-title">
                <span>01</span>
                <div><h2>Vị trí bất động sản</h2><p>Kéo bản đồ để đặt ghim tại đúng vị trí nhà, đất hoặc căn hộ.</p></div>
              </div>
              <div className="estate-map-area">
                <LocationPicker lat={position.lat} lng={position.lng} onChange={updatePosition} />
              </div>
              <div className="estate-position-controls">
                <div>
                  <strong>{position.lat.toFixed(6)}, {position.lng.toFixed(6)}</strong>
                  <small>{positionConfirmed ? 'Đã xác nhận tọa độ' : 'Chưa xác nhận tọa độ'}</small>
                </div>
                <button type="button" className="estate-secondary" onClick={useMyLocation} disabled={locating}>
                  <LocateFixed size={16} /> {locating ? 'Đang lấy GPS…' : 'Vị trí của tôi'}
                </button>
                <button type="button" className={positionConfirmed ? 'estate-confirm is-confirmed' : 'estate-confirm'} onClick={() => {
                  if (!isInsideServiceCoverage(position.lng, position.lat)) {
                    setError('Vị trí này nằm ngoài khu vực HOLA Maps hỗ trợ.');
                    return;
                  }
                  setPositionConfirmed(true);
                  setError('');
                }}>
                  <CheckCircle2 size={16} /> {positionConfirmed ? 'Đã xác nhận' : 'Xác nhận vị trí'}
                </button>
              </div>
            </section>

            <section className="estate-section">
              <div className="estate-section-title">
                <span>02</span>
                <div><h2>Thông tin tài sản</h2><p>Vui lòng cung cấp giá thực tế và địa chỉ rõ ràng để kiểm tra.</p></div>
              </div>

              <div className="estate-form-grid">
                <label className="estate-full">
                  Hình thức giao dịch
                  <select name="transactionType" value={form.transactionType} onChange={updateField}>
                    <option value="SALE">Cần bán</option>
                    <option value="RENT">Cho thuê</option>
                  </select>
                </label>
                <label>
                  Loại bất động sản
                  <select name="propertyType" value={form.propertyType} onChange={updateField}>
                    {PROPERTY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </label>
                <label className="estate-full">
                  Tên nhà / đất / căn hộ
                  <input name="name" required minLength={2} maxLength={160} value={form.name} onChange={updateField}
                    placeholder="Ví dụ: Nhà phố 3 tầng gần Đại học FPT" />
                </label>
                <label className="estate-full">
                  Địa chỉ hoặc khu vực
                  <input name="address" required maxLength={300} value={form.address} onChange={updateField}
                    placeholder="Số nhà, thôn/xã, khu đô thị, Hòa Lạc…" />
                </label>
                <label>
                  Diện tích (m²)
                  <input name="areaM2" required type="number" min="0.01" max="99999.99" step="0.01" inputMode="decimal"
                    value={form.areaM2} onChange={updateField} placeholder="Ví dụ: 100" />
                </label>
                <label>
                  {form.transactionType === 'SALE' ? 'Tổng giá bán (VND)' : 'Giá thuê mỗi tháng (VND)'}
                  <input name="priceVnd" required type="number" min="1" max={form.transactionType === 'SALE' ? '1000000000000000' : '100000000'}
                    step="1" inputMode="numeric" value={form.priceVnd} onChange={updateField}
                    placeholder={form.transactionType === 'SALE' ? '3500000000' : '2500000'} />
                  {formatMoney(form.priceVnd) && <small className="estate-money-preview">Tương đương: {formatMoney(form.priceVnd)}{form.transactionType === 'RENT' ? '/tháng' : ''}</small>}
                </label>
                <label className="estate-full">
                  Thông tin mô tả (không bắt buộc)
                  <textarea name="description" maxLength={2000} rows={4} value={form.description}
                    onChange={updateField} placeholder="Đặc điểm, đường vào, pháp lý được người đăng cung cấp, tiện ích gần đó…" />
                </label>
              </div>
            </section>

            <section className="estate-section">
              <div className="estate-section-title">
                <span>03</span>
                <div><h2>Liên hệ và hình ảnh</h2><p>Người kiểm duyệt có thể liên hệ để kiểm tra thông tin trước khi đăng.</p></div>
              </div>
              <div className="estate-form-grid">
                <label>
                  Tên người liên hệ
                  <input name="contactName" required minLength={2} maxLength={120} value={form.contactName}
                    onChange={updateField} placeholder="Tên của bạn" />
                </label>
                <label>
                  Số điện thoại liên hệ
                  <input name="phone" required type="tel" maxLength={30} value={form.phone}
                    onChange={updateField} placeholder="09xxxxxxxx" />
                </label>
                <label className="estate-full">
                  Ảnh tài sản (tối đa 8 ảnh, không bắt buộc)
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple
                    onChange={(event) => setPhotos(Array.from(event.target.files || []).slice(0, 8))} />
                  {!!photos.length && <small>Đã chọn {photos.length} ảnh</small>}
                </label>
              </div>
              <p className="estate-contact-note">Số điện thoại sẽ được hiển thị công khai sau khi tin được duyệt. HOLA Maps không xác nhận tính pháp lý hoặc quyền sở hữu chỉ qua việc duyệt tin.</p>
            </section>

            {error && <div className="estate-form-error" role="alert">{error}</div>}
            <div className="estate-submit-actions">
              <span><ShieldCheck size={16} /> Gửi yêu cầu, chưa đăng công khai</span>
              <button type="submit" disabled={submitting}>
                <Send size={17} /> {submitting ? 'Đang gửi…' : 'Gửi yêu cầu chờ duyệt'}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
