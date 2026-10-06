import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  HelpCircle,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Users,
  XCircle
} from 'lucide-react';
import {
  getCommunityVerificationQueue,
  submitCommunityVerification
} from '../services/communityVerificationApi.js';
import { useToast } from '../context/ToastContext.jsx';

const TYPE_LABELS = {
  CREATE_PLACE: 'Thêm địa điểm mới',
  UPDATE_PLACE: 'Cập nhật thông tin',
  ADD_PHOTO: 'Thêm ảnh thực tế',
  FIX_LOCATION: 'Chỉnh vị trí',
  UPDATE_HOURS: 'Cập nhật giờ mở cửa',
  UPDATE_PRICE: 'Cập nhật giá',
  REPORT_CLOSED: 'Báo địa điểm đóng cửa',
  REPORT_WRONG_INFO: 'Báo sai thông tin',
  REPORT_FLOOD: 'Báo ngập',
  REPORT_ROAD_CLOSURE: 'Báo đường cấm',
  REPORT_ALERT: 'Cảnh báo khu vực'
};

const VERDICT_LABELS = {
  CONFIRM: 'Đã xác nhận đúng',
  DISPUTE: 'Đã phản đối',
  UNSURE: 'Đã chọn chưa chắc'
};

const STATE_COPY = {
  COLLECTING: {
    label: 'Đang thu thập',
    description: 'Chưa đủ số người độc lập để hình thành đồng thuận.'
  },
  CONFIRMED: {
    label: 'Cộng đồng đồng thuận',
    description: 'Đã đủ tín hiệu xác nhận, nhưng vẫn cần moderator duyệt cuối.'
  },
  DISPUTED: {
    label: 'Có tranh chấp',
    description: 'Có phản đối đáng kể. Hệ thống sẽ ưu tiên kiểm tra thủ công.'
  },
  SPLIT: {
    label: 'Ý kiến chia đôi',
    description: 'Cộng đồng chưa thống nhất. Moderator sẽ xem xét kỹ hơn.'
  }
};

function contributionPhotos(item) {
  const direct = Array.isArray(item?.payload?.photos) ? item.payload.photos : [];
  if (direct.length) return direct;
  const assets = Array.isArray(item?.payload?.photoAssets) ? item.payload.photoAssets : [];
  return assets.map((asset) => asset?.url || asset?.secureUrl).filter(Boolean);
}

function ConsensusMeter({ verification }) {
  const confirm = Number(verification?.confirmCount || 0);
  const dispute = Number(verification?.disputeCount || 0);
  const unsure = Number(verification?.unsureCount || 0);
  const decisive = confirm + dispute;
  const required = Math.max(Number(verification?.requiredVoters || 3), 1);
  const progress = Math.min(decisive / required, 1) * 100;
  const state = STATE_COPY[verification?.state] || STATE_COPY.COLLECTING;

  return (
    <div className={'community-consensus-meter state-' + String(verification?.state || 'COLLECTING').toLowerCase()}>
      <div className="community-consensus-head">
        <span><Users size={15} /><b>{state.label}</b></span>
        <em>Confidence {Number(verification?.confidence || 0)}/100</em>
      </div>
      <p>{state.description}</p>
      <div className="community-consensus-track"><span style={{ width: progress + '%' }} /></div>
      <div className="community-consensus-counts">
        <span className="confirm"><CheckCircle2 size={13} /> {confirm} xác nhận</span>
        <span className="dispute"><XCircle size={13} /> {dispute} phản đối</span>
        <span><HelpCircle size={13} /> {unsure} chưa chắc</span>
        <small>{decisive}/{required} phiếu quyết định tối thiểu</small>
      </div>
    </div>
  );
}

