import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Clock3, MapPin, Navigation, Route, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getTravelTimePlaces } from '../services/api.js';
import '../travel-time-discovery.css';

const ANCHORS = [
  { value: 'fpt', label: 'Đại học FPT' },
  { value: 'dhqg', label: 'ĐHQG Hà Nội' },
  { value: 'cnc', label: 'Khu CNC Hòa Lạc' }
];
const CATEGORIES = [
  { value: 'all', label: 'Tất cả địa điểm' },
  { value: 'an-uong', label: 'Quán ăn' },
  { value: 'cafe', label: 'Cà phê' },
  { value: 'bat-dong-san', label: 'Bất động sản' },
  { value: 'homestay', label: 'Homestay' },
  { value: 'truong-hoc', label: 'Trường học' },
  { value: 'y-te', label: 'Y tế' }
];

export default function TravelTimeDiscovery({ defaultCategory = 'all', onChoose }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState('fpt');
  const [minutes, setMinutes] = useState(10);
  const [category, setCategory] = useState(defaultCategory);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(null);

  useEffect(() => {
    setCategory(defaultCategory);
    setData(null);
    setError('');
    requestRef.current?.abort();
    setBusy(false);
  }, [defaultCategory]);

  useEffect(() => () => requestRef.current?.abort(), []);

  function change(field, value) {
    requestRef.current?.abort();
    setData(null);
    setError('');
    setBusy(false);
    field(value);
  }

  async function calculate() {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError('');
    setData(null);
    try {
      const result = await getTravelTimePlaces({
        anchor, minutes, category: category === 'all' ? undefined : category, limit: 12
      }, { signal: controller.signal });
      if (!controller.signal.aborted) setData(result);
    } catch (reason) {
      if (!controller.signal.aborted) {
        const status = reason?.response?.status;
        setError(status === 503
          ? 'Máy chủ định tuyến chưa phản hồi. Vui lòng thử lại sau.'
          : status === 404
            ? 'Chưa tìm được mốc địa danh để tính đường đi.'
            : 'Không tìm được địa điểm theo thời gian lái xe. Hãy thử lại.');
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setBusy(false);
      }
    }
  }

  return (
    <section className="hm-travel-discovery" aria-label="Khám phá theo thời gian di chuyển"
      data-testid="travel-time-discovery">
      <button type="button" className="hm-travel-heading"
        onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <span className="hm-travel-heading-icon"><Route size={17} /></span>
        <span><strong>Khám phá theo phút lái xe</strong>
          <small>5–15 phút từ FPT, ĐHQG hoặc Khu CNC</small></span>
        <ChevronDown size={16} className={open ? 'expanded' : ''} />
      </button>

      {open && (
        <div className="hm-travel-body">
          <div className="hm-travel-fields">
            <label>
              <span>Mốc xuất phát</span>
              <select value={anchor}
                onChange={(event) => change(setAnchor, event.target.value)}
                aria-label="Mốc xuất phát lái xe">
                {ANCHORS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label>
              <span>Loại địa điểm</span>
              <select value={category}
                onChange={(event) => change(setCategory, event.target.value)}
                aria-label="Loại địa điểm theo thời gian">
                {CATEGORIES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
              </select>
            </label>
          </div>

          <div role="group" aria-label="Giới hạn thời gian lái xe" className="hm-travel-minutes">
            {[5, 10, 15].map((value) => (
              <button key={value} type="button"
                aria-pressed={minutes === value}
                onClick={() => change(setMinutes, value)}>
                {value} phút
              </button>
            ))}
          </div>
          <button className="hm-travel-run" type="button" disabled={busy}
            onClick={calculate}>
            <Navigation size={15} /> {busy ? 'Đang tính theo đường thực tế…' : 'Tìm địa điểm phù hợp'}
          </button>

          {error && <p className="hm-travel-message" role="alert">{error}</p>}
          {data && (
            <div className="hm-travel-results" role="status" aria-live="polite">
              <div className="hm-travel-result-summary">
                <Clock3 size={15} />
                <span>{data.items.length} kết quả trong {minutes} phút lái xe từ {data.anchor.name}</span>
              </div>
              {!data.items.length && (
                <p className="hm-travel-message">Chưa có địa điểm phù hợp trong nhóm được kiểm tra. Hãy chọn 15 phút hoặc loại khác.</p>
              )}
              {data.items.map((place) => (
                <div key={place.id} className="hm-travel-result">
                  <span className="hm-travel-result-icon"><MapPin size={15} /></span>
                  <div className="hm-travel-result-copy">
                    <strong>{place.name}</strong>
                    <small>{place.travelMinutes} phút lái xe · {place.category || 'Địa điểm'}</small>
                    <div className="hm-travel-links">
                      <button type="button"
                        onClick={() => onChoose?.(place)}
                        aria-label={'Xem ghim ' + place.name}>Xem ghim</button>
                      <Link to={'/place/' + encodeURIComponent(place.id)}>Chi tiết</Link>
                    </div>
                  </div>
                </div>
              ))}
              {data.meta?.limitedCoverage && (
                <p className="hm-travel-footnote">
                  Chỉ kiểm tra các địa điểm gần mốc nhất; có thể còn địa điểm khác chưa được tính.
                </p>
              )}
              <p className="hm-travel-footnote">
                <Route size={12} /> Thời gian ước tính bằng OSRM theo đường ô tô, chưa tính ùn tắc.
              </p>
            </div>
          )}
          {data && <button className="hm-travel-clear" type="button"
            onClick={() => { setData(null); setError(''); }}>
            <X size={12} /> Xóa kết quả
          </button>}
        </div>
      )}
    </section>
  );
}
