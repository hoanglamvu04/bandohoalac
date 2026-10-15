import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ImageOff, MapPinned, ScanSearch, ShieldCheck } from 'lucide-react';
import AdminDataTrust from './AdminDataTrust.jsx';
import { getDataQuality } from '../../services/dataTrustApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import '../../data-quality-v3.css';

export default function AdminDataQualityV3() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    getDataQuality(300)
      .then((result) => active && setData(result))
      .catch((error) => active && showToast(error.message, 'error'));
    return () => { active = false; };
  }, []);

  const areas = useMemo(() => data?.coverage?.areas || [], [data]);
  const summary = data?.summary || {};

  return (
    <>
      <section className="dqv3-shell page-container" aria-label="Data Quality V3 overview">
        <div className="dqv3-head">
          <div>
            <span>DATA QUALITY V3</span>
            <h1>Coverage & chống dữ liệu trùng</h1>
            <p>Theo dõi độ phủ theo khu vực, tọa độ thiếu, POI ngoài vùng phục vụ và các địa điểm có khả năng bị nhập trùng trước khi chúng lan ra public map.</p>
          </div>
          <div className="dqv3-score"><ShieldCheck size={20} /><b>{summary.averageScore ?? '—'}</b><small>/100</small></div>
        </div>

        <div className="dqv3-kpis">
          <article><MapPinned /><span><small>Public place</small><b>{summary.totalPublished ?? '—'}</b></span></article>
          <article className={summary.possibleDuplicates ? 'warn' : ''}><ScanSearch /><span><small>Có thể trùng</small><b>{summary.possibleDuplicates ?? 0}</b></span></article>
          <article className={summary.missingCoordinates ? 'warn' : ''}><AlertTriangle /><span><small>Thiếu tọa độ</small><b>{summary.missingCoordinates ?? 0}</b></span></article>
          <article className={summary.outOfCoverage ? 'warn' : ''}><MapPinned /><span><small>Ngoài vùng</small><b>{summary.outOfCoverage ?? 0}</b></span></article>
          <article><ImageOff /><span><small>Thiếu ảnh</small><b>{summary.missingImages ?? 0}</b></span></article>
        </div>

        <div className="dqv3-coverage">
          <div className="dqv3-section-title">
            <div><span>VÙNG PHỤC VỤ</span><h2>Độ phủ dữ liệu</h2></div>
            <small>{data?.coverage?.unassigned || 0} địa điểm chưa gán được khu vực từ tên/địa chỉ</small>
          </div>
          <div className="dqv3-area-grid">
            {areas.map((area) => {
              const attentionRate = area.total ? Math.round((area.needsAttention / area.total) * 100) : 0;
              return (
                <article key={area.name}>
                  <div><b>{area.name}</b><strong>{area.total}</strong></div>
                  <div className="dqv3-meter"><span style={{ width: `${Math.max(4, Math.min(100, area.averageScore || 0))}%` }} /></div>
                  <p><span>Quality {area.averageScore}/100</span><span>{attentionRate}% cần xử lý</span></p>
                  <small>{area.missingImages} thiếu ảnh · {area.possibleDuplicates} nghi trùng · {area.outOfCoverage || 0} ngoài vùng</small>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <AdminDataTrust />
    </>
  );
}
