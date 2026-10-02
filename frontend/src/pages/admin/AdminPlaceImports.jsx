import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Database,
  ExternalLink,
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
  getAdminPlaceImports,
  getCategories,
  rejectAdminPlaceImport,
  updateAdminPlaceImport
} from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

const STATUSES = ['ALL', 'NEW', 'REVIEW', 'DUPLICATE', 'APPROVED', 'REJECTED'];

function percent(value) {
  if (value === null || value === undefined) return '—';
  return Math.round(Number(value) * 100) + '%';
}

export default function AdminPlaceImports() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState('NEW');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.slug, category.name])),
    [categories]
  );

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

      <section className="admin-import-runbook">
        <Database size={22} />
        <div>
          <b>Quét dữ liệu Overture</b>
          <span>Chạy tại thư mục dự án sau khi cài <code>pip install -U overturemaps</code>.</span>
          <code>.\scripts\import-overture-places.ps1</code>
        </div>
        <small>Importer tự cắt đúng vùng dịch vụ Hòa Lạc và không public trực tiếp.</small>
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
