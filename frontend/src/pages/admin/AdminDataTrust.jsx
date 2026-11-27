import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CameraOff,
  CheckCircle2,
  Clock3,
  History,
  ImageOff,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  XCircle
} from 'lucide-react';
import { getAdminContributions, getAdminUsers } from '../../services/api.js';
import {
  auditCtvModeration,
  getDataQuality,
  getPlaceRevisions,
  rollbackPlaceRevision,
  verifyPlaceQuality
} from '../../services/dataTrustApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import '../../data-trust-admin.css';
import { filterQualityQueue, qualityQueueCsv } from '../../lib/qualityQueue.js';

const TRIAGE_LABELS = {
  CRITICAL: 'Ưu tiên khẩn',
  HIGH: 'Ưu tiên cao',
  MEDIUM: 'Cần rà soát',
  LOW: 'Bổ sung khi phù hợp'
};

const ISSUE_LABELS = {
  MISSING_ADDRESS: 'Thiếu địa chỉ',
  MISSING_DESCRIPTION: 'Thiếu mô tả',
  MISSING_CATEGORY: 'Thiếu danh mục',
  MISSING_HOURS: 'Thiếu giờ mở cửa',
  MISSING_CONTACT: 'Thiếu liên hệ',
  MISSING_IMAGES: 'Thiếu ảnh',
  STALE_IMAGES: 'Ảnh quá cũ',
  STALE_PLACE: 'Quá 180 ngày chưa xác minh',
  NEVER_VERIFIED: 'Chưa từng xác minh',
  INCOMPLETE_PROPERTY_PROFILE: 'Thiếu hồ sơ BĐS',
  MISSING_PROPERTY_PRICE: 'Thiếu giá nhà đất',
  MISSING_PROPERTY_AREA: 'Thiếu diện tích nhà đất',
  MISSING_COORDINATES: 'Thiếu tọa độ',
  OUT_OF_COVERAGE: 'Ngoài vùng phục vụ',
  POSSIBLE_DUPLICATE: 'Địa điểm có thể trùng',
  PROPERTY_NOT_ACTIVE: 'BĐS không còn hoạt động',
  PROPERTY_EXPIRED: 'BĐS đã hết hạn'
};

const REVISION_LABELS = {
  CREATE: 'Tạo địa điểm',
  UPDATE: 'Sửa thông tin',
  ARCHIVE: 'Ẩn địa điểm',
  VERIFY: 'Xác minh dữ liệu',
  IMAGE_ADD: 'Thêm ảnh',
  IMAGE_COVER: 'Đổi ảnh đại diện',
  IMAGE_DELETE: 'Xóa ảnh',
  CONTRIBUTION_APPLY: 'Áp dụng đóng góp',
  ROLLBACK: 'Rollback'
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN');
}

function riskClass(score) {
  if (Number(score) >= 70) return 'high';
  if (Number(score) >= 40) return 'medium';
  return 'low';
}

