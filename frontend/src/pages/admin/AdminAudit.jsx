import { useEffect, useState } from 'react';
import {
  Activity,
  Search,
  ShieldCheck
} from 'lucide-react';
import { getAdminAuditLogs } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function AdminAudit() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [entityType, setEntityType] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await getAdminAuditLogs({
          q: q.trim() || undefined,
          entityType,
          limit: 200
        });
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [q, entityType]);

  return (
    <main className="admin-page admin-audit-page page-container">
      <section className="section-heading">
        <div>
          <span className="eyebrow">SECURITY & OPERATIONS</span>
          <h2>Nhật ký hệ thống</h2>
          <p>Theo dõi các thao tác nhạy cảm: duyệt đóng góp, chỉnh ví điểm, user, đối tác, voucher, claim và mission.</p>
        </div>
        <span className="admin-audit-badge"><ShieldCheck size={17} /> {items.length} sự kiện</span>
      </section>

      <section className="admin-audit-filters">
        <label><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm action, user, entity..." /></label>
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="ALL">Tất cả đối tượng</option>
          <option value="USER">USER</option>
          <option value="CONTRIBUTION">CONTRIBUTION</option>
          <option value="PARTNER">PARTNER</option>
          <option value="VOUCHER_CAMPAIGN">VOUCHER_CAMPAIGN</option>
          <option value="VOUCHER_REDEMPTION">VOUCHER_REDEMPTION</option>
          <option value="PLACE_CLAIM">PLACE_CLAIM</option>
          <option value="MISSION">MISSION</option>
        </select>
      </section>

      <section className="admin-audit-card">
        {loading ? <div className="loading-card">Đang tải nhật ký...</div> : !items.length ? (
          <div className="empty-state"><Activity size={24} /><b>Chưa có sự kiện phù hợp</b></div>
        ) : (
          <div className="admin-audit-list">
            {items.map((item) => (
              <article key={item.id}>
                <span className="admin-audit-icon"><Activity size={16} /></span>
                <div className="admin-audit-main">
                  <span><b>{item.action}</b><em>{item.entityType}{item.entityId ? ' #' + item.entityId : ''}</em></span>
                  <small>{item.actorName || 'System'}{item.actorEmail ? ' · ' + item.actorEmail : ''}</small>
                  {item.metadata && Object.keys(item.metadata).length > 0 && (
                    <code>{JSON.stringify(item.metadata)}</code>
                  )}
                </div>
                <div className="admin-audit-meta">
                  <b>{new Date(item.createdAt).toLocaleString('vi-VN')}</b>
                  {item.ipAddress && <small>{item.ipAddress}</small>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
