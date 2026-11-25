import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPinned, RefreshCw } from 'lucide-react';
import { getHousingPublicAmenities } from '../services/api.js';
import '../housing-nearby-detail.css';

const RADIUS_OPTIONS = [
  { value: '500', label: '500 m' },
  { value: '1000', label: '1 km' },
  { value: '2000', label: '2 km' }
];

function distanceLabel(distance) {
  const meters = Number(distance);
  if (!Number.isFinite(meters) || meters < 0) return 'Chưa có khoảng cách';
  return meters >= 1000
    ? (meters / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' km'
    : Math.round(meters) + ' m';
}

// Deliberately on-demand. Loading this page must not request an expensive
// proximity query, user GPS, contact details or background location consent.
export default function HousingNearbyPlaces({ placeId }) {
  const [radius, setRadius] = useState('1000');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef({ seq: 0, controller: null });

  useEffect(() => () => {
    requestRef.current.seq += 1;
    requestRef.current.controller?.abort();
  }, [placeId]);

  function invalidateRequest() {
    requestRef.current.seq += 1;
    requestRef.current.controller?.abort();
    requestRef.current.controller = null;
    setBusy(false);
    setResult(null);
    setError('');
  }

  function handleRadiusChange(event) {
    invalidateRequest();
    setRadius(event.target.value);
  }

  async function fetchNearby() {
    if (!placeId || busy) return;
    invalidateRequest();
    const controller = new AbortController();
    const seq = ++requestRef.current.seq;
    requestRef.current.controller = controller;
    setBusy(true);
    try {
      const data = await getHousingPublicAmenities(placeId, Number(radius), {
        signal: controller.signal
      });
      if (requestRef.current.seq !== seq || controller.signal.aborted) return;
      setResult(data);
    } catch {
      if (requestRef.current.seq !== seq || controller.signal.aborted) return;
      setError('Chưa thể tải tiện ích quanh tin. Vui lòng thử lại.');
    } finally {
      if (requestRef.current.seq === seq) {
        requestRef.current.controller = null;
        setBusy(false);
      }
    }
  }

  const categories = Array.isArray(result?.categories) ? result.categories : [];
  const places = Array.isArray(result?.places) ? result.places.slice(0, 8) : [];

  return (
    <section className="place-v2-card hnp-card"
      data-testid="housing-nearby-detail" aria-label="Tiện ích quanh bất động sản">
      <div className="place-v2-section-title">
        <MapPinned size={19} aria-hidden="true" />
        <h2>Tiện ích quanh bất động sản</h2>
      </div>
      <p className="hnp-intro">
        Kiểm tra các địa điểm đã được công khai gần tin này. Không cần chia sẻ vị trí của bạn.
      </p>
      <div className="hnp-controls">
        <label htmlFor="hnp-radius">Bán kính tra cứu</label>
        <select id="hnp-radius" value={radius} onChange={handleRadiusChange}>
          {RADIUS_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <button type="button" onClick={fetchNearby} disabled={busy}>
          <RefreshCw size={15} aria-hidden="true" />
          {busy ? 'Đang tìm tiện ích…' : result || error ? 'Tra cứu lại' : 'Tra cứu tiện ích'}
        </button>
      </div>
      {busy && <p className="hnp-feedback" role="status">Đang tra cứu các tiện ích đã công khai…</p>}
      {error && <p className="hnp-error" role="alert">{error}</p>}
      {result && (
        <div className="hnp-results" data-testid="housing-nearby-results" aria-live="polite">
          <p className="hnp-summary">
            {result.capped
              ? 'Ít nhất ' + result.matchedCount + ' địa điểm được ghi nhận (kết quả giới hạn).'
              : result.matchedCount + ' địa điểm được ghi nhận trong bán kính ' +
                distanceLabel(result.radiusM) + '.'}
          </p>
          {categories.length > 0 ? (
            <ul className="hnp-categories" aria-label="Nhóm tiện ích">
              {categories.map((category) => (
                <li key={category.categorySlug}>
                  <strong>{category.name}</strong>
                  <span>{category.count} địa điểm{result.capped ? ' trong mẫu' : ''}</span>
                </li>
              ))}
            </ul>
          ) : <p className="hnp-empty">
            Chưa ghi nhận tiện ích nào trong dữ liệu hiện có của bán kính này.
          </p>}
          {places.length > 0 && (
            <div className="hnp-places">
              <h3>Địa điểm gần nhất đã ghi nhận</h3>
              <ul>
                {places.map((item) => (
                  <li key={item.id}>
                    <Link to={'/place/' + encodeURIComponent(item.id)}>{item.name}</Link>
                    <span>{distanceLabel(item.distanceM)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <p className="hnp-disclaimer">
        Khoảng cách đường thẳng, không phải quãng đường hay thời gian di chuyển.
        Dữ liệu cộng đồng có thể còn thiếu; không có kết quả không có nghĩa khu vực thiếu tiện ích.
      </p>
    </section>
  );
}