export default function AdminDataTrust() {
  const { user, ctvLevel } = useAuth();
  const { showToast } = useToast();
  const [quality, setQuality] = useState(null);
  const [pending, setPending] = useState([]);
  const [approvedCtv, setApprovedCtv] = useState([]);
  const [ctvs, setCtvs] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [queuePriority, setQueuePriority] = useState('ALL');
  const [queueQuery, setQueueQuery] = useState('');
  const [queueCategory, setQueueCategory] = useState('ALL');
  const [queueIds, setQueueIds] = useState([]);
  const [selected, setSelected] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const isAdmin = user?.role === 'ADMIN';
  const canVerify = ['ADMIN', 'MODERATOR'].includes(user?.role) || (user?.role === 'CTV' && ctvLevel >= 2);
  const canRollback = ['ADMIN', 'MODERATOR'].includes(user?.role);

  async function load() {
    setLoading(true);
    try {
      const jobs = [
        getDataQuality(200),
        getAdminContributions({ status: 'PENDING', limit: 100 })
      ];
      if (isAdmin) {
        jobs.push(getAdminContributions({ status: 'APPROVED', limit: 100 }));
        jobs.push(getAdminUsers({ role: 'CTV', limit: 100 }));
      }
      const [qualityData, pendingData, approvedData, ctvData] = await Promise.all(jobs);
      setQuality(qualityData);
      setPending(Array.isArray(pendingData?.items) ? pendingData.items : []);
      if (isAdmin) {
        setApprovedCtv((approvedData?.items || []).filter((item) => item.reviewerRole === 'CTV'));
        setCtvs(Array.isArray(ctvData?.items) ? ctvData.items : []);
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [isAdmin]);

  const qualityItems = useMemo(() => filterQualityQueue(quality?.items, {
    issue: filter, priority: queuePriority, query: queueQuery, category: queueCategory
  }), [quality, filter, queuePriority, queueQuery, queueCategory]);
  const queueCategories = useMemo(() => [...new Set((quality?.items || []).map(item => item.categorySlug).filter(Boolean))].sort(), [quality]);
  const selectedQueue = qualityItems.filter(item => queueIds.includes(String(item.id)));
  useEffect(() => { setQueueIds([]); }, [quality, filter, queuePriority, queueQuery, queueCategory]);
  function exportQueue() {
    const rows = selectedQueue.length ? selectedQueue : qualityItems;
    if (!rows.length) return;
    const url = URL.createObjectURL(new Blob([qualityQueueCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'hola-data-quality-queue.csv';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const risky = useMemo(
    () => pending.filter((item) => Number(item.riskScore || 0) >= 40).sort((a, b) => Number(b.riskScore) - Number(a.riskScore)),
    [pending]
  );

  async function openHistory(place) {
    setSelected(place);
    setBusy('history');
    try {
      const data = await getPlaceRevisions(place.id, 50);
      setRevisions(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function verify(place) {
    setBusy('verify-' + place.id);
    try {
      const result = await verifyPlaceQuality(place.id);
      showToast(
        result?.verificationSource === 'HOLA'
          ? 'HOLA đã xác minh dữ liệu địa điểm.'
          : 'Đã ghi nhận kiểm tra từ cộng đồng; mốc xác minh chính thức HOLA chưa thay đổi.',
        'success'
      );
      await load();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function rollback(revision) {
    if (!selected || !window.confirm('Hoàn tác thay đổi này và đưa địa điểm về trạng thái trước revision #' + revision.id + '?')) return;
    setBusy('rollback-' + revision.id);
    try {
      await rollbackPlaceRevision(selected.id, revision.id, 'Rollback từ Data Trust dashboard');
      showToast('Đã rollback địa điểm.', 'success');
      await openHistory(selected);
      await load();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function audit(item, verdict) {
    const label = verdict === 'CONFIRMED' ? 'xác nhận quyết định CTV' : 'đánh dấu quyết định CTV chưa chính xác';
    if (!window.confirm('Bạn muốn ' + label + '?')) return;
    setBusy('audit-' + item.id);
    try {
      await auditCtvModeration(item.id, verdict, 'Kiểm định từ Data Trust dashboard');
      showToast(verdict === 'CONFIRMED' ? 'Đã cộng tín nhiệm cho CTV.' : 'Đã trừ tín nhiệm CTV.', verdict === 'CONFIRMED' ? 'success' : 'info');
      await load();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy('');
    }
  }

  const summary = quality?.summary || {};

  return (
    <main className="admin-page page-container data-trust-page">
      <section className="data-trust-hero">
        <div>
          <span className="eyebrow">DATA TRUST V5 · PRIORITY TRIAGE</span>
          <h1>Chất lượng & độ tin cậy dữ liệu</h1>
          <p>Ưu tiên dữ liệu công khai có thể gây hiểu nhầm, rà soát tin bất động sản hết hạn, spam và chất lượng địa điểm. Điểm ưu tiên không tự ẩn hay từ chối nội dung.</p>
        </div>
        <div className="data-trust-health"><ShieldCheck size={22} /><span><b>{summary.averageScore ?? '—'}/100</b><small>điểm chất lượng TB</small></span></div>
      </section>

      {loading ? <div className="loading-card">Đang phân tích dữ liệu Hola Maps...</div> : (
        <>
          <section className="data-trust-stats">
            <article><Sparkles /><span><small>Địa điểm cần xử lý</small><b>{summary.needsAttention || 0}</b></span></article>
            <article><ImageOff /><span><small>Thiếu ảnh</small><b>{summary.missingImages || 0}</b></span></article>
            <article><Clock3 /><span><small>Chưa xác minh / quá cũ</small><b>{summary.stalePlaces || 0}</b></span></article>
            <article><CameraOff /><span><small>Ảnh quá cũ</small><b>{summary.staleImages || 0}</b></span></article>
            <article className={risky.length ? 'warn' : ''}><ShieldAlert /><span><small>Đóng góp rủi ro</small><b>{risky.length}</b></span></article>
          </section>

          {!!risky.length && (
            <section className="data-trust-section">
              <div className="data-trust-section-head"><div><span className="eyebrow">ANTI-SPAM</span><h2>Đóng góp cần chú ý</h2></div><a href="/admin/contributions">Mở hàng chờ →</a></div>
              <div className="risk-list">
                {risky.slice(0, 12).map((item) => (
                  <article key={item.id}>
                    <span className={'risk-score ' + riskClass(item.riskScore)}>{item.riskScore}</span>
                    <div><b>{item.payload?.place?.name || item.placeName || ('Đóng góp #' + item.id)}</b><small>{item.userName} · {item.type}</small><p>{(item.riskFlags || []).map((flag) => flag.detail || flag.code).join(' · ')}</p></div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="data-trust-section">
            <div className="data-trust-section-head">
              <div><span className="eyebrow">DATA QUALITY</span><h2>Địa điểm cần làm mới</h2></div>
              <div className="quality-filter-row hola-quality-filters">
                <label>Tìm địa điểm<input type="search" value={queueQuery} placeholder="Tên, ID, khu vực" onChange={event => setQueueQuery(event.target.value)} /></label>
                <label>Vấn đề<select value={filter} onChange={event => setFilter(event.target.value)}><option value="ALL">Tất cả vấn đề</option>{Object.entries(ISSUE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                <label>Ưu tiên<select value={queuePriority} onChange={event => setQueuePriority(event.target.value)}><option value="ALL">Tất cả mức</option>{Object.entries(TRIAGE_LABELS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                <label>Danh mục<select value={queueCategory} onChange={event => setQueueCategory(event.target.value)}><option value="ALL">Tất cả danh mục</option>{queueCategories.map(key => <option key={key} value={key}>{key}</option>)}</select></label>
              </div>
            </div>

            {quality?.triageVersion === 5 && <p className="data-trust-triage-summary" role="status">
              Hàng chờ ưu tiên V5 trong phạm vi {summary.auditedCount || 0} địa điểm đã kiểm tra:
              {' '}<b>{summary.triageCounts?.CRITICAL || 0} khẩn</b> ·
              {' '}{summary.triageCounts?.HIGH || 0} cao ·
              {' '}{summary.triageCounts?.MEDIUM || 0} cần rà soát.
              Không đại diện toàn bộ hệ thống nếu việc kiểm tra mới chỉ lấy mẫu.
            </p>}
            <div className="hola-quality-queue-actions">
              <span>{qualityItems.length} / {quality?.items?.length || 0} mục trong hàng chờ đã tải · Đã chọn {selectedQueue.length}</span>
              <button type="button" disabled={!qualityItems.length} onClick={() => setQueueIds(qualityItems.map(item => String(item.id)))}>Chọn kết quả</button>
              <button type="button" disabled={!queueIds.length} onClick={() => setQueueIds([])}>Bỏ chọn</button>
              <button type="button" disabled={!qualityItems.length} onClick={exportQueue}>Xuất CSV {selectedQueue.length ? 'đã chọn' : 'đã lọc'}</button>
            </div>
            <p className="data-trust-triage-summary">Bộ lọc và xuất CSV chỉ áp dụng cho hàng chờ đã tải; không tự động xác minh hoặc thay đổi dữ liệu.</p>
            {!qualityItems.length && <p>Không có mục phù hợp bộ lọc.</p>}
            <div className="quality-place-list">
              {qualityItems.map((place) => (
                <article key={place.id}>
                  <label className="hola-quality-select"><input type="checkbox" checked={queueIds.includes(String(place.id))} aria-label={'Chọn ' + place.name} onChange={event => setQueueIds(ids => event.target.checked ? [...ids, String(place.id)] : ids.filter(id => id !== String(place.id)))} /> Chọn</label>
                  <div className="quality-score"><b>{place.qualityScore}</b><small>/100</small></div>
                  <div className="quality-place-copy">
                    <small>{place.category || 'Chưa phân loại'} · #{place.id}</small>
                    <h3>{place.name}</h3>
                    {place.triagePriority && <div className={'data-trust-triage-badge tier-' + place.triagePriority.toLowerCase()}>
                      {TRIAGE_LABELS[place.triagePriority] || 'Cần rà soát'}
                    </div>}
                    <p>{place.address || 'Chưa có địa chỉ'}</p>
                    <div>{place.issues.map((issue) => <span key={issue}>{ISSUE_LABELS[issue] || issue}</span>)}</div>
                  </div>
                  <div className="quality-place-meta"><span>{place.imageCount} ảnh</span><span>Xác minh: {place.verifiedAgeDays === null ? 'Chưa từng' : place.verifiedAgeDays + ' ngày'}</span></div>
                  <div className="quality-place-actions">
                    <button onClick={() => openHistory(place)}><History size={15} /> Lịch sử</button>
                    {canVerify && <button className="primary" disabled={busy === 'verify-' + place.id} onClick={() => verify(place)}><BadgeCheck size={15} /> Đã kiểm tra</button>}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {isAdmin && (
            <section className="data-trust-section ctv-section">
              <div className="data-trust-section-head"><div><span className="eyebrow">CTV TRUST</span><h2>CTV cấp 1 / cấp 2</h2></div><a href="/admin/ctv">Quản lý CTV →</a></div>
              <div className="ctv-trust-grid">
                {ctvs.map((ctv) => <article key={ctv.id}><UserCheck size={18} /><div><b>{ctv.name}</b><small>CTV cấp {ctv.ctvLevel} · Trust {ctv.ctvTrustScore}/100</small><span>{ctv.ctvReviewsCount} lượt duyệt · {ctv.ctvConfirmedCount} đúng · {ctv.ctvOverturnedCount} bị sửa</span></div></article>)}
                {!ctvs.length && <div className="empty-state">Chưa có tài khoản CTV.</div>}
              </div>
            </section>
          )}

          {isAdmin && !!approvedCtv.length && (
            <section className="data-trust-section">
              <div className="data-trust-section-head"><div><span className="eyebrow">CTV AUDIT</span><h2>Kiểm định quyết định CTV</h2></div></div>
              <div className="ctv-audit-list">
                {approvedCtv.slice(0, 20).map((item) => (
                  <article key={item.id}>
                    <div><b>{item.payload?.place?.name || item.placeName || ('Đóng góp #' + item.id)}</b><small>Duyệt bởi {item.reviewerName || 'CTV'} · Cấp {item.reviewerCtvLevel || 1} · {formatDate(item.reviewedAt)}</small></div>
                    {item.ctvAuditVerdict ? <span className={'audit-result ' + item.ctvAuditVerdict.toLowerCase()}>{item.ctvAuditVerdict}</span> : <div className="audit-actions"><button disabled={busy === 'audit-' + item.id} onClick={() => audit(item, 'CONFIRMED')}><CheckCircle2 size={15} /> Đúng</button><button disabled={busy === 'audit-' + item.id} onClick={() => audit(item, 'OVERTURNED')}><XCircle size={15} /> Chưa đúng</button></div>}
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {selected && (
        <div className="revision-backdrop" onClick={() => setSelected(null)}>
          <section className="revision-panel" onClick={(event) => event.stopPropagation()}>
            <div className="revision-head"><div><span className="eyebrow">VERSION HISTORY</span><h2>{selected.name}</h2></div><button onClick={() => setSelected(null)}>×</button></div>
            {busy === 'history' && <div className="loading-card">Đang tải lịch sử...</div>}
            <div className="revision-list">
              {revisions.map((revision) => <article key={revision.id}><span className="revision-dot" /><div><div className="revision-title"><b>{REVISION_LABELS[revision.action] || revision.action}</b><small>#{revision.id}</small></div><p>{revision.reason || 'Không có ghi chú'}</p><span>{revision.actorName} {revision.actorRole ? '· ' + revision.actorRole : ''} · {formatDate(revision.createdAt)}</span></div>{canRollback && revision.rollbackSupported && <button disabled={busy === 'rollback-' + revision.id} onClick={() => rollback(revision)}><RotateCcw size={14} /> Rollback</button>}</article>)}
              {!revisions.length && busy !== 'history' && <div className="empty-state"><History size={22} /> Chưa có revision nào.</div>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
