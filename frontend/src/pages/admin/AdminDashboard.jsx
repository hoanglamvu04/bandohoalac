import { useEffect, useState } from 'react';
import { Activity, BadgePercent, ClipboardList, Flag, LayoutDashboard, MapPinned, Megaphone, Palette, PencilRuler, ShieldCheck, UserCog, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAdminContributions } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminContributions({ status: 'PENDING' })
      .then((data) => setPendingCount(data.items.length))
      .catch(() => setPendingCount(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="admin-page page-container">
      <section className="admin-hero">
        <div className="admin-hero-icon"><LayoutDashboard size={26} /></div>
        <div>
          <span className="eyebrow">MODERATION DASHBOARD</span>
          <h1>Xin chào, {user?.name}</h1>
          <p>Vai trò: <b>{user?.role}</b> · Kiểm duyệt đóng góp để giữ bản đồ Hola Maps chính xác.</p>
        </div>
      </section>

      <section className="admin-stat-grid">
        <div className="admin-stat-card">
          <ClipboardList size={22} />
          <b>{loading ? '...' : pendingCount ?? '—'}</b>
          <span>Đóng góp đang chờ duyệt</span>
        </div>
        <div className="admin-stat-card">
          <ShieldCheck size={22} />
          <b>{user?.role}</b>
          <span>Quyền hạn hiện tại</span>
        </div>
        <div className="admin-stat-card">
          <Users size={22} />
          <b>Community</b>
          <span>Nguồn dữ liệu: CTV &amp; User</span>
        </div>
      </section>

      <div className="admin-dashboard-actions">
        <Link className="primary-action" to="/admin/contributions">
          <ClipboardList size={18} /> Duyệt đóng góp
        </Link>
        <Link className="secondary-action" to="/admin/places">
          <MapPinned size={18} /> Quản lý địa điểm
        </Link>
        <Link className="secondary-action" to="/admin/map-editor">
          <PencilRuler size={18} /> Biên tập lớp bản đồ
        </Link>
        {user?.role === 'ADMIN' && (
          <>
            <Link className="secondary-action" to="/admin/users">
              <UserCog size={18} /> Quản lý người dùng
            </Link>
            <Link className="secondary-action" to="/admin/partners">
              <BadgePercent size={18} /> Đối tác & Voucher
            </Link>
            <Link className="secondary-action" to="/admin/missions">
              <Flag size={18} /> Nhiệm vụ Explorer
            </Link>
            <Link className="secondary-action" to="/admin/audit">
              <Activity size={18} /> Nhật ký hệ thống
            </Link>
            <Link className="secondary-action" to="/admin/brand">
              <Palette size={18} /> Quản lý thương hiệu
            </Link>
            <Link className="secondary-action" to="/admin/ads">
              <Megaphone size={18} /> Quản lý quảng cáo
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
