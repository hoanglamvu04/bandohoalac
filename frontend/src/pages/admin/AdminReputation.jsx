import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  History,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Zap
} from 'lucide-react';
import { getAdminUser, getAdminUsers } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

function formatPercent(value) {
  if (value == null) return '—';
  return Math.round(Number(value) * 100) + '%';
}

function eventLabel(item) {
  if (item?.type === 'CONTRIBUTION_APPROVED') return 'Đóng góp được duyệt';
  if (item?.type === 'CONTRIBUTION_REJECTED') return 'Đóng góp bị từ chối';
  return 'Cập nhật uy tín';
}

function flagLabel(flag) {
  const labels = {
    HIGH_VOLUME_24H: 'Tần suất đóng góp cao trong 24h',
    REPEATED_FINGERPRINTS: 'Có cụm nội dung gửi lặp',
    HIGH_REJECTION_RATE: 'Tỷ lệ bị từ chối 30 ngày cao'
  };
  return labels[flag] || flag;
}

export default function AdminReputation() {
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getAdminUsers({ limit: 100 })
      .then((data) => {
        const items = Array.isArray(data?.items) ? data.items : [];
        setUsers(items);
        if (!selectedId && items[0]) setSelectedId(items[0].id);
      })
      .catch((error) => showToast(error.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setDetailLoading(true);
    getAdminUser(selectedId)
      .then(setDetail)
      .catch((error) => showToast(error.message, 'error'))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((item) =>
      String(item.name || '').toLowerCase().includes(keyword)
      || String(item.email || '').toLowerCase().includes(keyword)
    );
  }, [users, query]);

  const inspector = detail?.reputationInspector || null;
  const reputation = inspector?.reputation || null;
  const signals = inspector?.signals || null;
  const history = Array.isArray(inspector?.history) ? inspector.history : [];
  const permissions = reputation?.permissions || {};
  const components = reputation?.components || {};

  return (
    <main className="admin-page reputation-inspector-page page-container">
      <section className="section-heading reputation-inspector-heading">
        <div>
          <span className="eyebrow">REPUTATION V2.1</span>
          <h2>Reputation Inspector</h2>
          <p>Giải thích điểm uy tín, quyền theo cấp, tín hiệu bất thường và lịch sử tăng giảm của từng tài khoản.</p>
        </div>
        <div className="reputation-policy-note">
          <ShieldCheck size={18} />
          <span><b>Không tự duyệt</b><small>Uy tín chỉ tăng ưu tiên kiểm duyệt.</small></span>
        </div>
      </section>

      <section className="reputation-inspector-layout">
        <aside className="reputation-user-browser">
          <label className="reputation-user-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên hoặc email..." />
          </label>

          {loading ? (
            <div className="loading-card">Đang tải người dùng...</div>
          ) : (
            <div className="reputation-user-list">
              {filtered.map((item) => (
                <button
                  type="button"
                  className={String(selectedId) === String(item.id) ? 'active' : ''}
                  onClick={() => setSelectedId(item.id)}
                  key={item.id}
                >
                  <span className="reputation-user-avatar">{item.name?.slice(0, 1)?.toUpperCase() || '?'}</span>
                  <span><b>{item.name}</b><small>{item.email}</small></span>
                  <em>{item.approvedCount}/{item.rejectedCount}</em>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="reputation-inspector-detail">
          {!selectedId ? (
            <div className="empty-state"><UserRound size={28} /><b>Chọn một tài khoản để kiểm tra</b></div>
          ) : detailLoading || !detail ? (
            <div className="loading-card">Đang phân tích Reputation...</div>
          ) : !inspector ? (
            <div className="empty-state"><AlertTriangle size={28} /><b>Không đọc được Reputation của tài khoản này</b></div>
          ) : (
            <>
              <div className="reputation-inspector-hero">
                <div>
                  <small>USER #{detail.id}</small>
                  <h3>{detail.name}</h3>
                  <span>{reputation.name}</span>
                </div>
                <div className="reputation-inspector-score">
                  <strong>{reputation.score}</strong><span>/100</span><small>uy tín</small>
                </div>
              </div>

              <div className="reputation-component-grid">
                <article><span>Chất lượng</span><b>{components.quality ?? 0}/35</b></article>
                <article><span>Tỷ lệ duyệt</span><b>{components.approval ?? 0}/25</b></article>
                <article><span>Trust</span><b>{components.trust ?? 0}/20</b></article>
                <article><span>Hữu ích</span><b>{components.helpfulness ?? 0}/15</b></article>
                <article><span>Thời gian</span><b>{components.tenure ?? 0}/5</b></article>
              </div>

              <div className="reputation-inspector-grid">
                <article className="reputation-inspector-card">
                  <div className="reputation-card-title"><Zap size={17} /><div><b>Quyền theo Reputation</b><small>Quyền mềm, không thay role hệ thống</small></div></div>
                  <div className="reputation-permission-list">
                    <span className="enabled"><CheckCircle2 size={14} /> Ưu tiên: {permissions.priorityLabel || 'Tiêu chuẩn'}</span>
                    <span className={permissions.advancedSuggestions ? 'enabled' : 'disabled'}>
                      {permissions.advancedSuggestions ? <CheckCircle2 size={14} /> : <span>×</span>} Đề xuất nâng cao
                    </span>
                    <span className={permissions.sensitiveCorrections ? 'enabled' : 'disabled'}>
                      {permissions.sensitiveCorrections ? <CheckCircle2 size={14} /> : <span>×</span>} Chỉnh sửa nhạy cảm
                    </span>
                    <span className={permissions.expeditedReview ? 'enabled' : 'disabled'}>
                      {permissions.expeditedReview ? <CheckCircle2 size={14} /> : <span>×</span>} Hàng chờ ưu tiên cao
                    </span>
                    <span className="disabled">× Tự duyệt: luôn tắt</span>
                  </div>
                </article>

                <article className="reputation-inspector-card">
                  <div className="reputation-card-title"><Gauge size={17} /><div><b>Tín hiệu kiểm soát</b><small>Chống farm và hành vi bất thường</small></div></div>
                  <div className="reputation-signal-grid">
                    <span><small>24 giờ</small><b>{signals?.submissions24h ?? 0}</b><em>đóng góp</em></span>
                    <span><small>7 ngày</small><b>{signals?.submissions7d ?? 0}</b><em>đóng góp</em></span>
                    <span><small>Từ chối 30d</small><b>{formatPercent(signals?.rejectionRate30d)}</b><em>{signals?.reviewed30d ?? 0} đã duyệt</em></span>
                    <span><small>Cụm lặp 7d</small><b>{signals?.duplicateClusters7d ?? 0}</b><em>fingerprint</em></span>
                  </div>
                  <div className={'reputation-risk-band ' + String(signals?.riskBand || 'LOW').toLowerCase()}>
                    <Activity size={14} /> Risk band: {signals?.riskBand || 'LOW'}
                  </div>
                  {Array.isArray(signals?.flags) && signals.flags.length > 0 && (
                    <div className="reputation-signal-flags">
                      {signals.flags.map((flag) => <span key={flag}><AlertTriangle size={13} /> {flagLabel(flag)}</span>)}
                    </div>
                  )}
                </article>
              </div>

              <article className="reputation-inspector-card reputation-history-card">
                <div className="reputation-card-title"><History size={17} /><div><b>Lịch sử Reputation</b><small>Score trước/sau và nguyên nhân thay đổi</small></div></div>
                {!history.length ? (
                  <div className="reputation-history-empty"><Sparkles size={18} /> Lịch sử sẽ bắt đầu ghi từ Reputation v2.1.</div>
                ) : (
                  <div className="reputation-admin-history">
                    {history.map((item) => (
                      <div key={item.id}>
                        <span className="reputation-history-event-icon"><ShieldCheck size={14} /></span>
                        <span className="reputation-history-copy">
                          <b>{eventLabel(item)}</b>
                          <small>{new Date(item.createdAt).toLocaleString('vi-VN')}</small>
                        </span>
                        <span className="reputation-history-score">{item.scoreBefore} → {item.scoreAfter}</span>
                        <em className={Number(item.delta) >= 0 ? 'positive' : 'negative'}>
                          {Number(item.delta) > 0 ? '+' : ''}{item.delta}
                        </em>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
