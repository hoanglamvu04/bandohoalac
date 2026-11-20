import { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Clock3, Database,
  Gauge, RefreshCw, ServerCrash, ShieldCheck
} from 'lucide-react';
import { getAdminOperationsOverview } from '../../services/api.js';
import '../../soft-launch-operations.css';

const GROUP_NAMES = {
  auth: 'Đăng nhập / phiên',
  places: 'Địa điểm',
  housing: 'Bất động sản',
  layers: 'Lớp bản đồ',
  directions: 'Chỉ đường',
  contributions: 'Đóng góp',
  public_api: 'API tích hợp',
  notifications: 'Thông báo',
  admin: 'Quản trị',
  other: 'API khác'
};

function number(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function duration(value) {
  return value === null || value === undefined ? '—' : number(value) + ' ms';
}

function statusLabel(status) {
  if (status === 'DEGRADED') return 'Cần xử lý ngay';
  if (status === 'ATTENTION') return 'Cần theo dõi';
  return 'Không phát hiện cảnh báo';
}

export default function AdminOperations() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setBusy(true);
    try {
      const result = await getAdminOperationsOverview();
      setData(result);
      setError('');
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu vận hành.');
    } finally {
      if (!silent) setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [load]);

  const summary = data?.metrics?.total;
  const databaseOk = Boolean(data?.database?.ok);
  const totalCount = summary?.requests || 0;
  const status = data?.status || 'UNKNOWN';

  return (
    <main className="admin-page page-container soft-launch-ops">
      <section className="soft-launch-ops-hero">
        <div>
          <span className="eyebrow"><Activity size={14} /> SOFT LAUNCH · OPERATIONS</span>
          <h1>Giám sát vận hành</h1>
          <p>Quan sát API, PostgreSQL và các dấu hiệu bất thường khi HOLA Maps
            mở thử nghiệm cho người dùng thực tế.</p>
        </div>
        <button type="button" onClick={() => load()} disabled={busy}>
          <RefreshCw size={16} className={busy ? 'spin' : ''} />
          {busy ? 'Đang kiểm tra...' : 'Làm mới'}
        </button>
      </section>

      {error && <p role="alert" className="soft-launch-ops-error">{error} Dữ liệu bên dưới có thể đã cũ.</p>}

      <section className={'soft-launch-ops-health ' + status.toLowerCase()} aria-live="polite">
        {status === 'DEGRADED'
          ? <ServerCrash size={22} />
          : status === 'ATTENTION'
            ? <AlertTriangle size={22} />
            : <CheckCircle2 size={22} />}
        <div>
          <small>TRẠNG THÁI THEO DÕI</small>
          <strong>{data ? statusLabel(status) : busy ? 'Đang kết nối…' : 'Chưa có dữ liệu'}</strong>
          <span>{data?.checkedAt
            ? 'Cập nhật ' + new Date(data.checkedAt).toLocaleString('vi-VN')
            : 'Dữ liệu được lấy trực tiếp từ API'}</span>
        </div>
        <div className="soft-launch-ops-health-db">
          <Database size={18} />
          {data ? databaseOk ? 'PostgreSQL kết nối tốt' : 'PostgreSQL không sẵn sàng' : 'Đang kiểm tra DB'}
          {data?.database?.latencyMs !== undefined &&
            <small> · {duration(data.database.latencyMs)}</small>}
        </div>
      </section>

      <section className="soft-launch-ops-stats" aria-label="Thống kê API trong 15 phút">
        <article><Activity /><small>Request / {data?.metrics?.windowMinutes || 15} phút</small><strong>{data ? number(totalCount) : '—'}</strong></article>
        <article><Gauge /><small>Độ trễ API P95</small><strong>{duration(summary?.p95Ms)}</strong></article>
        <article><ServerCrash /><small>Lỗi HTTP 5xx</small><strong>{data ? number(summary?.serverErrors) : '—'}</strong></article>
        <article><AlertTriangle /><small>Rate limit HTTP 429</small><strong>{data ? number(summary?.rateLimited) : '—'}</strong></article>
        <article><Clock3 /><small>Uptime tiến trình</small><strong>{data ? Math.floor((data.uptimeSeconds || 0) / 60).toLocaleString('vi-VN') + ' phút' : '—'}</strong></article>
        <article><ShieldCheck /><small>Bộ nhớ heap API</small><strong>{data ? number(data.heapUsedMb) + ' MB' : '—'}</strong></article>
      </section>

      {totalCount < 25 && data && (
        <p className="soft-launch-ops-note">
          Mới có {number(totalCount)} request trong khung theo dõi. Dữ liệu còn ít,
          chưa đủ cơ sở để kết luận tốc độ hoặc tỷ lệ lỗi ổn định.
        </p>
      )}

      {Boolean(data?.warnings?.length) && (
        <section className="soft-launch-ops-warnings">
          <h2>Cảnh báo cần chú ý</h2>
          {data.warnings.map((item) => (
            <p key={item.code} className={item.severity}><AlertTriangle size={16} /> {item.message}</p>
          ))}
        </section>
      )}

      <section className="soft-launch-ops-table">
        <div className="soft-launch-ops-table-head">
          <div><span className="eyebrow">API HEALTH</span><h2>Chi tiết theo nhóm dịch vụ</h2></div>
          <small>Không hiển thị IP, truy vấn URL, ID người dùng hay payload</small>
        </div>
        <div className="soft-launch-ops-scroll">
          <table>
            <thead><tr><th>Nhóm API</th><th>Request</th><th>P95</th><th>Lỗi 5xx</th><th>HTTP 429</th></tr></thead>
            <tbody>
              {(data?.metrics?.groups || []).map((item) => (
                <tr key={item.group}>
                  <td><b>{GROUP_NAMES[item.group] || 'API khác'}</b></td>
                  <td>{number(item.requests)}</td>
                  <td>{duration(item.p95Ms)}</td>
                  <td className={item.serverErrors ? 'metric-alert' : ''}>{number(item.serverErrors)}</td>
                  <td>{number(item.rateLimited)}</td>
                </tr>
              ))}
              {!data?.metrics?.groups?.length && (
                <tr><td colSpan={5} className="soft-launch-ops-empty">
                  {busy ? 'Đang tải...' : 'Chưa ghi nhận request trong khung 15 phút.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="soft-launch-ops-disclaimer">
        Số liệu chỉ nằm trong bộ nhớ một tiến trình PM2 và mất khi khởi động lại.
        Đây là công cụ theo dõi API, không thay thế sao lưu/khôi phục, kiểm tra
        Nginx hay đo tốc độ trên điện thoại thật.
      </p>
    </main>
  );
}
