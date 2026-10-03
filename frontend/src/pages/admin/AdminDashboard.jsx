import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BadgePercent,
  ClipboardList,
  Code2,
  Database,
  Flag,
  LayoutDashboard,
  MapPinned,
  Megaphone,
  Palette,
  PencilRuler,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAdminContributions } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const moderatorModules = [
  {
    to: '/admin/contributions',
    title: 'Duyệt đóng góp',
    description: 'Kiểm tra địa điểm, ảnh và chỉnh sửa từ cộng đồng.',
    icon: ClipboardList,
    tone: 'gold',
    key: 'contributions'
  },
  {
    to: '/admin/places',
    title: 'Quản lý địa điểm',
    description: 'Thêm, sửa, ẩn, quản lý ảnh và trạng thái địa điểm.',
    icon: MapPinned,
    tone: 'blue'
  },
  {
    to: '/admin/place-imports',
    title: 'Nhập dữ liệu bản đồ',
    description: 'Duyệt địa điểm quét từ Overture, chống trùng và nhập hàng loạt.',
    icon: Database,
    tone: 'cyan'
  },
  {
    to: '/admin/map-editor',
    title: 'Biên tập lớp bản đồ',
    description: 'Quản lý dữ liệu đường, vùng, công trình và lớp hiển thị.',
    icon: PencilRuler,
    tone: 'green'
  }
];

const adminModules = [
  {
    to: '/admin/users',
    title: 'Người dùng',
    description: 'Quản lý tài khoản, vai trò và điểm Explorer.',
    icon: UserCog,
    tone: 'violet'
  },
  {
    to: '/admin/partners',
    title: 'Đối tác & Voucher',
    description: 'Quản lý địa điểm đối tác và chương trình đổi thưởng.',
    icon: BadgePercent,
    tone: 'orange'
  },
  {
    to: '/admin/missions',
    title: 'Nhiệm vụ Explorer',
    description: 'Tạo chiến dịch và nhiệm vụ cộng đồng theo từng giai đoạn.',
    icon: Flag,
    tone: 'purple'
  },
  {
    to: '/admin/ads',
    title: 'Nội dung tài trợ',
    description: 'Quản lý banner, liên kết và lịch hiển thị nội dung.',
    icon: Megaphone,
    tone: 'rose'
  },
  {
    to: '/admin/brand',
    title: 'Thương hiệu',
    description: 'Đổi logo, favicon và kích thước nhận diện toàn website.',
    icon: Palette,
    tone: 'cyan'
  },
  {
    to: '/admin/audit',
    title: 'Nhật ký hệ thống',
    description: 'Theo dõi các thao tác quản trị quan trọng trên hệ thống.',
    icon: Activity,
    tone: 'slate'
  },
  {
    to: '/admin/developer-api',
    title: 'API & Tích hợp',
    description: 'Quản lý Public API, website kết nối, API key, endpoint và tài liệu.',
    icon: Code2,
    tone: 'green'
  }
];

function ModuleCard({ item, pendingCount }) {
  const Icon = item.icon;
  const hasPending = item.key === 'contributions' && Number(pendingCount) > 0;

  return (
    <Link className={'admin-control-module tone-' + item.tone} to={item.to}>
      <span className="admin-control-module-icon">
        <Icon size={21} />
      </span>

      <span className="admin-control-module-copy">
        <span className="admin-control-module-title">
          <b>{item.title}</b>
          {hasPending && <em>{pendingCount} chờ duyệt</em>}
        </span>
        <small>{item.description}</small>
      </span>

      <span className="admin-control-module-arrow">
        <ArrowRight size={17} />
      </span>
    </Link>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminContributions({ status: 'PENDING' })
      .then((data) => setPendingCount(Array.isArray(data?.items) ? data.items.length : 0))
      .catch(() => setPendingCount(null))
      .finally(() => setLoading(false));
  }, []);

  const firstName = useMemo(() => {
    const value = String(user?.name || 'Admin').trim();
    return value.split(/\s+/)[0] || 'Admin';
  }, [user?.name]);

  const modules = user?.role === 'ADMIN'
    ? [...moderatorModules, ...adminModules]
    : moderatorModules;

  return (
    <main className="admin-page admin-control-center page-container">
      <section className="admin-control-hero">
        <div className="admin-control-hero-copy">
          <span className="admin-control-kicker">
            <Sparkles size={14} />
            HOLA MAPS CONTROL CENTER
          </span>

          <h1>Xin chào, {firstName}.</h1>
          <p>
            Quản lý dữ liệu bản đồ, cộng đồng và các cấu hình vận hành của Hola Maps
            trong một không gian thống nhất.
          </p>

          <div className="admin-control-hero-meta">
            <span><ShieldCheck size={15} /> {user?.role || 'MODERATOR'}</span>
            <span><Database size={15} /> Dữ liệu cộng đồng</span>
          </div>
        </div>

        <div className="admin-control-focus-card">
          <span className="admin-control-focus-icon">
            <ClipboardList size={23} />
          </span>
          <div>
            <small>VIỆC CẦN XỬ LÝ</small>
            <strong>{loading ? '…' : pendingCount ?? '—'}</strong>
            <span>đóng góp đang chờ duyệt</span>
          </div>
          <Link to="/admin/contributions" aria-label="Mở danh sách chờ duyệt">
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <section className="admin-control-overview">
        <article>
          <span className="admin-overview-icon gold"><ClipboardList size={19} /></span>
          <div>
            <small>Hàng đợi kiểm duyệt</small>
            <b>{loading ? '...' : pendingCount ?? '—'}</b>
          </div>
          <em>{Number(pendingCount) > 0 ? 'Cần xử lý' : 'Đã sạch'}</em>
        </article>

        <article>
          <span className="admin-overview-icon blue"><ShieldCheck size={19} /></span>
          <div>
            <small>Quyền truy cập</small>
            <b>{user?.role || '—'}</b>
          </div>
          <em>Đang hoạt động</em>
        </article>

        <article>
          <span className="admin-overview-icon green"><Users size={19} /></span>
          <div>
            <small>Nguồn dữ liệu</small>
            <b>Community</b>
          </div>
          <em>CTV & User</em>
        </article>
      </section>

      <section className="admin-control-workspace">
        <div className="admin-control-section-head">
          <div>
            <span className="eyebrow">QUẢN TRỊ HỆ THỐNG</span>
            <h2>Công cụ quản lý</h2>
            <p>Chọn một khu vực để bắt đầu quản trị.</p>
          </div>
          <span className="admin-control-module-count">
            <LayoutDashboard size={15} />
            {modules.length} module
          </span>
        </div>

        <div className="admin-control-module-grid">
          {modules.map((item) => (
            <ModuleCard
              item={item}
              pendingCount={pendingCount}
              key={item.to}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
