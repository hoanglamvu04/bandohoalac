import { useEffect, useState } from 'react';
import { Award, Camera, Check, Clock3, MapPin, ShieldCheck, Users, X } from 'lucide-react';
import {
  client, getAdminContributions, rejectContribution
} from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import '../../contribution-scoring.css';

const TYPE_LABELS = {
  CREATE_PLACE: 'Thêm địa điểm mới',
  UPDATE_PLACE: 'Cập nhật thông tin',
  ADD_PHOTO: 'Thêm ảnh',
  FIX_LOCATION: 'Chỉnh vị trí',
  UPDATE_HOURS: 'Cập nhật giờ mở cửa',
  UPDATE_PRICE: 'Cập nhật giá',
  REPORT_CLOSED: 'Báo đóng cửa',
  REPORT_WRONG_INFO: 'Báo sai thông tin',
  REPORT_FLOOD: 'Báo ngập',
  REPORT_ROAD_CLOSURE: 'Báo đường cấm',
  REPORT_ALERT: 'Cảnh báo khu vực'
};

const COMMUNITY_STATE_LABELS = {
  COLLECTING: 'Đang thu thập',
  CONFIRMED: 'Cộng đồng đồng thuận',
  DISPUTED: 'Có tranh chấp',
  SPLIT: 'Ý kiến chia đôi'
};

const SCORE_CRITERIA = [
  {
    key: 'placeValue',
    label: 'Giá trị địa điểm / dữ liệu',
    max: 4,
    description: 'Mức hữu ích, cần thiết hoặc giá trị khám phá với cộng đồng.'
  },
  {
    key: 'accuracy',
    label: 'Chính xác & xác thực',
    max: 5,
    description: 'Tên, vị trí, địa chỉ và nội dung có thể đối chiếu, đáng tin cậy.'
  },
  {
    key: 'freshness',
    label: 'Độ mới của thông tin / ảnh',
    max: 4,
    description: 'Phản ánh tình trạng gần đây, không phải dữ liệu/ảnh đã quá cũ.'
  },
  {
    key: 'visualCoverage',
    label: 'Ảnh & mức độ thể hiện không gian',
    max: 4,
    description: 'Ảnh rõ, nhận diện tốt và cho thấy thực tế/không gian địa điểm.'
  },
  {
    key: 'completeness',
    label: 'Độ đầy đủ thông tin',
    max: 3,
    description: 'Có đủ các trường quan trọng phù hợp với loại đóng góp.'
  }
];

const MAX_POINTS = SCORE_CRITERIA.reduce((sum, item) => sum + item.max, 0);

function emptyDraft() {
  return {
    scores: Object.fromEntries(SCORE_CRITERIA.map((criterion) => [criterion.key, null])),
    note: ''
  };
}

function draftTotal(draft) {
  return SCORE_CRITERIA.reduce((sum, criterion) => {
    const value = draft?.scores?.[criterion.key];
    return sum + (Number.isInteger(value) ? value : 0);
  }, 0);
}

function draftComplete(draft) {
  return SCORE_CRITERIA.every((criterion) => Number.isInteger(draft?.scores?.[criterion.key]));
}

function contributionPhotos(item) {
  const direct = Array.isArray(item.payload?.photos) ? item.payload.photos : [];
  if (direct.length) return direct;
  const assets = Array.isArray(item.payload?.photoAssets) ? item.payload.photoAssets : [];
  return assets.map((asset) => asset?.url || asset?.secureUrl).filter(Boolean);
}

