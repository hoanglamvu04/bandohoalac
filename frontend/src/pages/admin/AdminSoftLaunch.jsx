import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, ClipboardList, Gauge,
  RefreshCw, Smartphone, ShieldCheck
} from 'lucide-react';
import {
  getAdminSoftLaunchFeedback, getAdminSoftLaunchVitals,
  reviewAdminSoftLaunchFeedback
} from '../../services/api.js';
import '../../soft-launch-feedback.css';

const STATUS_NAMES = {
  NEW: 'Chưa xử lý', IN_REVIEW: 'Đang xem xét',
  RESOLVED: 'Đã giải quyết', DISMISSED: 'Không hợp lệ'
};
const CATEGORY_NAMES = {
  BUG: 'Lỗi chức năng', DATA: 'Dữ liệu', UX: 'Giao diện', SUGGESTION: 'Đề xuất'
};
const AREA_NAMES = {
  MAP: 'Bản đồ', PLACE: 'Địa điểm', HOUSING: 'Nhà đất',
  SEARCH: 'Tìm kiếm', ACCOUNT: 'Tài khoản', OTHER: 'Khác'
};
const METRIC_NAMES = { LCP: 'Tải nội dung chính', INP: 'Phản hồi thao tác',
  CLS: 'Độ ổn định bố cục', MAP_READY: 'Bản đồ hiện sẵn sàng' };

