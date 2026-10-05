import {
  BadgeCheck,
  Camera,
  ChevronRight,
  Coins,
  Crown,
  LogOut,
  MapPin,
  ShieldCheck,
  Star
} from 'lucide-react';

function formatRequirement(item) {
  if (!item) return '';
  if (item.key === 'approvalRate') {
    return `${item.current}% / ${item.target}% được duyệt`;
  }
  if (item.key === 'accountAgeDays') {
    return `${item.current}/${item.target} ngày hoạt động`;
  }
  if (item.key === 'score') {
    return `${item.current}/${item.target} uy tín`;
  }
  if (item.key === 'approvedCount') {
    return `${item.current}/${item.target} đóng góp được duyệt`;
  }
  if (item.key === 'qualityPoints') {
    return `${item.current}/${item.target} điểm chất lượng`;
  }
  if (item.key === 'trustScore') {
    return `${item.current}/${item.target} trust`;
  }
  return `${item.current}/${item.target} ${item.label}`;
}

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

  const reputation = user?.reputation || user?.explorerLevel || null;
  const rawLevelLabel = reputation?.name;
  const localizedLevelLabels = {
    'Trusted Explorer': 'Người đóng góp tin cậy',
    Explorer: 'Người khám phá',
    'New Explorer': 'Thành viên mới',
    'Local Explorer': 'Người đóng góp',
    'Hòa Lạc Expert': 'Chuyên gia địa phương',
    'Hòa Lạc Insider': 'Chuyên gia địa phương'
  };
  const levelLabel = localizedLevelLabels[rawLevelLabel]
    || rawLevelLabel
    || 'Thành viên mới';
  const reputationScore = Number(reputation?.score || 0);
  const reputationProgress = Math.min(Math.max(Number(reputation?.progress || 0), 0), 1);
  const nextLevel = reputation?.nextLevel || null;
  const blockers = Array.isArray(reputation?.blockers)
    ? reputation.blockers.slice(0, 3)
    : [];

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

        <div className="explorer-score explorer-score-light reputation-v2-score">
          <span className="explorer-score-orb reputation-orb">
            <ShieldCheck size={29} />
          </span>
          <div className="reputation-score-copy">
            <span className="reputation-score-main">
              <strong>{reputationScore}</strong>
              <span>/100 uy tín</span>
            </span>
            <span className="reputation-reward-points">
              <Coins size={13} /> {(user?.points ?? 0).toLocaleString('vi-VN')} điểm thưởng
            </span>
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

      <div className="explorer-reputation-strip">
        <div className="explorer-reputation-heading">
          <span>
            <ShieldCheck size={15} />
            <b>Reputation v2</b>
          </span>
          <em>
            {nextLevel ? `Tiến tới ${nextLevel.name}` : 'Bạn đã đạt cấp cao nhất'}
          </em>
        </div>
        <div className="explorer-reputation-track" aria-label="Tiến độ cấp thành viên">
          <span style={{ width: `${Math.round(reputationProgress * 100)}%` }} />
        </div>
        <div className="explorer-reputation-foot">
          <span>{Math.round(reputationProgress * 100)}% tiến độ</span>
          {blockers.length > 0 ? (
            <div className="explorer-reputation-blockers">
              {blockers.map((item) => (
                <span key={item.key}>{formatRequirement(item)}</span>
              ))}
            </div>
          ) : (
            <span className="explorer-reputation-ready">Đã đủ mọi điều kiện cấp hiện tại</span>
          )}
        </div>
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
            <span>Tỷ lệ được duyệt</span>
          </span>
          <Star className="explorer-stat-muted" size={16} />
        </div>
      </div>
    </section>
  );
}
