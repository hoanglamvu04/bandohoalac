import { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardCopy, Clock3, Globe2, Plus, RefreshCw, RotateCcw, ShieldCheck, ShieldX } from 'lucide-react';
import {
  getAdminEmbedApplications,
  createAdminEmbedGrant,
  approveAdminEmbedRequest,
  rejectAdminEmbedRequest,
  revokeAdminEmbedGrant,
  rotateAdminEmbedGrant
} from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import '../../embed-platform.css';

function splitOrigins(value) {
  return String(value || '').split(/[\n,]+/).map((v) => v.trim()).filter(Boolean);
}

function iframeCode(item) {
  return '<iframe title="HOLA Maps" src="' + item.embedUrl +
    '" loading="lazy" referrerpolicy="no-referrer" ' +
    'style="width:100%;height:620px;border:0;border-radius:12px" ' +
    'allow="geolocation"></iframe>';
}

function dateLabel(value) {
  return value ? new Date(value).toLocaleDateString('vi-VN') : 'Không giới hạn';
}

export default function EmbedPlatformPanel() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    appName: '',
    contactEmail: '',
    origins: '',
    validDays: 365,
    note: ''
  });
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.status === 'PENDING' ? -1 : 0) - (b.status === 'PENDING' ? -1 : 0)),
    [items]
  );

  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await getAdminEmbedApplications();
      setItems(result.items || []);
    } catch (caught) {
      setError(caught.message || 'Không thể tải ứng dụng.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(event) {
    event.preventDefault();
    setBusy('new');
    try {
      await createAdminEmbedGrant({
        appName: form.appName,
        contactEmail: form.contactEmail,
        origins: splitOrigins(form.origins),
        note: form.note || undefined,
        validDays: Number(form.validDays) || 365
      });
      setForm({ appName: '', contactEmail: '', origins: '', validDays: 365, note: '' });
      showToast('Đã cấp mã nhúng và kích hoạt danh sách domain.', 'success');
      await load();
    } catch (caught) {
      showToast(caught.message || 'Không cấp được mã nhúng.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function act(item, operation) {
    if (
      operation === 'approve' &&
      !window.confirm('Đã xác minh quyền sử dụng các domain của ' + item.appName + '?')
    ) return;

    if (
      operation === 'revoke' &&
      !window.confirm('Thu hồi sẽ chặn iframe trên tất cả website của ' + item.appName + ' ngay lập tức. Tiếp tục?')
    ) return;

    if (
      operation === 'rotate' &&
      !window.confirm('Đổi mã khiến iframe đang dùng mã cũ không hoạt động. Tiếp tục?')
    ) return;

    let reason = '';
    if (operation === 'reject') {
      reason = window.prompt('Lý do từ chối (ít nhất 5 ký tự):') || '';
      if (reason.trim().length < 5) return;
    }

    setBusy(item.id + ':' + operation);
    try {
      if (operation === 'approve') {
        await approveAdminEmbedRequest(item.id, { validDays: 365 });
      } else if (operation === 'reject') {
        await rejectAdminEmbedRequest(item.id, reason.trim());
      } else if (operation === 'revoke') {
        await revokeAdminEmbedGrant(item.id);
      } else if (operation === 'rotate') {
        await rotateAdminEmbedGrant(item.id, { validDays: 365 });
      }
      showToast('Đã cập nhật quyền nhúng ' + item.appName + '.', 'success');
      await load();
    } catch (caught) {
      showToast(caught.message || 'Không thể cập nhật quyền nhúng.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function copy(value) {
    try {
      await navigator.clipboard.writeText(value);
      showToast('Đã sao chép.', 'success');
    } catch {
      showToast('Trình duyệt từ chối sao chép. Hãy chọn và sao chép thủ công.', 'error');
    }
  }

  return (
    <section className="hola-embed-panel" aria-label="Quản lý quyền nhúng bản đồ">
      <div className="hola-embed-intro">
        <div>
          <span><ShieldCheck size={16} /> HOLA EMBED PLATFORM</span>
          <h2>Cấp quyền nhúng theo ứng dụng</h2>
          <p>Website gửi yêu cầu, Admin xác minh domain và cấp mã nhúng riêng.
            Mã công khai không phải API secret; CSP chỉ cho domain đã duyệt hiển thị iframe.</p>
        </div>
        <button type="button" onClick={load} disabled={loading}>
          <RefreshCw size={16} /> Làm mới
        </button>
      </div>

      <form className="hola-embed-form" onSubmit={create}>
        <div>
          <h3><Plus size={17} /> Cấp trực tiếp cho một ứng dụng</h3>
          <p>Ví dụ: HALO HOLA. Dùng khi đã xác minh website là đối tác hợp lệ.</p>
        </div>
        <div className="hola-embed-form-grid">
          <label>Tên website / ứng dụng
            <input required minLength={2} maxLength={120} value={form.appName}
              onChange={(event) => setForm((old) => ({ ...old, appName: event.target.value }))}
              placeholder="HALO HOLA" />
          </label>
          <label>Email liên hệ
            <input type="email" required value={form.contactEmail}
              onChange={(event) => setForm((old) => ({ ...old, contactEmail: event.target.value }))}
              placeholder="Địa chỉ liên hệ của đối tác" />
          </label>
          <label>Thời hạn (ngày)
            <input type="number" min="1" max="730" value={form.validDays}
              onChange={(event) => setForm((old) => ({ ...old, validDays: event.target.value }))} />
          </label>
        </div>
        <label>Domain cho phép (mỗi dòng một domain HTTPS)
          <textarea rows={3} required value={form.origins}
            onChange={(event) => setForm((old) => ({ ...old, origins: event.target.value }))}
            placeholder={'https://halohola.vn\nhttps://www.halohola.vn'} />
        </label>
        <label>Ghi chú
          <input maxLength={1000} value={form.note}
            onChange={(event) => setForm((old) => ({ ...old, note: event.target.value }))}
            placeholder="Đã kiểm tra quyền sở hữu tên miền..." />
        </label>
        <button className="hola-embed-primary" disabled={busy === 'new' || loading}>
          <ShieldCheck size={16} /> {busy === 'new' ? 'Đang cấp mã...' : 'Cấp mã nhúng'}
        </button>
      </form>

      <div className="hola-embed-list-head">
        <h3>Ứng dụng đăng ký ({items.length})</h3>
        <a href="/developers/embed" target="_blank" rel="noreferrer">Trang yêu cầu nhúng</a>
      </div>

      {loading && <p className="hola-embed-muted">Đang tải các ứng dụng…</p>}
      {error && <p role="alert" className="hola-embed-error">{error}</p>}
      {!loading && !items.length && <p className="hola-embed-muted">Chưa có yêu cầu nhúng nào.</p>}

      <div className="hola-embed-list">
        {sorted.map((item) => {
          const isApproved = item.status === 'APPROVED';
          const expired = item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now();
          const working = busy.startsWith(item.id + ':');

          return (
            <article className="hola-embed-app" key={item.id}>
              <div className="hola-embed-app-heading">
                <div>
                  <strong>{item.appName}</strong>
                  <small>{item.contactEmail} · Yêu cầu {dateLabel(item.createdAt)}</small>
                </div>
                <span className={'hola-embed-status ' + item.status.toLowerCase()}>
                  {item.status === 'PENDING' ? 'Chờ duyệt' :
                    item.status === 'APPROVED' ? expired ? 'Đã hết hạn' : 'Đã duyệt' :
                    item.status === 'REVOKED' ? 'Đã thu hồi' : 'Từ chối'}
                </span>
              </div>
              <div className="hola-embed-origins">
                <Globe2 size={15} />
                <div>{(isApproved ? item.approvedOrigins : item.requestedOrigins).map((origin) => (
                  <code key={origin}>{origin}</code>
                ))}</div>
              </div>
              {item.reviewNote && <p className="hola-embed-muted">Lý do: {item.reviewNote}</p>}
              {isApproved && (
                <div className="hola-embed-issued">
                  <small><Clock3 size={13} /> Hạn dùng: {dateLabel(item.expiresAt)}</small>
                  <label>URL iframe
                    <input readOnly value={item.embedUrl || ''} onFocus={(event) => event.target.select()} />
                  </label>
                  <div className="hola-embed-actions">
                    <button type="button" onClick={() => copy(item.embedUrl || '')}><ClipboardCopy size={14} /> Copy URL</button>
                    <button type="button" onClick={() => copy(iframeCode(item))}><ClipboardCopy size={14} /> Copy HTML</button>
                  </div>
                  <p>Mã công khai theo domain được duyệt; mã này không cho phép gọi API riêng tư.</p>
                </div>
              )}
              <div className="hola-embed-actions">
                {item.status === 'PENDING' && (
                  <>
                    <button type="button" disabled={working} onClick={() => act(item, 'approve')}>
                      <Check size={15} /> Duyệt + cấp mã
                    </button>
                    <button type="button" disabled={working} onClick={() => act(item, 'reject')}>
                      <ShieldX size={15} /> Từ chối
                    </button>
                  </>
                )}
                {isApproved && (
                  <>
                    <button type="button" disabled={working} onClick={() => act(item, 'rotate')}>
                      <RotateCcw size={15} /> Đổi mã / gia hạn
                    </button>
                    <button type="button" disabled={working} className="danger" onClick={() => act(item, 'revoke')}>
                      <ShieldX size={15} /> Thu hồi
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
