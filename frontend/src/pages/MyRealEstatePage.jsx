import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CalendarClock, CheckCircle2, Home, MapPin, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createContribution, getMyHousingListings, manageMyHousingListing } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import '../real-estate-management.css';

const STATUS_LABEL = {
  ACTIVE: 'Đang hiển thị',
  PAUSED: 'Đã tạm ẩn',
  SOLD: 'Đã bán',
  RENTED: 'Đã cho thuê',
  EXPIRED: 'Hết hạn xác nhận'
};

function currency(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? new Intl.NumberFormat('vi-VN').format(number) + ' đ'
    : 'Chưa cập nhật';
}

export default function MyRealEstatePage() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [priceDrafts, setPriceDrafts] = useState({});

  const load = useCallback(async () => {
    try {
      const response = await getMyHousingListings();
      setItems(Array.isArray(response.items) ? response.items : []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Không tải được tin của bạn.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function manage(item, action) {
    const message = {
      CONFIRM_ACTIVE: 'Xác nhận tin vẫn còn hiệu lực và gia hạn thêm 30 ngày?',
      PAUSE: 'Tạm ẩn tin này khỏi toàn bộ bản đồ? Muốn đăng lại cần Admin xét duyệt.',
      SOLD: 'Xác nhận đã bán và ẩn tin khỏi bản đồ?',
      RENTED: 'Xác nhận đã cho thuê và ẩn tin khỏi bản đồ?'
    }[action];
    if (!window.confirm(message)) return;
    setBusyId(item.id);
    try {
      await manageMyHousingListing(item.id, action);
      showToast('Đã cập nhật trạng thái tin bất động sản.', 'success');
      await load();
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Không cập nhật được tin.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function requestPrice(item) {
    const raw = priceDrafts[item.id];
    const amount = Number(raw);
    if (!Number.isSafeInteger(amount) || amount <= 0 ||
        (item.listingType === 'RENT' && amount > 100000000) ||
        amount > 1000000000000000) {
      showToast('Vui lòng nhập giá hợp lệ bằng đồng Việt Nam.', 'error');
      return;
    }
    if (!window.confirm('Gửi yêu cầu đổi giá sang ' + currency(amount) + '? Giá công khai chỉ đổi sau khi Admin duyệt.')) return;
    setBusyId(item.id);
    try {
      const result = await createContribution({
        type: 'UPDATE_PRICE',
        placeId: item.id,
        place: { realEstatePriceVnd: amount }
      });
      showToast('Yêu cầu thay đổi giá #' + result.id + ' đang chờ duyệt.', 'success');
      setPriceDrafts((state) => ({ ...state, [item.id]: '' }));
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Không gửi được yêu cầu.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="estate-manager-page">
      <div className="estate-manager-wrap">
        <Link className="estate-manager-back" to="/profile"><ArrowLeft size={16} /> Trang cá nhân</Link>
        <header className="estate-manager-header">
          <span><Home size={17} /> HOLA MAPS · TIN CỦA TÔI</span>
          <h1>Quản lý tin bất động sản</h1>
          <p>Xác nhận tin còn hiệu lực mỗi 30 ngày, chủ động ẩn khi đã giao dịch. Thay đổi giá luôn được Admin duyệt trước khi hiển thị.</p>
          <Link to="/dang-tin-bat-dong-san" className="estate-manager-new">+ Đăng bất động sản mới</Link>
        </header>

        {loading && <p>Đang tải tin của bạn…</p>}
        {error && <div className="estate-manager-error" role="alert">{error}</div>}
        {!loading && !error && items.length === 0 && (
          <div className="estate-manager-empty">
            <MapPin size={34} />
            <h2>Chưa có bất động sản đã đăng</h2>
            <p>Khi tin của bạn được duyệt, bạn có thể quản lý và cập nhật tình trạng tại đây.</p>
          </div>
        )}

        <div className="estate-manager-list">
          {items.map((item) => {
            const active = item.listingStatus === 'ACTIVE' && item.placeStatus === 'PUBLISHED';
            const until = item.expiresAt ? new Date(item.expiresAt) : null;
            const isStale = active && until && until.getTime() <= Date.now();
            const needsRenewal = active && until && (until.getTime() - Date.now()) < 7 * 86400000;
            const price = item.listingType === 'SALE' ? item.totalPriceVnd : item.monthlyRentVnd;

            return (
              <article className="estate-manager-card" key={item.id} data-testid={'my-estate-' + item.id}>
                <div className="estate-manager-card-head">
                  <div>
                    <span className={active ? 'estate-manager-status active' : 'estate-manager-status'}>
                      {isStale ? 'Đến hạn xác nhận' : STATUS_LABEL[item.listingStatus] || item.listingStatus}
                    </span>
                    <h2>{item.name}</h2>
                    <p>{item.address || 'Hòa Lạc'}</p>
                  </div>
                  {active && <Link to={'/place/' + item.id}>Xem tin công khai</Link>}
                </div>
                <div className="estate-manager-metrics">
                  <span><b>{item.listingType === 'SALE' ? 'Đang bán' : 'Cho thuê'}</b></span>
                  <span><b>{currency(price)}</b>{item.listingType === 'RENT' && '/tháng'}</span>
                  {item.areaM2 && <span><b>{item.areaM2} m²</b></span>}
                </div>

                {active ? (
                  <>
                    <div className={needsRenewal ? 'estate-manager-expiry urgent' : 'estate-manager-expiry'}>
                      <CalendarClock size={17} />
                      {until ? (isStale
                        ? 'Đã tới hạn xác nhận. Hãy xác nhận ngay trước khi tin tự ẩn.'
                        : 'Cần xác nhận lại trước ' + until.toLocaleDateString('vi-VN'))
                        : 'Tin cũ chưa có hạn xác nhận, bạn vẫn có thể chủ động xác nhận.'}
                    </div>
                    <div className="estate-manager-actions">
                      <button type="button" disabled={busyId === item.id} onClick={() => manage(item, 'CONFIRM_ACTIVE')}>
                        <CheckCircle2 size={16} /> Tin vẫn còn hiệu lực
                      </button>
                      <button type="button" disabled={busyId === item.id} onClick={() => manage(item, 'PAUSE')}>Tạm ẩn</button>
                      <button type="button" disabled={busyId === item.id} onClick={() => manage(item, item.listingType === 'SALE' ? 'SOLD' : 'RENTED')}>
                        {item.listingType === 'SALE' ? 'Đã bán' : 'Đã cho thuê'}
                      </button>
                    </div>
                    <div className="estate-manager-price-form">
                      <label htmlFor={'price-' + item.id}>Gửi yêu cầu thay đổi giá (VND)</label>
                      <div>
                        <input id={'price-' + item.id} type="number" min="1" step="1" inputMode="numeric"
                          value={priceDrafts[item.id] ?? ''}
                          onChange={(event) => setPriceDrafts((state) => ({ ...state, [item.id]: event.target.value }))}
                          placeholder="Nhập giá mới" />
                        <button type="button" disabled={busyId === item.id || !priceDrafts[item.id]} onClick={() => requestPrice(item)}>
                          Gửi chờ duyệt
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="estate-manager-hidden-note">
                    <ShieldCheck size={16} /> Tin đã ẩn khỏi bản đồ. Muốn đăng lại, hãy gửi tin mới để quản trị viên duyệt.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
