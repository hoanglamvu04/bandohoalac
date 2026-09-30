import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Camera,
  CheckCircle2,
  Gift,
  QrCode,
  ScanLine,
  TicketCheck,
  Users
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getPartnerDashboard,
  redeemPartnerVoucher
} from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

function normalizeScannedCode(value) {
  const raw = String(value || '').trim();
  if (raw.toUpperCase().startsWith('HOLA-VOUCHER:')) {
    return raw.slice('HOLA-VOUCHER:'.length).trim();
  }
  return raw;
}

export default function PartnerDashboard() {
  const { showToast } = useToast();
  const videoRef = useRef(null);
  const scanTimerRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setData(await getPartnerDashboard());
    } catch (error) {
      showToast(error.message, 'error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    setScannerSupported(
      typeof window !== 'undefined' &&
      'BarcodeDetector' in window &&
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

  async function startScanner() {
    if (!scannerSupported) {
      showToast('Trình duyệt này chưa hỗ trợ quét QR trực tiếp. Hãy nhập mã voucher.', 'info');
      return;
    }

    try {
      detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      streamRef.current = stream;
      setScannerOpen(true);

      requestAnimationFrame(async () => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        scanTimerRef.current = window.setInterval(async () => {
          if (!videoRef.current || !detectorRef.current || videoRef.current.readyState < 2) return;
          try {
            const results = await detectorRef.current.detect(videoRef.current);
            const value = results?.[0]?.rawValue;
            if (value) {
              const nextCode = normalizeScannedCode(value);
              setCode(nextCode);
              stopScanner();
              await confirmCode(nextCode);
            }
          } catch {
            // Keep scanning; intermittent detector errors are expected on moving frames.
          }
        }, 650);
      });
    } catch (error) {
      stopScanner();
      showToast(
        error?.name === 'NotAllowedError'
          ? 'Cần cấp quyền camera để quét QR.'
          : 'Không thể mở camera quét QR.',
        'error'
      );
    }
  }

  async function confirmCode(value = code) {
    const normalized = normalizeScannedCode(value);
    if (!normalized) {
      showToast('Nhập hoặc quét mã voucher.', 'error');
      return;
    }
    if (redeeming) return;

    setRedeeming(true);
    try {
      const item = await redeemPartnerVoucher(normalized);
      showToast('Xác nhận thành công voucher ' + item.code + '.', 'success');
      setCode('');
      await load();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setRedeeming(false);
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
            ít nhất một địa điểm trên Hola Maps.
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
          <p>Quản lý địa điểm đã xác minh và xác nhận voucher của khách tại quán.</p>
        </div>
        <span className="partner-dashboard-mark"><Building2 size={32} /></span>
      </section>

      <section className="partner-stat-grid">
        <div><Building2 size={19} /><span><b>{data.stats?.managedPlaces || 0}</b><small>Địa điểm quản lý</small></span></div>
        <div><Gift size={19} /><span><b>{data.stats?.campaigns || 0}</b><small>Chiến dịch</small></span></div>
        <div><TicketCheck size={19} /><span><b>{data.stats?.vouchersPending || 0}</b><small>Chờ sử dụng</small></span></div>
        <div><CheckCircle2 size={19} /><span><b>{data.stats?.vouchersRedeemed || 0}</b><small>Đã sử dụng</small></span></div>
      </section>

      <section className="partner-redeem-panel">
        <div className="partner-redeem-copy">
          <span className="partner-redeem-icon"><QrCode size={24} /></span>
          <div>
            <span className="eyebrow">XÁC NHẬN VOUCHER</span>
            <h2>Quét QR hoặc nhập mã của khách</h2>
            <p>Mỗi voucher chỉ xác nhận được một lần. Hệ thống kiểm tra quyền theo đúng địa điểm đối tác.</p>
          </div>
        </div>

        <div className="partner-redeem-controls">
          <label>
            <ScanLine size={17} />
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  confirmCode();
                }
              }}
              placeholder="HOLA-XXXXXXXX"
            />
          </label>

          <button className="primary-action" type="button" onClick={() => confirmCode()} disabled={redeeming}>
            <CheckCircle2 size={16} /> {redeeming ? 'Đang xác nhận...' : 'Xác nhận mã'}
          </button>

          <button className="secondary-action" type="button" onClick={startScanner}>
            <Camera size={16} /> Quét QR
          </button>
        </div>

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
                  <small>{place.partnerStatus ? 'PARTNER · ' + place.partnerStatus : 'ĐỊA ĐIỂM ĐÃ XÁC MINH'}</small>
                  <b>{place.partnerName || place.name}</b>
                  <span>{place.address || 'Hòa Lạc'}</span>
                </div>
                <Link to={'/place/' + place.placeId}>Xem</Link>
              </article>
            ))}
          </div>
        </div>

        <div className="partner-dashboard-card">
          <div className="partner-card-head">
            <div><span className="eyebrow">VOUCHER</span><h2>Lượt đổi gần đây</h2></div>
            <span>{data.recentRedemptions?.length || 0}</span>
          </div>

          {!data.recentRedemptions?.length ? (
            <div className="empty-state"><TicketCheck size={22} /><b>Chưa có voucher được đổi</b></div>
          ) : (
            <div className="partner-redemption-list">
              {data.recentRedemptions.slice(0, 20).map((item) => (
                <article key={item.id}>
                  <div>
                    <small>{item.campaignTitle}</small>
                    <b>{item.code}</b>
                    <span>{item.userName} · {item.placeName}</span>
                  </div>
                  <span className={'voucher-status ' + item.status.toLowerCase()}>{item.status}</span>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

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
              <small>{item.partnerName} · {item.pointsCost.toLocaleString('vi-VN')} điểm</small>
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
