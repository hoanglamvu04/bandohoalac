import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Database,
  ExternalLink,
  Landmark,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert
} from 'lucide-react';
import {
  approveAdminHighConfidencePlaceImports,
  approveAdminPlaceImport,
  getAdminPlaceImportRuns,
  getAdminPlaceImports,
  getCategories,
  rejectAdminPlaceImport,
  startAdminOverturePlaceScan,
  updateAdminPlaceImport
} from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const STATUSES = ['ALL', 'NEW', 'REVIEW', 'DUPLICATE', 'APPROVED', 'REJECTED'];

function percent(value) {
  if (value === null || value === undefined) return '—';
  return Math.round(Number(value) * 100) + '%';
}

function runStatusLabel(status) {
  if (status === 'QUEUED') return 'Đang chờ';
  if (status === 'RUNNING') return 'Đang quét';
  if (status === 'SUCCESS') return 'Hoàn tất';
  if (status === 'FAILED') return 'Lỗi';
  return status || '—';
}

function formatRunTime(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function foundationPublishCount(run) {
  const match = String(run?.logExcerpt || '').match(/FOUNDATION_PUBLISHED:\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
}

export default function AdminPlaceImports() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState('NEW');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [runs, setRuns] = useState([]);
  const [scanBusy, setScanBusy] = useState(false);
  const [foundationBusy, setFoundationBusy] = useState(false);

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.slug, category.name])),
    [categories]
  );
  const hasActiveRun = runs.some((run) => run.status === 'QUEUED' || run.status === 'RUNNING');
  const canScan = user?.role === 'ADMIN';

  function load() {
    setLoading(true);
    return getAdminPlaceImports({
      status,
      q: query.trim() || undefined,
      limit: 200
    })
      .then((data) => {
        setItems(Array.isArray(data?.items) ? data.items : []);
        setStats(data?.stats || null);
      })
      .catch((error) => {
        showToast(error.message, 'error');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    getCategories()
      .then((data) => setCategories(Array.isArray(data?.items) ? data.items : []))
      .catch(() => setCategories([]));
  }, []);

  async function loadRuns({ refreshPlaces = false } = {}) {
    try {
      const data = await getAdminPlaceImportRuns({ limit: 8 });
      const nextRuns = Array.isArray(data?.items) ? data.items : [];
      setRuns(nextRuns);
      if (refreshPlaces) await load();
      return nextRuns;
    } catch (error) {
      showToast(error.message, 'error');
      return [];
    }
  }

  useEffect(() => {
    loadRuns();
  }, []);

  useEffect(() => {
    if (!hasActiveRun) return undefined;

    const timer = window.setInterval(async () => {
      const nextRuns = await loadRuns();
      const stillActive = nextRuns.some(
        (run) => run.status === 'QUEUED' || run.status === 'RUNNING'
      );
      if (!stillActive) await load();
    }, 2500);

    return () => window.clearInterval(timer);
  }, [hasActiveRun]);

  useEffect(() => {
    const timer = window.setTimeout(load, query.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [status, query]);

  async function remap(item, mappedCategorySlug) {
    setBusyId(item.id);
    try {
      await updateAdminPlaceImport(item.id, { mappedCategorySlug });
      showToast('Đã cập nhật danh mục.', 'success');
      await load();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function approve(item) {
    setBusyId(item.id);
    try {
      await approveAdminPlaceImport(item.id);
      showToast('Đã đưa địa điểm lên Hola Maps.', 'success');
      await load();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(item) {
    if (!window.confirm('Bỏ qua địa điểm này khỏi hàng chờ import?')) return;

    setBusyId(item.id);
    try {
      await rejectAdminPlaceImport(item.id);
      showToast('Đã loại địa điểm khỏi hàng chờ.', 'info');
      await load();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  function prependRun(data) {
    if (!data?.run) return;
    setRuns((current) => [
      data.run,
      ...current.filter((item) => item.id !== data.run.id)
    ].slice(0, 8));
  }

  async function startScan() {
    if (!canScan || scanBusy || foundationBusy || hasActiveRun) return;

    setScanBusy(true);
    try {
      const data = await startAdminOverturePlaceScan({
        minConfidence: 0.55,
        mode: 'STAGING'
      });
      prependRun(data);
      showToast('Đã bắt đầu quét Overture vào hàng chờ.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
      await loadRuns();
    } finally {
      setScanBusy(false);
    }
  }

  async function startFoundationScan() {
    if (!canScan || scanBusy || foundationBusy || hasActiveRun) return;
    if (!window.confirm(
      'Quét POI nền sẽ tự public các mốc và dịch vụ đủ độ tin cậy sau khi chống trùng. Các điểm chưa chắc chắn vẫn ở hàng chờ. Tiếp tục?'
    )) return;

    setFoundationBusy(true);
    try {
      const data = await startAdminOverturePlaceScan({
        minConfidence: 0.72,
        mode: 'FOUNDATION'
      });
      prependRun(data);
      showToast('Đã bắt đầu quét POI nền cho tìm kiếm quanh địa điểm.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
      await loadRuns();
    } finally {
      setFoundationBusy(false);
    }
  }

  async function approveHighConfidence() {
    if (!window.confirm('Duyệt tối đa 200 địa điểm độ tin cậy từ 80%, đã map danh mục và không bị trùng?')) {
      return;
    }

    setBulkBusy(true);
    try {
      const result = await approveAdminHighConfidencePlaceImports({
        minConfidence: 0.8,
        limit: 200
      });
      showToast(
        'Đã duyệt ' + Number(result?.approvedCount || 0) + ' địa điểm.',
        result?.failedCount ? 'info' : 'success'
      );
      await load();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBulkBusy(false);
    }
  }

  const statCards = [
    ['Mới', stats?.new || 0],
    ['Cần xem', stats?.review || 0],
    ['Trùng', stats?.duplicates || 0],
    ['Đã duyệt', stats?.approved || 0]
  ];
  const lastRun = runs[0] || null;

  return (
    <main className="admin-page admin-place-imports page-container">
      <div className="section-heading admin-import-heading">
        <div>
          <span className="eyebrow">DATA IMPORT</span>
          <h2>Nhập địa điểm hàng loạt</h2>
          <p>Overture Places → kiểm tra trùng → map danh mục → duyệt vào Hola Maps.</p>
        </div>

        <div className="admin-import-heading-actions">
          <button type="button" className="secondary-action" onClick={load} disabled={loading}>
            <RefreshCw size={16} /> Làm mới
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={approveHighConfidence}
            disabled={bulkBusy || !stats?.readyHighConfidence}
          >
            <ShieldCheck size={17} />
            {bulkBusy ? 'Đang duyệt...' : 'Duyệt nhóm ≥ 80%'}
          </button>
        </div>
      </div>

      <section className="admin-import-runbook admin-import-scan-card">
        <Database size={22} />
        <div>
          <b>Quét dữ liệu Overture trực tiếp</b>
          <span>
            Chế độ thường chỉ đưa dữ liệu vào staging để duyệt thủ công.
          </span>
          <small>
            {lastRun
              ? 'Lần gần nhất: ' + formatRunTime(lastRun.createdAt) + ' · ' + runStatusLabel(lastRun.status)
              : 'Chưa có lịch sử quét từ Admin.'}
          </small>
        </div>
        <button
          type="button"
          className={hasActiveRun ? 'admin-import-scan-button running' : 'admin-import-scan-button'}
          onClick={startScan}
          disabled={!canScan || scanBusy || foundationBusy || hasActiveRun}
          title={canScan ? 'Quét Overture Places vào hàng chờ' : 'Chỉ ADMIN được chạy quét dữ liệu'}
        >
          <RefreshCw size={17} />
          {hasActiveRun ? 'Đang quét…' : scanBusy ? 'Đang khởi tạo…' : 'Quét hàng chờ'}
        </button>
      </section>

      <section className="admin-import-runbook admin-import-scan-card foundation-scan-card">
        <Landmark size={22} />
        <div>
          <b>Quét POI nền cho Smart Search</b>
          <span>
            Ưu tiên trường học, y tế, cơ quan, giao thông, địa danh; sau đó cafe, ăn uống, lưu trú và tiện ích.
            Điểm đủ confidence được tự public sau khi chống trùng, điểm mơ hồ vẫn chờ duyệt.
          </span>
          <small>Giúp các câu như “cafe gần FPT”, “trường quanh ĐHQG” có mốc và POI thật để tìm.</small>
        </div>
        <button
          type="button"
          className={hasActiveRun ? 'admin-import-scan-button running' : 'admin-import-scan-button foundation'}
          onClick={startFoundationScan}
          disabled={!canScan || scanBusy || foundationBusy || hasActiveRun}
          title={canScan ? 'Quét và bổ sung POI nền có kiểm soát' : 'Chỉ ADMIN được chạy quét dữ liệu'}
        >
          <Landmark size={17} />
          {hasActiveRun ? 'Đang quét…' : foundationBusy ? 'Đang khởi tạo…' : 'Quét POI nền'}
        </button>
      </section>

      <section className="admin-import-stats">
        {statCards.map(([label, value]) => (
          <article key={label}>
            <small>{label}</small>
            <b>{value}</b>
          </article>
        ))}
        <article className="ready">
          <small>Sẵn sàng duyệt ≥80%</small>
          <b>{stats?.readyHighConfidence || 0}</b>
        </article>
      </section>

      <section className="admin-import-history">
        <div className="admin-import-history-head">
          <div>
            <b>Lịch sử quét</b>
            <span>Theo dõi các lần tải và nhập Overture gần nhất.</span>
          </div>
          {hasActiveRun && <small className="running">TỰ ĐỘNG CẬP NHẬT</small>}
        </div>

        <div className="admin-import-run-list">
          {!runs.length && <span className="admin-import-no-runs">Chưa có lần quét nào.</span>}
          {runs.map((run) => {
            const published = foundationPublishCount(run);
            return (
              <article className={'run-' + String(run.status || '').toLowerCase()} key={run.id}>
                <div className="admin-import-run-status">
                  <i />
                  <span>
                    <b>{runStatusLabel(run.status)}</b>
                    <small>
                      #{run.id} · {formatRunTime(run.createdAt)}
                      {run.scanMode === 'FOUNDATION' ? ' · POI nền' : ''}
                    </small>
                  </span>
                </div>

                <div className="admin-import-run-metrics">
                  <span><b>{run.received || 0}</b><small>Nhận</small></span>
                  <span><b>{run.new || 0}</b><small>Mới</small></span>
                  <span><b>{run.review || 0}</b><small>Xem lại</small></span>
                  <span><b>{run.duplicates || 0}</b><small>Trùng</small></span>
                  <span><b>{published || 0}</b><small>Auto public</small></span>
                </div>

                <div className="admin-import-run-note">
                  {run.status === 'FAILED'
                    ? <span>{run.errorMessage || 'Lần quét gặp lỗi.'}</span>
                    : run.status === 'SUCCESS'
                      ? <span>
                          {run.scanMode === 'FOUNDATION'
                            ? 'POI nền hoàn tất · đã tự public ' + published + ' điểm đủ chuẩn'
                            : 'Hoàn tất với confidence ≥ ' + percent(run.minConfidence)}
                        </span>
                      : <span>Đang xử lý dữ liệu nền…</span>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="admin-import-panel">
        <div className="admin-import-toolbar">
          <div className="admin-import-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm tên, địa chỉ, category..."
            />
          </div>

          <div className="admin-import-tabs">
            {STATUSES.map((value) => (
              <button
                type="button"
                className={status === value ? 'active' : ''}
                key={value}
                onClick={() => setStatus(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {loading && <div className="loading-card">Đang tải dữ liệu import...</div>}

        {!loading && !items.length && (
          <div className="empty-state">
            <Database size={26} />
            <b>Chưa có địa điểm trong nhóm này</b>
            <span>Chạy importer Overture hoặc đổi bộ lọc.</span>
          </div>
        )}

        <div className="admin-import-list">
          {items.map((item) => {
            const busy = busyId === item.id;
            const canApprove = item.importStatus !== 'DUPLICATE' &&
              item.importStatus !== 'APPROVED' &&
              item.importStatus !== 'REJECTED' &&
              Boolean(item.mappedCategorySlug);

            return (
              <article className={'admin-import-row status-' + item.importStatus.toLowerCase()} key={item.id}>
                <div className="admin-import-row-main">
                  <div className="admin-import-row-title">
                    <span className="admin-import-pin"><MapPin size={18} /></span>
                    <div>
                      <small>
                        {item.source} · {item.basicCategory || item.taxonomyPrimary || 'chưa phân loại'}
                      </small>
                      <b>{item.name}</b>
                      <span>{item.address || 'Chưa có địa chỉ'}</span>
                    </div>
                  </div>

                  <div className="admin-import-meta">
                    <span>
                      <strong>{percent(item.confidence)}</strong>
                      độ tin cậy
                    </span>
                    <span>
                      <strong>{item.operatingStatus || 'unknown'}</strong>
                      trạng thái nguồn
                    </span>
                    {item.phone && <span><strong>{item.phone}</strong> điện thoại</span>}
                    {item.website && (
                      <a href={item.website} target="_blank" rel="noreferrer">
                        Website <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>

                <div className="admin-import-category">
                  <label>
                    Danh mục Hola Maps
                    <select
                      value={item.mappedCategorySlug || ''}
                      disabled={busy || item.importStatus === 'APPROVED'}
                      onChange={(event) => remap(item, event.target.value)}
                    >
                      <option value="">Chưa map</option>
                      {categories.map((category) => (
                        <option value={category.slug} key={category.slug}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {item.mappedCategorySlug && (
                    <small>→ {categoryMap.get(item.mappedCategorySlug) || item.mappedCategorySlug}</small>
                  )}
                </div>

                <div className="admin-import-status">
                  <span>{item.importStatus}</span>
                  {item.duplicateOfPlaceId && (
                    <small className="duplicate">
                      <TriangleAlert size={13} />
                      Trùng #{item.duplicateOfPlaceId} {item.duplicatePlaceName || ''}
                    </small>
                  )}
                  {item.approvedPlaceId && (
                    <small className="approved">
                      <Check size={13} /> Place #{item.approvedPlaceId}
                    </small>
                  )}
                </div>

                <div className="admin-import-actions">
                  <button
                    type="button"
                    className="admin-import-approve"
                    disabled={!canApprove || busy}
                    onClick={() => approve(item)}
                  >
                    <Check size={15} /> Duyệt
                  </button>
                  <button
                    type="button"
                    className="admin-import-reject"
                    disabled={busy || item.importStatus === 'APPROVED' || item.importStatus === 'REJECTED'}
                    onClick={() => reject(item)}
                  >
                    <Trash2 size={15} /> Bỏ
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
