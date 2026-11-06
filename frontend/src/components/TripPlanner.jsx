import {
  ArrowDown,
  ArrowUp,
  Car,
  Clock3,
  Copy,
  MapPin,
  Navigation,
  Route,
  Sparkles,
  Trash2,
  TriangleAlert,
  X
} from 'lucide-react';

function formatDistance(value) {
  const meters = Math.max(0, Number(value) || 0);
  if (meters < 1000) return Math.round(meters) + ' m';
  return (meters / 1000).toLocaleString('vi-VN', {
    maximumFractionDigits: 1
  }) + ' km';
}

function formatDuration(value) {
  const minutes = Math.max(0, Math.round((Number(value) || 0) / 60));
  if (minutes < 60) return minutes + ' phút';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? hours + ' giờ ' + rest + ' phút' : hours + ' giờ';
}

function hazardLabel(type) {
  if (type === 'FLOOD') return 'Ngập';
  if (type === 'ROAD_CLOSURE') return 'Đường cấm';
  return 'Cảnh báo';
}

export default function TripPlanner({
  open,
  stops = [],
  route,
  loading = false,
  error = '',
  onClose,
  onMove,
  onRemove,
  onCalculate,
  onOptimize,
  onShare,
  onClear
}) {
  if (!open) return null;

  const canCalculate = stops.length >= 2 && !loading;
  const hazards = Array.isArray(route?.hazards) ? route.hazards : [];

  return (
    <aside className="hm-trip-panel" aria-label="HOLA Trip Planner">
      <header className="hm-trip-header">
        <span className="hm-trip-brand"><Route size={19} /></span>
        <div className="hm-trip-heading">
          <small>HOLA MAPS · TRIP PLANNER</small>
          <h2>Lịch trình của bạn</h2>
          <span>{stops.length}/12 điểm đến <i /> Ô tô</span>
        </div>
        <button type="button" className="hm-trip-close" onClick={onClose} aria-label="Đóng lịch trình">
          <X size={18} />
        </button>
      </header>

      <div className="hm-trip-engine">
        <Car size={15} />
        <span>OSRM Driving Engine</span>
        <b>Chỉ đường ô tô</b>
      </div>

      <div className="hm-trip-stop-heading">
        <div>
          <b>ĐIỂM GHÉ THĂM</b>
          <small>Kéo thứ tự bằng nút lên / xuống</small>
        </div>
        {stops.length > 0 && (
          <button type="button" onClick={onClear} disabled={loading}>
            <Trash2 size={13} /> Xóa hết
          </button>
        )}
      </div>

      <div className="hm-trip-stops">
        {stops.length ? stops.map((stop, index) => (
          <article className="hm-trip-stop" key={stop.id}>
            <span className={index === 0 ? 'hm-trip-stop-number start' : 'hm-trip-stop-number'}>
              {index + 1}
            </span>
            <div className="hm-trip-stop-copy">
              <small>{index === 0 ? 'ĐIỂM BẮT ĐẦU' : 'ĐIỂM DỪNG ' + index}</small>
              <b>{stop.name || 'Địa điểm Hòa Lạc'}</b>
              <span>{stop.address || 'Hòa Lạc, Hà Nội'}</span>
            </div>
            <div className="hm-trip-stop-actions">
              <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0 || loading} aria-label={'Đưa ' + stop.name + ' lên'}>
                <ArrowUp size={14} />
              </button>
              <button type="button" onClick={() => onMove(index, 1)} disabled={index === stops.length - 1 || loading} aria-label={'Đưa ' + stop.name + ' xuống'}>
                <ArrowDown size={14} />
              </button>
              <button type="button" onClick={() => onRemove(stop.id)} disabled={loading} aria-label={'Xóa ' + stop.name}>
                <X size={14} />
              </button>
            </div>
          </article>
        )) : (
          <div className="hm-trip-empty">
            <MapPin size={22} />
            <b>Chưa có điểm đến</b>
            <p>Chọn một địa điểm trên bản đồ, mở thẻ thông tin và nhấn “Thêm vào lịch trình”.</p>
          </div>
        )}
      </div>

      {error && <div className="hm-trip-error">{error}</div>}

      <div className="hm-trip-actions">
        <button type="button" className="secondary" onClick={() => onCalculate(false)} disabled={!canCalculate}>
          <Route size={15} /> Tính lịch trình
        </button>
        <button type="button" className="primary" onClick={onOptimize} disabled={!canCalculate || stops.length < 3}>
          <Sparkles size={15} /> Tối ưu thứ tự
        </button>
      </div>

      {loading && (
        <div className="hm-trip-loading">
          <span />
          Đang tính các chặng đường…
        </div>
      )}

      {route && !loading && (
        <>
          <div className="hm-trip-summary">
            <div>
              <Navigation size={16} />
              <b>{formatDistance(route.distanceMeters)}</b>
              <small>Tổng quãng đường</small>
            </div>
            <div>
              <Clock3 size={16} />
              <b>{formatDuration(route.durationSeconds)}</b>
              <small>Thời gian lái xe</small>
            </div>
          </div>

          {route.optimized && (
            <div className="hm-trip-optimization-note">
              <Sparkles size={13} />
              {route.optimizationMethod === 'osrm-duration-matrix'
                ? 'Đã tối ưu theo ma trận thời gian lái xe OSRM'
                : 'Đã tối ưu theo khoảng cách ước lượng; bảng thời gian OSRM chưa khả dụng'}
            </div>
          )}

          {!!route.legs?.length && (
            <div className="hm-trip-legs">
              <b className="hm-trip-section-label">CÁC CHẶNG DI CHUYỂN</b>
              {route.legs.map((leg, index) => (
                <div className="hm-trip-leg" key={String(leg.fromStop?.id) + '-' + String(leg.toStop?.id) + '-' + index}>
                  <span>{index + 1}</span>
                  <div>
                    <b>{leg.fromStop?.name || 'Điểm ' + (index + 1)} <i>→</i> {leg.toStop?.name || 'Điểm ' + (index + 2)}</b>
                    <small>{formatDistance(leg.distanceMeters)} · {formatDuration(leg.durationSeconds)}</small>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="hm-trip-hazards">
            <div className="hm-trip-hazards-heading">
              <TriangleAlert size={15} />
              <b>Cảnh báo trên tuyến</b>
              <span>{hazards.length}</span>
            </div>
            {hazards.length ? hazards.slice(0, 8).map((hazard, index) => (
              <div
                className={'hm-trip-hazard severity-' + String(hazard.severity || 'INFO').toLowerCase()}
                key={hazard.id || hazard.name || index}
              >
                <span>{hazardLabel(hazard.type)}</span>
                <b>{hazard.name || hazard.description || 'Có dữ liệu cần lưu ý gần tuyến đường'}</b>
                <small>{hazard.severity || 'INFO'}</small>
              </div>
            )) : (
              <p>
                {route.hazardCheckAvailable === false
                  ? 'Chưa thể xác minh dữ liệu ngập và đường cấm trên tuyến. Hãy kiểm tra lại lớp cảnh báo bản đồ.'
                  : 'Không có cảnh báo ngập, đường cấm hoặc cảnh báo đang hiệu lực được ghi nhận trên tuyến.'}
              </p>
            )}
          </div>
        </>
      )}

      <footer className="hm-trip-footer">
        <button type="button" onClick={onShare} disabled={stops.length < 2}>
          <Copy size={15} /> Chia sẻ lịch trình
        </button>
        <small>Link chia sẻ lưu danh sách điểm đến và thứ tự ghé thăm.</small>
      </footer>
    </aside>
  );
}
