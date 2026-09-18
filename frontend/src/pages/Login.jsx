import { useState } from 'react';
import { LogIn, Sparkles } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(form);
      showToast('Đăng nhập thành công. Chào mừng trở lại!', 'success');
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page page-container">
      <form className="auth-card" onSubmit={submit}>
        <span className="eyebrow"><Sparkles size={15} /> HOLA MAPS</span>
        <h1>Đăng nhập</h1>
        <p className="auth-subtitle">Đăng nhập để đóng góp địa điểm, lưu yêu thích và theo dõi điểm Explorer của bạn.</p>

        <label>Email
          <input type="email" name="email" required value={form.email} onChange={updateField} placeholder="you@example.com" />
        </label>
        <label>Mật khẩu
          <input type="password" name="password" required value={form.password} onChange={updateField} placeholder="••••••••" />
        </label>

        {error && <div className="form-status error">{error}</div>}

        <button className="primary-action wide" type="submit" disabled={submitting}>
          <LogIn size={18} /> {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>

        <p className="auth-switch">Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link></p>
      </form>
    </main>
  );
}
