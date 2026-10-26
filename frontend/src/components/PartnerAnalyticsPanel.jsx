import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Eye,
  Globe2,
  Navigation,
  Phone,
  RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPartnerAnalytics } from '../services/api.js';
import '../partner-analytics.css';

const METRICS = [
  { key: 'views', label: 'Lượt mở địa điểm', Icon: Eye, tone: 'views' },
  { key: 'calls', label: 'Bấm gọi điện', Icon: Phone, tone: 'calls' },
  { key: 'directions', label: 'Bấm chỉ đường', Icon: Navigation, tone: 'directions' },
  { key: 'websites', label: 'Bấm website', Icon: Globe2, tone: 'websites' }
];

function numberLabel(number) {
  return Number(number || 0).toLocaleString('vi-VN');
}

function shortDate(date) {
  const parts = String(date || '').split('-');
  return parts.length === 3 ? parts[2] + '/' + parts[1] : date;
}

function actionCount(item) {
  return (Number(item?.calls) || 0) +
    (Number(item?.directions) || 0) +
    (Number(item?.websites) || 0);
}

function chartBuckets(daily = [], days = 30) {
  if (days !== 90) {
    return daily.map((item, index) => ({
      key: item.date,
      label: (days === 7 || index % 5 === 0 || index === daily.length - 1)
        ? shortDate(item.date) : '',
      views: Number(item.views) || 0,
      actions: actionCount(item),
      range: shortDate(item.date)
    }));
  }

  const result = [];
  for (let index = 0; index < daily.length; index += 7) {
    const slice = daily.slice(index, index + 7);
    const first = slice[0];
    const last = slice[slice.length - 1];
    result.push({
      key: first.date,
      label: shortDate(first.date),
      range: shortDate(first.date) + ' – ' + shortDate(last.date),
      views: slice.reduce((sum, item) => sum + (Number(item.views) || 0), 0),
      actions: slice.reduce((sum, item) => sum + actionCount(item), 0)
    });
  }
  return result;
}

export default function PartnerAnalyticsPanel({ managedPlaces = [] }) {
  const [days, setDays] = useState(30);
  const [placeId, setPlaceId] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    getPartnerAnalytics({ days, placeId: placeId || undefined })
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((caught) => {
        if (!active) return;
        setReport(null);
        setError(caught.message || 'Không tải được thống kê.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [days, placeId, refresh]);

  const chart = useMemo(
    () => chartBuckets(report?.daily || [], days),
    [report?.daily, days]
  );
  const chartMax = Math.max(1, ...chart.map((item) => Math.max(item.views, item.actions)));
  const totals = report?.totals || {};
  const hasActivity = Number(totals.views || 0) + actionCount(totals) > 0;

  return (
    <section className="partner-analytics-panel" aria-labelledby="partner-analytics-title">
      <div className="pa-topline">
        <div>
          <span className="pa-eyebrow"><Activity size={14} /> HOLA PARTNER INSIGHTS</span>
          <h2 id="partner-analytics-title">Hiệu quả địa điểm</h2>
          <p>Đo lượt mở thông tin và các lần khách bấm liên hệ hoặc chỉ đường.</p>
        </div>
        <button
          type="button"
          className="pa-refresh"
          onClick={() => setRefresh((current) => current + 1)}
          disabled={loading}
          aria-label="Làm mới thống kê"
        >
          <RefreshCw size={17} /> Làm mới
        </button>
      </div>

      <div className="pa-toolbar">
        <label className="pa-place-picker">
          <span>Địa điểm</span>
          <select value={placeId} onChange={(event) => setPlaceId(event.target.value)}>
            <option value="">Tất cả địa điểm được quản lý</option>
            {managedPlaces.map((place) => (
              <option value={String(place.placeId)} key={place.placeId}>{place.name}</option>
            ))}
          </select>
        </label>
        <div className="pa-period-picker" role="group" aria-label="Khoảng thời gian">
          {[7, 30, 90].map((period) => (
            <button
              key={period}
              type="button"
              aria-pressed={days === period}
              className={days === period ? 'active' : ''}
              onClick={() => setDays(period)}
            >
              {period} ngày
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="pa-status" role="status">Đang tải thống kê…</p>}
      {error && <p className="pa-error" role="alert">{error}</p>}

      {report && (
        <>
          <div className="pa-stat-grid">
            {METRICS.map(({ key, label, Icon, tone }) => (
              <div className={'pa-stat-card ' + tone} key={key}>
                <span className="pa-stat-icon"><Icon size={19} /></span>
                <div>
                  <strong>{numberLabel(totals[key])}</strong>
                  <small>{label}</small>
                </div>
              </div>
            ))}
          </div>

          <div className="pa-chart-card">
            <div className="pa-chart-heading">
              <div>
                <h3>Xu hướng tương tác</h3>
                <p>{shortDate(report.fromDate)} – {shortDate(report.toDate)} · {days === 90 ? 'Gộp theo tuần' : 'Theo ngày'}</p>
              </div>
              <div className="pa-legend">
                <span><i className="views" /> Lượt mở</span>
                <span><i className="actions" /> Hành động</span>
              </div>
            </div>

            {hasActivity ? (
              <div className="pa-plot-scroll">
                <div className={'pa-plot ' + (days === 30 ? 'pa-plot--dense' : '')}>
                  {chart.map((item) => (
                    <div className="pa-plot-column" key={item.key}>
                      <div className="pa-plot-bars">
                        <span
                          className="pa-bar pa-bar--views"
                          style={{ height: item.views ? Math.max(3, item.views / chartMax * 100) + '%' : '0%' }}
                          title={item.range + ': ' + numberLabel(item.views) + ' lượt mở'}
                        />
                        <span
                          className="pa-bar pa-bar--actions"
                          style={{ height: item.actions ? Math.max(3, item.actions / chartMax * 100) + '%' : '0%' }}
                          title={item.range + ': ' + numberLabel(item.actions) + ' hành động'}
                        />
                      </div>
                      <span className="pa-plot-tick">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="pa-empty">
                <Activity size={25} />
                <strong>Chưa có tương tác được ghi nhận</strong>
                <p>Dữ liệu bắt đầu tích lũy sau khi tính năng được triển khai.</p>
              </div>
            )}

            <p className="pa-privacy-note">
              Số liệu là lượt thao tác, không phải số người dùng duy nhất hay cuộc gọi/khách hàng đã xác nhận.
              HOLA Maps không lưu danh tính người xem trong báo cáo này.
            </p>
          </div>

          {report.places?.length > 1 && (
            <div className="pa-breakdown">
              <h3>Chi tiết theo địa điểm</h3>
              <div className="pa-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Địa điểm</th>
                      <th scope="col">Lượt mở</th>
                      <th scope="col">Gọi</th>
                      <th scope="col">Chỉ đường</th>
                      <th scope="col">Website</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.places.map((place) => (
                      <tr key={place.placeId}>
                        <th scope="row">
                          <Link to={'/place/' + encodeURIComponent(place.placeId)}>
                            {place.name} <ArrowUpRight size={13} />
                          </Link>
                        </th>
                        <td>{numberLabel(place.views)}</td>
                        <td>{numberLabel(place.calls)}</td>
                        <td>{numberLabel(place.directions)}</td>
                        <td>{numberLabel(place.websites)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
