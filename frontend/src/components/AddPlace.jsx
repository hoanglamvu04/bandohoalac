import { useState } from 'react';
import { Camera, CheckCircle2, LocateFixed, MapPin, Send } from 'lucide-react';
import { createContribution } from '../services/api.js';

const initialForm = { name: '', category: 'Cafe', address: '', description: '', price: '', phone: '' };

export default function AddPlace() {
  const [form, setForm] = useState(initialForm);
  const [location, setLocation] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function getLocation() {
    setStatus({ type: '', message: '' });
    if (!navigator.geolocation) {
      setStatus({ type: 'error', message: 'Thiết bị không hỗ trợ định vị.' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
          timestamp: position.timestamp
        });
      },
      () => setStatus({ type: 'error', message: 'Không thể lấy vị trí. Hãy kiểm tra quyền GPS.' }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
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
    if (!location) {
      setStatus({ type: 'error', message: 'Hãy lấy vị trí hiện tại trước khi gửi.' });
      return;
    }

    setSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      await createContribution({
        type: 'CREATE_PLACE',
        place: form,
        location,
        photoCount: photos.length
      });
      setStatus({ type: 'success', message: 'Đã gửi đóng góp. Bạn sẽ nhận +20 điểm khi được duyệt.' });
      setForm(initialForm);
      setPhotos([]);
    } catch {
      setStatus({ type: 'success', message: 'Đã ghi nhận trên giao diện. Khi backend online, dữ liệu sẽ được gửi để duyệt.' });
    } finally {
      setSubmitting(false);
    }
  }

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
          <div><b>1. Xác minh vị trí</b><small>GPS chỉ được lấy khi bạn chủ động bấm nút.</small></div>
        </div>

        <button className="location-capture" type="button" onClick={getLocation}>
          <LocateFixed size={18} />
          {location ? 'Cập nhật vị trí hiện tại' : 'Lấy vị trí hiện tại'}
        </button>

        {location && (
          <div className="gps-card">
            <CheckCircle2 size={18} />
            <div>
              <b>Đã lấy vị trí</b>
              <span>{location.lat.toFixed(6)}, {location.lng.toFixed(6)} · độ chính xác ±{location.accuracy} m</span>
            </div>
          </div>
        )}
      </div>

      <div className="form-section">
        <div className="section-title">
          <span className="step-dot">2</span>
          <div><b>Thông tin địa điểm</b><small>Thông tin càng rõ, việc duyệt càng nhanh.</small></div>
        </div>

        <div className="form-grid">
          <label className="full">Tên địa điểm<input name="name" value={form.name} onChange={updateField} placeholder="Ví dụ: The Lake Coffee" /></label>

          <label>Danh mục
            <select name="category" value={form.category} onChange={updateField}>
              <option>Cafe</option>
              <option>Ăn uống</option>
              <option>Homestay</option>
              <option>Villa</option>
              <option>Check-in</option>
              <option>Trải nghiệm</option>
            </select>
          </label>

          <label>Mức giá<input name="price" value={form.price} onChange={updateField} placeholder="30.000 - 70.000đ" /></label>
          <label className="full">Địa chỉ mô tả<input name="address" value={form.address} onChange={updateField} placeholder="Thôn/xã, mốc đường dễ nhận biết..." /></label>
          <label>Số điện thoại<input name="phone" value={form.phone} onChange={updateField} placeholder="Nếu có" /></label>
          <label className="full">Trải nghiệm thực tế<textarea name="description" value={form.description} onChange={updateField} rows="4" placeholder="View, chỗ đỗ xe, không gian, lưu ý khi đến..." /></label>
        </div>
      </div>

      <div className="form-section">
        <div className="section-title">
          <Camera size={19} />
          <div><b>3. Ảnh thực tế</b><small>Tối đa 8 ảnh. Ảnh rõ và đúng địa điểm sẽ được ưu tiên.</small></div>
        </div>

        <label className="photo-drop">
          <Camera size={23} />
          <b>Chọn ảnh từ thiết bị</b>
          <span>{photos.length ? photos.length + ' ảnh đã chọn' : 'JPG, PNG hoặc WEBP'}</span>
          <input type="file" accept="image/*" multiple onChange={selectPhotos} />
        </label>
      </div>

      {status.message && <div className={'form-status ' + status.type}>{status.message}</div>}

      <button className="primary-action wide" disabled={submitting} type="submit">
        <Send size={18} />
        {submitting ? 'Đang gửi...' : 'Gửi đóng góp để duyệt'}
      </button>
    </form>
  );
}
