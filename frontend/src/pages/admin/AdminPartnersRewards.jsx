import { useEffect, useMemo, useState } from 'react';
import {
  BadgePercent,
  CheckCircle2,
  Handshake,
  CheckCircle2 as CheckSelected,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  TicketCheck,
  XCircle
} from 'lucide-react';
import {
  createAdminPartner,
  createAdminVoucher,
  getAdminPartners,
  getAdminPlaces,
  getAdminPlaceClaims,
  getAdminVoucherRedemptions,
  getAdminVouchers,
  markAdminVoucherRedeemed,
  reviewAdminPlaceClaim,
  updateAdminPartner,
  updateAdminVoucher
} from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

function toLocalDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const EMPTY_PARTNER = {
  placeId: '',
  status: 'PENDING',
  partnerName: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  note: ''
};

const EMPTY_VOUCHER = {
  partnerId: '',
  title: '',
  description: '',
  voucherValueText: '',
  terms: '',
  pointsCost: 1000,
  quantityTotal: '',
  maxPerUser: 1,
  status: 'DRAFT',
  startsAt: '',
  endsAt: ''
};

export default function AdminPartnersRewards() {
  const { showToast } = useToast();
  const [tab, setTab] = useState('partners');
  const [partners, setPartners] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  const [partnerId, setPartnerId] = useState(null);
  const [partnerForm, setPartnerForm] = useState({ ...EMPTY_PARTNER });
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState([]);
  const [placePickerOpen, setPlacePickerOpen] = useState(false);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);

  const [voucherId, setVoucherId] = useState(null);
  const [voucherForm, setVoucherForm] = useState({ ...EMPTY_VOUCHER });
  const [saving, setSaving] = useState(false);

  const selectedPartner = useMemo(
    () => partners.find((item) => String(item.id) === String(partnerId)) || null,
    [partners, partnerId]
  );
  const selectedVoucher = useMemo(
    () => vouchers.find((item) => String(item.id) === String(voucherId)) || null,
    [vouchers, voucherId]
  );

  async function loadAll() {
    setLoading(true);
    try {
      const [partnerData, voucherData, redemptionData, claimData] = await Promise.all([
        getAdminPartners(),
        getAdminVouchers(),
        getAdminVoucherRedemptions(),
        getAdminPlaceClaims()
      ]);
      setPartners(Array.isArray(partnerData?.items) ? partnerData.items : []);
      setVouchers(Array.isArray(voucherData?.items) ? voucherData.items : []);
      setRedemptions(Array.isArray(redemptionData?.items) ? redemptionData.items : []);
      setClaims(Array.isArray(claimData?.items) ? claimData.items : []);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!placePickerOpen || partnerId || partnerForm.placeId) {
      setPlaceResults([]);
      setPlaceLoading(false);
      return undefined;
    }

    const timer = setTimeout(() => {
      const needle = placeQuery.trim();
      setPlaceLoading(true);
      getAdminPlaces({
        q: needle || undefined,
        status: 'PUBLISHED',
        limit: needle ? 30 : 40
      })
        .then((data) => {
          const items = Array.isArray(data?.items) ? data.items : [];
          const linkedPlaceIds = new Set(partners.map((item) => String(item.placeId)));
          setPlaceResults(
            items.filter((place) => !linkedPlaceIds.has(String(place.id)))
          );
        })
        .catch(() => setPlaceResults([]))
        .finally(() => setPlaceLoading(false));
    }, placeQuery.trim() ? 220 : 0);

    return () => clearTimeout(timer);
  }, [placeQuery, placePickerOpen, partnerId, partnerForm.placeId, partners]);

  function startPartner() {
    setPartnerId(null);
    setPartnerForm({ ...EMPTY_PARTNER });
    setPlaceQuery('');
    setPlaceResults([]);
    setPlacePickerOpen(false);
    setSelectedPlace(null);
  }

  function editPartner(item) {
    setPartnerId(item.id);
    setPartnerForm({
      placeId: item.placeId,
      status: item.status,
      partnerName: item.partnerName || '',
      contactName: item.contactName || '',
      contactPhone: item.contactPhone || '',
      contactEmail: item.contactEmail || '',
      note: item.note || ''
    });
    setPlaceQuery(item.placeName || '');
    setPlaceResults([]);
    setPlacePickerOpen(false);
    setSelectedPlace(null);
  }

  async function savePartner(event) {
    event.preventDefault();
    if (!partnerId && !partnerForm.placeId) {
      showToast('Chọn một địa điểm đã có trên Hola Maps.', 'error');
      return;
    }

    const payload = {
      status: partnerForm.status,
      partnerName: partnerForm.partnerName.trim() || null,
      contactName: partnerForm.contactName.trim() || null,
      contactPhone: partnerForm.contactPhone.trim() || null,
      contactEmail: partnerForm.contactEmail.trim() || null,
      note: partnerForm.note.trim() || null
    };

    setSaving(true);
    try {
      if (partnerId) {
        await updateAdminPartner(partnerId, payload);
      } else {
        await createAdminPartner({ ...payload, placeId: Number(partnerForm.placeId) });
      }
      showToast(partnerId ? 'Đã cập nhật đối tác.' : 'Đã tạo hồ sơ đối tác.', 'success');
      startPartner();
      await loadAll();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function startVoucher(partner = null) {
    setVoucherId(null);
    setVoucherForm({
      ...EMPTY_VOUCHER,
      partnerId: partner?.id || ''
    });
    setTab('vouchers');
  }

  function editVoucher(item) {
    setVoucherId(item.id);
    setVoucherForm({
      partnerId: item.partnerId,
      title: item.title || '',
      description: item.description || '',
      voucherValueText: item.voucherValueText || '',
      terms: item.terms || '',
      pointsCost: item.pointsCost || 1000,
      quantityTotal: item.quantityTotal ?? '',
      maxPerUser: item.maxPerUser || 1,
      status: item.status || 'DRAFT',
      startsAt: toLocalDateTime(item.startsAt),
      endsAt: toLocalDateTime(item.endsAt)
    });
  }

  async function saveVoucher(event) {
    event.preventDefault();
    if (!voucherForm.partnerId || !voucherForm.title.trim()) {
      showToast('Chọn đối tác và nhập tên chiến dịch.', 'error');
      return;
    }

    const payload = {
      partnerId: Number(voucherForm.partnerId),
      title: voucherForm.title.trim(),
      description: voucherForm.description.trim() || null,
      voucherValueText: voucherForm.voucherValueText.trim() || null,
      terms: voucherForm.terms.trim() || null,
      pointsCost: Number(voucherForm.pointsCost),
      quantityTotal:
        voucherForm.quantityTotal === '' || Number(voucherForm.quantityTotal) <= 0
          ? null
          : Number(voucherForm.quantityTotal),
      maxPerUser: Number(voucherForm.maxPerUser || 1),
      status: voucherForm.status,
      startsAt: toIso(voucherForm.startsAt),
      endsAt: toIso(voucherForm.endsAt)
    };

    setSaving(true);
    try {
      if (voucherId) await updateAdminVoucher(voucherId, payload);
      else await createAdminVoucher(payload);
      showToast(voucherId ? 'Đã cập nhật voucher.' : 'Đã tạo chiến dịch voucher.', 'success');
      setVoucherId(null);
      setVoucherForm({ ...EMPTY_VOUCHER });
      await loadAll();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function markRedeemed(item) {
    if (!window.confirm('Xác nhận voucher ' + item.code + ' đã được sử dụng?')) return;
    try {
      await markAdminVoucherRedeemed(item.id);
      showToast('Đã xác nhận voucher được sử dụng.', 'success');
      await loadAll();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function reviewClaim(item, status) {
    const reviewNote = status === 'REJECTED'
      ? window.prompt('Lý do từ chối yêu cầu xác minh:', '') || ''
      : '';

    if (status === 'REJECTED' && !reviewNote.trim()) return;

    try {
      await reviewAdminPlaceClaim(item.id, {
        status,
        reviewNote: reviewNote.trim() || null
      });
      showToast(
        status === 'APPROVED' ? 'Đã xác minh quyền quản lý địa điểm.' : 'Đã từ chối yêu cầu.',
        status === 'APPROVED' ? 'success' : 'info'
      );
      await loadAll();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  return (
    <main className="admin-page admin-partners-page page-container">
      <section className="section-heading admin-partners-heading">
        <div>
          <span className="eyebrow">PARTNER REWARDS</span>
          <h2>Đối tác & Voucher</h2>
          <p>Gắn quán/địa điểm trên bản đồ thành đối tác, tạo ưu đãi và quản lý voucher người dùng đã đổi.</p>
        </div>
      </section>

      <nav className="admin-reward-tabs">
        <button className={tab === 'partners' ? 'active' : ''} onClick={() => setTab('partners')} type="button">
          <Handshake size={16} /> Đối tác <span>{partners.length}</span>
        </button>
        <button className={tab === 'vouchers' ? 'active' : ''} onClick={() => setTab('vouchers')} type="button">
          <BadgePercent size={16} /> Chiến dịch <span>{vouchers.length}</span>
        </button>
        <button className={tab === 'redemptions' ? 'active' : ''} onClick={() => setTab('redemptions')} type="button">
          <TicketCheck size={16} /> Voucher đã đổi <span>{redemptions.length}</span>
        </button>
        <button className={tab === 'claims' ? 'active' : ''} onClick={() => setTab('claims')} type="button">
          <ShieldCheck size={16} /> Xác minh chủ quán <span>{claims.filter((item) => item.status === 'PENDING').length}</span>
        </button>
      </nav>

      {loading ? <div className="loading-card">Đang tải dữ liệu đối tác...</div> : (
        <>
          {tab === 'partners' && (
            <div className="admin-partner-grid">
              <section className="admin-partner-list-card">
                <div className="admin-reward-card-head">
                  <div><b>Địa điểm đối tác</b><span>Đối tác luôn gắn với một place có sẵn.</span></div>
                  <button className="primary-action" type="button" onClick={startPartner}><Plus size={15} /> Thêm đối tác</button>
                </div>

                {!partners.length && <div className="empty-state"><Handshake size={23} /><b>Chưa có đối tác</b></div>}

                <div className="admin-partner-list">
                  {partners.map((item) => (
                    <button type="button" className={String(item.id) === String(partnerId) ? 'admin-partner-row active' : 'admin-partner-row'} onClick={() => editPartner(item)} key={item.id}>
                      <span className="admin-partner-image">{item.placeImage ? <img src={item.placeImage} alt="" /> : <MapPin size={20} />}</span>
                      <span>
                        <small>{item.status}</small>
                        <b>{item.partnerName || item.placeName}</b>
                        <em>{item.placeAddress || 'Hòa Lạc'}</em>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <form className="admin-partner-form-card" onSubmit={savePartner}>
                <div className="admin-reward-card-head">
                  <div><b>{partnerId ? 'Chỉnh sửa đối tác' : 'Thêm đối tác mới'}</b><span>{selectedPartner?.placeName || 'Chọn địa điểm đã xuất bản trên Hola Maps.'}</span></div>
                </div>

                {!partnerId && (
                  <div className="admin-place-picker">
                    <div className="admin-place-picker-title">
                      <div>
                        <b>Chọn địa điểm có sẵn trên Maps</b>
                        <span>Chỉ hiển thị địa điểm đã xuất bản và chưa được gắn đối tác.</span>
                      </div>
                      {partnerForm.placeId && (
                        <button
                          className="admin-place-clear"
                          type="button"
                          onClick={() => {
                            setPartnerForm((current) => ({
                              ...current,
                              placeId: '',
                              partnerName: ''
                            }));
                            setSelectedPlace(null);
                            setPlaceQuery('');
                            setPlacePickerOpen(true);
                          }}
                        >
                          Chọn lại
                        </button>
                      )}
                    </div>

                    {!partnerForm.placeId ? (
                      <>
                        <label>
                          Tìm hoặc chọn địa điểm
                          <span className="admin-place-picker-input">
                            <Search size={16} />
                            <input
                              value={placeQuery}
                              onFocus={() => setPlacePickerOpen(true)}
                              onChange={(event) => {
                                setPlaceQuery(event.target.value);
                                setPlacePickerOpen(true);
                              }}
                              placeholder="Bấm vào đây để xem danh sách địa điểm..."
                              autoComplete="off"
                            />
                          </span>
                        </label>

                        {placePickerOpen && (
                          <div className="admin-place-picker-dropdown">
                            <div className="admin-place-picker-dropdown-head">
                              <span>{placeQuery.trim() ? 'Kết quả tìm kiếm' : 'Địa điểm trên Hola Maps'}</span>
                              <small>{placeLoading ? 'Đang tải...' : placeResults.length + ' địa điểm'}</small>
                            </div>

                            {placeLoading ? (
                              <div className="admin-place-picker-state">Đang tải danh sách địa điểm...</div>
                            ) : placeResults.length ? (
                              <div className="admin-place-picker-results">
                                {placeResults.map((place) => (
                                  <button
                                    type="button"
                                    key={place.id}
                                    onClick={() => {
                                      setSelectedPlace(place);
                                      setPartnerForm((current) => ({
                                        ...current,
                                        placeId: place.id,
                                        partnerName: place.name || current.partnerName
                                      }));
                                      setPlaceQuery(place.name || '');
                                      setPlaceResults([]);
                                      setPlacePickerOpen(false);
                                    }}
                                  >
                                    <span className="admin-place-result-icon"><MapPin size={15} /></span>
                                    <span className="admin-place-result-copy">
                                      <b>{place.name}</b>
                                      <small>{place.address || 'Hòa Lạc'}</small>
                                      <em>{place.category || place.categoryName || 'Địa điểm'}</em>
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="admin-place-picker-state">
                                {placeQuery.trim()
                                  ? 'Không tìm thấy địa điểm phù hợp.'
                                  : 'Chưa có địa điểm khả dụng để gắn đối tác.'}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="admin-place-selected-card">
                        <span className="admin-place-selected-icon"><CheckSelected size={18} /></span>
                        <div>
                          <small>ĐÃ CHỌN TỪ HOLA MAPS</small>
                          <b>{selectedPlace?.name || placeQuery}</b>
                          <span>{selectedPlace?.address || 'Địa điểm đã xuất bản trên bản đồ'}</span>
                        </div>
                        <em>Place #{partnerForm.placeId}</em>
                      </div>
                    )}
                  </div>
                )}

                <label> Tên đối tác <input value={partnerForm.partnerName} onChange={(e) => setPartnerForm((c) => ({ ...c, partnerName: e.target.value }))} /></label>
                <label> Trạng thái
                  <select value={partnerForm.status} onChange={(e) => setPartnerForm((c) => ({ ...c, status: e.target.value }))}>
                    <option value="PENDING">PENDING</option><option value="ACTIVE">ACTIVE</option><option value="PAUSED">PAUSED</option><option value="ENDED">ENDED</option>
                  </select>
                </label>
                <div className="admin-partner-form-row">
                  <label>Người liên hệ<input value={partnerForm.contactName} onChange={(e) => setPartnerForm((c) => ({ ...c, contactName: e.target.value }))} /></label>
                  <label>Số điện thoại<input value={partnerForm.contactPhone} onChange={(e) => setPartnerForm((c) => ({ ...c, contactPhone: e.target.value }))} /></label>
                </div>
                <label>Email liên hệ<input type="email" value={partnerForm.contactEmail} onChange={(e) => setPartnerForm((c) => ({ ...c, contactEmail: e.target.value }))} /></label>
                <label>Ghi chú<textarea rows="4" value={partnerForm.note} onChange={(e) => setPartnerForm((c) => ({ ...c, note: e.target.value }))} /></label>
                <div className="admin-partner-form-actions">
                  <button className="primary-action" disabled={saving} type="submit">{saving ? 'Đang lưu...' : 'Lưu đối tác'}</button>
                  {partnerId && <button className="secondary-action" type="button" onClick={() => startVoucher(selectedPartner)}><BadgePercent size={15} /> Tạo voucher</button>}
                </div>
              </form>
            </div>
          )}

          {tab === 'vouchers' && (
            <div className="admin-voucher-layout">
              <section className="admin-voucher-list-card">
                <div className="admin-reward-card-head">
                  <div><b>Chiến dịch voucher</b><span>Điểm được trừ từ ví Explorer khi đổi.</span></div>
                  <button className="primary-action" type="button" onClick={() => startVoucher()}><Plus size={15} /> Tạo chiến dịch</button>
                </div>
                <div className="admin-voucher-list">
                  {vouchers.map((item) => (
                    <button className={String(item.id) === String(voucherId) ? 'admin-voucher-row active' : 'admin-voucher-row'} type="button" onClick={() => editVoucher(item)} key={item.id}>
                      <span><small>{item.status} · {item.partnerName}</small><b>{item.title}</b><em>{item.voucherValueText || item.placeName}</em></span>
                      <strong>{item.pointsCost.toLocaleString('vi-VN')}<small> điểm</small></strong>
                    </button>
                  ))}
                </div>
              </section>

              <form className="admin-voucher-form-card" onSubmit={saveVoucher}>
                <div className="admin-reward-card-head">
                  <div><b>{voucherId ? 'Chỉnh sửa chiến dịch' : 'Tạo chiến dịch voucher'}</b><span>Ví dụ: 1.000 điểm đổi voucher giảm 50.000đ.</span></div>
                </div>
                <label>Đối tác
                  <select value={voucherForm.partnerId} onChange={(e) => setVoucherForm((c) => ({ ...c, partnerId: e.target.value }))}>
                    <option value="">Chọn đối tác</option>
                    {partners.map((item) => <option value={item.id} key={item.id}>{item.partnerName || item.placeName}</option>)}
                  </select>
                </label>
                <label>Tên chiến dịch<input value={voucherForm.title} onChange={(e) => setVoucherForm((c) => ({ ...c, title: e.target.value }))} placeholder="Đổi 1.000 điểm - giảm 50.000đ" /></label>
                <label>Giá trị voucher<input value={voucherForm.voucherValueText} onChange={(e) => setVoucherForm((c) => ({ ...c, voucherValueText: e.target.value }))} placeholder="Giảm 50.000đ hóa đơn từ 200.000đ" /></label>
                <label>Mô tả<textarea rows="3" value={voucherForm.description} onChange={(e) => setVoucherForm((c) => ({ ...c, description: e.target.value }))} /></label>
                <div className="admin-partner-form-row">
                  <label>Điểm cần đổi<input type="number" min="1" value={voucherForm.pointsCost} onChange={(e) => setVoucherForm((c) => ({ ...c, pointsCost: e.target.value }))} /></label>
                  <label>Số lượng voucher <span className="field-help">0 hoặc để trống = không giới hạn</span><input type="number" min="0" value={voucherForm.quantityTotal} onChange={(e) => setVoucherForm((c) => ({ ...c, quantityTotal: e.target.value }))} placeholder="0 = không giới hạn" /></label>
                </div>
                <div className="admin-partner-form-row">
                  <label>Giới hạn/user<input type="number" min="1" value={voucherForm.maxPerUser} onChange={(e) => setVoucherForm((c) => ({ ...c, maxPerUser: e.target.value }))} /></label>
                  <label>Trạng thái<select value={voucherForm.status} onChange={(e) => setVoucherForm((c) => ({ ...c, status: e.target.value }))}><option>DRAFT</option><option>ACTIVE</option><option>PAUSED</option><option>ENDED</option></select></label>
                </div>
                <div className="admin-partner-form-row">
                  <label>Bắt đầu<input type="datetime-local" value={voucherForm.startsAt} onChange={(e) => setVoucherForm((c) => ({ ...c, startsAt: e.target.value }))} /></label>
                  <label>Kết thúc<input type="datetime-local" value={voucherForm.endsAt} onChange={(e) => setVoucherForm((c) => ({ ...c, endsAt: e.target.value }))} /></label>
                </div>
                <label>Điều kiện sử dụng<textarea rows="4" value={voucherForm.terms} onChange={(e) => setVoucherForm((c) => ({ ...c, terms: e.target.value }))} placeholder="Không áp dụng cùng chương trình khác..." /></label>
                <button className="primary-action" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu chiến dịch'}</button>
              </form>
            </div>
          )}

          {tab === 'claims' && (
            <section className="admin-claims-card">
              <div className="admin-reward-card-head">
                <div>
                  <b>Yêu cầu xác minh địa điểm</b>
                  <span>Duyệt chủ quán/người đại diện trước khi cấp quyền Business Dashboard.</span>
                </div>
              </div>

              {!claims.length ? (
                <div className="empty-state"><ShieldCheck size={24} /><b>Chưa có yêu cầu xác minh</b></div>
              ) : (
                <div className="admin-claim-list">
                  {claims.map((item) => (
                    <article key={item.id} className={'admin-claim-row ' + item.status.toLowerCase()}>
                      <span className="admin-claim-place-image">
                        {item.placeImage ? <img src={item.placeImage} alt="" /> : <MapPin size={20} />}
                      </span>
                      <div className="admin-claim-main">
                        <small>{item.status} · CLAIM #{item.id}</small>
                        <b>{item.businessName || item.placeName}</b>
                        <span>{item.placeName} · {item.placeAddress || 'Hòa Lạc'}</span>
                        <em>{item.userName} · {item.userEmail} · {item.contactPhone}</em>
                        <p>{item.proofNote}</p>
                        {item.reviewNote && <blockquote>{item.reviewNote}</blockquote>}
                      </div>
                      <div className="admin-claim-actions">
                        {item.status === 'PENDING' ? (
                          <>
                            <button className="approve" type="button" onClick={() => reviewClaim(item, 'APPROVED')}>
                              <ShieldCheck size={15} /> Duyệt
                            </button>
                            <button className="reject" type="button" onClick={() => reviewClaim(item, 'REJECTED')}>
                              <XCircle size={15} /> Từ chối
                            </button>
                          </>
                        ) : (
                          <span className={'voucher-status ' + (item.status === 'APPROVED' ? 'redeemed' : 'cancelled')}>{item.status}</span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === 'redemptions' && (
            <section className="admin-redemptions-card">
              <div className="admin-reward-card-head">
                <div><b>Voucher người dùng đã đổi</b><span>Quán/admin dùng mã này để xác nhận ưu đãi đã được sử dụng.</span></div>
              </div>
              {!redemptions.length ? <div className="empty-state"><TicketCheck size={23} /><b>Chưa có lượt đổi voucher</b></div> : (
                <div className="admin-redemption-table">
                  {redemptions.map((item) => (
                    <article key={item.id}>
                      <span><small>{item.campaignTitle}</small><b>{item.code}</b><em>{item.userName} · {item.userEmail}</em></span>
                      <span><b>{item.pointsSpent.toLocaleString('vi-VN')} điểm</b><small>{new Date(item.createdAt).toLocaleString('vi-VN')}</small></span>
                      <span className={'voucher-status ' + item.status.toLowerCase()}>{item.status}</span>
                      {item.status === 'ISSUED' ? <button type="button" onClick={() => markRedeemed(item)}><CheckCircle2 size={15} /> Xác nhận đã dùng</button> : <span className="admin-redemption-done">Đã xử lý</span>}
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
