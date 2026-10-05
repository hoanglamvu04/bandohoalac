import { useEffect, useMemo, useState } from 'react';
import { Award, Search, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { getAdminUsers, updateAdminUser } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import '../../data-trust-admin.css';
import '../../ctv-management.css';

function roleLabel(role) {
  if (role === 'CTV') return 'CTV kiểm duyệt';
  if (role === 'MODERATOR') return 'Quản trị dữ liệu';
  if (role === 'ADMIN') return 'Quản trị viên';
  if (role === 'CONTRIBUTOR') return 'Người đóng góp';
  return 'Thành viên';
}

export default function AdminCtvManagement() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getAdminUsers({ q: q.trim() || undefined, limit: 100 });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, q.trim() ? 250 : 0);
    return () => clearTimeout(timer);
  }, [q]);

  const ctvCount = useMemo(() => items.filter((item) => item.role === 'CTV').length, [items]);

  async function patchUser(item, patch) {
    setBusyId(item.id);
    try {
      const updated = await updateAdminUser(item.id, patch);
      setItems((current) => current.map((entry) => String(entry.id) === String(updated.id) ? { ...entry, ...updated } : entry));
      showToast('Đã cập nhật quyền CTV.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="admin-page page-container ctv-management-page">
      <section className="data-trust-hero">
        <div>
          <span className="eyebrow">CTV TRUST MANAGEMENT</span>
          <h1>Quản lý CTV kiểm duyệt</h1>
          <p>CTV cấp 1 xử lý đóng góp rủi ro thấp. CTV cấp 2 được sửa địa điểm, xác minh chất lượng và duyệt import từng bản ghi.</p>
        </div>
        <div className="data-trust-health"><Users size={20} /><span><b>{ctvCount}</b><small>CTV trong danh sách</small></span></div>
      </section>

      <section className="ctv-manager-toolbar">
        <label><Search size={16} /><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Tìm tên hoặc email để cấp quyền CTV..." /></label>
      </section>

      {loading && <div className="loading-card">Đang tải tài khoản...</div>}

      <section className="ctv-manager-list">
        {items.map((item) => (
          <article className={item.role === 'CTV' ? 'is-ctv' : ''} key={item.id}>
            <span className="ctv-manager-avatar">{item.name?.slice(0, 1)?.toUpperCase() || 'U'}</span>
            <div className="ctv-manager-copy">
              <small>#{item.id} · {roleLabel(item.role)}</small>
              <h3>{item.name}</h3>
              <p>{item.email}</p>
              {item.role === 'CTV' && (
                <div className="ctv-manager-metrics">
                  <span><ShieldCheck size={13} /> Trust <b>{item.ctvTrustScore}/100</b></span>
                  <span><Award size={13} /> {item.ctvReviewsCount} lượt duyệt</span>
                  <span>{item.ctvConfirmedCount} đúng · {item.ctvOverturnedCount} bị sửa</span>
                </div>
              )}
            </div>

            <div className="ctv-manager-controls">
              <label>Vai trò
                <select disabled={busyId === item.id} value={item.role} onChange={(event) => patchUser(item, { role: event.target.value })}>
                  <option value="USER">Thành viên</option>
                  <option value="CONTRIBUTOR">Người đóng góp</option>
                  <option value="CTV">CTV kiểm duyệt</option>
                  <option value="MODERATOR">Quản trị dữ liệu</option>
                  <option value="ADMIN">Quản trị viên</option>
                </select>
              </label>

              {item.role === 'CTV' && (
                <>
                  <label>Cấp CTV
                    <select disabled={busyId === item.id} value={item.ctvLevel || 1} onChange={(event) => patchUser(item, { ctvLevel: Number(event.target.value) })}>
                      <option value="1">Cấp 1</option>
                      <option value="2">Cấp 2</option>
                    </select>
                  </label>
                  <label>Trust
                    <input type="number" min="0" max="100" disabled={busyId === item.id} value={item.ctvTrustScore ?? 60} onChange={(event) => setItems((current) => current.map((entry) => String(entry.id) === String(item.id) ? { ...entry, ctvTrustScore: Number(event.target.value) } : entry))} onBlur={(event) => patchUser(item, { ctvTrustScore: Number(event.target.value) })} />
                  </label>
                </>
              )}
            </div>
          </article>
        ))}
      </section>

      {!loading && !items.length && <div className="empty-state"><UserCheck size={24} /><b>Không tìm thấy tài khoản</b></div>}
    </main>
  );
}
