import { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Clock3, Database,
  Gauge, RefreshCw, ServerCrash, ShieldCheck
} from 'lucide-react';
import { getAdminOperationsOverview } from '../../services/api.js';
import '../../soft-launch-operations.css';

const MANUAL_GATE_LABELS = {
  OFFSITE_BACKUP_VERIFIED: 'Bản sao lưu ngoài VPS đã kiểm tra checksum',
  PRODUCTION_RESTORE_DRILL: 'Thử khôi phục DB/ảnh độc lập từ backup thật',
  REAL_MOBILE_ACCEPTANCE: 'Kiểm tra thiết bị Android và iOS thực tế',
  LEGACY_MEDIA_PRIVACY_REVIEW: 'Rà soát ảnh cũ và quyền sử dụng ảnh',
  LIVE_HTTPS_AND_NGINX: 'HTTPS, Nginx và PM2 production',
  WA005_OPERATOR_APPROVAL: 'Nghiệm thu và cấp nguồn WA-005 từ X-HUB'
};
const DATA_BLOCKER_LABELS = {
  NO_PUBLIC_PLACES: 'Không có địa điểm công khai',
  STALE_PUBLISHED_HOUSING: 'Bất động sản hết hiệu lực vẫn đang PUBLISHED',
  HOUSING_MISSING_CONTACT: 'Bất động sản thiếu thông tin liên hệ',
  HOUSING_INVALID_PRICE_AREA: 'Bất động sản thiếu giá hoặc diện tích hợp lệ',
  LEGACY_UNSTRUCTURED_HOUSING: 'Tin BĐS cũ chưa có hồ sơ cấu trúc',
  DATA_EVIDENCE_QUERY_FAILED: 'Không thể kiểm tra dữ liệu PostgreSQL',
  DATABASE_DOWN: 'PostgreSQL không sẵn sàng'
};
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

      {data?.launch && <section className="soft-launch-ops-launch"
        data-testid="launch-evidence" aria-label="Cổng nghiệm thu ra mắt công chúng">
        <div className="soft-launch-ops-launch-head">
          <div>
            <small>PUBLIC LAUNCH GATES</small>
            <h2>Kiểm tra trước khi ra mắt công chúng</h2>
            <p role="status">Chưa nghiệm thu production. API hoạt động và CI PASS
              không thay thế backup, phục hồi dữ liệu hay kiểm tra thực tế.</p>
          </div>
          <span className="soft-launch-ops-gate-status">
            {data.launch.dataGate === 'NO_BLOCKERS_DETECTED'
              ? 'Chưa thấy lỗi dữ liệu bắt buộc'
              : data.launch.dataGate === 'UNKNOWN'
                ? 'Chưa kiểm tra được dữ liệu'
                : 'Có dữ liệu cần xử lý'}
          </span>
        </div>
        {data.launch.counts && <div className="soft-launch-ops-launch-counts">
          <div><small>Địa điểm công khai</small><b>{number(data.launch.counts.publishedPlaces)}</b></div>
          <div><small>Tin BĐS còn hiệu lực</small><b>{number(data.launch.counts.activeHousing)}</b></div>
          <div><small>BĐS đã hết hiệu lực nhưng còn công khai</small><b>{number(data.launch.counts.stalePublishedHousing)}</b></div>
          <div><small>Thiếu liên hệ BĐS</small><b>{number(data.launch.counts.missingHousingContact)}</b></div>
          <div><small>BĐS cũ chưa chuẩn hóa</small><b>{number(data.launch.counts.legacyUnstructuredHousing)}</b></div>
          <div><small>BĐS thiếu giá hoặc diện tích hợp lệ</small><b>{data.launch.counts.invalidHousingPriceArea == null ? '—' : number(data.launch.counts.invalidHousingPriceArea)}</b></div>
          <div><small>Tin BĐS chưa có ảnh</small><b>{data.launch.counts.propertyMissingImages == null ? '—' : number(data.launch.counts.propertyMissingImages)}</b></div>
          <div><small>Địa điểm chưa có ảnh</small><b>{number(data.launch.counts.publishedWithoutImages)}</b></div>
        </div>}
        {Boolean(data.launch.blockers?.length) && <div className="soft-launch-ops-launch-blockers">
          <strong>Vấn đề dữ liệu cần đối chiếu:</strong>
          <ul>{data.launch.blockers.map((code) =>
            <li key={code}>{DATA_BLOCKER_LABELS[code] || 'Cần kiểm tra thêm'}</li>)}</ul>
        </div>}
        <h3>Điều kiện vận hành chưa thể xác minh qua API</h3>
        <ul className="soft-launch-ops-gates">
          {(data.launch.manualGates || []).map((gate) =>
            <li key={gate.code}>
              <span>{MANUAL_GATE_LABELS[gate.code] || 'Nghiệm thu bổ sung'}</span>
              <small>Chưa xác minh</small>
            </li>)}
        </ul>
        <p className="soft-launch-ops-note">Hướng dẫn kiểm tra:
          <code> scripts/check-p0-readiness.sh</code> và
          <code> docs/PUBLIC_LAUNCH_P0_RUNBOOK.md</code>.
          Không dùng bảng này để tự kích hoạt production.</p>
      </section>}

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
