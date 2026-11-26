import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Eye, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { getHousingContact } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import '../housing-contact-reveal.css';

// Only an authenticated, explicit button click requests the contact endpoint.
// No private number is sent with public listings or held in local storage.
const ROLE_LABELS = { OWNER:'Chủ nhà / chủ tài sản', BROKER:'Môi giới', MANAGER:'Đơn vị quản lý / cho thuê', OTHER:'Khác' };

export default function HousingContactReveal({ placeId, contactName, advertiserRole, isDemo = false }) {
  const { user } = useAuth();
  const location = useLocation();
  const [revealed, setRevealed] = useState(null);
  const requestRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const currentUserId = user?.id || null;

  useEffect(() => {
    requestRef.current?.abort();
    setRevealed(null);
    setBusy(false);
    setError('');
    return () => requestRef.current?.abort();
  }, [placeId, currentUserId]);

  async function reveal() {
    if (!user || busy || !placeId) return;
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    setBusy(true);
    setError('');
    try {
      const response = await getHousingContact(placeId, { signal: controller.signal });
      if (!controller.signal.aborted) {
        setRevealed({
          userId: currentUserId, placeId: String(placeId),
          contact: response.contact
        });
      }
    } catch (exception) {
      if (!controller.signal.aborted) {
        setRevealed(null);
        setError(exception.status === 429
          ? 'Bạn đã xem nhiều số liên hệ. Vui lòng thử lại sau.'
          : exception.status === 401
            ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
            : 'Không lấy được số liên hệ. Vui lòng thử lại.');
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const contact = user && revealed?.userId === currentUserId &&
    revealed?.placeId === String(placeId) ? revealed.contact : null;
  const displayName = isDemo
    ? 'Tài khoản DEMO (không liên hệ)'
    : (contact?.contactName || contactName || 'Chưa cập nhật người đăng');
  const phone = typeof contact?.phone === 'string' ? contact.phone : '';
  const usablePhone = /^\+?[0-9][0-9\s().-]{7,18}$/.test(phone);
  const zalo = typeof contact?.zalo === 'string' ? contact.zalo : '';

  return (
    <div className="hm-housing-contact" aria-label="Liên hệ người đăng bất động sản">
      <div className="hm-housing-contact-person">
        <UserRound size={17} aria-hidden="true" />
        <div>
          <small>Người đăng / người cho thuê</small>
          <strong>{displayName}</strong>
          {!isDemo && ROLE_LABELS[advertiserRole] && <small>{ROLE_LABELS[advertiserRole]} · Tự khai, chưa xác minh</small>}
        </div>
      </div>
      <div className="hm-housing-contact-reveal">
        {isDemo ? (
          <span className="hm-housing-contact-note">
            <ShieldCheck size={15} aria-hidden="true" />
            Tin DEMO — không có số liên hệ thật.
          </span>
        ) : contact ? (
          <div className="hm-housing-contact-revealed">
            {usablePhone ? (
              <a href={'tel:' + phone.replace(/[^+0-9]/g, '')}>
                <Phone size={16} aria-hidden="true" /> {phone}
              </a>
            ) : <span>Người đăng chưa cung cấp số điện thoại.</span>}
            {zalo && <small>Zalo: {zalo}</small>}
          </div>
        ) : user ? (
          <button type="button" onClick={reveal} disabled={busy} aria-busy={busy}>
            <Eye size={16} aria-hidden="true" />
            {busy ? 'Đang lấy liên hệ...' : 'Hiện số điện thoại'}
          </button>
        ) : (
          <Link to="/login" state={{ from: { pathname: location.pathname, search: location.search } }}>
            <Eye size={16} aria-hidden="true" /> Đăng nhập để hiện số
          </Link>
        )}
        {error && <small role="alert" className="hm-housing-contact-error">{error}</small>}
      </div>
      <small className="hm-housing-contact-footnote">
        Thông tin liên hệ do người đăng cung cấp; hãy xác minh trước khi giao dịch.
      </small>
    </div>
  );
}
