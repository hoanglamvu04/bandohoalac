import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { KeyRound, LogOut, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  confirmTwoFactorSetup,
  getSecurityOverview,
  revokeAllSecuritySessions,
  revokeSecuritySession,
  startTwoFactorSetup
} from '../services/api.js';

export default function SecurityPage() {
  const { user, logout, refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [password, setPassword] = useState('');
  const [setup, setSetup] = useState(null);
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setData(await getSecurityOverview()); }
    catch (error) { showToast(error.message, 'error'); }
  }

  useEffect(() => { load(); }, []);

  async function begin(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const next = await startTwoFactorSetup(password);
      setSetup(next);
      setQr(await QRCode.toDataURL(next.otpauthUri, { width: 210, margin: 1 }));
      setPassword('');
    } catch (error) {
      showToast(error.message, 'error');
    } finally { setBusy(false); }
  }

  async function confirm(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await confirmTwoFactorSetup(code);
      await refreshUser();
      await load();
      setSetup(null);
      setCode('');
      showToast('Đã bật xác thực hai lớp.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally { setBusy(false); }
  }

  async function revoke(session) {
    if (!window.confirm('Thu hồi phiên đăng nhập này?')) return;
    const result = await revokeSecuritySession(session.id);
    if (result.currentSessionRevoked) {
      logout();
      navigate('/login', { replace: true });
      return;
    }
    await load();
  }

  async function revokeAll() {
    if (!window.confirm('Đăng xuất tất cả thiết bị?')) return;
    await revokeAllSecuritySessions();
    logout();
    navigate('/login', { replace: true });
  }

  const enabled = Boolean(data?.security?.twoFactorEnabled);
  return (
    <main className="security-page page-container">
      <section className="security-hero">
        <ShieldCheck size={28} />
        <div><small>HOLA SECURITY</small><h1>Bảo mật tài khoản</h1><p>2FA và các phiên đăng nhập đang hoạt động.</p></div>
      </section>

      {user?.role === 'ADMIN' && !enabled && (
        <div className="security-warning">Admin bắt buộc bật 2FA trước khi truy cập khu quản trị.</div>
      )}

      <section className="security-grid">
        <article className="security-card">
          <h2><KeyRound size={18} /> Xác thực hai lớp</h2>
          {enabled ? (
            <div className="security-ok">Đang bật và bảo vệ tài khoản.</div>
          ) : setup ? (
            <form onSubmit={confirm} className="security-setup">
              {qr && <img src={qr} alt="QR thiết lập 2FA" />}
              <code>{setup.secret}</code>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Mã 6 số" minLength={6} maxLength={6} required />
              <button disabled={busy}>Xác minh và bật</button>
            </form>
          ) : (
            <form onSubmit={begin} className="security-form">
              <p>Dùng Google/Microsoft Authenticator hoặc ứng dụng TOTP tương thích.</p>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu hiện tại" required />
              <button disabled={busy}>Thiết lập 2FA</button>
            </form>
          )}
        </article>

        <article className="security-card">
          <h2><Smartphone size={18} /> Thiết bị đăng nhập</h2>
          <div className="security-sessions">
            {(data?.sessions || []).map((session) => (
              <div key={session.id}>
                <span><b>{session.current ? 'Thiết bị này' : 'Phiên đăng nhập'}</b><small>{session.userAgent}</small></span>
                <button onClick={() => revoke(session)} aria-label="Thu hồi phiên"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <button className="security-revoke" onClick={revokeAll}><LogOut size={14} /> Đăng xuất tất cả thiết bị</button>
        </article>
      </section>
    </main>
  );
}
