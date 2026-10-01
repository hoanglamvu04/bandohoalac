import {
  BadgeCheck,
  Camera,
  ChevronRight,
  Crown,
  LogOut,
  MapPin,
  Sparkles,
  Star
} from 'lucide-react';

export default function ExplorerProfile({
  user,
  stats,
  onLogout,
  onOpenStat
}) {
  const initials = (user?.name || '?')
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const levelLabel = user?.explorerLevel?.name
    || (user?.trustScore >= 80
      ? 'Trusted Explorer'
      : user?.trustScore >= 40
        ? 'Explorer'
        : 'New Explorer');

  return (
    <section className="explorer-card explorer-card-light">
      <div className="explorer-profile-top">
        <div className="explorer-identity">
          <div className="explorer-avatar">
            {initials}
            <span className="explorer-avatar-crown" aria-hidden="true">
              <Crown size={14} />
            </span>
          </div>

          <div className="explorer-identity-copy">
            <span className="trusted-badge">
              <Crown size={14} />
              {levelLabel}
            </span>
            <h1>{user?.name}</h1>
            <p>
              {user?.bio || 'Chưa có giới thiệu. Hãy cập nhật thông tin cá nhân của bạn.'}
            </p>
          </div>
        </div>

        <div className="explorer-score explorer-score-light">
          <span className="explorer-score-orb">
            <Sparkles size={28} />
          </span>
          <div>
            <strong>{(user?.points ?? 0).toLocaleString('vi-VN')}</strong>
            <span>điểm</span>
          </div>
          <ChevronRight size={18} />
        </div>

        {onLogout && (
          <button
            type="button"
            className="explorer-mobile-logout"
            onClick={onLogout}
            aria-label="Đăng xuất"
            title="Đăng xuất"
          >
            <LogOut size={14} />
            <span>Đăng xuất</span>
          </button>
        )}
      </div>

      <div className="explorer-stats explorer-stats-light">
        <button type="button" onClick={() => onOpenStat?.('places')}>
          <span className="explorer-stat-icon place"><MapPin size={22} /></span>
          <span className="explorer-stat-copy">
            <b>{stats?.placesContributed ?? 0}</b>
            <span>Địa điểm</span>
          </span>
          <ChevronRight size={18} />
        </button>

        <button type="button" onClick={() => onOpenStat?.('photos')}>
          <span className="explorer-stat-icon photo"><Camera size={22} /></span>
          <span className="explorer-stat-copy">
            <b>{stats?.photosContributed ?? 0}</b>
            <span>Ảnh thực tế</span>
          </span>
          <ChevronRight size={18} />
        </button>

        <div>
          <span className="explorer-stat-icon verify"><BadgeCheck size={22} /></span>
          <span className="explorer-stat-copy">
            <b>
              {stats?.approvalRate != null
                ? Math.round(stats.approvalRate * 100) + '%'
                : '—'}
            </b>
            <span>Duyệt chính xác</span>
          </span>
          <Star className="explorer-stat-muted" size={16} />
        </div>
      </div>
    </section>
  );
}
