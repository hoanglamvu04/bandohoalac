import { useEffect, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  Clock3,
  RefreshCw,
  TicketCheck,
  UserRound,
  Users
} from 'lucide-react';
import { getPartnerReconciliation } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN');
}

const PERIODS = [
  ['today', 'Hôm nay'],
  ['7d', '7 ngày'],
  ['30d', '30 ngày']
];

export default function PartnerReconciliationPanel() {
  const { showToast } = useToast();
  const [period, setPeriod] = useState('today');
  const [partnerId, setPartnerId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load(nextPeriod = period, nextPartnerId = partnerId) {
    setLoading(true);
    try {
      const result = await getPartnerReconciliation({
        period: nextPeriod,
        partnerId: nextPartnerId || undefined
      });
      setData(result);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(period, partnerId);
  }, [period, partnerId]);

  if (loading && !data) {
    return <section className="partner-reconciliation-card"><div className="loading-card">Đang tải đối soát...</div></section>;
  }

  if (!data?.hasOwnerAccess) return null;

  return (
    <section className="partner-reconciliation-card">
      <header className="partner-reconciliation-head">
        <div>
          <span className="eyebrow">ĐỐI SOÁT VẬN HÀNH</span>
          <h2>Voucher theo ca & nhân viên</h2>
          <p>Theo dõi số voucher đã xử lý, ca làm và hiệu suất theo STAFF.</p>
        </div>

        <div className="partner-reconciliation-actions">
          {data.partners?.length > 1 && (
            <select value={partnerId} onChange={(event) => setPartnerId(event.target.value)}>
              <option value="">Tất cả đối tác</option>
              {data.partners.map((partner) => (
                <option key={partner.partnerId} value={partner.partnerId}>
                  {partner.partnerName}
                </option>
              ))}
            </select>
          )}

          <div className="partner-period-tabs">
            {PERIODS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={period === value ? 'active' : ''}
                onClick={() => setPeriod(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <button className="partner-reconcile-refresh" type="button" onClick={() => load()}>
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      <div className="partner-reconciliation-summary">
        <article>
          <span><TicketCheck size={18} /></span>
          <div><b>{data.summary?.vouchersUsed || 0}</b><small>Voucher đã dùng</small></div>
        </article>
        <article>
          <span><Users size={18} /></span>
          <div><b>{data.summary?.staffCount || 0}</b><small>Nhân viên xử lý</small></div>
        </article>
        <article>
          <span><Clock3 size={18} /></span>
          <div><b>{data.summary?.shiftsCount || 0}</b><small>Ca có giao dịch</small></div>
        </article>
      </div>

      <div className="partner-reconciliation-grid">
        <section>
          <header><UserRound size={16} /><b>Theo nhân viên</b></header>
          {!data.byStaff?.length ? (
            <div className="partner-reconcile-empty">Chưa có dữ liệu trong khoảng này.</div>
          ) : (
            <div className="partner-staff-performance">
              {data.byStaff.map((item) => (
                <article key={item.userId || item.userName}>
                  <span className="partner-staff-performance-avatar">
                    {(item.userName || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <b>{item.userName}</b>
                    <small>
                      {item.firstUsedAt ? formatDateTime(item.firstUsedAt) : ''}
                      {item.lastUsedAt ? ' → ' + formatDateTime(item.lastUsedAt) : ''}
                    </small>
                  </div>
                  <strong>{item.vouchersUsed}</strong>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <header><BarChart3 size={16} /><b>Theo chiến dịch</b></header>
          {!data.byCampaign?.length ? (
            <div className="partner-reconcile-empty">Chưa có voucher được sử dụng.</div>
          ) : (
            <div className="partner-campaign-performance">
              {data.byCampaign.map((item) => (
                <article key={item.campaignId}>
                  <div>
                    <b>{item.voucherValueText || item.title}</b>
                    <small>{item.title}</small>
                  </div>
                  <strong>{item.vouchersUsed}</strong>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="partner-shift-history">
        <header><CalendarDays size={16} /><b>Lịch sử ca làm</b></header>
        {!data.shifts?.length ? (
          <div className="partner-reconcile-empty">Chưa có ca làm trong khoảng này.</div>
        ) : (
          <div className="partner-shift-history-list">
            {data.shifts.slice(0, 12).map((item) => (
              <article key={item.id}>
                <span className={item.status === 'OPEN' ? 'open' : 'closed'}>{item.status}</span>
                <div>
                  <b>{item.userName}</b>
                  <small>{item.partnerName}</small>
                </div>
                <div>
                  <small>Bắt đầu</small>
                  <b>{formatDateTime(item.startedAt)}</b>
                </div>
                <div>
                  <small>Kết thúc</small>
                  <b>{item.endedAt ? formatDateTime(item.endedAt) : 'Đang trực'}</b>
                </div>
                <strong>{item.vouchersUsed} voucher</strong>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
