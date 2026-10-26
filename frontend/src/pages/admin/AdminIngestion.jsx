import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bot,
  Camera,
  CheckCircle2,
  Clock3,
  Database,
  ImagePlus,
  Link2,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TimerReset,
  ToggleLeft,
  ToggleRight,
  TriangleAlert,
  UsersRound
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getAdminIngestionOverview,
  runAdminIngestionCycle,
  runAdminIngestionSource,
  updateAdminIngestionSource
} from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

const SOURCE_ICONS = {
  OVERTURE_PLACES: Database,
  PHOTO_SCAN: Camera,
  FRESHNESS_SWEEP: TimerReset,
  COMMUNITY_EVENT: UsersRound,
  PARTNER_EVENT: ShieldCheck
};

const SOURCE_HELP = {
  OVERTURE_PLACES: 'Tự tìm POI mới trong vùng phục vụ, chuẩn hóa danh mục và chống trùng trước khi publish.',
  PHOTO_SCAN: 'Quét ảnh theo tên + tọa độ; chỉ ảnh Wikimedia có license rõ ràng mới đủ điều kiện auto-approve.',
  FRESHNESS_SWEEP: 'Tự tạo hàng đợi cho địa điểm cũ, thiếu ảnh và trạng thái phòng trọ quá hạn.',
  COMMUNITY_EVENT: 'Ghi provenance từ đóng góp đã được duyệt của cộng đồng.',
  PARTNER_EVENT: 'Ghi provenance từ địa điểm HOLA Partner đã xác minh.'
};

const SCHEDULE_OPTIONS = [
  { value: 60, label: 'Mỗi 1 giờ' },
  { value: 180, label: 'Mỗi 3 giờ' },
  { value: 360, label: 'Mỗi 6 giờ' },
  { value: 720, label: 'Mỗi 12 giờ' },
  { value: 1440, label: 'Mỗi ngày' },
  { value: 2880, label: 'Mỗi 2 ngày' },
  { value: 10080, label: 'Mỗi tuần' }
];

function formatDateTime(value) {
  if (!value) return 'Chưa chạy';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN');
}

function statusLabel(value) {
  return {
    QUEUED: 'Đang chờ',
    DISPATCHED: 'Đã giao việc',
    RUNNING: 'Đang chạy',
    SUCCESS: 'Hoàn tất',
    FAILED: 'Lỗi',
    SKIPPED: 'Bỏ qua'
  }[value] || value;
}

function sourceModeLabel(source) {
  if (source.collectionMode === 'EVENT') return 'Theo sự kiện';
  if (!source.enabled) return 'Đang tắt';
  const match = SCHEDULE_OPTIONS.find((item) => Number(item.value) === Number(source.scheduleMinutes));
  return match?.label || (source.scheduleMinutes ? source.scheduleMinutes + ' phút' : 'Theo lịch');
}

