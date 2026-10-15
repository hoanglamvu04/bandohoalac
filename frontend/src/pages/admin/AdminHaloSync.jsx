import { useEffect, useState } from 'react';
import { Activity, ExternalLink, Image, Link2, MapPin, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { getHaloSyncMonitor } from '../../services/haloSyncAdminApi.js';
import { useToast } from '../../context/ToastContext.jsx';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN');
}

export default function AdminHaloSync() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setData(await getHaloSyncMonitor(60));
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const summary = data?.summary || {};
  const recent = data?.recent || [];

  return (
    <main className="admin-page page-container halo-sync-page">
      <section className="halo-sync-hero">
        <div>
          <span className="eyebrow">HALO HOLA INTEGRATION</span>
          <h1>Sync Monitor</h1>
          <p>Theo dõi bài đã công bố, pin riêng, canonical place và các lần cập nhật/xóa gần nhất từ HALO HOLA.</p>
        </div>
        <button type="button" onClick={load} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={16} /> Làm mới</button>
      </section>

      <section className="halo-sync-kpis">
        <article><ShieldCheck /><span><small>Đang public</small><b>{summary.publishedPosts ?? '—'}</b></span></article>
        <article><Trash2 /><span><small>Đã gỡ</small><b>{summary.deletedPosts ?? '—'}</b></span></article>
        <article><MapPin /><span><small>Spot hoạt động</small><b>{summary.activeSpots ?? '—'}</b></span></article>
        <article><Image /><span><small>Media public</small><b>{summary.activeMedia ?? '—'}</b></span></article>
        <article><Link2 /><span><small>Gắn canonical</small><b>{summary.canonicalPosts ?? '—'}</b></span></article>
        <article><Activity /><span><small>Pin HALO riêng</small><b>{summary.pinPosts ?? '—'}</b></span></article>
      </section>

      <section className="halo-sync-health">
        <div><small>SYNC GẦN NHẤT</small><b>{formatDate(summary.lastSyncAt)}</b></div>
        <div><small>PUBLIC GẦN NHẤT</small><b>{formatDate(summary.lastPublishedAt)}</b></div>
        <div><small>PIN TẠM ĐÃ ẨN</small><b>{summary.hiddenTempSpots ?? 0}</b></div>
      </section>

      <section className="halo-sync-table-card">
        <div className="halo-sync-table-head">
          <div><span className="eyebrow">RECENT SYNC</span><h2>Dữ liệu HALO HOLA gần đây</h2></div>
          <small>{recent.length} bản ghi</small>
        </div>
        <div className="halo-sync-table-wrap">
          <table className="halo-sync-table">
            <thead><tr><th>Bài</th><th>Trạng thái</th><th>Điểm</th><th>Media</th><th>Đồng bộ</th><th /></tr></thead>
            <tbody>
              {recent.map((item) => (
                <tr key={item.id}>
                  <td><b>{item.title || item.code || item.postId}</b><small>{item.author || item.postId}</small></td>
                  <td><span className={'halo-sync-status ' + String(item.status || '').toLowerCase()}>{item.status}</span></td>
                  <td><b>{item.spot?.label || '—'}</b><small>{item.spot?.placeId ? `Canonical #${item.spot.placeId}` : item.spot?.externalSpotId || 'Pin HALO'}</small></td>
                  <td>{item.mediaCount}</td>
                  <td><b>{formatDate(item.syncedAt)}</b><small>{item.code || ''}</small></td>
                  <td>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" aria-label="Mở bài HALO"><ExternalLink size={15} /></a> : null}</td>
                </tr>
              ))}
              {!loading && recent.length === 0 && <tr><td colSpan="6" className="halo-sync-empty">Chưa có dữ liệu đồng bộ HALO HOLA.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
