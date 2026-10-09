import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ExternalLink,
  Image as ImageIcon,
  Images,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import {
  approvePhotoCandidate,
  getPhotoCandidates,
  getPhotoScannerStats,
  getPhotoScanRuns,
  rejectPhotoCandidate,
  startPhotoScan
} from '../../services/photoScannerApi.js';

const STATUS_LABELS = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã gắn',
  REJECTED: 'Đã loại',
  STALE: 'Hết hiệu lực'
};

const SOURCE_LABELS = {
  WIKIMEDIA: 'Wikimedia Commons',
  FOURSQUARE: 'Foursquare',
  GOOGLE: 'Google'
};

function RunStatus({ run }) {
  if (!run) return null;
  return (
    <div className={'photo-run-status state-' + String(run.status || '').toLowerCase()}>
      <span><ScanSearch size={15} /> {run.status}</span>
      <b>{run.scannedPlaces || 0} địa điểm</b>
      <b>{run.candidates || 0} ảnh tìm thấy</b>
      {run.errorMessage && <small>{run.errorMessage}</small>}
    </div>
  );
}

export default function AdminPhotoScanner() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [filters, setFilters] = useState({ status: 'PENDING', source: 'ALL', q: '' });
  const [scope, setScope] = useState('MISSING_IMAGES');
  const [scanLimit, setScanLimit] = useState(50);

  const activeRun = useMemo(
    () => runs.find((run) => ['QUEUED', 'RUNNING'].includes(run.status)) || null,
    [runs]
  );

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const [candidateData, statsData, runData] = await Promise.all([
        getPhotoCandidates({ ...filters, limit: 100 }),
        getPhotoScannerStats(),
        getPhotoScanRuns({ limit: 8 })
      ]);
      setItems(Array.isArray(candidateData?.items) ? candidateData.items : []);
      setStats(statsData || null);
      setRuns(Array.isArray(runData?.items) ? runData.items : []);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [filters, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!activeRun) return undefined;
    const timer = window.setInterval(() => load({ quiet: true }), 3500);
    return () => window.clearInterval(timer);
  }, [activeRun, load]);

  async function startScan() {
    if (starting || activeRun) return;
    setStarting(true);
    try {
      const data = await startPhotoScan({ scope, limit: Number(scanLimit) || 50 });
      showToast('Đã bắt đầu quét ảnh cho địa điểm.', 'success');
      if (data?.run) setRuns((current) => [data.run, ...current]);
      window.setTimeout(() => load({ quiet: true }), 1200);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setStarting(false);
    }
  }

  async function approve(item, makeCover) {
    setBusyId(item.id);
    try {
      await approvePhotoCandidate(item.id, { makeCover });
      showToast(makeCover ? 'Đã gắn làm ảnh đại diện.' : 'Đã thêm vào thư viện ảnh.', 'success');
      await load({ quiet: true });
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(item) {
    setBusyId(item.id);
    try {
      await rejectPhotoCandidate(item.id);
      showToast('Đã loại ảnh khỏi hàng chờ.', 'success');
      await load({ quiet: true });
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  const providerEntries = Object.entries(stats?.providers || {});

  return (
    <main className="admin-page photo-scanner-page page-container">
      <section className="photo-scanner-hero">
        <div>
          <span className="photo-scanner-kicker"><Sparkles size={14} /> PHOTO SCANNER V1</span>
          <h1>Ảnh quét chờ duyệt</h1>
          <p>
            Dò ảnh theo tên và tọa độ địa điểm, giữ nguyên nguồn/attribution rồi đưa vào hàng chờ.
            Chỉ ảnh được staff duyệt mới xuất hiện trong gallery Hola Maps.
          </p>
        </div>
        <div className="photo-scanner-hero-stat">
          <Images size={24} />
          <strong>{stats?.status?.PENDING ?? '—'}</strong>
          <span>ảnh đang chờ</span>
        </div>
      </section>

      <section className="photo-provider-strip">
        {providerEntries.map(([key, provider]) => (
          <div className={provider.enabled ? 'photo-provider active' : 'photo-provider'} key={key}>
            <span>{SOURCE_LABELS[key] || key}</span>
            <b>{provider.enabled ? 'Đang bật' : 'Chưa bật'}</b>
            <small>{provider.mode}</small>
          </div>
        ))}
      </section>

      {user?.role === 'ADMIN' && (
        <section className="photo-scan-control">
          <div>
            <span className="photo-control-icon"><ScanSearch size={20} /></span>
            <div>
              <b>Quét ảnh cho dữ liệu địa điểm</b>
              <small>Wikimedia chạy ngay. Foursquare tự bật khi VPS có FOURSQUARE_API_KEY.</small>
            </div>
          </div>
          <select value={scope} onChange={(event) => setScope(event.target.value)}>
            <option value="MISSING_IMAGES">Chỉ địa điểm thiếu ảnh</option>
            <option value="ALL">Quét lại tất cả</option>
          </select>
          <input
            type="number"
            min="1"
            max="200"
            value={scanLimit}
            onChange={(event) => setScanLimit(event.target.value)}
            aria-label="Số địa điểm cần quét"
          />
          <button type="button" onClick={startScan} disabled={starting || Boolean(activeRun)}>
            <ScanSearch size={16} />
            {activeRun ? 'Đang quét…' : (starting ? 'Đang tạo…' : 'Bắt đầu quét')}
          </button>
        </section>
      )}

      <RunStatus run={activeRun || runs[0]} />

      <section className="photo-scanner-toolbar">
        <div className="photo-status-pills">
          {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((status) => (
            <button
              type="button"
              className={filters.status === status ? 'active' : ''}
              onClick={() => setFilters((current) => ({ ...current, status }))}
              key={status}
            >
              {status === 'ALL' ? 'Tất cả' : STATUS_LABELS[status]}
              {status !== 'ALL' && <em>{stats?.status?.[status] ?? 0}</em>}
            </button>
          ))}
        </div>
        <select
          value={filters.source}
          onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))}
        >
          <option value="ALL">Mọi nguồn</option>
          <option value="WIKIMEDIA">Wikimedia Commons</option>
          <option value="FOURSQUARE">Foursquare</option>
        </select>
        <input
          value={filters.q}
          onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
          placeholder="Tìm tên địa điểm…"
        />
        <button type="button" className="refresh" onClick={() => load()} disabled={loading}>
          <RefreshCw size={15} /> Làm mới
        </button>
      </section>

      {loading && <div className="loading-card">Đang tải ảnh quét…</div>}

      {!loading && !items.length && (
        <section className="photo-scanner-empty">
          <ImageIcon size={34} />
          <b>Chưa có ảnh phù hợp trong bộ lọc này</b>
          <span>Nếu chưa quét, Admin có thể bắt đầu với nhóm địa điểm đang thiếu ảnh.</span>
        </section>
      )}

      <section className="photo-candidate-grid">
        {items.map((item) => {
          const busy = String(busyId) === String(item.id);
          return (
            <article className="photo-candidate-card" key={item.id}>
              <div className="photo-candidate-image">
                <img src={item.previewUrl || item.remoteUrl} alt={'Ảnh đề xuất cho ' + item.placeName} loading="lazy" />
                <span className={'source source-' + item.source.toLowerCase()}>{SOURCE_LABELS[item.source] || item.source}</span>
                <em>{Math.round(Number(item.score || 0) * 100)}% phù hợp</em>
              </div>
              <div className="photo-candidate-body">
                <div className="photo-candidate-place">
                  <small>ĐỊA ĐIỂM</small>
                  <h2>{item.placeName}</h2>
                  {item.placeAddress && <p>{item.placeAddress}</p>}
                </div>

                <div className="photo-candidate-meta">
                  <span><b>Nguồn</b>{SOURCE_LABELS[item.source] || item.source}</span>
                  <span><b>Kích thước</b>{item.width && item.height ? item.width + ' × ' + item.height : 'Không rõ'}</span>
                  {item.classification && <span><b>Loại ảnh</b>{item.classification}</span>}
                  {item.authorName && <span><b>Tác giả</b>{item.authorName}</span>}
                  {item.licenseCode && <span><b>Giấy phép</b>{item.licenseCode}</span>}
                </div>

                {item.attribution && (
                  <div className="photo-attribution"><ShieldCheck size={14} /> {item.attribution}</div>
                )}

                <div className="photo-source-links">
                  {item.sourcePageUrl && (
                    <a href={item.sourcePageUrl} target="_blank" rel="noreferrer">
                      Xem nguồn <ExternalLink size={13} />
                    </a>
                  )}
                  {item.licenseUrl && (
                    <a href={item.licenseUrl} target="_blank" rel="noreferrer">
                      Giấy phép <ExternalLink size={13} />
                    </a>
                  )}
                </div>

                {item.status === 'PENDING' ? (
                  <div className="photo-candidate-actions">
                    <button type="button" className="cover" onClick={() => approve(item, true)} disabled={busy}>
                      <Check size={15} /> Ảnh đại diện
                    </button>
                    <button type="button" className="gallery" onClick={() => approve(item, false)} disabled={busy}>
                      <Images size={15} /> Thêm gallery
                    </button>
                    <button type="button" className="reject" onClick={() => reject(item)} disabled={busy}>
                      <X size={15} /> Loại
                    </button>
                  </div>
                ) : (
                  <div className={'photo-candidate-state state-' + item.status.toLowerCase()}>
                    {STATUS_LABELS[item.status] || item.status}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
