import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Gauge,
  History,
  MapPinned,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Zap
} from 'lucide-react';
import { getAdminUser, getAdminUsers } from '../../services/api.js';
import { updateAdminReputationControl } from '../../services/reputationApi.js';
import { useToast } from '../../context/ToastContext.jsx';

const EMPTY_CONTROL = {
  scoreAdjustment: '0',
  permissionCeiling: '',
  expiresAt: '',
  reason: ''
};

function formatPercent(value) {
  if (value == null) return '—';
  return Math.round(Number(value) * 100) + '%';
}

function eventLabel(item) {
  if (item?.type === 'CONTRIBUTION_APPROVED') return 'Đóng góp được duyệt';
  if (item?.type === 'CONTRIBUTION_REJECTED') return 'Đóng góp bị từ chối';
  if (item?.type === 'ADMIN_REPUTATION_CONTROL') return 'Admin cập nhật Reputation control';
  if (item?.type === 'ADMIN_REPUTATION_CONTROL_CLEARED') return 'Admin gỡ Reputation control';
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

function stabilityLabel(reason) {
  const labels = {
    INACTIVITY_DECAY: 'Giảm nhẹ do lâu không hoạt động',
    LOW_CONFIDENCE_FOR_PRIVILEGES: 'Confidence chưa đủ để giữ toàn bộ quyền',
    NEAR_LEVEL_FLOOR: 'Điểm đang sát ngưỡng tối thiểu của cấp',
    ADMIN_ADJUSTMENT: 'Đang có điều chỉnh giảm từ Admin'
  };
  return labels[reason] || reason;
}

function confidenceLabel(band) {
  if (band === 'HIGH') return 'Cao';
  if (band === 'MEDIUM') return 'Trung bình';
  return 'Thấp';
}

function freshnessLabel(state) {
  const labels = {
    BUILDING: 'Đang xây dựng',
    ACTIVE: 'Đang hoạt động',
    COOLING: 'Ít hoạt động',
    STALE: 'Dữ liệu hoạt động cũ',
    DORMANT: 'Lâu chưa hoạt động'
  };
  return labels[state] || state || '—';
}

function expertiseTierLabel(tier) {
  if (tier === 'EXPERT') return 'Chuyên gia';
  if (tier === 'SPECIALIST') return 'Chuyên môn';
  return 'Đang xây dựng';
}

function toControlForm(control) {
  if (!control) return EMPTY_CONTROL;
  return {
    scoreAdjustment: String(control.scoreAdjustment ?? 0),
    permissionCeiling: control.permissionCeiling || '',
    expiresAt: control.expiresAt
      ? new Date(control.expiresAt).toISOString().slice(0, 16)
      : '',
    reason: control.reason || ''
  };
}

export default function AdminReputation() {
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [controlForm, setControlForm] = useState(EMPTY_CONTROL);
  const [controlSaving, setControlSaving] = useState(false);

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
      .then((data) => {
        setDetail(data);
        setControlForm(toControlForm(data?.reputationInspector?.control));
      })
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
  const control = inspector?.control || null;
  const expertise = inspector?.expertise || null;
  const permissions = reputation?.permissions || {};
  const components = reputation?.components || {};
  const confidence = reputation?.confidence || {};
  const freshness = reputation?.freshness || {};
  const stability = reputation?.stability || {};
  const expertiseBadges = Array.isArray(expertise?.badges) ? expertise.badges.slice(0, 8) : [];
  const topExpertise = [
    ...(Array.isArray(expertise?.areas) ? expertise.areas.slice(0, 3) : []),
    ...(Array.isArray(expertise?.domains) ? expertise.domains.slice(0, 3) : [])
  ];

  async function saveControl(event) {
    event.preventDefault();
    if (!selectedId) return;
    if (controlForm.reason.trim().length < 5) {
      showToast('Nhập lý do điều chỉnh Reputation tối thiểu 5 ký tự.', 'error');
      return;
    }

    setControlSaving(true);
    try {
      const updated = await updateAdminReputationControl(selectedId, {
        scoreAdjustment: Number(controlForm.scoreAdjustment || 0),
        permissionCeiling: controlForm.permissionCeiling || null,
        expiresAt: controlForm.expiresAt
          ? new Date(controlForm.expiresAt).toISOString()
          : null,
        reason: controlForm.reason.trim()
      });
      setDetail(updated);
      setControlForm(toControlForm(updated?.reputationInspector?.control));
      showToast('Đã cập nhật Reputation control.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setControlSaving(false);
    }
  }

  async function clearControl() {
    if (!selectedId || controlSaving) return;
    if (controlForm.reason.trim().length < 5) {
      showToast('Nhập lý do trước khi gỡ Reputation control.', 'error');
      return;
    }

    setControlSaving(true);
    try {
      const updated = await updateAdminReputationControl(selectedId, {
        clear: true,
        reason: controlForm.reason.trim()
      });
      setDetail(updated);
      setControlForm(EMPTY_CONTROL);
      showToast('Đã gỡ Reputation control.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setControlSaving(false);
    }
  }

  return (
    <main className="admin-page reputation-inspector-page page-container">
      <section className="section-heading reputation-inspector-heading">
        <div>
          <span className="eyebrow">REPUTATION V2.3</span>
          <h2>Reputation Inspector</h2>
          <p>Score + Confidence + Freshness + Expertise theo khu vực/lĩnh vực, anti-farm và kiểm soát thủ công có audit.</p>
        </div>
        <div className="reputation-policy-note">
          <ShieldCheck size={18} />
          <span><b>Không tự duyệt</b><small>Expertise chỉ tăng ưu tiên đúng lĩnh vực khi Reputation và Confidence đủ mạnh.</small></span>
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
                  <span>{reputation.name} · base {reputation.baseScore}/100</span>
                </div>
                <div className="reputation-inspector-score">
                  <strong>{reputation.score}</strong><span>/100</span><small>uy tín hiệu lực</small>
                </div>
              </div>

              <div className="reputation-v22-status-grid">
                <article className={'confidence ' + String(confidence.band || 'LOW').toLowerCase()}>
                  <Gauge size={17} />
                  <span><small>CONFIDENCE</small><b>{confidence.score ?? 0}/100 · {confidenceLabel(confidence.band)}</b></span>
                </article>
                <article className={'freshness ' + String(freshness.state || 'BUILDING').toLowerCase()}>
                  <Clock size={17} />
                  <span><small>FRESHNESS</small><b>{freshnessLabel(freshness.state)}</b></span>
                  <em>{Number(freshness.penalty || 0) > 0 ? `-${freshness.penalty} điểm` : 'Không decay'}</em>
                </article>
                <article className={stability.atRisk ? 'stability at-risk' : 'stability'}>
                  {stability.atRisk ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
                  <span><small>STABILITY</small><b>{stability.atRisk ? 'Cần duy trì' : 'Ổn định'}</b></span>
                  <em>buffer {stability.bufferToFloor ?? 0}</em>
                </article>
              </div>

              {Array.isArray(stability.reasons) && stability.reasons.length > 0 && (
                <div className="reputation-stability-reasons">
                  {stability.reasons.map((reason) => <span key={reason}>{stabilityLabel(reason)}</span>)}
                </div>
              )}

              {expertise && (
                <article className="reputation-inspector-card reputation-expertise-admin">
                  <div className="reputation-card-title">
                    <Award size={17} />
                    <div><b>Expertise v2.3</b><small>Chuyên môn được suy ra từ đóng góp đã review, không phải tự khai</small></div>
                    <em>{Number(expertise.expertCount || 0)} expert · {Number(expertise.specialistCount || 0)} specialist</em>
                  </div>
                  {topExpertise.length > 0 ? (
                    <div className="reputation-expertise-admin-grid">
                      {topExpertise.map((item) => (
                        <div key={`${item.dimension}:${item.expertiseKey}`}>
                          {item.dimension === 'AREA' ? <MapPinned size={14} /> : <Sparkles size={14} />}
                          <span><small>{item.dimension === 'AREA' ? 'KHU VỰC' : 'LĨNH VỰC'}</small><b>{item.label}</b></span>
                          <em>{item.score}/100 · {expertiseTierLabel(item.tier)}</em>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="reputation-history-empty">Chưa đủ dữ liệu review để xây dựng chuyên môn.</div>
                  )}
                  {expertiseBadges.length > 0 && (
                    <div className="reputation-expertise-admin-badges">
                      {expertiseBadges.map((badge) => (
                        <span className={badge.tier === 'EXPERT' ? 'expert' : 'specialist'} key={badge.code}>
                          <Award size={12} /> {badge.title}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              )}

              <div className="reputation-component-grid">
                <article><span>Chất lượng</span><b>{components.quality ?? 0}/35</b></article>
                <article><span>Tỷ lệ duyệt</span><b>{components.approval ?? 0}/25</b></article>
                <article><span>Trust</span><b>{components.trust ?? 0}/20</b></article>
                <article><span>Hữu ích</span><b>{components.helpfulness ?? 0}/15</b></article>
                <article><span>Thời gian</span><b>{components.tenure ?? 0}/5</b></article>
              </div>

              <div className="reputation-inspector-grid">
                <article className="reputation-inspector-card">
                  <div className="reputation-card-title"><Zap size={17} /><div><b>Quyền theo Reputation</b><small>Score xác định cấp, Confidence xác định độ mở quyền</small></div></div>
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
                  {(permissions.confidenceGated || permissions.ceilingApplied) && (
                    <div className="reputation-permission-gate">
                      {permissions.confidenceGated && <span>Confidence đang giới hạn một phần quyền.</span>}
                      {permissions.ceilingApplied && <span>Admin permission ceiling đang có hiệu lực.</span>}
                    </div>
                  )}
                </article>

                <article className="reputation-inspector-card">
                  <div className="reputation-card-title"><Gauge size={17} /><div><b>Tín hiệu kiểm soát</b><small>Chống farm và hành vi bất thường</small></div></div>
                  <div className="reputation-signal-grid">
                    <span><small>24 giờ</small><b>{signals?.submissions24h ?? 0}</b><em>đóng góp</em></span>
                    <span><small>7 ngày</small><b>{signals?.submissions7d ?? 0}</b><em>đóng góp</em></span>
                    <span><small>Từ chối 30d</small><b>{formatPercent(signals?.rejectionRate30d)}</b><em>{signals?.reviewed30d ?? 0} đã review</em></span>
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

              <article className="reputation-inspector-card reputation-control-card">
                <div className="reputation-card-title">
                  <ShieldCheck size={17} />
                  <div><b>Admin Reputation Control</b><small>Chỉ điều chỉnh có giới hạn, luôn ghi event + audit log</small></div>
                  {control && <em>Đang có hiệu lực</em>}
                </div>

                <form className="reputation-control-form" onSubmit={saveControl}>
                  <label>
                    Điều chỉnh score (-15 → +15)
                    <input
                      type="number"
                      min="-15"
                      max="15"
                      value={controlForm.scoreAdjustment}
                      onChange={(event) => setControlForm((current) => ({ ...current, scoreAdjustment: event.target.value }))}
                    />
                  </label>
                  <label>
                    Trần quyền
                    <select
                      value={controlForm.permissionCeiling}
                      onChange={(event) => setControlForm((current) => ({ ...current, permissionCeiling: event.target.value }))}
                    >
                      <option value="">Không giới hạn</option>
                      <option value="NEW_MEMBER">Thành viên mới</option>
                      <option value="EXPLORER">Người khám phá</option>
                      <option value="CONTRIBUTOR">Người đóng góp</option>
                      <option value="TRUSTED_CONTRIBUTOR">Người đóng góp tin cậy</option>
                      <option value="LOCAL_EXPERT">Chuyên gia địa phương</option>
                    </select>
                  </label>
                  <label>
                    Hết hạn
                    <input
                      type="datetime-local"
                      value={controlForm.expiresAt}
                      onChange={(event) => setControlForm((current) => ({ ...current, expiresAt: event.target.value }))}
                    />
                  </label>
                  <label className="reason">
                    Lý do
                    <input
                      value={controlForm.reason}
                      onChange={(event) => setControlForm((current) => ({ ...current, reason: event.target.value }))}
                      placeholder="Ví dụ: giới hạn tạm thời trong quá trình kiểm tra dữ liệu..."
                    />
                  </label>
                  <div className="reputation-control-actions">
                    <button className="primary-action" type="submit" disabled={controlSaving}>
                      <Save size={15} /> {controlSaving ? 'Đang lưu...' : 'Lưu control'}
                    </button>
                    {control && (
                      <button type="button" className="secondary-action" disabled={controlSaving} onClick={clearControl}>
                        <RotateCcw size={15} /> Gỡ control
                      </button>
                    )}
                  </div>
                </form>
              </article>

              <article className="reputation-inspector-card reputation-history-card">
                <div className="reputation-card-title"><History size={17} /><div><b>Lịch sử Reputation</b><small>Score trước/sau, confidence và nguyên nhân thay đổi</small></div></div>
                {!history.length ? (
                  <div className="reputation-history-empty"><Sparkles size={18} /> Chưa có biến động Reputation được ghi nhận.</div>
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