export default function AdminSoftLaunch() {
  const [tab, setTab] = useState('feedback');
  const [status, setStatus] = useState('NEW');
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState(null);
  const [vitals, setVitals] = useState(null);
  const [selectedNetwork, setSelectedNetwork] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (tab === 'feedback') {
        const result = await getAdminSoftLaunchFeedback({
          status: status === 'ALL' ? undefined : status, page, limit: 20
        });
        setFeedback(result);
      } else {
        setVitals(await getAdminSoftLaunchVitals());
      }
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, [tab, status, page]);

  useEffect(() => { load(); }, [load]);

  async function save(item) {
    const draft = drafts[item.id] || {};
    setSavingId(item.id); setError('');
    try {
      await reviewAdminSoftLaunchFeedback(item.id, {
        status: draft.status || item.status,
        note: draft.note !== undefined ? draft.note : item.note || ''
      });
      await load();
    } catch (err) {
      setError(err.message || 'Không thể cập nhật phản hồi.');
    } finally {
      setSavingId(null);
    }
  }

  const visibleVitals = useMemo(() => (vitals?.groups || [])
    .filter((item) => selectedNetwork === 'ALL' || item.network === selectedNetwork)
    .sort((a, b) => b.samples - a.samples), [vitals, selectedNetwork]);

  return (
    <main className="admin-page page-container soft-launch-admin">
      <header className="soft-launch-admin-header">
        <div>
          <span className="soft-feedback-eyebrow"><Activity size={15}/> HOLA MAPS · SOFT LAUNCH V1</span>
          <h1>Phản hồi & hiệu năng</h1>
          <p>Tiếp nhận lỗi từ người thử nghiệm và xem chất lượng tải trang theo
            nhóm thiết bị, loại mạng. Chỉ Admin được xem dữ liệu phản hồi.</p>
        </div>
        <button className="soft-launch-admin-reload" type="button" onClick={load} disabled={loading}>
          <RefreshCw size={16}/> {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </header>
      <div className="soft-launch-admin-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'feedback'}
          className={tab === 'feedback' ? 'active' : ''}
          onClick={() => setTab('feedback')}><ClipboardList size={17}/> Phản hồi người dùng</button>
        <button type="button" role="tab" aria-selected={tab === 'vitals'}
          className={tab === 'vitals' ? 'active' : ''}
          onClick={() => setTab('vitals')}><Gauge size={17}/> Hiệu năng thực tế</button>
      </div>
      {error && <div className="soft-feedback-error" role="alert">{error}</div>}

      {tab === 'feedback' ? (
        <section className="soft-launch-admin-section">
          <div className="soft-launch-admin-section-head">
            <div><h2>Hàng đợi phản hồi</h2><small>{feedback?.total ?? '—'} phản hồi phù hợp bộ lọc</small></div>
            <select aria-label="Lọc trạng thái phản hồi" value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="NEW">Chưa xử lý</option>
              <option value="IN_REVIEW">Đang xem xét</option>
              <option value="RESOLVED">Đã giải quyết</option>
              <option value="DISMISSED">Không hợp lệ</option>
              <option value="ALL">Tất cả</option>
            </select>
          </div>
          <div className="soft-launch-feedback-items">
            {(feedback?.items || []).map((item) => {
              const draft = drafts[item.id] || {};
              return (
                <article className="soft-launch-feedback-item" key={item.id}>
                  <div className="soft-launch-feedback-item-head">
                    <div>
                      <span className="soft-feedback-tag">{CATEGORY_NAMES[item.category] || item.category}</span>
                      <span className="soft-feedback-tag outline">{AREA_NAMES[item.area] || item.area}</span>
                      <b>{STATUS_NAMES[item.status] || item.status}</b>
                    </div>
                    <small>{new Date(item.createdAt).toLocaleString('vi-VN')}</small>
                  </div>
                  <p>{item.message}</p>
                  <small className="soft-launch-feedback-reference">Mã: {item.reference}</small>
                  <div className="soft-launch-feedback-review">
                    <label>
                      Trạng thái
                      <select aria-label={'Trạng thái phản hồi ' + item.id}
                        value={draft.status || item.status}
                        onChange={(e) => setDrafts((prev) => ({
                          ...prev, [item.id]: { ...prev[item.id], status: e.target.value }
                        }))}>
                        {Object.entries(STATUS_NAMES).map(([code, label]) =>
                          <option key={code} value={code}>{label}</option>)}
                      </select>
                    </label>
                    <label className="soft-launch-feedback-note">
                      Ghi chú nội bộ (chỉ Admin)
                      <textarea rows={2} maxLength={1000}
                        aria-label={'Ghi chú phản hồi ' + item.id}
                        value={draft.note === undefined ? item.note || '' : draft.note}
                        onChange={(e) => setDrafts((prev) => ({
                          ...prev, [item.id]: { ...prev[item.id], note: e.target.value }
                        }))}/>
                    </label>
                    <button type="button" disabled={savingId === item.id}
                      onClick={() => save(item)}><CheckCircle2 size={15}/>
                      {savingId === item.id ? 'Đang lưu...' : 'Lưu xử lý'}
                    </button>
                  </div>
                </article>
              );
            })}
            {!loading && !feedback?.items?.length &&
              <div className="soft-launch-feedback-empty">Chưa có phản hồi ở trạng thái này.</div>}
          </div>
          <div className="soft-launch-feedback-pages">
            <button type="button" disabled={page === 1 || loading}
              onClick={() => setPage((p) => p - 1)}>Trang trước</button>
            <span>Trang {page} / {Math.max(1, Math.ceil((feedback?.total || 0) / 20))}</span>
            <button type="button" disabled={loading || page * 20 >= (feedback?.total || 0)}
              onClick={() => setPage((p) => p + 1)}>Trang tiếp</button>
          </div>
        </section>
      ) : (
        <section className="soft-launch-admin-section">
          <div className="soft-launch-admin-section-head">
            <div>
              <h2><Smartphone size={19}/> Dữ liệu trình duyệt · 24 giờ</h2>
              <small>Phân loại tốt / cần cải thiện / kém theo ngưỡng từng chỉ số.</small>
            </div>
            <select aria-label="Lọc loại mạng" value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(e.target.value)}>
              <option value="ALL">Tất cả mạng</option>
              <option value="4g">4G</option>
              <option value="3g">3G</option>
              <option value="2g">2G</option>
              <option value="slow-2g">2G chậm</option>
              <option value="unknown">Không xác định</option>
            </select>
          </div>
          <p className="soft-launch-metrics-note"><ShieldCheck size={16}/>
            Chỉ lưu tổng số mẫu theo giờ và nhóm trang, không lưu ID, IP, URL,
            cookie hoặc nội dung người dùng. INP và CLS là ước lượng từ PerformanceObserver;
            trình duyệt không hỗ trợ sẽ không có mẫu. Không suy ra kết quả cho toàn bộ người dùng.
          </p>
          <div className="soft-launch-vitals-list">
            {visibleVitals.map((item) => (
              <article key={[item.metric, item.routeGroup, item.device, item.network].join('-')}
                className="soft-launch-vital-row">
                <div>
                  <b>{METRIC_NAMES[item.metric] || item.metric}</b>
                  <small>{item.metric} · {item.routeGroup} · {item.device === 'MOBILE' ? 'Di động' : 'Máy tính'} · {item.network}</small>
                </div>
                <div className="soft-launch-vital-track" aria-label={'Tỷ lệ tốt ' + item.goodPct + ' phần trăm'}>
                  <span style={{ width: item.goodPct + '%' }}/>
                </div>
                <strong>{item.goodPct}% tốt{item.samples < 20 ? ' · mẫu ít' : ''}</strong>
                <small>{item.samples.toLocaleString('vi-VN')} mẫu</small>
              </article>
            ))}
            {!loading && !visibleVitals.length &&
              <div className="soft-launch-feedback-empty">
                Chưa có mẫu hiệu năng cho bộ lọc này. Cần lượt truy cập production thật mới có dữ liệu.
              </div>}
          </div>
          <p className="soft-launch-metrics-note"><AlertTriangle size={16}/>
            Mẫu nhỏ, kết nối mạng do trình duyệt tự báo và số liệu gần đúng không thay thế
            đo thử 4G trên điện thoại thực tế.</p>
        </section>
      )}
    </main>
  );
}
