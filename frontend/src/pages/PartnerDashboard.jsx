import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Camera,
  CheckCircle2,
  Clock3,
  Gift,
  History,
  ImageUp,
  Mail,
  Pencil,
  QrCode,
  Save,
  ScanLine,
  ShieldCheck,
  TicketCheck,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import jsQR from 'jsqr';
import {
  addPartnerStaff,
  getPartnerDashboard,
  inspectPartnerVoucher,
  updatePartnerManagedPlace,
  updatePartnerStaffStatus,
  usePartnerVoucher
} from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

function parseVoucherPayload(value) {
  const raw = String(value || '').trim();
  if (!raw) return { code: '', qrToken: null };

  if (raw.toUpperCase().startsWith('HOLA-VOUCHER:')) {
    const parts = raw.split(':');
    return {
      code: String(parts[1] || '').trim().toUpperCase(),
      qrToken: parts[2] ? String(parts[2]).trim() : null
    };
  }

  return {
    code: raw.toUpperCase(),
    qrToken: null
  };
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN');
}

function statusLabel(status) {
  if (status === 'USED' || status === 'REDEEMED') return 'Đã sử dụng';
  if (status === 'ISSUED') return 'Có thể sử dụng';
  if (status === 'EXPIRED') return 'Hết hạn';
  if (status === 'CANCELLED') return 'Đã hủy';
  return status || 'Không xác định';
}

