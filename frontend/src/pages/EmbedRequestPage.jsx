import { useEffect, useState } from 'react';
import { ArrowLeft, ClipboardCopy, Globe2, KeyRound, Send, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { createEmbedRequest, getMyEmbedRequests } from '../services/api.js';
import '../embed-platform.css';

function originsFromInput(value) {
  return String(value || '').split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}

function iframeCode(application) {
  return '<iframe title="HOLA Maps" src="' + application.embedUrl +
    '" loading="lazy" referrerpolicy="no-referrer" ' +
    'style="width:100%;height:620px;border:0;border-radius:12px" ' +
    'allow="geolocation"></iframe>';
}

export default function EmbedRequestPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    appName: '', contactEmail: user?.email || '', origins: '', note: ''
  });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await getMyEmbedRequests();
      setItems(result.items || []);
    } catch (caught) {
      setError(caught.message || 'Không tải được hồ sơ đăng ký.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await createEmbedRequest({
        appName: form.appName,
        contactEmail: form.contactEmail,
        origins: originsFromInput(form.origins),
        note: form.note || undefined
      });
      showToast('Đã gửi yêu cầu. HOLA Maps sẽ kiểm tra domain trước khi cấp quyền.', 'success');
      setForm((old) => ({ ...old, appName: '', origins: '', note: '' }));
      await load();
    } catch (caught) {
      showToast(caught.message || 'Không thể gửi yêu cầu.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function copyCode(application) {
    try {
      await navigator.clipboard.writeText(iframeCode(application));
      showToast('Đã sao chép đoạn HTML nhúng.', 'success');
    } catch {
      showToast('Không thể sao chép tự động.', 'error');
    }
  }

  return (
    <main className="hola-embed-request page-container">
      <Link to="/developers"><ArrowLeft size={16} /> Tài liệu tích hợp</Link>
      <div className="hola-embed-request-hero">
        <span><KeyRound size={16} /> HOLA EMBED · PARTNER ACCESS</span>
        <h1>Xin quyền nhúng bản đồ Hòa Lạc</h1>
        <p>Đăng ký tên website và domain cần nhúng. Sau khi HOLA Maps xác minh và duyệt,
          bạn nhận được iframe URL cùng một mã công khai dùng riêng cho các domain đó.
          Có thể gia hạn hoặc yêu cầu cấp lại khi cần.</p>
      </div>
      <div className="hola-embed-request-grid">
        <form className="hola-embed-form" onSubmit={submit}>
          <h2><Send size={19} /> Yêu cầu cấp quyền</h2>
          <label>Tên website / ứng dụng
            <input required minLength={2} maxLength={120} value={form.appName}
              onChange={(e) => setForm((v) => ({ ...v, appName: e.target.value }))}
              placeholder="Tên sản phẩm của bạn" />
          </label>
          <label>Email liên hệ
            <input required type="email" value={form.contactEmail}
              onChange={(e) => setForm((v) => ({ ...v, contactEmail: e.target.value }))} />
          </label>
          <label>Domain cần cho phép (mỗi dòng một domain)
            <textarea required rows={4} value={form.origins}
              onChange={(e) => setForm((v) => ({ ...v, origins: e.target.value }))}
              placeholder={'https://example.com\nhttps://www.example.com'} />
          </label>
          <label>Giới thiệu mục đích nhúng
            <textarea rows={3} maxLength={1000} value={form.note}
              onChange={(e) => setForm((v) => ({ ...v, note: e.target.value }))}
              placeholder="Nhúng bản đồ tìm địa điểm cho người truy cập..." />
          </label>
          <button className="hola-embed-primary" disabled={busy}>
            {busy ? 'Đang gửi...' : 'Gửi yêu cầu xét duyệt'}
          </button>
          <p>Chỉ chấp nhận HTTPS và domain cụ thể. Không cấp quyền theo wildcard.</p>
        </form>

        <section className="hola-embed-my-apps">
          <h2><Globe2 size={19} /> Các website đã đăng ký</h2>
          {loading && <p>Đang tải yêu cầu…</p>}
          {error && <p role="alert" className="hola-embed-error">{error}</p>}
          {!loading && items.length === 0 && <p>Chưa có yêu cầu nào.</p>}
          {items.map((application) => (
            <article key={application.id} className="hola-embed-app">
              <div className="hola-embed-app-heading">
                <strong>{application.appName}</strong>
                <span className={'hola-embed-status ' + application.status.toLowerCase()}>
                  {application.status === 'APPROVED' ? 'Đã duyệt' :
                    application.status === 'PENDING' ? 'Chờ duyệt' :
                    application.status === 'REVOKED' ? 'Đã thu hồi' : 'Từ chối'}
                </span>
              </div>
              <div className="hola-embed-origins">
                <Globe2 size={15} />
                <div>{(application.approvedOrigins?.length ?
                  application.approvedOrigins : application.requestedOrigins).map((origin) => (
                  <code key={origin}>{origin}</code>
                ))}</div>
              </div>
              {application.reviewNote && <p>{application.reviewNote}</p>}
              {application.embedUrl && application.status === 'APPROVED' && (
                <div className="hola-embed-issued">
                  <p><ShieldCheck size={14} /> Đã cấp mã, hết hạn: {new Date(application.expiresAt).toLocaleDateString('vi-VN')}</p>
                  <input readOnly aria-label="URL nhúng" value={application.embedUrl}
                    onFocus={(e) => e.target.select()} />
                  <button type="button" onClick={() => copyCode(application)}>
                    <ClipboardCopy size={15} /> Sao chép HTML nhúng
                  </button>
                </div>
              )}
            </article>
          ))}
        </section>
      </div>
      <p className="hola-embed-security-note">
        <ShieldCheck size={16} /> Mã nhúng hiển thị trong HTML là mã định danh công khai,
        không phải API secret. Quyền nhúng được bảo vệ bằng allowlist HTTPS và
        CSP của máy chủ; HOLA Maps có thể thu hồi từng ứng dụng bất cứ lúc nào.
      </p>
    </main>
  );
}
