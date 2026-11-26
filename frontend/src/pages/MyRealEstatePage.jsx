import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CalendarClock, CheckCircle2, Home, MapPin, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createContribution, getMyContributions, getMyHousingListings, manageMyHousingListing } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import '../real-estate-management.css';
import HousingViewingsManager from '../components/HousingViewingsManager.jsx';
import { RoomCatalogManager } from '../components/CommunityTools.jsx';

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
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [submissionsWarning, setSubmissionsWarning] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [priceDrafts, setPriceDrafts] = useState({});
  const [roomDrafts,setRoomDrafts]=useState({});

  const load = useCallback(async () => {
    // Both endpoints are scoped to the signed-in owner. A failed history
    // request must not hide already-published listings.
    const [published, history] = await Promise.allSettled([
      getMyHousingListings(),
      getMyContributions()
    ]);
    if (published.status === 'fulfilled') {
      setItems(Array.isArray(published.value.items) ? published.value.items : []);
      setError('');
    } else {
      setError(published.reason?.message || 'Không tải được tin đã đăng của bạn.');
    }
    if (history.status === 'fulfilled') {
      const all = Array.isArray(history.value.items) ? history.value.items : [];
      setPendingSubmissions(all.filter((entry) =>
        entry.type === 'CREATE_PLACE' &&
        entry.payload?.place?.categorySlug === 'bat-dong-san' &&
        entry.payload?.place?.realEstate &&
        ['PENDING', 'REJECTED'].includes(entry.status)
      ));
      setSubmissionsWarning('');
    } else {
      setSubmissionsWarning('Chưa tải được trạng thái tin chờ duyệt. Hãy thử tải lại trang.');
    }
    setLoading(false);
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
      const rooms=roomDrafts[item.id];
      const options=action==='CONFIRM_ACTIVE'&&item.listingType==='RENT'&&!item.roomTypeCount&&rooms!==undefined&&rooms!==''?{availableRooms:Number(rooms)}:{};
      if(options.availableRooms!==undefined&&(!Number.isInteger(options.availableRooms)||options.availableRooms<0||options.availableRooms>10000||
        (item.totalRooms!=null&&options.availableRooms>item.totalRooms)))throw new Error('Số phòng trống không hợp lệ.');
      await manageMyHousingListing(item.id, action,options);
      setRoomDrafts(current=>({...current,[item.id]:undefined}));
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

        <HousingViewingsManager/>
        {loading && <p>Đang tải tin của bạn…</p>}
        {error && <div className="estate-manager-error" role="alert">{error}</div>}
        {submissionsWarning && <div className="estate-manager-error" role="alert">{submissionsWarning}</div>}
        {!loading && !error && items.length === 0 && pendingSubmissions.length === 0 && (
          <div className="estate-manager-empty">
            <MapPin size={34} />
            <h2>Chưa có bất động sản đã đăng</h2>
            <p>Khi tin của bạn được duyệt, bạn có thể quản lý và cập nhật tình trạng tại đây.</p>
          </div>
        )}

        {!loading && pendingSubmissions.length > 0 && (
          <section className="estate-manager-review-queue" aria-label="Tin đang xét duyệt"
            data-testid="estate-owner-review-queue">
            <div className="estate-manager-review-intro">
              <h2>Yêu cầu đăng tin của bạn</h2>
              <p>Đây là yêu cầu chưa được công khai trên bản đồ. Tin bị từ chối có lý do để bạn chỉnh sửa rồi gửi lại.</p>
            </div>
            <div className="estate-manager-review-list">
              {pendingSubmissions.map((entry) => {
                const estate = entry.payload.place.realEstate;
                const property = entry.payload.place;
                const price = estate.transactionType === 'SALE'
                  ? estate.totalPriceVnd : estate.monthlyRentVnd;
                const rejected = entry.status === 'REJECTED';
                return (
                  <article className="estate-manager-review-card" key={entry.id}
                    data-testid={'estate-submission-' + entry.id}>
                    <div className="estate-manager-review-top">
                      <span className={rejected ? 'estate-manager-status rejected' : 'estate-manager-status waiting'}>
                        {rejected ? 'Đã từ chối' : 'Chờ Admin duyệt'}
                      </span>
                      <small>Mã yêu cầu #{entry.id}</small>
                    </div>
                    <h3>{property.name}</h3>
                    <p>{property.address || 'Hòa Lạc'}</p>
                    <div className="estate-manager-review-meta">
                      {estate.transactionType === 'SALE' ? 'Cần bán' : 'Cho thuê'}
                      {' · '}{currency(price)}{estate.transactionType === 'RENT' ? '/tháng' : ''}
                      {estate.areaM2 ? ' · ' + estate.areaM2 + ' m²' : ''}
                    </div>
                    {rejected ? (
                      <div className="estate-manager-reject-reason">
                        <strong>Lý do từ chối</strong>
                        <p>{entry.rejectReason || 'Chưa có lý do chi tiết. Vui lòng liên hệ quản trị viên.'}</p>
                        <Link to="/dang-tin-bat-dong-san">Tạo tin mới sau khi chỉnh sửa</Link>
                      </div>
                    ) : (
                      <p className="estate-manager-pending-note">
                        <ShieldCheck size={16}/> Đang được kiểm tra; chỉ xuất hiện trên bản đồ sau khi được duyệt.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
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
                  {item.listingType==='RENT'&&<span>Phòng trống: <b>{item.availableRooms??'Chưa cập nhật'}</b></span>}
                  <span>30 ngày: <b>{item.viewingRequests30d??0}</b> yêu cầu xem · <b>{item.acceptedViewings30d??0}</b> đang ở trạng thái xác nhận</span>
                  {item.detailViews30d!=null&&<span>30 ngày: <b>{item.detailViews30d}</b> lượt xem chi tiết · <b>{item.contactReveals30d}</b> lượt hiện số (có đồng ý thống kê; không phải người dùng duy nhất)</span>}
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
                    {item.listingType==='RENT'&&['HOUSE','APARTMENT'].includes(item.propertyType)&&<RoomCatalogManager item={item} onChanged={load}/>}
                    {item.listingType==='RENT'&&!item.roomTypeCount&&<div className="estate-manager-price-form">
                      <label htmlFor={'rooms-'+item.id}>Số phòng/căn còn trống (tự khai)</label>
                      <input id={'rooms-'+item.id} type="number" min="0" max={item.totalRooms??10000} step="1"
                        value={roomDrafts[item.id]??''} onChange={e=>setRoomDrafts(s=>({...s,[item.id]:e.target.value}))}
                        placeholder={item.availableRooms==null?'Chưa cập nhật':String(item.availableRooms)}/>
                      <small>Nhấn “Tin vẫn còn hiệu lực” để lưu. Nhập 0 nếu hết phòng; lịch tương lai sẽ bị hủy.</small>
                    </div>}
                    <div className="estate-manager-actions">
                      <button type="button" disabled={busyId === item.id} onClick={() => manage(item, 'CONFIRM_ACTIVE')}>
                        <CheckCircle2 size={16} /> Tin vẫn còn hiệu lực
                      </button>
                      <button type="button" disabled={busyId === item.id} onClick={() => manage(item, 'PAUSE')}>Tạm ẩn</button>
                      <button type="button" disabled={busyId === item.id} onClick={() => manage(item, item.listingType === 'SALE' ? 'SOLD' : 'RENTED')}>
                        {item.listingType === 'SALE' ? 'Đã bán' : 'Đã cho thuê'}
                      </button>
                    </div>
                    {!item.roomTypeCount&&<div className="estate-manager-price-form">
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
                    </div>}
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
