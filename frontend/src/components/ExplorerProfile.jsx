import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  ChevronRight,
  Coins,
  Crown,
  Gauge,
  History,
  LogOut,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star
} from 'lucide-react';
import { getMyReputationSummary } from '../services/reputationApi.js';

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

function historyLabel(item) {
  if (item?.type === 'CONTRIBUTION_APPROVED') return 'Đóng góp được duyệt';
  if (item?.type === 'CONTRIBUTION_REJECTED') return 'Đóng góp chưa được duyệt';
  if (item?.type === 'ADMIN_REPUTATION_CONTROL') return 'Admin điều chỉnh Reputation';
  if (item?.type === 'ADMIN_REPUTATION_CONTROL_CLEARED') return 'Admin gỡ điều chỉnh Reputation';
  return 'Uy tín được cập nhật';
}

function permissionSummary(permissions) {
  if (!permissions) return 'Hàng chờ kiểm duyệt tiêu chuẩn';
  if (permissions.expeditedReview) {
    return permissions.sensitiveCorrections
      ? 'Ưu tiên duyệt cao · mở đề xuất chỉnh sửa nâng cao'
      : 'Ưu tiên duyệt cao';
  }
  if (permissions.advancedSuggestions) return 'Ưu tiên duyệt · mở đề xuất nâng cao';
  return `Hàng chờ ${String(permissions.priorityLabel || 'tiêu chuẩn').toLowerCase()}`;
}

function confidenceLabel(band) {
  if (band === 'HIGH') return 'Cao';
  if (band === 'MEDIUM') return 'Trung bình';
  return 'Đang xây dựng';
}

function freshnessLabel(state) {
  const labels = {
    BUILDING: 'Đang xây dựng dữ liệu',
    ACTIVE: 'Hoạt động gần đây',
    COOLING: 'Ít hoạt động',
    STALE: 'Hoạt động đã cũ',
    DORMANT: 'Lâu chưa hoạt động'
  };
  return labels[state] || 'Đang theo dõi';
}

export default function ExplorerProfile({
  user,
  stats,
  onLogout,
  onOpenStat
}) {
  const [privateReputation, setPrivateReputation] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getMyReputationSummary()
      .then((data) => {
        if (!cancelled) setPrivateReputation(data?.reputation || null);
      })
      .catch(() => {
        if (!cancelled) setPrivateReputation(null);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  const initials = (user?.name || '?')
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const reputation = privateReputation || user?.reputation || user?.explorerLevel || null;
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
  const permissions = reputation?.permissions || null;
  const history = Array.isArray(reputation?.history) ? reputation.history.slice(0, 3) : [];
  const confidence = reputation?.confidence || null;
  const freshness = reputation?.freshness || null;
  const stability = reputation?.stability || null;

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
            <b>Reputation v2.2</b>
          </span>
          <em>
            {nextLevel ? `Tiến tới ${nextLevel.name}` : 'Bạn đã đạt cấp cao nhất'}
          </em>
        </div>

        <div className="explorer-reputation-v22-meta">
          <span className={'confidence ' + String(confidence?.band || 'LOW').toLowerCase()}>
            <Gauge size={13} /> Confidence {Number(confidence?.score || 0)}/100 · {confidenceLabel(confidence?.band)}
          </span>
          <span className={'freshness ' + String(freshness?.state || 'BUILDING').toLowerCase()}>
            {freshnessLabel(freshness?.state)}
            {Number(freshness?.penalty || 0) > 0 ? ` · -${freshness.penalty} điểm` : ''}
          </span>
          {stability?.atRisk && (
            <span className="risk"><AlertTriangle size={12} /> Cấp hiện tại cần được duy trì</span>
          )}
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

        <div className="explorer-reputation-permission">
          <Sparkles size={14} />
          <span>{permissionSummary(permissions)}</span>
          <em>{permissions?.confidenceGated ? 'Quyền đang giới hạn theo confidence' : 'Không cấp quyền tự duyệt'}</em>
        </div>

        {history.length > 0 && (
          <div className="explorer-reputation-history">
            <div className="explorer-reputation-history-title">
              <History size={14} />
              <b>Lịch sử uy tín gần đây</b>
            </div>
            <div className="explorer-reputation-history-list">
              {history.map((item) => (
                <div key={item.id}>
                  <span>
                    <b>{historyLabel(item)}</b>
                    <small>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</small>
                  </span>
                  <em className={Number(item.delta) >= 0 ? 'positive' : 'negative'}>
                    {Number(item.delta) > 0 ? '+' : ''}{Number(item.delta)}
                  </em>
                </div>
              ))}
            </div>
          </div>
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
            <span>Tỷ lệ được duyệt</span>
          </span>
          <Star className="explorer-stat-muted" size={16} />
        </div>
      </div>
    </section>
  );
}
