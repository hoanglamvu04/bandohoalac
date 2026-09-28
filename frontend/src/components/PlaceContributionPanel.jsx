import { useMemo, useState } from 'react';
import {
  Camera,
  Clock3,
  Flag,
  MapPin,
  PencilLine,
  Send,
  WalletCards,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createContribution } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import LocationPicker from './LocationPicker.jsx';

const ACTIONS = [
  { type: 'UPDATE_PLACE', label: 'Sửa thông tin', icon: PencilLine },
  { type: 'ADD_PHOTO', label: 'Thêm ảnh', icon: Camera },
  { type: 'FIX_LOCATION', label: 'Sửa vị trí', icon: MapPin },
  { type: 'UPDATE_HOURS', label: 'Giờ mở cửa', icon: Clock3 },
  { type: 'UPDATE_PRICE', label: 'Mức giá', icon: WalletCards },
  { type: 'REPORT_WRONG_INFO', label: 'Báo sai', icon: Flag },
  { type: 'REPORT_CLOSED', label: 'Báo đóng cửa', icon: X }
];

export default function PlaceContributionPanel({ place }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [type, setType] = useState('UPDATE_PLACE');
  const [form, setForm] = useState({
    address: place.address || '',
    description: place.description || '',
    phone: place.phone || '',
    website: place.website || '',
    openingHours: place.openingHours || '',
    price: place.priceLevel || '',
    reason: ''
  });
  const [location, setLocation] = useState({
    lat: Number(place.lat),
    lng: Number(place.lng)
  });
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);

  const selectedAction = useMemo(
    () => ACTIONS.find((item) => item.type === type),
    [type]
  );
  const SelectedActionIcon = selectedAction?.icon;

  function field(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!user) return;

    const payload = {
      type,
      placeId: place.id,
      photos: type === 'ADD_PHOTO' ? photos : [],
      reason: ['REPORT_WRONG_INFO', 'REPORT_CLOSED'].includes(type)
        ? form.reason.trim()
        : undefined
    };

    if (type === 'UPDATE_PLACE') {
      payload.place = {
        address: form.address.trim(),
        description: form.description.trim(),
        phone: form.phone.trim(),
        website: form.website.trim()
      };
    }
    if (type === 'UPDATE_HOURS') payload.place = { openingHours: form.openingHours.trim() };
    if (type === 'UPDATE_PRICE') payload.place = { price: form.price.trim() };
    if (type === 'FIX_LOCATION') payload.location = { ...location, manuallyAdjusted: true };

    setSaving(true);
    try {
      await createContribution(payload);
      showToast('Đã gửi cập nhật để chờ duyệt.', 'success');
      setPhotos([]);
      setForm((current) => ({ ...current, reason: '' }));
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="place-contribution-block">
      <div className="place-contribution-head">
        <div>
          <span className="eyebrow">CẬP NHẬT DỮ LIỆU</span>
          <h2>Thông tin chưa chính xác?</h2>
          <p>Mọi thay đổi đều được kiểm duyệt trước khi xuất hiện công khai.</p>
        </div>
      </div>

      {!user ? (
        <div className="place-review-login">
          <span>Đăng nhập để bổ sung hoặc sửa thông tin địa điểm.</span>
          <Link to="/login">Đăng nhập</Link>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="place-contribution-actions">
            {ACTIONS.map(({ type: actionType, label, icon: Icon }) => (
              <button
                key={actionType}
                type="button"
                className={type === actionType ? 'active' : ''}
                onClick={() => setType(actionType)}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          <div className="place-contribution-editor">
            <div className="place-contribution-editor-title">
              {SelectedActionIcon && <SelectedActionIcon size={18} />}
              <b>{selectedAction?.label}</b>
            </div>

            {type === 'UPDATE_PLACE' && (
              <div className="place-contribution-grid">
                <label className="full">
                  Địa chỉ
                  <input value={form.address} onChange={(e) => field('address', e.target.value)} />
                </label>
                <label>
                  Điện thoại
                  <input value={form.phone} onChange={(e) => field('phone', e.target.value)} />
                </label>
                <label>
                  Website
                  <input value={form.website} onChange={(e) => field('website', e.target.value)} />
                </label>
                <label className="full">
                  Mô tả
                  <textarea rows="4" value={form.description} onChange={(e) => field('description', e.target.value)} />
                </label>
              </div>
            )}

            {type === 'ADD_PHOTO' && (
              <label className="photo-drop">
                <Camera size={23} />
                <b>Chọn ảnh thực tế</b>
                <span>{photos.length ? photos.length + ' ảnh đã chọn' : 'Tối đa 8 ảnh'}</span>
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setPhotos(Array.from(event.target.files || []).slice(0, 8))}
                />
              </label>
            )}

            {type === 'FIX_LOCATION' && (
              <LocationPicker
                lat={location.lat}
                lng={location.lng}
                onChange={({ lat, lng }) => setLocation({ lat, lng })}
              />
            )}

            {type === 'UPDATE_HOURS' && (
              <label className="place-contribution-single">
                Giờ mở cửa mới
                <input
                  value={form.openingHours}
                  onChange={(e) => field('openingHours', e.target.value)}
                  placeholder="Ví dụ: 07:00 - 22:00"
                />
              </label>
            )}

            {type === 'UPDATE_PRICE' && (
              <label className="place-contribution-single">
                Mức giá mới
                <input
                  value={form.price}
                  onChange={(e) => field('price', e.target.value)}
                  placeholder="Ví dụ: 30.000 - 70.000đ"
                />
              </label>
            )}

            {['REPORT_WRONG_INFO', 'REPORT_CLOSED'].includes(type) && (
              <label className="place-contribution-single">
                Nội dung báo cáo
                <textarea
                  rows="3"
                  value={form.reason}
                  onChange={(e) => field('reason', e.target.value)}
                  placeholder={type === 'REPORT_CLOSED'
                    ? 'Bạn biết địa điểm đã đóng từ khi nào?'
                    : 'Thông tin nào đang sai?'}
                />
              </label>
            )}

            <button className="primary-action" type="submit" disabled={saving}>
              <Send size={16} /> {saving ? 'Đang gửi...' : 'Gửi để kiểm duyệt'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