export default function PartnerDashboard() {
  const { showToast } = useToast();
  const videoRef = useRef(null);
  const scanTimerRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [usingVoucher, setUsingVoucher] = useState(false);
  const [voucherPreview, setVoucherPreview] = useState(null);
  const [voucherInput, setVoucherInput] = useState({ code: '', qrToken: null });

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(false);
  const [imageScanning, setImageScanning] = useState(false);

  const [editingPlace, setEditingPlace] = useState(null);
  const [placeForm, setPlaceForm] = useState({
    phone: '',
    website: '',
    openingHours: '',
    description: ''
  });
  const [placeSaving, setPlaceSaving] = useState(false);

  const [staffEmail, setStaffEmail] = useState('');
  const [staffPartnerId, setStaffPartnerId] = useState('');
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffUpdatingId, setStaffUpdatingId] = useState(null);

  const ownerPartners = useMemo(
    () => (data?.managedPlaces || []).filter(
      (item) => item.partnerId && item.canManageStaff
    ),
    [data?.managedPlaces]
  );

  const visibleStaff = useMemo(() => {
    const items = Array.isArray(data?.staffMembers) ? data.staffMembers : [];
    if (!staffPartnerId) return items;
    return items.filter((item) => String(item.partnerId) === String(staffPartnerId));
  }, [data?.staffMembers, staffPartnerId]);

  async function load({ silent = false } = {}) {
    if (!silent) setLoading(true);
    try {
      const next = await getPartnerDashboard();
      setData(next);
      const ownerIds = Array.isArray(next?.ownerPartnerIds) ? next.ownerPartnerIds : [];
      setStaffPartnerId((current) => {
        if (current && ownerIds.some((id) => String(id) === String(current))) return current;
        return ownerIds[0] || '';
      });
    } catch (error) {
      showToast(error.message, 'error');
      setData(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    setScannerSupported(
      typeof window !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia)
    );

    return stopScanner;
  }, []);

  function stopScanner() {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScannerOpen(false);
  }

  async function inspectVoucher(payload) {
    const parsed = typeof payload === 'string'
      ? parseVoucherPayload(payload)
      : payload;

    if (!parsed?.code) {
      showToast('Nhập hoặc quét mã voucher.', 'error');
      return;
    }

    if (inspecting) return;
    setInspecting(true);
    setVoucherPreview(null);

    try {
      const item = await inspectPartnerVoucher({
        code: parsed.code,
        qrToken: parsed.qrToken || null
      });
      setVoucherInput(parsed);
      setCode(parsed.code);
      setVoucherPreview(item);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setInspecting(false);
    }
  }

  function decodeFrame(source, width, height) {
    if (!width || !height || typeof document === 'undefined') return null;

    const canvas = canvasRef.current || document.createElement('canvas');
    canvasRef.current = canvas;

    // Decode a reasonably sized frame to keep scanning smooth on mobile.
    const maxWidth = 960;
    const scale = Math.min(1, maxWidth / width);
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(source, 0, 0, targetWidth, targetHeight);
    const frame = context.getImageData(0, 0, targetWidth, targetHeight);

    return jsQR(frame.data, frame.width, frame.height, {
      inversionAttempts: 'attemptBoth'
    });
  }

  async function startScanner() {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast(
        'Trình duyệt không mở được camera. Hãy chọn ảnh QR hoặc nhập mã voucher.',
        'info'
      );
      fileInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      setScannerOpen(true);

      window.setTimeout(async () => {
        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();

        scanTimerRef.current = window.setInterval(async () => {
          const currentVideo = videoRef.current;
          if (!currentVideo || currentVideo.readyState < 2) return;

          try {
            const result = decodeFrame(
              currentVideo,
              currentVideo.videoWidth,
              currentVideo.videoHeight
            );
            const value = result?.data;
            if (!value) return;

            const parsed = parseVoucherPayload(value);
            stopScanner();
            await inspectVoucher(parsed);
          } catch {
            // A moving frame can be unreadable; continue scanning the next frame.
          }
        }, 280);
      }, 80);
    } catch (error) {
      stopScanner();
      showToast(
        error?.name === 'NotAllowedError'
          ? 'Camera đang bị chặn. Hãy cấp quyền camera hoặc chọn ảnh QR từ máy.'
          : 'Không thể mở camera. Bạn có thể chọn ảnh QR hoặc nhập mã voucher.',
        'error'
      );
    }
  }

  async function scanQrImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || imageScanning) return;

    setImageScanning(true);
    try {
      let imageSource;

      if ('createImageBitmap' in window) {
        imageSource = await createImageBitmap(file);
      } else {
        imageSource = await new Promise((resolve, reject) => {
          const image = new Image();
          const url = URL.createObjectURL(file);
          image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
          };
          image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('IMAGE_LOAD_FAILED'));
          };
          image.src = url;
        });
      }

      const result = decodeFrame(
        imageSource,
        imageSource.width || imageSource.naturalWidth,
        imageSource.height || imageSource.naturalHeight
      );

      imageSource.close?.();

      if (!result?.data) {
        showToast('Không tìm thấy QR trong ảnh này. Hãy thử ảnh rõ hơn.', 'error');
        return;
      }

      await inspectVoucher(parseVoucherPayload(result.data));
    } catch {
      showToast('Không thể đọc ảnh QR. Hãy thử ảnh khác hoặc nhập mã voucher.', 'error');
    } finally {
      setImageScanning(false);
    }
  }

  async function confirmVoucherUse() {
    if (!voucherPreview?.id || !voucherPreview?.valid || usingVoucher) return;

    if (!window.confirm(
      'Xác nhận voucher ' + voucherPreview.code + ' đã được sử dụng tại ' +
      voucherPreview.placeName + '?'
    )) return;

    setUsingVoucher(true);
    try {
      const item = await usePartnerVoucher(voucherPreview.id, {
        code: voucherInput.code || voucherPreview.code,
        qrToken: voucherInput.qrToken || null
      });

      setVoucherPreview({
        ...voucherPreview,
        ...item,
        valid: false,
        status: 'USED',
        message: 'Voucher đã được ghi nhận sử dụng thành công.'
      });
      setCode('');
      showToast('Đã xác nhận voucher ' + item.code + ' là USED.', 'success');
      await load({ silent: true });
    } catch (error) {
      showToast(error.message, 'error');
      try {
        await inspectVoucher(voucherInput);
      } catch {
        // The toast above is enough.
      }
    } finally {
      setUsingVoucher(false);
    }
  }

  function editPlace(place) {
    setEditingPlace(place);
    setPlaceForm({
      phone: place.phone || '',
      website: place.website || '',
      openingHours: place.openingHours || '',
      description: place.description || ''
    });
  }

  async function savePlace(event) {
    event.preventDefault();
    if (!editingPlace) return;

    setPlaceSaving(true);
    try {
      await updatePartnerManagedPlace(editingPlace.placeId, {
        phone: placeForm.phone.trim() || null,
        website: placeForm.website.trim() || null,
        openingHours: placeForm.openingHours.trim() || null,
        description: placeForm.description.trim() || null
      });
      showToast('Đã cập nhật thông tin địa điểm.', 'success');
      setEditingPlace(null);
      await load({ silent: true });
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setPlaceSaving(false);
    }
  }

  async function addStaff(event) {
    event.preventDefault();
    if (!staffPartnerId || !staffEmail.trim()) {
      showToast('Chọn đối tác và nhập email tài khoản nhân viên.', 'error');
      return;
    }

    setStaffSaving(true);
    try {
      await addPartnerStaff({
        partnerId: Number(staffPartnerId),
        email: staffEmail.trim()
      });
      setStaffEmail('');
      showToast('Đã cấp quyền STAFF cho nhân viên.', 'success');
      await load({ silent: true });
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setStaffSaving(false);
    }
  }

  async function changeStaffStatus(item) {
    if (item.role !== 'STAFF' || staffUpdatingId) return;
    const nextStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    setStaffUpdatingId(item.id);
    try {
      await updatePartnerStaffStatus(item.id, { status: nextStatus });
      showToast(
        nextStatus === 'ACTIVE'
          ? 'Đã kích hoạt lại tài khoản nhân viên.'
          : 'Đã tạm khóa quyền nhân viên.',
        'success'
      );
      await load({ silent: true });
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setStaffUpdatingId(null);
    }
  }

  if (loading) {
    return <main className="partner-dashboard page-container"><div className="loading-card">Đang tải Partner Dashboard...</div></main>;
  }

  if (!data?.hasAccess) {
    return (
      <main className="partner-dashboard page-container">
        <section className="partner-no-access">
          <Building2 size={36} />
          <h1>Chưa có địa điểm được xác minh</h1>
          <p>
            Partner Dashboard chỉ mở khi tài khoản của bạn đã được xác minh quyền quản lý
            hoặc được OWNER thêm làm nhân viên của một đối tác trên Hola Maps.
          </p>
          <Link className="primary-action" to="/map">Tìm địa điểm của bạn</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="partner-dashboard page-container">
      <section className="partner-dashboard-hero">
        <div>
          <span className="eyebrow">HOLA MAPS PARTNER</span>
          <h1>Partner Dashboard</h1>
          <p>
            Quét voucher, xác nhận sử dụng, quản lý địa điểm và theo dõi lịch sử
            giao dịch tại quán.
          </p>
        </div>
        <span className="partner-dashboard-mark"><Building2 size={32} /></span>
      </section>

      <section className="partner-stat-grid">
        <div><Building2 size={19} /><span><b>{data.stats?.managedPlaces || 0}</b><small>Địa điểm truy cập</small></span></div>
        <div><Gift size={19} /><span><b>{data.stats?.campaigns || 0}</b><small>Chiến dịch</small></span></div>
        <div><TicketCheck size={19} /><span><b>{data.stats?.vouchersPending || 0}</b><small>Chờ sử dụng</small></span></div>
        <div><CheckCircle2 size={19} /><span><b>{data.stats?.vouchersUsed || 0}</b><small>Đã dùng</small></span></div>
      </section>

      <section className="partner-redeem-panel partner-voucher-scanner">
        <div className="partner-redeem-copy">
          <span className="partner-redeem-icon"><QrCode size={24} /></span>
          <div>
            <span className="eyebrow">VOUCHER SCANNER</span>
            <h2>Kiểm tra trước, xác nhận sau</h2>
            <p>
              Quét QR hoặc nhập mã. Voucher chỉ chuyển sang USED sau khi nhân viên
              kiểm tra thông tin và bấm xác nhận.
            </p>
          </div>
        </div>

        <div className="partner-redeem-controls">
          <label>
            <ScanLine size={17} />
            <input
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase());
                setVoucherPreview(null);
                setVoucherInput({ code: '', qrToken: null });
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  inspectVoucher(parseVoucherPayload(code));
                }
              }}
              placeholder="HOLA-XXXXXXXX"
            />
          </label>

          <button
            className="primary-action"
            type="button"
            onClick={() => inspectVoucher(parseVoucherPayload(code))}
            disabled={inspecting}
          >
            <ShieldCheck size={16} />
            {inspecting ? 'Đang kiểm tra...' : 'Kiểm tra mã'}
          </button>

          <button className="secondary-action" type="button" onClick={startScanner}>
            <Camera size={16} /> Quét QR
          </button>

          <button
            className="secondary-action"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={imageScanning}
          >
            <ImageUp size={16} /> {imageScanning ? 'Đang đọc...' : 'Chọn ảnh QR'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={scanQrImage}
          />
        </div>

        {voucherPreview && (
          <article className={'partner-voucher-preview ' + (voucherPreview.valid ? 'valid' : 'invalid')}>
            <div className="partner-voucher-preview-status">
              <span>
                {voucherPreview.valid
                  ? <CheckCircle2 size={25} />
                  : voucherPreview.status === 'USED'
                    ? <TicketCheck size={25} />
                    : <Clock3 size={25} />}
              </span>
              <div>
                <small>{statusLabel(voucherPreview.status)}</small>
                <b>{voucherPreview.message}</b>
              </div>
            </div>

            <div className="partner-voucher-preview-grid">
              <span><small>Ưu đãi</small><b>{voucherPreview.voucherValueText || voucherPreview.campaignTitle}</b></span>
              <span><small>Khách hàng</small><b>{voucherPreview.userName}</b></span>
              <span><small>Địa điểm</small><b>{voucherPreview.placeName}</b></span>
              <span><small>Mã voucher</small><b>{voucherPreview.code}</b></span>
            </div>

            {voucherPreview.terms && (
              <div className="partner-voucher-preview-terms">
                <small>Điều kiện sử dụng</small>
                <span>{voucherPreview.terms}</span>
              </div>
            )}

            <footer>
              <div>
                {voucherPreview.expiresAt && (
                  <span><Clock3 size={13} /> Hạn: {formatDateTime(voucherPreview.expiresAt)}</span>
                )}
                {voucherPreview.usedAt && (
                  <span>
                    <History size={13} />
                    Đã dùng: {formatDateTime(voucherPreview.usedAt)}
                    {voucherPreview.usedByName ? ' · ' + voucherPreview.usedByName : ''}
                  </span>
                )}
              </div>

              {voucherPreview.valid && (
                <button
                  className="primary-action partner-use-voucher"
                  type="button"
                  disabled={usingVoucher}
                  onClick={confirmVoucherUse}
                >
                  <CheckCircle2 size={17} />
                  {usingVoucher ? 'Đang xác nhận...' : 'Xác nhận đã sử dụng'}
                </button>
              )}
            </footer>
          </article>
        )}

        {scannerOpen && (
          <div className="partner-scanner-modal">
            <div className="partner-scanner-card">
              <div className="partner-scanner-head">
                <span><Camera size={17} /> Đưa QR voucher vào khung</span>
                <button type="button" onClick={stopScanner}>Đóng</button>
              </div>
              <div className="partner-scanner-video">
                <video ref={videoRef} playsInline muted />
                <span className="partner-scan-frame" />
              </div>
              <p className="partner-scanner-help">
                Giữ QR trong khung khoảng 1–2 giây. Hệ thống đọc QR bằng JavaScript nên
                không phụ thuộc BarcodeDetector của trình duyệt. Voucher chỉ được kiểm tra,
                chưa bị sử dụng ở bước này.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="partner-dashboard-grid">
        <div className="partner-dashboard-card">
          <div className="partner-card-head">
            <div><span className="eyebrow">ĐỊA ĐIỂM</span><h2>Đang quản lý</h2></div>
            <span>{data.managedPlaces?.length || 0}</span>
          </div>

          <div className="partner-place-list">
            {data.managedPlaces?.map((place) => (
              <article key={place.placeId}>
                <span className="partner-place-image">
                  {place.image ? <img src={place.image} alt="" /> : <Building2 size={20} />}
                </span>
                <div>
                  <small>
                    {place.partnerStatus
                      ? (place.partnerRole || 'PARTNER') + ' · ' + place.partnerStatus
                      : 'ĐỊA ĐIỂM ĐÃ XÁC MINH'}
                  </small>
                  <b>{place.partnerName || place.name}</b>
                  <span>{place.address || 'Hòa Lạc'}</span>
                </div>
                <div className="partner-place-actions">
                  {place.canEditPlace && (
                    <button type="button" onClick={() => editPlace(place)}>
                      <Pencil size={13} /> Sửa
                    </button>
                  )}
                  <Link to={'/place/' + place.placeId}>Xem</Link>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="partner-dashboard-card partner-usage-history-card">
          <div className="partner-card-head">
            <div><span className="eyebrow">LỊCH SỬ SỬ DỤNG</span><h2>Voucher đã dùng</h2></div>
            <span>{data.usageHistory?.length || 0}</span>
          </div>

          {!data.usageHistory?.length ? (
            <div className="empty-state">
              <History size={22} />
              <b>Chưa có voucher được sử dụng</b>
              <span>Lượt xác nhận đầu tiên sẽ xuất hiện tại đây.</span>
            </div>
          ) : (
            <div className="partner-redemption-list partner-history-list">
              {data.usageHistory.slice(0, 30).map((item) => (
                <article key={item.id}>
                  <div>
                    <small>{item.campaignTitle}</small>
                    <b>{item.code}</b>
                    <span>
                      {item.userName} · {item.placeName}
                      {item.usedByName ? ' · NV: ' + item.usedByName : ''}
                    </span>
                    <em>{formatDateTime(item.usedAt)}</em>
                  </div>
                  <span className="voucher-status used">USED</span>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {ownerPartners.length > 0 && (
        <section className="partner-dashboard-card partner-staff-card">
          <div className="partner-card-head">
            <div>
              <span className="eyebrow">PARTNER STAFF</span>
              <h2>Nhân viên quán</h2>
            </div>
            <span>{visibleStaff.filter((item) => item.role === 'STAFF').length} staff</span>
          </div>

          <div className="partner-staff-layout">
            <form className="partner-staff-form" onSubmit={addStaff}>
              <div className="partner-staff-form-copy">
                <span className="partner-staff-form-icon"><UserPlus size={21} /></span>
                <div>
                  <b>Thêm nhân viên</b>
                  <small>
                    Nhân viên dùng tài khoản Hola Maps riêng và chỉ có quyền quét/xác nhận voucher.
                  </small>
                </div>
              </div>

              {ownerPartners.length > 1 && (
                <label>
                  Đối tác
                  <select value={staffPartnerId} onChange={(e) => setStaffPartnerId(e.target.value)}>
                    {ownerPartners.map((place) => (
                      <option key={place.partnerId} value={place.partnerId}>
                        {place.partnerName || place.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                Email tài khoản nhân viên
                <span className="partner-staff-email">
                  <Mail size={16} />
                  <input
                    type="email"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="nhanvien@example.com"
                  />
                </span>
              </label>

              <button className="primary-action" type="submit" disabled={staffSaving}>
                <UserPlus size={16} />
                {staffSaving ? 'Đang thêm...' : 'Cấp quyền STAFF'}
              </button>
            </form>

            <div className="partner-staff-list">
              {!visibleStaff.length ? (
                <div className="empty-state">
                  <Users size={22} />
                  <b>Chưa có nhân viên</b>
                  <span>Thêm tài khoản nhân viên để họ quét voucher bằng máy riêng.</span>
                </div>
              ) : (
                visibleStaff.map((item) => (
                  <article key={item.id} className={item.status === 'ACTIVE' ? 'active' : 'inactive'}>
                    <span className="partner-staff-avatar">
                      {(item.userName || '?')
                        .split(' ')
                        .map((word) => word[0])
                        .slice(-2)
                        .join('')
                        .toUpperCase()}
                    </span>
                    <div>
                      <small>{item.role} · {item.status}</small>
                      <b>{item.userName}</b>
                      <span>{item.userEmail}</span>
                    </div>

                    {item.role === 'STAFF' ? (
                      <button
                        type="button"
                        disabled={staffUpdatingId === item.id}
                        onClick={() => changeStaffStatus(item)}
                      >
                        {item.status === 'ACTIVE' ? 'Tạm khóa' : 'Kích hoạt'}
                      </button>
                    ) : (
                      <span className="partner-owner-pill">OWNER</span>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {editingPlace && (
        <div className="partner-edit-modal">
          <form className="partner-edit-card" onSubmit={savePlace}>
            <div className="partner-edit-head">
              <div>
                <span className="eyebrow">BUSINESS DETAILS</span>
                <h2>{editingPlace.name}</h2>
              </div>
              <button type="button" onClick={() => setEditingPlace(null)}><X size={17} /></button>
            </div>

            <p>
              Bạn có thể cập nhật các thông tin vận hành của địa điểm đã xác minh.
              Tên và vị trí bản đồ vẫn do Hola Maps kiểm duyệt riêng.
            </p>

            <label>Số điện thoại<input value={placeForm.phone} onChange={(e) => setPlaceForm((v) => ({ ...v, phone: e.target.value }))} /></label>
            <label>Website<input value={placeForm.website} onChange={(e) => setPlaceForm((v) => ({ ...v, website: e.target.value }))} placeholder="https://..." /></label>
            <label>Giờ mở cửa<textarea rows="3" value={placeForm.openingHours} onChange={(e) => setPlaceForm((v) => ({ ...v, openingHours: e.target.value }))} /></label>
            <label>Mô tả<textarea rows="5" value={placeForm.description} onChange={(e) => setPlaceForm((v) => ({ ...v, description: e.target.value }))} /></label>

            <button className="primary-action" type="submit" disabled={placeSaving}>
              <Save size={16} /> {placeSaving ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
          </form>
        </div>
      )}

      <section className="partner-dashboard-card">
        <div className="partner-card-head">
          <div><span className="eyebrow">CHIẾN DỊCH</span><h2>Voucher đang quản lý</h2></div>
          <span>{data.campaigns?.length || 0}</span>
        </div>
        <div className="partner-campaign-grid">
          {data.campaigns?.map((item) => (
            <article key={item.id}>
              <span>{item.status}</span>
              <b>{item.title}</b>
              <small>
                {item.partnerName} · {item.pointsCost.toLocaleString('vi-VN')} điểm
              </small>
              {item.voucherValueText && <em>{item.voucherValueText}</em>}
              <div>
                <strong>{item.quantityRedeemed}</strong>
                <span>/ {item.quantityTotal === null ? '∞' : item.quantityTotal} lượt đổi</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
