import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, KeyRound, LogOut, RefreshCw, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  changePassword,
  confirmTwoFactorSetup,
  disableTwoFactor,
  getSecurityOverview,
  regenerateTwoFactorRecoveryCodes,
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
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [recoveryForm, setRecoveryForm] = useState({ password: '', code: '' });
  const [disableForm, setDisableForm] = useState({ password: '', code: '', recoveryCode: '' });
  const [disableWithRecovery, setDisableWithRecovery] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
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
      const result = await confirmTwoFactorSetup(code);
      setRecoveryCodes(Array.isArray(result?.recoveryCodes) ? result.recoveryCodes : []);
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


  async function regenerateRecovery(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await regenerateTwoFactorRecoveryCodes(recoveryForm);
      setRecoveryCodes(Array.isArray(result?.recoveryCodes) ? result.recoveryCodes : []);
      setRecoveryForm({ password: '', code: '' });
      await load();
      showToast('Đã tạo bộ mã khôi phục mới. Mã cũ đã hết hiệu lực.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function copyRecoveryCodes() {
    if (!recoveryCodes.length) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      showToast('Đã sao chép mã khôi phục.', 'success');
    } catch {
      showToast('Không thể sao chép tự động.', 'error');
    }
  }

  async function rotatePassword(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await changePassword(passwordForm);
      showToast('Đã đổi mật khẩu. Hãy đăng nhập lại.', 'success');
      logout();
      navigate('/login', { replace: true });
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }


  async function turnOffTwoFactor(event) {
    event.preventDefault();
    if (!window.confirm('Tắt xác thực hai lớp cho tài khoản này?')) return;
    setBusy(true);
    try {
      await disableTwoFactor(disableForm);
      setDisableForm({ password: '', code: '', recoveryCode: '' });
      setDisableWithRecovery(false);
      setRecoveryCodes([]);
      await refreshUser();
      await load();
      showToast('Đã tắt xác thực hai lớp.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy(false);
    }
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
            <div className="security-2fa-enabled">
              <div className="security-ok">
                Đang bật và bảo vệ tài khoản · {data?.security?.recoveryCodesRemaining ?? 0} mã khôi phục còn lại.
              </div>

              {recoveryCodes.length > 0 && (
                <div className="security-recovery-codes">
                  <div>
                    <b>Lưu các mã này ngay</b>
                    <span>Mỗi mã chỉ dùng một lần và sẽ không hiển thị lại sau khi rời trang.</span>
                  </div>
                  <div className="security-recovery-grid">
                    {recoveryCodes.map((item) => <code key={item}>{item}</code>)}
                  </div>
                  <button type="button" onClick={copyRecoveryCodes}>
                    <Copy size={14} /> Sao chép tất cả
                  </button>
                </div>
              )}

              <form className="security-form security-recovery-form" onSubmit={regenerateRecovery}>
                <p>Tạo bộ mã khôi phục mới nếu mã cũ đã bị lộ hoặc sắp hết. Bộ mã cũ sẽ bị vô hiệu hóa.</p>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={recoveryForm.password}
                  onChange={(e) => setRecoveryForm((current) => ({ ...current, password: e.target.value }))}
                  placeholder="Mật khẩu hiện tại"
                  required
                />
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  minLength={6}
                  maxLength={6}
                  value={recoveryForm.code}
                  onChange={(e) => setRecoveryForm((current) => ({ ...current, code: e.target.value }))}
                  placeholder="Mã Authenticator 6 số"
                  required
                />
                <button disabled={busy}><RefreshCw size={14} /> Tạo mã khôi phục mới</button>
              </form>

              <details className="security-disable-2fa">
                <summary>Tắt xác thực hai lớp</summary>
                <form className="security-form" onSubmit={turnOffTwoFactor}>
                  <p>
                    {user?.role === 'ADMIN'
                      ? 'Admin sẽ bị khóa khỏi khu quản trị cho đến khi bật 2FA lại.'
                      : 'Chỉ nên tắt khi bạn không còn muốn bảo vệ tài khoản bằng lớp xác thực thứ hai.'}
                  </p>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={disableForm.password}
                    onChange={(e) => setDisableForm((current) => ({ ...current, password: e.target.value }))}
                    placeholder="Mật khẩu hiện tại"
                    required
                  />
                  {disableWithRecovery ? (
                    <input
                      value={disableForm.recoveryCode}
                      onChange={(e) => setDisableForm((current) => ({ ...current, recoveryCode: e.target.value, code: '' }))}
                      placeholder="Mã khôi phục"
                      minLength={12}
                      maxLength={32}
                      required
                    />
                  ) : (
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={disableForm.code}
                      onChange={(e) => setDisableForm((current) => ({ ...current, code: e.target.value, recoveryCode: '' }))}
                      placeholder="Mã Authenticator 6 số"
                      minLength={6}
                      maxLength={6}
                      required
                    />
                  )}
                  <button
                    className="security-link-button"
                    type="button"
                    onClick={() => {
                      setDisableWithRecovery((value) => !value);
                      setDisableForm((current) => ({ ...current, code: '', recoveryCode: '' }));
                    }}
                  >
                    {disableWithRecovery ? 'Dùng Authenticator' : 'Dùng mã khôi phục'}
                  </button>
                  <button className="security-danger-button" disabled={busy}>Tắt 2FA</button>
                </form>
              </details>
            </div>
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

        <article className="security-card security-password-card">
          <h2><KeyRound size={18} /> Đổi mật khẩu</h2>
          <form onSubmit={rotatePassword} className="security-form">
            <p>Đổi mật khẩu sẽ thu hồi toàn bộ phiên đăng nhập và yêu cầu đăng nhập lại.</p>
            <input
              type="password"
              autoComplete="current-password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((current) => ({ ...current, currentPassword: e.target.value }))}
              placeholder="Mật khẩu hiện tại"
              required
            />
            <input
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((current) => ({ ...current, newPassword: e.target.value }))}
              placeholder="Mật khẩu mới"
              required
            />
            <button disabled={busy}>Đổi mật khẩu an toàn</button>
          </form>
        </article>
      </section>
    </main>
  );
}
