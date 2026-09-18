import { useEffect, useState } from 'react';
import { Check, Clock3, MapPin, Camera, X } from 'lucide-react';
import {
  approveContribution, getAdminContributions, rejectContribution
} from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

const TYPE_LABELS = {
  CREATE_PLACE: 'Thêm địa điểm mới',
  UPDATE_PLACE: 'Cập nhật thông tin',
  ADD_PHOTO: 'Thêm ảnh',
  FIX_LOCATION: 'Chỉnh vị trí',
  UPDATE_HOURS: 'Cập nhật giờ mở cửa',
  UPDATE_PRICE: 'Cập nhật giá',
  REPORT_CLOSED: 'Báo đóng cửa',
  REPORT_WRONG_INFO: 'Báo sai thông tin'
};

export default function AdminContributions() {
  const { showToast } = useToast();
  const [status, setStatus] = useState('PENDING');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  function load() {
    setLoading(true);
    getAdminContributions({ status })
      .then((data) => setItems(data.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }

  useEffect(load, [status]);

  async function handleApprove(id) {
    setBusyId(id);
    try {
      await approveContribution(id);
      showToast('Đã duyệt đóng góp. Địa điểm đã xuất hiện trên bản đồ.', 'success');
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id) {
    if (!rejectReason.trim()) {
      showToast('Vui lòng nhập lý do từ chối.', 'error');
      return;
    }
    setBusyId(id);
    try {
      await rejectContribution(id, rejectReason.trim());
      showToast('Đã từ chối đóng góp.', 'info');
      setItems((current) => current.filter((item) => item.id !== id));
      setRejectingId(null);
      setRejectReason('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="admin-page page-container">
      <div className="section-heading">
        <div><span className="eyebrow">MODERATION</span><h2>Đóng góp cộng đồng</h2></div>
        <div className="admin-status-tabs">
          {['PENDING', 'APPROVED', 'REJECTED'].map((value) => (
            <button key={value} className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>
              {value}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="loading-card">Đang tải danh sách...</div>}
      {!loading && !items.length && (
        <div className="empty-state"><Clock3 size={24} /><b>Không có đóng góp nào</b><span>Trạng thái: {status}</span></div>
      )}

      <div className="contribution-list">
        {items.map((item) => {
          const place = item.payload?.place || {};
          const location = item.payload?.location;
          const photos = item.payload?.photos || [];
          return (
            <article className="contribution-card" key={item.id}>
              <div className="contribution-card-head">
                <span className="place-kicker">{TYPE_LABELS[item.type] || item.type}</span>
                <span className="result-note">{new Date(item.createdAt).toLocaleString('vi-VN')}</span>
              </div>

              <h3>{place.name || item.placeName || `Contribution #${item.id}`}</h3>
              <p className="detail-description">Người gửi: <b>{item.userName}</b> ({item.userEmail})</p>

              {place.address && <p className="place-meta"><MapPin size={15} /> {place.address}</p>}
              {location && <p className="place-meta"><MapPin size={15} /> GPS: {Number(location.lat).toFixed(6)}, {Number(location.lng).toFixed(6)}</p>}
              {place.description && <p className="detail-description">{place.description}</p>}
              {(place.price || place.openingHours || place.phone) && (
                <p className="place-meta">
                  {place.price ? <>Giá: {place.price}</> : null}
                  {place.openingHours ? <> · Giờ: {place.openingHours}</> : null}
                  {place.phone ? <> · SĐT: {place.phone}</> : null}
                </p>
              )}
              {item.rejectReason && <div className="form-status error">Lý do từ chối: {item.rejectReason}</div>}

              {!!photos.length && (
                <div className="contribution-photos">
                  {photos.map((url) => <img key={url} src={url} alt="Ảnh đóng góp" />)}
                  <span className="result-note"><Camera size={14} /> {photos.length} ảnh</span>
                </div>
              )}

              {status === 'PENDING' && (
                <div className="contribution-actions">
                  <button className="primary-action" disabled={busyId === item.id} onClick={() => handleApprove(item.id)}>
                    <Check size={17} /> Duyệt
                  </button>
                  <button className="secondary-action" disabled={busyId === item.id} onClick={() => setRejectingId(item.id)}>
                    <X size={17} /> Từ chối
                  </button>
                </div>
              )}

              {rejectingId === item.id && (
                <div className="reject-panel">
                  <textarea
                    rows="2"
                    placeholder="Lý do từ chối..."
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                  />
                  <div className="contribution-actions">
                    <button className="primary-action" disabled={busyId === item.id} onClick={() => handleReject(item.id)}>Xác nhận từ chối</button>
                    <button className="secondary-action" onClick={() => { setRejectingId(null); setRejectReason(''); }}>Hủy</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
