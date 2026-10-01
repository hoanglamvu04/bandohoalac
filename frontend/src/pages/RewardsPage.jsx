import { useEffect, useState } from 'react';
import {
  BadgePercent,
  CheckCircle2,
  Clock3,
  Coins,
  LockKeyhole,
  MapPin,
  Sparkles,
  TicketCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getMyRewards,
  getRewards,
  redeemReward
} from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import VoucherQr from '../components/VoucherQr.jsx';

const STATUS_LABELS = {
  ISSUED: 'Có thể sử dụng',
  USED: 'Đã sử dụng',
  REDEEMED: 'Đã sử dụng',
  EXPIRED: 'Hết hạn',
  CANCELLED: 'Đã hủy'
};

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN');
}

export default function RewardsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [pointsBalance, setPointsBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const publicData = await getRewards();
      setCampaigns(Array.isArray(publicData?.items) ? publicData.items : []);
      if (user) {
        const myData = await getMyRewards();
        setRedemptions(Array.isArray(myData?.items) ? myData.items : []);
        setPointsBalance(Number(myData?.pointsBalance || 0));
      } else {
        setRedemptions([]);
        setPointsBalance(null);
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [user?.id]);

  async function redeem(item) {
    if (!user) {
      showToast('Đăng nhập để đổi voucher bằng điểm Explorer.', 'info');
      return;
    }

    if (!window.confirm('Đổi ' + item.pointsCost.toLocaleString('vi-VN') + ' điểm lấy voucher "' + item.title + '"?')) {
      return;
    }

    setRedeemingId(item.id);
    try {
      const result = await redeemReward(item.id);
      showToast('Đổi voucher thành công. Mã của bạn: ' + result.code, 'success');
      await load();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setRedeemingId(null);
    }
  }

  return (
    <main className="rewards-page page-container">
      <section className="rewards-hero">
        <div className="rewards-hero-copy">
          <span className="eyebrow">HOLA EXPLORER REWARDS</span>
          <h1>Đóng góp cho Hòa Lạc,<br />nhận ưu đãi từ đối tác.</h1>
          <p>
            Điểm Explorer bạn kiếm được từ những đóng góp đã duyệt có thể dùng
            để đổi voucher tại các quán và địa điểm đối tác của Hola Maps.
          </p>
          {!user ? (
            <Link className="rewards-login-cta" to="/login" state={{ from: { pathname: '/rewards' } }}>
              Đăng nhập để xem ví điểm
            </Link>
          ) : (
            <div className="rewards-wallet">
              <span><Coins size={20} /></span>
              <div><small>Ví điểm của bạn</small><b>{Number(pointsBalance || 0).toLocaleString('vi-VN')} điểm</b></div>
            </div>
          )}
        </div>
        <div className="rewards-hero-art">
          <span><TicketCheck size={48} /></span>
          <b>Hola Rewards</b>
          <small>Đổi điểm · Nhận mã · Dùng tại đối tác</small>
        </div>
      </section>

      <section className="rewards-section">
        <div className="rewards-section-head">
          <div><span className="eyebrow">ƯU ĐÃI ĐANG CÓ</span><h2>Voucher từ đối tác</h2></div>
          <span>{campaigns.length} ưu đãi</span>
        </div>

        {loading ? <div className="loading-card">Đang tải ưu đãi...</div> : !campaigns.length ? (
          <div className="empty-state"><BadgePercent size={25} /><b>Chưa có voucher đang hoạt động</b><span>Ưu đãi mới sẽ xuất hiện tại đây khi đối tác mở chiến dịch.</span></div>
        ) : (
          <div className="rewards-grid">
            {campaigns.map((item) => {
              const enoughPoints = user && Number(pointsBalance || 0) >= item.pointsCost;
              const atLimit = user && item.userRedeemedCount >= item.maxPerUser;
              return (
                <article className="reward-card" key={item.id}>
                  <div className="reward-cover">
                    {item.placeImage ? <img src={item.placeImage} alt={item.placeName} /> : <MapPin size={32} />}
                    <span><Sparkles size={13} /> Đối tác Hola Maps</span>
                  </div>

                  <div className="reward-content">
                    <small>{item.partnerName}</small>
                    <h3>{item.title}</h3>
                    {item.voucherValueText && <strong>{item.voucherValueText}</strong>}
                    <p>{item.description || 'Đổi điểm Explorer để nhận ưu đãi tại địa điểm đối tác.'}</p>

                    <div className="reward-place"><MapPin size={14} /><span><b>{item.placeName}</b><small>{item.placeAddress}</small></span></div>

                    <div className="reward-meta">
                      <span><Coins size={15} /><b>{item.pointsCost.toLocaleString('vi-VN')}</b> điểm</span>
                      {item.quantityRemaining !== null && <span>Còn {item.quantityRemaining}</span>}
                    </div>

                    {!user ? (
                      <Link className="reward-redeem login" to="/login" state={{ from: { pathname: '/rewards' } }}>Đăng nhập để đổi</Link>
                    ) : (
                      <button
                        className="reward-redeem"
                        type="button"
                        disabled={redeemingId === item.id || !enoughPoints || atLimit}
                        onClick={() => redeem(item)}
                      >
                        {atLimit
                          ? 'Đã đạt giới hạn'
                          : !enoughPoints
                            ? 'Chưa đủ điểm'
                            : redeemingId === item.id
                              ? 'Đang đổi...'
                              : 'Đổi voucher'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {user && (
        <section className="rewards-section my-vouchers-section">
          <div className="rewards-section-head">
            <div><span className="eyebrow">VOUCHER CỦA TÔI</span><h2>Mã đã đổi</h2></div>
            <span>{redemptions.length} voucher</span>
          </div>

          {!redemptions.length ? (
            <div className="empty-state"><TicketCheck size={24} /><b>Bạn chưa đổi voucher nào</b><span>Tích điểm từ đóng góp và quay lại chọn ưu đãi phù hợp.</span></div>
          ) : (
            <div className="my-voucher-grid">
              {redemptions.map((item) => {
                const status = item.status === 'REDEEMED' ? 'USED' : item.status;
                const usable = status === 'ISSUED';
                return (
                  <article className={'my-voucher-card status-' + status.toLowerCase()} key={item.id}>
                    <span className={'voucher-status ' + status.toLowerCase()}>
                      {STATUS_LABELS[status] || status}
                    </span>

                    <small>{item.partnerName}</small>
                    <h3>{item.campaignTitle}</h3>
                    {item.voucherValueText && <strong className="my-voucher-value">{item.voucherValueText}</strong>}

                    {usable ? (
                      <div className="my-voucher-qr">
                        <VoucherQr code={item.code} token={item.qrToken} size={172} />
                        <div className="my-voucher-code">
                          <span>MÃ VOUCHER</span>
                          <b>{item.code}</b>
                          <small>Đưa QR hoặc mã này cho nhân viên quán để kiểm tra và xác nhận.</small>
                        </div>
                      </div>
                    ) : (
                      <div className={'my-voucher-locked ' + status.toLowerCase()}>
                        <span>
                          {status === 'USED'
                            ? <CheckCircle2 size={24} />
                            : status === 'EXPIRED'
                              ? <Clock3 size={24} />
                              : <LockKeyhole size={24} />}
                        </span>
                        <div>
                          <b>{STATUS_LABELS[status] || status}</b>
                          {status === 'USED' && item.usedAt && (
                            <small>{formatDateTime(item.usedAt)}</small>
                          )}
                          {status === 'EXPIRED' && item.expiresAt && (
                            <small>Hết hạn: {formatDateTime(item.expiresAt)}</small>
                          )}
                          <em>Mã {item.code}</em>
                        </div>
                      </div>
                    )}

                    <p><MapPin size={13} /> {item.placeName} · {item.placeAddress}</p>

                    {item.terms && (
                      <div className="my-voucher-terms">
                        <b>Điều kiện</b>
                        <span>{item.terms}</span>
                      </div>
                    )}

                    <footer>
                      <span><Coins size={14} /> {item.pointsSpent.toLocaleString('vi-VN')} điểm</span>
                      {usable && item.expiresAt && (
                        <span><Clock3 size={14} /> HSD {new Date(item.expiresAt).toLocaleDateString('vi-VN')}</span>
                      )}
                      {status === 'USED' && (
                        <span><CheckCircle2 size={14} /> Đã khóa QR</span>
                      )}
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