export default function CommunityVerification() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [disputingId, setDisputingId] = useState(null);
  const [reasons, setReasons] = useState({});

  function load() {
    setLoading(true);
    getCommunityVerificationQueue({ limit: 30 })
      .then((data) => setItems(Array.isArray(data?.items) ? data.items : []))
      .catch((error) => {
        setItems([]);
        showToast(error.message, 'error');
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const unvotedCount = useMemo(
    () => items.filter((item) => !item.verification?.myVote).length,
    [items]
  );

  async function vote(item, verdict) {
    if (verdict === 'DISPUTE') {
      setDisputingId(item.id);
      return;
    }

    setBusyId(item.id);
    try {
      const result = await submitCommunityVerification(item.id, verdict);
      setItems((current) => current.map((entry) => entry.id === item.id
        ? {
            ...entry,
            verification: {
              ...result.consensus,
              myVote: result.vote
            }
          }
        : entry));
      showToast(result.message || 'Đã ghi nhận xác minh.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function submitDispute(item) {
    const reason = String(reasons[item.id] || '').trim();
    if (!reason) {
      showToast('Hãy nêu ngắn gọn điểm bạn thấy chưa đúng.', 'error');
      return;
    }

    setBusyId(item.id);
    try {
      const result = await submitCommunityVerification(item.id, 'DISPUTE', reason);
      setItems((current) => current.map((entry) => entry.id === item.id
        ? {
            ...entry,
            verification: {
              ...result.consensus,
              myVote: result.vote
            }
          }
        : entry));
      setDisputingId(null);
      showToast(result.message || 'Đã ghi nhận phản đối.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="community-verification-page page-container">
      <section className="community-verification-hero">
        <div>
          <span className="eyebrow">REPUTATION V2.4 · COMMUNITY VERIFICATION</span>
          <h1>Cùng xác minh dữ liệu Hòa Lạc</h1>
          <p>
            Xem các đóng góp đang chờ duyệt và cho biết bạn có thể xác nhận thông tin đó hay không.
            Phiếu được cân trọng số theo lịch sử uy tín và chuyên môn, nhưng luôn cần nhiều người độc lập.
          </p>
        </div>
        <div className="community-verification-hero-stat">
          <ShieldCheck size={24} />
          <strong>{unvotedCount}</strong>
          <span>mục bạn chưa xác minh</span>
        </div>
      </section>

      <section className="community-verification-policy">
        <ShieldCheck size={20} />
        <div>
          <b>Đồng thuận cộng đồng không phải quyền tự duyệt.</b>
          <span>
            Bạn không thể xác minh đóng góp của chính mình. Dữ liệu risk cao không được đưa ra cộng đồng.
            Kể cả khi đạt đồng thuận, Admin/Moderator vẫn là người duyệt xuất bản cuối cùng.
          </span>
        </div>
        <button type="button" onClick={load} disabled={loading}>
          <RefreshCw size={15} /> Làm mới
        </button>
      </section>

      {loading && <div className="loading-card">Đang lấy hàng chờ xác minh...</div>}

      {!loading && !items.length && (
        <div className="community-verification-empty">
          <CheckCircle2 size={32} />
          <b>Hiện chưa có dữ liệu cần bạn xác minh</b>
          <span>Khi có đóng góp phù hợp, chúng sẽ xuất hiện tại đây.</span>
        </div>
      )}

      <section className="community-verification-list">
        {items.map((item) => {
          const place = item.payload?.place || {};
          const location = item.payload?.location;
          const photos = contributionPhotos(item);
          const myVote = item.verification?.myVote;
          const isBusy = String(busyId) === String(item.id);
          const isDisputing = String(disputingId) === String(item.id);

          return (
            <article className="community-verification-card" key={item.id}>
              <div className="community-verification-card-head">
                <span>{TYPE_LABELS[item.type] || item.type}</span>
                <small>{new Date(item.createdAt).toLocaleString('vi-VN')}</small>
              </div>

              <h2>{place.name || item.placeName || `Đóng góp #${item.id}`}</h2>
              <p className="community-verification-author">Được gửi bởi <b>{item.userName || 'thành viên cộng đồng'}</b></p>

              {place.address && (
                <p className="community-verification-meta"><MapPin size={14} /> {place.address}</p>
              )}
              {location && (
                <p className="community-verification-meta">
                  <MapPin size={14} /> GPS: {Number(location.lat).toFixed(6)}, {Number(location.lng).toFixed(6)}
                </p>
              )}
              {place.description && <p className="community-verification-description">{place.description}</p>}
              {item.payload?.reason && (
                <div className="community-verification-report">
                  <AlertTriangle size={15} />
                  <span>{item.payload.reason}</span>
                </div>
              )}

              {!!photos.length && (
                <div className="community-verification-photos">
                  {photos.slice(0, 4).map((url) => <img key={url} src={url} alt="Ảnh đóng góp cần xác minh" />)}
                  <span><Camera size={13} /> {photos.length} ảnh</span>
                </div>
              )}

              <ConsensusMeter verification={item.verification} />

              {myVote && (
                <div className={'community-my-vote ' + String(myVote.verdict || '').toLowerCase()}>
                  <ShieldCheck size={14} />
                  <span><b>{VERDICT_LABELS[myVote.verdict] || myVote.verdict}</b> · trọng số {Number(myVote.weight || 0).toFixed(2)}</span>
                </div>
              )}

              {isDisputing && (
                <div className="community-dispute-box">
                  <label>
                    Điểm nào chưa đúng?
                    <textarea
                      rows="3"
                      maxLength="500"
                      value={reasons[item.id] || ''}
                      onChange={(event) => setReasons((current) => ({
                        ...current,
                        [item.id]: event.target.value
                      }))}
                      placeholder="Ví dụ: vị trí này lệch khoảng 100m; địa điểm vẫn đang mở; ảnh không phải khu vực này..."
                    />
                  </label>
                  <div>
                    <button type="button" className="secondary" onClick={() => setDisputingId(null)} disabled={isBusy}>Hủy</button>
                    <button type="button" className="danger" onClick={() => submitDispute(item)} disabled={isBusy}>Gửi phản đối</button>
                  </div>
                </div>
              )}

              {!isDisputing && (
                <div className="community-verification-actions">
                  <button
                    type="button"
                    className={myVote?.verdict === 'CONFIRM' ? 'confirm active' : 'confirm'}
                    onClick={() => vote(item, 'CONFIRM')}
                    disabled={isBusy}
                  >
                    <CheckCircle2 size={17} /> Xác nhận đúng
                  </button>
                  <button
                    type="button"
                    className={myVote?.verdict === 'DISPUTE' ? 'dispute active' : 'dispute'}
                    onClick={() => vote(item, 'DISPUTE')}
                    disabled={isBusy}
                  >
                    <XCircle size={17} /> Có vấn đề
                  </button>
                  <button
                    type="button"
                    className={myVote?.verdict === 'UNSURE' ? 'unsure active' : 'unsure'}
                    onClick={() => vote(item, 'UNSURE')}
                    disabled={isBusy}
                  >
                    <HelpCircle size={17} /> Chưa chắc
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