function SourceCard({ source, busy, onToggle, onSchedule, onRun }) {
  const Icon = SOURCE_ICONS[source.key] || Database;
  const scheduled = source.collectionMode === 'SCHEDULED';

  return (
    <article className={'ingestion-source-card ' + (source.enabled ? 'enabled' : 'disabled')}>
      <div className="ingestion-source-head">
        <span className={'ingestion-source-icon kind-' + source.kind.toLowerCase()}>
          <Icon size={20} />
        </span>
        <div>
          <small>{source.kind} · {source.collectionMode}</small>
          <h2>{source.name}</h2>
        </div>
        <button
          type="button"
          className="ingestion-toggle"
          onClick={() => onToggle(source)}
          disabled={busy || source.collectionMode === 'EVENT'}
          aria-label={source.enabled ? 'Tắt nguồn' : 'Bật nguồn'}
          title={source.collectionMode === 'EVENT' ? 'Nguồn sự kiện luôn cập nhật theo hoạt động hệ thống' : undefined}
        >
          {source.enabled ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
        </button>
      </div>

      <p>{SOURCE_HELP[source.key] || 'Nguồn dữ liệu của HOLA Maps.'}</p>

      <div className="ingestion-source-meta">
        <span><Clock3 size={13} /><b>{sourceModeLabel(source)}</b></span>
        <span><CheckCircle2 size={13} />Lần tốt gần nhất: <b>{formatDateTime(source.lastSuccessAt)}</b></span>
        {source.autoPublishThreshold !== null && (
          <span><Bot size={13} />Auto threshold: <b>{Math.round(Number(source.autoPublishThreshold) * 100)}%</b></span>
        )}
      </div>

      {source.lastError && (
        <div className="ingestion-source-error">
          <TriangleAlert size={14} />
          <span>{source.lastError}</span>
        </div>
      )}

      <div className="ingestion-source-actions">
        {scheduled && (
          <select
            value={source.scheduleMinutes || ''}
            onChange={(event) => onSchedule(source, Number(event.target.value))}
            disabled={busy}
            aria-label={'Lịch chạy ' + source.name}
          >
            {SCHEDULE_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        )}

        {scheduled ? (
          <button type="button" onClick={() => onRun(source)} disabled={busy}>
            <Play size={14} />
            {busy ? 'Đang tạo…' : 'Chạy ngay'}
          </button>
        ) : (
          <span className="event-source-badge">Tự cập nhật theo event</span>
        )}
      </div>
    </article>
  );
}

export default function AdminIngestion() {
  const { showToast } = useToast();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [runningAll, setRunningAll] = useState(false);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      setOverview(await getAdminIngestionOverview());
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const activeJobs = useMemo(
    () => (overview?.jobs || []).filter((job) => ['QUEUED', 'DISPATCHED', 'RUNNING'].includes(job.status)),
    [overview?.jobs]
  );

  useEffect(() => {
    if (!activeJobs.length) return undefined;
    const timer = window.setInterval(() => load({ quiet: true }), 3500);
    return () => window.clearInterval(timer);
  }, [activeJobs.length, load]);

  async function toggleSource(source) {
    setBusyKey(source.key);
    try {
      await updateAdminIngestionSource(source.key, { enabled: !source.enabled });
      showToast(source.enabled ? 'Đã tắt nguồn tự động.' : 'Đã bật nguồn tự động.', 'success');
      await load({ quiet: true });
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusyKey('');
    }
  }

  async function updateSchedule(source, scheduleMinutes) {
    setBusyKey(source.key);
    try {
      await updateAdminIngestionSource(source.key, { scheduleMinutes });
      showToast('Đã cập nhật lịch thu thập.', 'success');
      await load({ quiet: true });
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusyKey('');
    }
  }

  async function runSource(source) {
    setBusyKey(source.key);
    try {
      await runAdminIngestionSource(source.key);
      showToast('Đã đưa nguồn vào hàng đợi thu thập.', 'success');
      await load({ quiet: true });
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusyKey('');
    }
  }

  async function runAll() {
    if (runningAll) return;
    setRunningAll(true);
    try {
      await runAdminIngestionCycle();
      showToast('Đã khởi động một chu kỳ thu thập đầy đủ.', 'success');
      await load({ quiet: true });
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setRunningAll(false);
    }
  }

  const stats = overview?.stats || {};

  return (
    <main className="admin-page ingestion-center page-container">
      <section className="ingestion-hero">
        <div>
          <span className="ingestion-kicker"><Sparkles size={14} /> AUTO INGESTION V1</span>
          <h1>HOLA Maps tự nuôi dữ liệu.</h1>
          <p>
            Overture tìm địa điểm mới, Photo Scanner tìm ảnh có nguồn, Freshness Engine phát hiện dữ liệu cũ.
            Mọi thứ đi qua confidence, chống trùng và hàng đợi kiểm duyệt trước khi xuất hiện công khai.
          </p>
          <div className="ingestion-hero-actions">
            <button type="button" onClick={runAll} disabled={runningAll || Boolean(activeJobs.length)}>
              <Play size={16} />
              {runningAll ? 'Đang khởi động…' : 'Chạy toàn bộ một lượt'}
            </button>
            <button type="button" className="secondary" onClick={() => load()} disabled={loading}>
              <RefreshCw size={15} /> Làm mới
            </button>
          </div>
        </div>

        <div className="ingestion-hero-status">
          <span><Activity size={21} /></span>
          <div>
            <small>AUTOMATION</small>
            <strong>{activeJobs.length ? activeJobs.length + ' job đang chạy' : 'Đang theo lịch'}</strong>
            <em>{overview?.sources?.filter((source) => source.enabled).length || 0} nguồn đang bật</em>
          </div>
        </div>
      </section>

      <section className="ingestion-stats">
        <article>
          <span className="blue"><Database size={19} /></span>
          <div><small>Candidate địa điểm</small><b>{Number(stats.placeCandidatesNew || 0) + Number(stats.placeCandidatesReview || 0)}</b></div>
          <em>{stats.duplicateCandidates || 0} nghi trùng</em>
        </article>
        <article>
          <span className="green"><ImagePlus size={19} /></span>
          <div><small>Ảnh chờ duyệt</small><b>{stats.photoCandidatesPending ?? '—'}</b></div>
          <em>{stats.photoApproved || 0} đã duyệt</em>
        </article>
        <article>
          <span className="gold"><TimerReset size={19} /></span>
          <div><small>Cần xác minh</small><b>{stats.verificationPending ?? '—'}</b></div>
          <em>{stats.verificationHousing || 0} phòng trọ</em>
        </article>
        <article>
          <span className="violet"><Link2 size={19} /></span>
          <div><small>Provenance</small><b>{stats.provenanceLinks ?? '—'}</b></div>
          <em>{stats.provenancePlaces || 0} địa điểm có nguồn</em>
        </article>
      </section>

      <section className="ingestion-workspace">
        <div className="ingestion-section-head">
          <div>
            <span>NGUỒN DỮ LIỆU</span>
            <h2>Bộ máy thu thập tự động</h2>
            <p>Bật/tắt nguồn, chọn chu kỳ và chạy thủ công khi cần.</p>
          </div>
          <span className="ingestion-safe-badge"><ShieldCheck size={14} /> Chỉ auto-publish theo policy</span>
        </div>

        {loading && !overview ? (
          <div className="loading-card">Đang tải Auto Ingestion…</div>
        ) : (
          <div className="ingestion-source-grid">
            {(overview?.sources || []).map((source) => (
              <SourceCard
                source={source}
                busy={busyKey === source.key}
                onToggle={toggleSource}
                onSchedule={updateSchedule}
                onRun={runSource}
                key={source.key}
              />
            ))}
          </div>
        )}
      </section>

      <section className="ingestion-pipeline">
        <div className="ingestion-section-head">
          <div>
            <span>PIPELINE</span>
            <h2>Thu thập → chuẩn hóa → chống trùng → xác minh</h2>
          </div>
        </div>
        <div className="ingestion-pipeline-grid">
          <article><b>01</b><Database size={19} /><h3>Collect</h3><p>Nguồn được quét theo lịch và giữ payload nguồn để truy vết.</p></article>
          <article><b>02</b><Bot size={19} /><h3>Normalize</h3><p>Danh mục, tọa độ, thông tin liên hệ và confidence được chuẩn hóa.</p></article>
          <article><b>03</b><ShieldCheck size={19} /><h3>Deduplicate</h3><p>So tên, khoảng cách, điện thoại và website trước khi tạo pin mới.</p></article>
          <article><b>04</b><CheckCircle2 size={19} /><h3>Publish / Verify</h3><p>Chỉ dữ liệu vượt policy mới tự publish; phần còn lại chờ staff/CTV.</p></article>
        </div>
      </section>

      <section className="ingestion-jobs">
        <div className="ingestion-section-head">
          <div>
            <span>NHẬT KÝ GẦN ĐÂY</span>
            <h2>Job thu thập</h2>
          </div>
          <div className="ingestion-quick-links">
            <Link to="/admin/place-imports">Candidate địa điểm <ArrowRight size={13} /></Link>
            <Link to="/admin/photo-scanner">Candidate ảnh <ArrowRight size={13} /></Link>
            <Link to="/admin/data-quality">Data Quality <ArrowRight size={13} /></Link>
          </div>
        </div>

        <div className="ingestion-job-list">
          {(overview?.jobs || []).map((job) => (
            <article key={job.id}>
              <span className={'job-dot status-' + String(job.status).toLowerCase()} />
              <div>
                <b>{job.sourceName || job.sourceKey}</b>
                <small>{job.triggerType} · {formatDateTime(job.createdAt)}</small>
              </div>
              <strong className={'job-status status-' + String(job.status).toLowerCase()}>
                {statusLabel(job.status)}
              </strong>
              <span className="job-result">
                {job.stats?.approvedCount || job.stats?.autoPublish?.approvedCount || job.stats?.autoApprove?.approvedCount
                  ? 'Auto + ' + (
                      job.stats?.approvedCount ||
                      job.stats?.autoPublish?.approvedCount ||
                      job.stats?.autoApprove?.approvedCount
                    )
                  : job.stats?.candidates
                    ? job.stats.candidates + ' ảnh'
                    : job.stats?.staged
                      ? job.stats.staged + ' candidate'
                      : '—'}
              </span>
            </article>
          ))}

          {!overview?.jobs?.length && (
            <div className="ingestion-empty">Chưa có job Auto Ingestion nào được chạy.</div>
          )}
        </div>
      </section>
    </main>
  );
}
