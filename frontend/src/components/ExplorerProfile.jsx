import { BadgeCheck, Camera, MapPin, Sparkles } from 'lucide-react';

export default function ExplorerProfile({ user, stats }) {
  const initials = (user?.name || '?').split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase();
  const trustLabel = user?.trustScore >= 80 ? 'Trusted Explorer' : user?.trustScore >= 40 ? 'Explorer' : 'New Explorer';

  return (
    <section className="explorer-card">
      <div className="explorer-cover">
        <div className="explorer-avatar">{initials}</div>
        <span className="trusted-badge"><BadgeCheck size={16} /> {trustLabel}</span>
      </div>

      <div className="explorer-body">
        <div>
          <span className="eyebrow">HOLA EXPLORER</span>
          <h1>{user?.name}</h1>
          <p>{user?.bio || 'Chưa có giới thiệu. Hãy cập nhật thông tin cá nhân của bạn.'}</p>
        </div>

        <div className="explorer-score">
          <Sparkles size={20} />
          <strong>{(user?.points ?? 0).toLocaleString('vi-VN')}</strong>
          <span>điểm</span>
        </div>
      </div>

      <div className="explorer-stats">
        <div><MapPin size={18} /><b>{stats?.placesContributed ?? 0}</b><span>Địa điểm</span></div>
        <div><Camera size={18} /><b>{stats?.photosContributed ?? 0}</b><span>Ảnh thực tế</span></div>
        <div><BadgeCheck size={18} /><b>{stats?.approvalRate != null ? `${Math.round(stats.approvalRate * 100)}%` : '—'}</b><span>Duyệt chính xác</span></div>
      </div>
    </section>
  );
}
