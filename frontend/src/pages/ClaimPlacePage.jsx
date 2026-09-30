import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock3,
  MapPin,
  ShieldCheck
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import {
  createPlaceClaim,
  getMyPlaceClaims,
  getPlace
} from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function ClaimPlacePage() {
  const { id } = useParams();
  const { showToast } = useToast();
  const [place, setPlace] = useState(null);
  const [claims, setClaims] = useState([]);
  const [form, setForm] = useState({
    businessName: '',
    contactPhone: '',
    proofNote: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const existing = useMemo(
    () => claims.find((item) => String(item.placeId) === String(id)) || null,
    [claims, id]
  );

  useEffect(() => {
    let active = true;
    Promise.all([getPlace(id), getMyPlaceClaims()])
      .then(([placeData, claimData]) => {
        if (!active) return;
        setPlace(placeData);
        setClaims(Array.isArray(claimData?.items) ? claimData.items : []);
        setForm((current) => ({
          ...current,
          businessName: current.businessName || placeData?.name || ''
        }));
      })
      .catch((error) => {
        if (active) showToast(error.message, 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  async function submit(event) {
    event.preventDefault();
    if (existing) return;

    setSaving(true);
    try {
      const item = await createPlaceClaim({
        placeId: Number(id),
        businessName: form.businessName.trim() || undefined,
        contactPhone: form.contactPhone.trim(),
        proofNote: form.proofNote.trim()
      });
      setClaims((current) => [item, ...current]);
      showToast('Đã gửi yêu cầu xác minh địa điểm.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="claim-place-page page-container"><div className="loading-card">Đang tải thông tin xác minh...</div></main>;
  }

  if (!place) {
    return <main className="claim-place-page page-container"><div className="empty-state"><MapPin size={24} /><b>Không tìm thấy địa điểm</b></div></main>;
  }

  return (
    <main className="claim-place-page page-container">
      <section className="claim-place-hero">
        <div>
          <span className="eyebrow">BUSINESS CLAIM</span>
          <h1>Xác minh quyền quản lý địa điểm</h1>
          <p>
            Dành cho chủ quán, doanh nghiệp hoặc người đại diện hợp lệ.
            Sau khi được duyệt, bạn có thể vào Business/Partner Dashboard để quản lý
            thông tin và xác nhận voucher khi tham gia chương trình đối tác.
          </p>
        </div>

        <div className="claim-place-summary">
          <span className="claim-place-cover">
            {place.images?.[0] ? <img src={place.images[0]} alt="" /> : <Building2 size={28} />}
          </span>
          <div>
            <small>{place.category || 'Địa điểm'}</small>
            <b>{place.name}</b>
            <span><MapPin size={13} /> {place.address || 'Hòa Lạc'}</span>
          </div>
        </div>
      </section>

      {existing ? (
        <section className={'claim-status-card ' + existing.status.toLowerCase()}>
          {existing.status === 'PENDING' ? <Clock3 size={27} /> : <CheckCircle2 size={27} />}
          <div>
            <span className="eyebrow">TRẠNG THÁI YÊU CẦU</span>
            <h2>
              {existing.status === 'PENDING'
                ? 'Đang chờ Hola Maps xác minh'
                : existing.status === 'APPROVED'
                  ? 'Đã xác minh quyền quản lý'
                  : 'Yêu cầu chưa được chấp nhận'}
            </h2>
            <p>
              {existing.status === 'PENDING'
                ? 'Admin sẽ kiểm tra thông tin bạn cung cấp trước khi cấp quyền quản lý địa điểm.'
                : existing.status === 'APPROVED'
                  ? 'Bạn đã có quyền quản lý địa điểm này. Mở Partner Dashboard để tiếp tục.'
                  : (existing.reviewNote || 'Bạn có thể liên hệ Hola Maps nếu cần bổ sung thông tin xác minh.')}
            </p>
            {existing.status === 'APPROVED' && <Link className="primary-action" to="/partner">Mở Partner Dashboard</Link>}
          </div>
        </section>
      ) : (
        <form className="claim-place-form" onSubmit={submit}>
          <div className="claim-form-heading">
            <span><ShieldCheck size={22} /></span>
            <div><b>Thông tin xác minh</b><small>Không hiển thị công khai trên trang địa điểm.</small></div>
          </div>

          <label>
            Tên doanh nghiệp / quán
            <input
              value={form.businessName}
              onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
              placeholder={place.name}
            />
          </label>

          <label>
            Số điện thoại liên hệ
            <input
              required
              value={form.contactPhone}
              onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))}
              placeholder="Số điện thoại để Hola Maps xác minh"
            />
          </label>

          <label>
            Thông tin chứng minh quyền quản lý
            <textarea
              required
              rows="6"
              minLength="10"
              value={form.proofNote}
              onChange={(event) => setForm((current) => ({ ...current, proofNote: event.target.value }))}
              placeholder="Ví dụ: Tôi là chủ quán, có thể xác minh qua số điện thoại fanpage/website, giấy tờ kinh doanh... Không gửi mật khẩu hoặc thông tin nhạy cảm."
            />
          </label>

          <div className="claim-form-note">
            Hola Maps chỉ dùng thông tin này để xét quyền quản lý địa điểm.
            Không gửi mật khẩu, mã OTP hoặc dữ liệu tài chính.
          </div>

          <button className="primary-action" type="submit" disabled={saving}>
            <ShieldCheck size={16} /> {saving ? 'Đang gửi...' : 'Gửi yêu cầu xác minh'}
          </button>
        </form>
      )}
    </main>
  );
}
