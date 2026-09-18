import { useState } from 'react';
import { Sparkles, UserPlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
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
      await register(form);
      showToast('Tạo tài khoản thành công. Chào mừng đến với Hola Maps!', 'success');
      navigate('/', { replace: true });
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
        <h1>Tạo tài khoản Explorer</h1>
        <p className="auth-subtitle">Tham gia cộng đồng Hola Explorer, đóng góp địa điểm và nhận điểm thưởng.</p>

        <label>Họ và tên
          <input name="name" required minLength={2} value={form.name} onChange={updateField} placeholder="Nguyễn Văn A" />
        </label>
        <label>Email
          <input type="email" name="email" required value={form.email} onChange={updateField} placeholder="you@example.com" />
        </label>
        <label>Mật khẩu
          <input type="password" name="password" required minLength={8} value={form.password} onChange={updateField} placeholder="Ít nhất 8 ký tự" />
        </label>

        {error && <div className="form-status error">{error}</div>}

        <button className="primary-action wide" type="submit" disabled={submitting}>
          <UserPlus size={18} /> {submitting ? 'Đang tạo tài khoản...' : 'Đăng ký'}
        </button>

        <p className="auth-switch">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
      </form>
    </main>
  );
}
