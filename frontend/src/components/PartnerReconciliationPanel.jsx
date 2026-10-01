import { useEffect, useState } from 'react';
import {
  Banknote,
  CircleDollarSign,
  RefreshCw,
  TicketCheck,
  UserRound
} from 'lucide-react';
import { getPartnerReconciliation } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN');
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('vi-VN') + 'đ';
}

const PERIODS = [
  ['today', 'Hôm nay'],
  ['7d', '7 ngày'],
  ['30d', '30 ngày']
];

function settlementLabel(status) {
  if (status === 'PAID') return 'Đã thanh toán';
  if (status === 'PROCESSING') return 'Đang đối soát';
  return 'Chờ thanh toán';
}

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
          <span className="eyebrow">ĐỐI SOÁT HỢP TÁC</span>
          <h2>Voucher Hola Map tài trợ</h2>
          <p>Mỗi voucher được nhân viên xác nhận sẽ trở thành khoản Hola Map cần thanh toán cho đối tác.</p>
        </div>

        <div className="partner-reconciliation-actions">
          {data.partners?.length > 1 && (
            <select value={partnerId} onChange={(event) => setPartnerId(event.target.value)}>
              <option value="">Tất cả đối tác</option>
              {data.partners.map((partner) => (
                <option key={partner.partnerId} value={partner.partnerId}>{partner.partnerName}</option>
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

      <div className="partner-reconciliation-summary finance-summary">
        <article>
          <span><TicketCheck size={18} /></span>
          <div><b>{data.summary?.vouchersUsed || 0}</b><small>Voucher đã xác nhận</small></div>
        </article>
        <article>
          <span><CircleDollarSign size={18} /></span>
          <div><b>{formatMoney(data.summary?.totalPayable)}</b><small>Tổng giá trị đã giảm</small></div>
        </article>
        <article className="unpaid">
          <span><Banknote size={18} /></span>
          <div><b>{formatMoney(data.summary?.unpaidAmount)}</b><small>Hola Map còn phải trả</small></div>
        </article>
        <article className="paid">
          <span><Banknote size={18} /></span>
          <div><b>{formatMoney(data.summary?.paidAmount)}</b><small>Đã thanh toán</small></div>
        </article>
      </div>

      <div className="partner-reconciliation-grid">
        <section>
          <header><UserRound size={16} /><b>Theo nhân viên xác nhận</b></header>
          {!data.byStaff?.length ? (
            <div className="partner-reconcile-empty">Chưa có giao dịch trong khoảng này.</div>
          ) : (
            <div className="partner-staff-performance">
              {data.byStaff.map((item) => (
                <article key={item.userId || item.userName}>
                  <span className="partner-staff-performance-avatar">{(item.userName || '?').slice(0, 1).toUpperCase()}</span>
                  <div>
                    <b>{item.userName}</b>
                    <small>{item.vouchersUsed} voucher · {item.lastUsedAt ? formatDateTime(item.lastUsedAt) : ''}</small>
                  </div>
                  <strong>{formatMoney(item.amountTotal)}</strong>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <header><CircleDollarSign size={16} /><b>Theo chiến dịch</b></header>
          {!data.byCampaign?.length ? (
            <div className="partner-reconcile-empty">Chưa có voucher được sử dụng.</div>
          ) : (
            <div className="partner-campaign-performance">
              {data.byCampaign.map((item) => (
                <article key={item.campaignId}>
                  <div>
                    <b>{item.title}</b>
                    <small>{item.vouchersUsed} voucher · còn chờ {formatMoney(item.unpaidAmount)}</small>
                  </div>
                  <strong>{formatMoney(item.amountTotal)}</strong>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="partner-settlement-history">
        <header><Banknote size={16} /><b>Giao dịch gần đây</b></header>
        {!data.recentTransactions?.length ? (
          <div className="partner-reconcile-empty">Chưa có giao dịch để đối soát.</div>
        ) : (
          <div className="partner-settlement-list">
            {data.recentTransactions.slice(0, 20).map((item) => (
              <article key={item.id}>
                <div>
                  <small>{item.partnerName} · {item.campaignTitle}</small>
                  <b>{item.code}</b>
                  <span>{item.customerName}{item.cashierName ? ' · NV: ' + item.cashierName : ''}</span>
                </div>
                <div>
                  <strong>{formatMoney(item.amount)}</strong>
                  <small>{formatDateTime(item.usedAt)}</small>
                </div>
                <span className={'partner-settlement-status ' + String(item.settlementStatus || 'UNPAID').toLowerCase()}>
                  {settlementLabel(item.settlementStatus)}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
