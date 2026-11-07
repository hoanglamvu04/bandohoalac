import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Globe2,
  MapPinned,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext.jsx';
import {
  getAdminLocalSeoPages,
  updateAdminLocalSeoPageStatus
} from '../../services/api.js';
import '../../local-seo-admin.css';

const STATUS_LABELS = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đã xuất bản',
  ARCHIVED: 'Đã lưu trữ'
};

function QualityMetric({ label, value, target, ready }) {
  return (
    <div className="local-seo-metric">
      <span>{label}</span>
      <b className={ready ? 'pass' : 'fail'}>{value}{target ? ' / ' + target : ''}</b>
    </div>
  );
}

export default function AdminLocalSeoPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getAdminLocalSeoPages();
      setItems(Array.isArray(result?.items) ? result.items : []);
    } catch (requestError) {
      setError(requestError.message || 'Không thể tải danh sách Local SEO.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(item, status) {
    if (busyId) return;
    if (status === 'PUBLISHED' && !window.confirm(
      'Xác nhận đã rà soát nội dung và dữ liệu thực tế trước khi xuất bản trang này?'
    )) return;

    setBusyId(String(item.id));
    try {
      const result = await updateAdminLocalSeoPageStatus(item.id, status);
      setItems((current) => current.map((entry) =>
        String(entry.id) === String(item.id) ? result.item : entry
      ));
      showToast(
        status === 'PUBLISHED'
          ? 'Đã xuất bản landing page Local SEO.'
          : status === 'DRAFT'
            ? 'Đã chuyển trang về bản nháp.'
            : 'Đã lưu trữ landing page.',
        'success'
      );
    } catch (requestError) {
      const blockers = requestError.details?.blockers;
      showToast(
        blockers?.length
          ? requestError.message + ' ' + blockers.join(' ')
          : requestError.message || 'Không thể cập nhật trạng thái.',
        'error'
      );
      await load();
    } finally {
      setBusyId('');
    }
  }

  const readyCount = items.filter((item) => item.canPublish).length;
  const publishedCount = items.filter((item) => item.status === 'PUBLISHED').length;

  return (
    <main className="admin-page local-seo-admin page-container">
      <header className="local-seo-admin-hero">
        <div>
          <span><Globe2 size={15} /> HOLA MAPS · LOCAL SEO</span>
          <h1>SEO theo khu vực và danh mục</h1>
          <p>Chỉ xuất bản landing page khi địa điểm thật, ảnh, tọa độ, xác minh và nội dung đều đạt ngưỡng chất lượng.</p>
        </div>
        <button type="button" onClick={load} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Làm mới
        </button>
      </header>

      <section className="local-seo-admin-overview">
        <article><small>Tổng landing page</small><b>{items.length}</b></article>
        <article><small>Đạt điều kiện xuất bản</small><b>{readyCount}</b></article>
        <article><small>Đang xuất bản</small><b>{publishedCount}</b></article>
      </section>

      <div className="local-seo-admin-policy">
        <ShieldCheck size={18} />
        <p><b>Quality Gate đang bật.</b> Trang không đạt điều kiện sẽ không được trả HTML indexable và không xuất hiện trong sitemap, kể cả khi trạng thái trước đó là Published.</p>
      </div>

      {error && <div className="local-seo-admin-error"><AlertTriangle size={17} /> {error}</div>}
      {loading ? (
        <div className="local-seo-admin-empty">Đang kiểm tra dữ liệu địa điểm và điều kiện SEO...</div>
      ) : !items.length ? (
        <div className="local-seo-admin-empty">Chưa có landing page nào được cấu hình.</div>
      ) : (
        <section className="local-seo-admin-list">
          {items.map((item) => {
            const quality = item.quality || {};
            const busy = busyId === String(item.id);
            return (
              <article className="local-seo-admin-card" key={item.id}>
                <div className="local-seo-admin-card-head">
                  <div>
                    <span className="local-seo-admin-area">{item.areaName} · {item.categorySlug || 'Dịch vụ quanh campus'}</span>
                    <h2>{item.title}</h2>
                    <code>/khu-vuc/{item.slug}</code>
                  </div>
                  <span className={'local-seo-status ' + String(item.status).toLowerCase()}>
                    {STATUS_LABELS[item.status] || item.status}
                  </span>
                </div>

                <div className="local-seo-admin-metrics">
                  <QualityMetric label="Địa điểm" value={quality.placeCount || 0} target={item.minPlaceCount} ready={(quality.placeCount || 0) >= item.minPlaceCount} />
                  <QualityMetric label="Có ảnh" value={quality.photoPlaceCount || 0} target={item.minPhotoPlaces} ready={(quality.photoPlaceCount || 0) >= item.minPhotoPlaces} />
                  <QualityMetric label="Xác minh mới" value={quality.recentVerifiedCount || 0} target={item.minRecentVerified} ready={(quality.recentVerifiedCount || 0) >= item.minRecentVerified} />
                  <QualityMetric label="Nội dung" value={quality.wordCount || 0} target={item.minWordCount + ' từ'} ready={(quality.wordCount || 0) >= item.minWordCount} />
                  <QualityMetric label="Phần nội dung" value={quality.sectionCount || 0} target={item.minSections} ready={(quality.sectionCount || 0) >= item.minSections} />
                  <QualityMetric label="Tọa độ hợp lệ" value={quality.coordinateCount || 0} target={quality.placeCount || 0} ready={(quality.coordinateCount || 0) === (quality.placeCount || 0)} />
                  <QualityMetric label="Địa chỉ" value={quality.addressCount || 0} target={quality.placeCount || 0} ready={(quality.addressCount || 0) === (quality.placeCount || 0)} />
                </div>

                <div className="local-seo-admin-map-status">
                  <MapPinned size={15} />
                  {item.mapSupported ? 'Đã nằm trong phạm vi bản đồ tương tác HOLA MAP.' : 'Ngoài phạm vi bản đồ hiện tại — chưa được phép xuất bản.'}
                </div>

                {quality.blockers?.length ? (
                  <ul className="local-seo-admin-blockers">
                    {quality.blockers.map((blocker) => <li key={blocker}><AlertTriangle size={13} /> {blocker}</li>)}
                  </ul>
                ) : (
                  <div className="local-seo-admin-ready"><CheckCircle2 size={15} /> Đạt các điều kiện dữ liệu và nội dung. Chờ phê duyệt biên tập để xuất bản.</div>
                )}

                <footer className="local-seo-admin-actions">
                  {item.status === 'PUBLISHED' && quality.ready ? (
                    <Link to={'/khu-vuc/' + encodeURIComponent(item.slug)} target="_blank" rel="noreferrer">
                      Xem trang công khai <ExternalLink size={14} />
                    </Link>
                  ) : <span />}
                  {item.status === 'PUBLISHED' ? (
                    <button type="button" className="secondary" disabled={busy} onClick={() => changeStatus(item, 'DRAFT')}>
                      {busy ? 'Đang cập nhật...' : 'Gỡ xuất bản'}
                    </button>
                  ) : (
                    <button type="button" disabled={busy || !item.canPublish} onClick={() => changeStatus(item, 'PUBLISHED')}>
                      {busy ? 'Đang xuất bản...' : 'Phê duyệt & xuất bản'}
                    </button>
                  )}
                  {item.status !== 'ARCHIVED' && item.status !== 'PUBLISHED' && (
                    <button type="button" className="quiet" disabled={busy} onClick={() => changeStatus(item, 'ARCHIVED')}>Lưu trữ</button>
                  )}
                  {item.status === 'ARCHIVED' && (
                    <button type="button" className="quiet" disabled={busy} onClick={() => changeStatus(item, 'DRAFT')}>Khôi phục bản nháp</button>
                  )}
                </footer>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