export default function AdminContributions() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [status, setStatus] = useState('PENDING');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [scoreDrafts, setScoreDrafts] = useState({});
  const [duplicatesById, setDuplicatesById] = useState({});
  const [nearbyAcknowledged, setNearbyAcknowledged] = useState({});

  function load() {
    setLoading(true);
    getAdminContributions({ status })
      .then((data) => {
        const nextItems = Array.isArray(data.items) ? data.items : [];
        setItems(nextItems);
        if (status === 'PENDING') {
          setScoreDrafts((current) => {
            const next = { ...current };
            nextItems.forEach((item) => {
              if (!next[item.id]) next[item.id] = emptyDraft();
            });
            return next;
          });
        }
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }

  useEffect(load, [status]);

  function updateScore(id, key, value) {
    setScoreDrafts((current) => {
      const draft = current[id] || emptyDraft();
      return {
        ...current,
        [id]: {
          ...draft,
          scores: { ...draft.scores, [key]: value }
        }
      };
    });
  }

  function updateScoreNote(id, note) {
    setScoreDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] || emptyDraft()), note }
    }));
  }

  async function checkDuplicates(id) {
    setDuplicatesById((current) => ({ ...current, [id]: { loading: true } }));
    setNearbyAcknowledged((current) => ({ ...current, [id]: false }));
    try {
      const response = await client.get('/admin/contributions/' + encodeURIComponent(id) + '/duplicates');
      const next = {
        loading: false,
        checked: true,
        items: Array.isArray(response.data?.items) ? response.data.items : []
      };
      setDuplicatesById((current) => ({ ...current, [id]: next }));
      return next;
    } catch (err) {
      const next = {
        loading: false,
        checked: false,
        error: err.response?.data?.error || 'Không kiểm tra được tin gần vị trí này.'
      };
      setDuplicatesById((current) => ({ ...current, [id]: next }));
      return next;
    }
  }

  async function handleApprove(item) {
    const isRealEstate = Boolean(
      item.placeCategorySlug === 'bat-dong-san' ||
      item.payload?.place?.realEstate ||
      item.payload?.place?.realEstatePriceVnd !== undefined
    );
    if (isRealEstate && item.type === 'CREATE_PLACE' && item.payload?.place?.realEstate) {
      // Re-check immediately before submitting, even if the queue was already
      // examined earlier. Server repeats this gate transactionally.
      const latest = await checkDuplicates(item.id);
      if (!latest.checked) {
        showToast(latest.error || 'Không thể kiểm tra tin gần vị trí, vui lòng thử lại.', 'error');
        return;
      }
      if (latest.items.length > 0 && !nearbyAcknowledged[item.id]) {
        showToast('Có tin gần vị trí. Hãy xem danh sách và tích xác nhận trước khi duyệt.', 'error');
        return;
      }
    }
    if (isRealEstate && !window.confirm(
      item.type === 'REPORT_CLOSED'
        ? 'Bạn đã kiểm tra bằng chứng và liên hệ nếu cần? Duyệt sẽ tạm ẩn bất động sản khỏi toàn bộ bản đồ.'
        : item.payload?.place?.realEstatePriceVnd !== undefined
          ? 'Bạn đã kiểm tra giá cập nhật? Duyệt sẽ thay giá công khai của tin bất động sản.'
          : 'Bạn đã kiểm tra giá, vị trí, thông tin liên hệ? Duyệt sẽ xuất bản tin bất động sản lên bản đồ.'
    )) return;
    const draft = isRealEstate
      ? {
          scores: Object.fromEntries(SCORE_CRITERIA.map((criterion) => [criterion.key, 0])),
          note: 'Tin bất động sản: duyệt thủ công, không cấp điểm.'
        }
      : scoreDrafts[item.id] || emptyDraft();
    if (!draftComplete(draft)) {
      showToast('Hãy chấm đủ 5 tiêu chí trước khi duyệt.', 'error');
      return;
    }

    const total = draftTotal(draft);
    setBusyId(item.id);
    try {
      await client.post('/admin/contributions/' + encodeURIComponent(item.id) + '/approve', {
        scoreBreakdown: draft.scores,
        scoreNote: draft.note.trim() || undefined,
        ...(isRealEstate && item.type === 'CREATE_PLACE' && item.payload?.place?.realEstate
          ? { nearbyListingsReviewed: true } : {})
      });
      const isRoadStatus = ['REPORT_FLOOD', 'REPORT_ROAD_CLOSURE', 'REPORT_ALERT'].includes(item.type);
      showToast(
        isRealEstate
          ? (item.type === 'REPORT_CLOSED'
              ? 'Đã duyệt báo cáo và tạm ẩn tin bất động sản.'
              : item.payload?.place?.realEstatePriceVnd !== undefined
                ? 'Đã duyệt cập nhật giá bất động sản.'
                : 'Đã duyệt tin bất động sản. Tin hiện có thể xem trên bản đồ.')
          : isRoadStatus
            ? `Đã xác minh tình trạng và cộng +${total}/${MAX_POINTS} điểm chất lượng.`
            : `Đã duyệt đóng góp và cộng +${total}/${MAX_POINTS} điểm chất lượng.`,
        'success'
      );
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setScoreDrafts((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Không thể duyệt đóng góp.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id) {
    if (!rejectReason.trim()) {
      showToast('Vui lòng nhập lý do từ chối.', 'error');
      return;
    }
    setBusyId(id);
    try {
      await rejectContribution(id, rejectReason.trim());
      showToast('Đã từ chối đóng góp.', 'info');
      setItems((current) => current.filter((item) => item.id !== id));
      setRejectingId(null);
      setRejectReason('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="admin-page page-container admin-contribution-scoring-page">
      <div className="section-heading contribution-admin-heading">
        <div>
          <span className="eyebrow">MODERATION & QUALITY SCORE</span>
          <h2>Đóng góp cộng đồng</h2>
          <p>Mỗi đóng góp được duyệt nhận <b>tối đa {MAX_POINTS} điểm</b>. Điểm thực nhận phụ thuộc chất lượng dữ liệu do Admin/Moderator chấm.</p>
        </div>
        <div className="admin-status-tabs">
          {['PENDING', 'APPROVED', 'REJECTED'].map((value) => (
            <button key={value} className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>
              {value}
            </button>
          ))}
        </div>
      </div>

      {status === 'PENDING' && (
        <div className="quality-policy-banner">
          <ShieldCheck size={20} />
          <div>
            <b>20 điểm là trần, không phải mức mặc định.</b>
            <span>Hãy xem địa điểm, độ chính xác, độ mới, ảnh/không gian, độ đầy đủ và tín hiệu Community Verification trước khi duyệt. Đồng thuận cộng đồng không tự xuất bản dữ liệu.</span>
          </div>
        </div>
      )}

      {loading && <div className="loading-card">Đang tải danh sách...</div>}
      {!loading && !items.length && (
        <div className="empty-state"><Clock3 size={24} /><b>Không có đóng góp nào</b><span>Trạng thái: {status}</span></div>
      )}

      <div className="contribution-list">
        {items.map((item) => {
          const place = item.payload?.place || {};
          const isPropertyPriceUpdate = place.realEstatePriceVnd !== undefined;
          const isRealEstate = Boolean(place.realEstate || isPropertyPriceUpdate ||
            item.placeCategorySlug === 'bat-dong-san');
          const canReviewRealEstate = ['ADMIN', 'MODERATOR'].includes(user?.role);
          const estate = place.realEstate;
          const location = item.payload?.location;
          const photos = contributionPhotos(item);
          const draft = scoreDrafts[item.id] || emptyDraft();
          const total = draftTotal(draft);
          const isComplete = draftComplete(draft);
          const moderation = item.moderation || item.payload?.moderation;
          const community = item.communityVerification || {};
          const communityVotes = Number(community.confirmCount || 0)
            + Number(community.disputeCount || 0)
            + Number(community.unsureCount || 0);

          return (
            <article className="contribution-card quality-contribution-card" key={item.id}>
              <div className="contribution-card-head">
                <span className="place-kicker">{TYPE_LABELS[item.type] || item.type}</span>
                <span className="result-note">{new Date(item.createdAt).toLocaleString('vi-VN')}</span>
              </div>

              <h3>{place.name || item.placeName || `Contribution #${item.id}`}</h3>
              <p className="detail-description">Người gửi: <b>{item.userName}</b> ({item.userEmail})</p>

              {place.address && <p className="place-meta"><MapPin size={15} /> {place.address}</p>}
              {location && <p className="place-meta"><MapPin size={15} /> GPS: {Number(location.lat).toFixed(6)}, {Number(location.lng).toFixed(6)}</p>}
              {place.description && <p className="detail-description">{place.description}</p>}
              {isPropertyPriceUpdate && (
                <div className="form-status info">
                  <strong>YÊU CẦU THAY ĐỔI GIÁ BẤT ĐỘNG SẢN</strong>
                  <p>Giá mới đề xuất: {new Intl.NumberFormat('vi-VN').format(Number(place.realEstatePriceVnd))} đ</p>
                  <small>Chỉ Admin/Moderator được phép duyệt; giá công khai chỉ thay đổi sau khi duyệt.</small>
                </div>
              )}
              {isRealEstate && estate && (
                <div className="form-status info">
                  <strong>TIN BẤT ĐỘNG SẢN · {estate.transactionType === 'SALE' ? 'CẦN BÁN' : 'CHO THUÊ'}</strong>
                  <div>
                    Loại: {({ LAND: 'Đất', HOUSE: 'Nhà', APARTMENT: 'Căn hộ', VILLA: 'Biệt thự', COMMERCIAL: 'Mặt bằng', OTHER: 'Khác' })[estate.propertyType] || estate.propertyType}
                    {' · '}Diện tích: {estate.areaM2} m²
                  </div>
                  <div>
                    {estate.transactionType === 'SALE' ? 'Tổng giá bán' : 'Giá thuê/tháng'}:
                    {' '}{new Intl.NumberFormat('vi-VN').format(
                      estate.transactionType === 'SALE' ? estate.totalPriceVnd : estate.monthlyRentVnd
                    )} đ
                  </div>
                  <div>Liên hệ: {estate.contactName || item.userName} · {place.phone}</div>
                  <div>{estate.publicContactConsent === true ? '✓ Đã đồng ý công khai liên hệ' : '⚠ Chưa có xác nhận công khai liên hệ'}</div>
                  {!!photos.length && <div>{estate.imageRightsConfirmed === true ? '✓ Đã xác nhận quyền ảnh' : '⚠ Chưa xác nhận quyền sử dụng ảnh'}</div>}
                  {!photos.length && <div>⚠ Tin chưa có ảnh minh họa</div>}
                  {!place.description?.trim() && <div>⚠ Tin chưa có mô tả tài sản</div>}
                  {status === 'PENDING' && canReviewRealEstate && (
                    <div className="estate-admin-duplicate-check" data-testid={'estate-duplicate-check-' + item.id}>
                      <button className="secondary-action" type="button"
                        onClick={() => checkDuplicates(item.id)}
                        disabled={duplicatesById[item.id]?.loading || busyId === item.id}>
                        <MapPin size={14}/>
                        {duplicatesById[item.id]?.loading
                          ? 'Đang kiểm tra…' : 'Kiểm tra tin gần vị trí (100 m)'}
                      </button>
                      {duplicatesById[item.id]?.error && (
                        <p role="alert">{duplicatesById[item.id].error}</p>
                      )}
                      {duplicatesById[item.id]?.checked && (
                        <div className="estate-nearby-results">
                          {!duplicatesById[item.id].items.length ? (
                            <p>Không tìm thấy tin đang đăng hoặc chờ duyệt trong phạm vi 100 m.</p>
                          ) : (
                            <>
                              <strong>Phát hiện {duplicatesById[item.id].items.length} tin gần đây — cần kiểm tra thủ công.</strong>
                              <p>Gần nhau không có nghĩa là trùng tài sản. Đối chiếu tên, số liên hệ, vị trí và ảnh.</p>
                              {duplicatesById[item.id].items.map((duplicate) => (
                                <p key={duplicate.source + ':' + duplicate.id}>
                                  {duplicate.risk === 'LIKELY_DUPLICATE' ? '⚠ Có dấu hiệu trùng · '
                                    : duplicate.risk === 'REVIEW' ? 'Cần đối chiếu · ' : 'Gần vị trí · '}
                                  {duplicate.distanceM} m ·{' '}
                                  {duplicate.source === 'PUBLISHED'
                                    ? <a href={'/place/' + duplicate.id}
                                        target="_blank" rel="noreferrer">
                                        {duplicate.name}
                                      </a>
                                    : <span>Đang chờ duyệt #{duplicate.id}: {duplicate.name}</span>}
                                  {' · '}{duplicate.address || ''}
                                  {duplicate.phone ? ' · ' + duplicate.phone : ''}
                                </p>
                              ))}
                              <label className="estate-nearby-acknowledgement">
                                <input type="checkbox"
                                  aria-label={'Tôi đã đối chiếu tin gần vị trí ' + item.id}
                                  checked={Boolean(nearbyAcknowledged[item.id])}
                                  disabled={busyId === item.id}
                                  onChange={(event) => setNearbyAcknowledged((current) => ({
                                    ...current, [item.id]: event.target.checked
                                  }))}/>
                                <span>Tôi đã đối chiếu các tin gần vị trí và xác nhận đây là bất động sản khác.
                                  Tin trùng thật sự phải bị từ chối, không xuất bản.</span>
                              </label>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <small>Tin chỉ được tạo trên bản đồ khi Admin/Moderator duyệt. Hãy kiểm tra vị trí, thông tin liên hệ và giá trước khi đăng.</small>
                </div>
              )}
              {item.payload?.fieldKey && (
                <div className="form-status info">
                  Trường cần kiểm tra: {item.payload.fieldKey === 'ADDRESS' ? 'Địa chỉ' : item.payload.fieldKey === 'OPENING_HOURS' ? 'Giờ mở cửa' : 'Số điện thoại'}
                  {item.payload.suggestedValue ? ' · Đề xuất: ' + item.payload.suggestedValue : ''}
                </div>
              )}
              {item.payload?.reason && <div className="form-status info">Nội dung báo cáo: {item.payload.reason}</div>}

              {['REPORT_FLOOD', 'REPORT_ROAD_CLOSURE', 'REPORT_ALERT'].includes(item.type) && (
                <div className="form-status info">
                  Mức độ: <b>{item.payload?.severity || 'MEDIUM'}</b>
                  {' · '}{Number(item.activeConfirmations || 0)} người xác nhận vẫn còn
                  {' · '}{Number(item.resolvedConfirmations || 0)} người báo đã hết
                  {item.payload?.expiresAt
                    ? ' · Tự hết hạn ' + new Date(item.payload.expiresAt).toLocaleString('vi-VN')
                    : ''}
                </div>
              )}

              {(place.price || place.openingHours || place.phone) && (
                <p className="place-meta">
                  {place.price ? <>Giá: {place.price}</> : null}
                  {place.openingHours ? <> · Giờ: {place.openingHours}</> : null}
                  {place.phone ? <> · SĐT: {place.phone}</> : null}
                </p>
              )}
              {item.rejectReason && <div className="form-status error">Lý do từ chối: {item.rejectReason}</div>}

              {!!photos.length && (
                <div className="contribution-photos">
                  {photos.map((url) => <img key={url} src={url} alt="Ảnh đóng góp" />)}
                  <span className="result-note"><Camera size={14} /> {photos.length} ảnh</span>
                </div>
              )}

              {(status === 'PENDING' || communityVotes > 0) && (
                <section className={'admin-community-consensus state-' + String(community.state || 'COLLECTING').toLowerCase()}>
                  <div>
                    <span><Users size={15} /> COMMUNITY VERIFICATION V2.4</span>
                    <b>{COMMUNITY_STATE_LABELS[community.state] || COMMUNITY_STATE_LABELS.COLLECTING}</b>
                    <small>Lane: {item.reviewLane || 'STANDARD_REVIEW'} · Confidence {Number(community.confidence || 0)}/100</small>
                  </div>
                  <div className="admin-community-consensus-stats">
                    <span><b>{Number(community.confirmCount || 0)}</b><small>xác nhận</small></span>
                    <span><b>{Number(community.disputeCount || 0)}</b><small>phản đối</small></span>
                    <span><b>{Number(community.unsureCount || 0)}</b><small>chưa chắc</small></span>
                    <span><b>{Number(item.contributorReputation?.communityPriorityBoost || 0) > 0 ? '+1' : '0'}</b><small>priority boost</small></span>
                  </div>
                  <p>
                    {community.state === 'CONFIRMED'
                      ? 'Cộng đồng đã đạt đồng thuận. Đây chỉ là tín hiệu ưu tiên; quyết định cuối vẫn thuộc người kiểm duyệt.'
                      : ['DISPUTED', 'SPLIT'].includes(community.state)
                        ? 'Có ý kiến trái chiều. Hãy kiểm tra kỹ bằng chứng trước khi duyệt hoặc từ chối.'
                        : `Cần tối thiểu ${Number(community.requiredVoters || 3)} người độc lập để hình thành đồng thuận.`}
                  </p>
                </section>
              )}

              {status === 'PENDING' && !isRealEstate && (
                <section className="contribution-score-panel">
                  <div className="score-panel-head">
                    <div>
                      <span className="score-panel-kicker"><Award size={15} /> CHẤM ĐIỂM CHẤT LƯỢNG</span>
                      <h4>Điểm thực nhận do người duyệt quyết định</h4>
                    </div>
                    <div className={isComplete ? 'score-total complete' : 'score-total'}>
                      <b>{total}</b><span>/ {MAX_POINTS}</span>
                    </div>
                  </div>

                  <div className="score-criteria-list">
                    {SCORE_CRITERIA.map((criterion) => {
                      const selected = draft.scores[criterion.key];
                      return (
                        <div className="score-criterion" key={criterion.key}>
                          <div className="score-criterion-copy">
                            <b>{criterion.label}</b>
                            <span>{criterion.description}</span>
                          </div>
                          <div className="score-options" aria-label={criterion.label}>
                            {Array.from({ length: criterion.max + 1 }, (_, value) => (
                              <button
                                type="button"
                                key={value}
                                className={selected === value ? 'active' : ''}
                                onClick={() => updateScore(item.id, criterion.key, value)}
                              >
                                {value}
                              </button>
                            ))}
                            <small>/ {criterion.max}</small>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <label className="score-note-field">
                    Ghi chú chấm điểm <span>(không bắt buộc)</span>
                    <textarea
                      rows="2"
                      maxLength="1000"
                      value={draft.note}
                      onChange={(event) => updateScoreNote(item.id, event.target.value)}
                      placeholder="Ví dụ: ảnh mới, vị trí chuẩn; thiếu giờ mở cửa nên trừ 1 điểm..."
                    />
                  </label>

                  <div className="score-summary-line">
                    {isComplete
                      ? <>Sẽ cộng <b>+{total} điểm</b> vào ví khi duyệt.</>
                      : <>Còn {SCORE_CRITERIA.filter((criterion) => !Number.isInteger(draft.scores[criterion.key])).length} tiêu chí chưa chấm.</>}
                  </div>
                </section>
              )}

              {status === 'APPROVED' && moderation && (
                <section className="approved-score-card">
                  <Award size={18} />
                  <div>
                    <span>Điểm chất lượng đã duyệt</span>
                    <b>+{Number(moderation.pointsAwarded || 0)} / {Number(moderation.maxPoints || MAX_POINTS)} điểm</b>
                    {moderation.scoreNote && <small>{moderation.scoreNote}</small>}
                  </div>
                </section>
              )}

              {status === 'APPROVED' && !moderation && (
                <div className="legacy-score-note">Đóng góp này được duyệt trước khi áp dụng cơ chế chấm điểm chất lượng.</div>
              )}

              {status === 'PENDING' && isRealEstate && (
                <div className="form-status info">
                  <ShieldCheck size={15} /> Duyệt tin bất động sản không cộng điểm thưởng.
                  {!canReviewRealEstate && ' Chỉ Admin hoặc Moderator có quyền duyệt tin.'}
                </div>
              )}
              {status === 'PENDING' && (
                <div className="contribution-actions">
                  <button
                    className="primary-action"
                    disabled={busyId === item.id || (isRealEstate ? (!canReviewRealEstate || (estate && (estate.publicContactConsent !== true || (!!photos.length && estate.imageRightsConfirmed !== true)))) : !isComplete)}
                    onClick={() => handleApprove(item)}
                    title={isRealEstate
                      ? (item.type === 'REPORT_CLOSED' ? 'Kiểm tra bằng chứng rồi tạm ẩn tin' : 'Kiểm tra thông tin bất động sản')
                      : (!isComplete ? 'Hãy chấm đủ 5 tiêu chí trước' : '')}
                  >
                    <Check size={17} /> {isRealEstate
                      ? (item.type === 'REPORT_CLOSED' ? 'Duyệt & ẩn tin'
                        : isPropertyPriceUpdate ? 'Duyệt cập nhật giá' : 'Duyệt & đăng bản đồ')
                      : 'Duyệt +' + total + ' điểm'}
                  </button>
                  <button className="secondary-action" disabled={busyId === item.id || (isRealEstate && !canReviewRealEstate)} onClick={() => setRejectingId(item.id)}>
                    <X size={17} /> Từ chối
                  </button>
                </div>
              )}

              {rejectingId === item.id && (
                <div className="reject-panel">
                  <textarea
                    rows="2"
                    placeholder="Lý do từ chối..."
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                  />
                  <div className="contribution-actions">
                    <button className="primary-action" disabled={busyId === item.id} onClick={() => handleReject(item.id)}>Xác nhận từ chối</button>
                    <button className="secondary-action" onClick={() => { setRejectingId(null); setRejectReason(''); }}>Hủy</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}