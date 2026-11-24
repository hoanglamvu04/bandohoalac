import { useState } from 'react';
import { ArrowLeft, CheckCircle2, MessageSquareWarning, Send, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { submitSoftLaunchFeedback } from '../services/api.js';
import '../soft-launch-feedback.css';

const CATEGORIES = [
  ['BUG', 'Lỗi không hoạt động'],
  ['DATA', 'Thông tin địa điểm sai hoặc thiếu'],
  ['UX', 'Giao diện khó dùng'],
  ['SUGGESTION', 'Đề xuất tính năng']
];
const AREAS = [
  ['MAP', 'Bản đồ'], ['PLACE', 'Chi tiết địa điểm'],
  ['HOUSING', 'Bất động sản'], ['SEARCH', 'Tìm kiếm'],
  ['ACCOUNT', 'Tài khoản'], ['OTHER', 'Khác']
];
const AREA_CODES = new Set(AREAS.map(([code]) => code));

export default function SoftLaunchFeedbackPage() {
  const location = useLocation();
  const suggestedArea = location.state?.area;
  // Only an already-public integer listing ID is accepted from the URL.
  // No user position, contact, image or identity is prefilled or collected.
  const rawPropertyId = new URLSearchParams(location.search).get('reportHousing');
  const propertyId = rawPropertyId && /^[1-9]\\d{0,14}$/.test(rawPropertyId) &&
    Number.isSafeInteger(Number(rawPropertyId)) ? rawPropertyId : null;
  const messagePrefix = propertyId ? 'Tin BĐS #' + propertyId + ': ' : '';
  const [category, setCategory] = useState(propertyId ? 'DATA' : 'BUG');
  const [area, setArea] = useState(propertyId ? 'HOUSING' :
    AREA_CODES.has(suggestedArea) ? suggestedArea : 'MAP');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    if (busy || message.trim().length < 20 ||
        messagePrefix.length + message.trim().length > 1200) return;
    setBusy(true);
    setError('');
    try {
      const result = await submitSoftLaunchFeedback({
        category, area, message: messagePrefix + message.trim(), website
      });
      setReference(result.reference || null);
      setSent(true);
    } catch (err) {
      setError(err?.status === 429
        ? 'Bạn đã gửi nhiều phản hồi. Hãy thử lại sau.'
        : err.message || 'Gửi phản hồi chưa thành công. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="soft-feedback-page">
      <div className="soft-feedback-container">
        <Link className="soft-feedback-back" to="/map"><ArrowLeft size={16} /> Quay về bản đồ</Link>

        {sent ? (
          <section className="soft-feedback-panel soft-feedback-success" role="status">
            <CheckCircle2 size={42} />
            <span className="soft-feedback-eyebrow">HOLA MAPS · SOFT LAUNCH</span>
            <h1>Cảm ơn bạn đã góp ý!</h1>
            <p>Phản hồi đã được ghi nhận và chuyển vào hàng đợi để đội ngũ kiểm tra.
              Không có thay đổi nào được tự động áp dụng lên bản đồ.</p>
            {reference && (
              <div className="soft-feedback-ref">
                <small>Mã tham chiếu</small>
                <code>{reference}</code>
              </div>
            )}
            <div className="soft-feedback-actions">
              <Link to="/map">Quay về bản đồ</Link>
              <button type="button" onClick={() => {
                setSent(false); setReference(null); setMessage('');
              }}>Gửi phản hồi khác</button>
            </div>
          </section>
        ) : (
          <>
            <div className="soft-feedback-intro">
              <span className="soft-feedback-eyebrow"><MessageSquareWarning size={16}/> THỬ NGHIỆM CỘNG ĐỒNG</span>
              <h1>Bạn gặp lỗi khi dùng HOLA Maps?</h1>
              <p>{propertyId
                ? 'Phản ánh về một tin BĐS đã công khai. Vui lòng mô tả lý do cần kiểm tra; báo cáo không làm tin tự động bị ẩn.'
                : 'Mô tả sự cố hoặc góp ý của bạn. Chúng tôi sẽ xem xét để bản đồ hoạt động tốt hơn trước khi ra mắt rộng rãi.'}</p>
              {propertyId && <p className="soft-feedback-property-context" role="status">
                Đang phản ánh tin BĐS #{propertyId}. Mã tin do người gửi cung cấp và cần Admin đối chiếu trước khi xử lý.
              </p>}
            </div>

            <form className="soft-feedback-panel soft-feedback-form" onSubmit={onSubmit}>
              <label>
                <span>Loại phản hồi</span>
                <select aria-label="Loại phản hồi" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <label>
                <span>Bạn gặp vấn đề ở đâu?</span>
                <select aria-label="Khu vực gặp lỗi" value={area} onChange={(e) => setArea(e.target.value)}>
                  {AREAS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <label className="soft-feedback-full">
                <span>Mô tả lỗi hoặc đề xuất <em>(ít nhất 20 ký tự)</em></span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  minLength={20}
                  maxLength={1200 - messagePrefix.length}
                  rows={6}
                  required
                  placeholder={propertyId
                    ? 'Ví dụ: Giá/ảnh trên tin không trùng với thực tế; giải thích dấu hiệu và cách bạn kiểm tra, không gửi dữ liệu cá nhân...'
                    : 'Ví dụ: Khi mở bản đồ bằng điện thoại và chọn lớp đường, các điểm bị tải lại liên tục...'}
                />
                <small>{message.trim().length} / {1200 - messagePrefix.length} ký tự ·
                  {propertyId ? ' Nêu dấu hiệu nghi vấn, không cần cung cấp thông tin riêng tư.' : ' Nêu các bước gây lỗi nếu có.'}
                </small>
              </label>
              <div className="soft-feedback-trap" aria-hidden="true">
                <label htmlFor="soft-feedback-website">Không điền trường này</label>
                <input id="soft-feedback-website" tabIndex={-1} autoComplete="off"
                  value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
              <div className="soft-feedback-privacy soft-feedback-full">
                <ShieldCheck size={20} />
                <span>Không cần đăng nhập, không tự lấy vị trí, ảnh màn hình hay thông tin tài khoản.
                  Vui lòng <b>không nhập mật khẩu, số điện thoại hoặc thông tin cá nhân</b>
                  trong phần mô tả. Nội dung bạn chủ động gửi chỉ được Admin xem xét.</span>
              </div>
              {error && <div className="soft-feedback-error soft-feedback-full" role="alert">{error}</div>}
              <button className="soft-feedback-submit soft-feedback-full" type="submit"
                disabled={busy || message.trim().length < 20}>
                <Send size={17} /> {busy ? 'Đang gửi...' : 'Gửi góp ý cho HOLA Maps'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
