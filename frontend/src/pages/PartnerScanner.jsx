import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Camera,
  CheckCircle2,
  Clock3,
  History,
  LogOut,
  QrCode,
  ScanLine,
  ShieldCheck,
  TicketCheck,
  UserRound,
  Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import jsQR from 'jsqr';
import {
  endPartnerShift,
  getPartnerScannerState,
  inspectPartnerVoucher,
  startPartnerShift,
  usePartnerVoucher
} from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
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

  return { code: raw.toUpperCase(), qrToken: null };
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN');
}

export default function PartnerScanner() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);
  const canvasRef = useRef(null);
  const scanLockedRef = useRef(false);
  const lastScanRef = useRef({ value: '', at: 0 });
  const audioContextRef = useRef(null);
  const hardwareBufferRef = useRef('');
  const hardwareLastKeyAtRef = useRef(0);
  const scanHandlerRef = useRef(null);
  const resetTimerRef = useRef(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [shift, setShift] = useState(null);
  const [shiftBusy, setShiftBusy] = useState(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [scannerPaused, setScannerPaused] = useState(false);
  const [quickConfirm, setQuickConfirm] = useState(false);
  const [scanSource, setScanSource] = useState('');
  const [preview, setPreview] = useState(null);
  const [voucherInput, setVoucherInput] = useState({ code: '', qrToken: null });
  const [inspecting, setInspecting] = useState(false);
  const [usingVoucher, setUsingVoucher] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [recentUsage, setRecentUsage] = useState([]);

  const partners = data?.partners || [];
  const selectedPartner = useMemo(
    () => partners.find((item) => String(item.partnerId) === String(selectedPartnerId)) || null,
    [partners, selectedPartnerId]
  );

  async function load() {
    setLoading(true);
    try {
      const next = await getPartnerScannerState();
      setData(next);
      setRecentUsage(Array.isArray(next?.recentUsage) ? next.recentUsage : []);

      const openShift = Array.isArray(next?.openShifts) ? next.openShifts[0] : null;
      if (openShift) {
        setShift(openShift);
        setSelectedPartnerId(String(openShift.partnerId));
      } else {
        setShift(null);
        setSelectedPartnerId((current) => current || String(next?.partners?.[0]?.partnerId || ''));
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      const target = event.target;
      const tag = target?.tagName;
      const typing = target?.isContentEditable
        || tag === 'INPUT'
        || tag === 'TEXTAREA'
        || tag === 'SELECT';
      if (typing) return;

      const now = Date.now();
      if (now - hardwareLastKeyAtRef.current > 120) {
        hardwareBufferRef.current = '';
      }
      hardwareLastKeyAtRef.current = now;

      if (event.key === 'Enter') {
        const raw = hardwareBufferRef.current.trim();
        hardwareBufferRef.current = '';
        const upper = raw.toUpperCase();

        if (
          raw.length >= 8
          && (upper.startsWith('HOLA-') || upper.startsWith('HOLA-VOUCHER:'))
        ) {
          event.preventDefault();
          scanHandlerRef.current?.(raw, 'hardware');
        }
        return;
      }

      if (
        event.key.length === 1
        && !event.ctrlKey
        && !event.metaKey
        && !event.altKey
      ) {
        hardwareBufferRef.current += event.key;
        if (hardwareBufferRef.current.length > 300) {
          hardwareBufferRef.current = hardwareBufferRef.current.slice(-300);
        }
      }
    }

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  function stopCamera() {
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    scanLockedRef.current = false;
    setCameraOn(false);
    setScannerPaused(false);
  }

  function playFeedback(type = 'detected') {
    try {
      if (navigator.vibrate) {
        navigator.vibrate(type === 'success' ? [60, 35, 100] : 55);
      }

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = context;
      context.resume?.();

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      const duration = type === 'success' ? 0.13 : 0.075;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(type === 'success' ? 1080 : 860, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.11, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    } catch {
      // Feedback is optional.
    }
  }

  function resetScanner() {
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    scanLockedRef.current = false;
    lastScanRef.current = { value: '', at: 0 };
    setScannerPaused(false);
    setPreview(null);
    setVoucherInput({ code: '', qrToken: null });
    setManualCode('');
    setScanSource('');
  }

  function decodeFrame(source, width, height) {
    if (!width || !height) return null;

    const canvas = canvasRef.current || document.createElement('canvas');
    canvasRef.current = canvas;
    const maxWidth = 960;
    const scale = Math.min(1, maxWidth / width);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);

    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(frame.data, frame.width, frame.height, {
      inversionAttempts: 'attemptBoth'
    });
  }

  async function startCamera() {
    if (!shift) {
      showToast('Hãy bắt đầu ca trước khi mở máy quét.', 'error');
      return;
    }

    if (streamRef.current) {
      setCameraOn(true);
      resetScanner();
      window.setTimeout(async () => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = streamRef.current;
        try { await videoRef.current.play(); } catch {}
      }, 60);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('Trình duyệt không hỗ trợ camera. Bạn vẫn có thể dùng máy quét USB/Bluetooth.', 'error');
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass && !audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }
      audioContextRef.current?.resume?.();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      setCameraOn(true);
      resetScanner();

      window.setTimeout(async () => {
        const video = videoRef.current;
        if (!video || !streamRef.current) return;
        video.srcObject = streamRef.current;
        await video.play();

        scanTimerRef.current = window.setInterval(() => {
          if (scanLockedRef.current) return;
          const current = videoRef.current;
          if (!current || current.readyState < 2) return;

          try {
            const result = decodeFrame(current, current.videoWidth, current.videoHeight);
            if (result?.data) scanHandlerRef.current?.(result.data, 'camera');
          } catch {
            // Continue with the next moving frame.
          }
        }, 220);
      }, 80);
    } catch (error) {
      stopCamera();
      showToast(
        error?.name === 'NotAllowedError'
          ? 'Camera đang bị chặn. Hãy cấp quyền một lần hoặc dùng máy quét USB/Bluetooth.'
          : 'Không thể mở camera.',
        'error'
      );
    }
  }

  async function beginShift() {
    if (!selectedPartnerId || shiftBusy) return;

    setShiftBusy(true);
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass && !audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }
      audioContextRef.current?.resume?.();

      const item = await startPartnerShift({ partnerId: Number(selectedPartnerId) });
      setShift(item);
      showToast('Đã bắt đầu ca làm việc.', 'success');
      await startCameraAfterShift(item);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setShiftBusy(false);
    }
  }

  async function startCameraAfterShift(activeShift) {
    if (!activeShift) return;
    if (!navigator.mediaDevices?.getUserMedia) return;

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
      setCameraOn(true);
      scanLockedRef.current = false;

      window.setTimeout(async () => {
        if (!videoRef.current || !streamRef.current) return;
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play();

        if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
        scanTimerRef.current = window.setInterval(() => {
          if (scanLockedRef.current) return;
          const current = videoRef.current;
          if (!current || current.readyState < 2) return;
          try {
            const result = decodeFrame(current, current.videoWidth, current.videoHeight);
            if (result?.data) scanHandlerRef.current?.(result.data, 'camera');
          } catch {}
        }, 220);
      }, 80);
    } catch (error) {
      showToast(
        error?.name === 'NotAllowedError'
          ? 'Ca đã bắt đầu. Camera bị chặn, nhưng USB/Bluetooth scanner vẫn dùng được.'
          : 'Ca đã bắt đầu nhưng chưa mở được camera.',
        'info'
      );
    }
  }

  async function closeShift() {
    if (!shift || shiftBusy) return;
    if (!window.confirm('Kết thúc ca làm hiện tại?')) return;

    setShiftBusy(true);
    try {
      const closed = await endPartnerShift(shift.id);
      stopCamera();
      setShift(null);
      setPreview(null);
      showToast(
        'Đã kết thúc ca · ' + Number(closed.vouchersUsed || 0) + ' voucher.',
        'success'
      );
      await load();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setShiftBusy(false);
    }
  }

  async function consumeVoucher(item, parsed, source) {
    if (!item?.id || !item.valid || !shift || usingVoucher) return;

    setUsingVoucher(true);
    try {
      const used = await usePartnerVoucher(item.id, {
        code: parsed.code || item.code,
        qrToken: parsed.qrToken || null,
        shiftId: Number(shift.id)
      });

      const recentItem = {
        id: used.id,
        code: used.code,
        usedAt: used.usedAt || new Date().toISOString(),
        campaignTitle: used.campaignTitle,
        voucherValueText: used.voucherValueText,
        partnerName: used.partnerName,
        placeName: used.placeName,
        customerName: used.userName,
        cashierName: user?.name || null,
        shiftId: shift.id
      };

      setRecentUsage((current) => [recentItem, ...current.filter((row) => row.id !== recentItem.id)].slice(0, 5));
      setPreview({ ...item, ...used, valid: false, status: 'USED', justUsed: true });
      playFeedback('success');

      setShift((current) => current
        ? { ...current, vouchersUsed: Number(current.vouchersUsed || 0) + 1 }
        : current
      );

      resetTimerRef.current = window.setTimeout(resetScanner, 750);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setUsingVoucher(false);
    }
  }

  async function handleScan(rawValue, source = 'camera') {
    if (!shift || scanLockedRef.current) return;

    const parsed = parseVoucherPayload(rawValue);
    if (!parsed.code) return;

    const signature = parsed.code + ':' + (parsed.qrToken || '');
    const now = Date.now();
    if (
      lastScanRef.current.value === signature
      && now - lastScanRef.current.at < 2200
    ) return;

    lastScanRef.current = { value: signature, at: now };
    scanLockedRef.current = true;
    setScannerPaused(true);
    setScanSource(source);
    setVoucherInput(parsed);
    setManualCode(parsed.code);
    setPreview(null);
    playFeedback('detected');

    setInspecting(true);
    try {
      const item = await inspectPartnerVoucher({
        code: parsed.code,
        qrToken: parsed.qrToken || null
      });
      setPreview(item);

      if (item.valid && quickConfirm) {
        await consumeVoucher(item, parsed, source);
      }
    } catch (error) {
      showToast(error.message, 'error');
      resetTimerRef.current = window.setTimeout(resetScanner, 1200);
    } finally {
      setInspecting(false);
    }
  }

  scanHandlerRef.current = handleScan;

  async function inspectManual() {
    const parsed = parseVoucherPayload(manualCode);
    if (!parsed.code) return;
    await handleScan(parsed.code, 'manual');
  }

  if (loading) {
    return <main className="partner-scanner-page"><div className="partner-scanner-loading">Đang mở máy quét...</div></main>;
  }

  if (!data?.hasAccess) {
    return (
      <main className="partner-scanner-page">
        <section className="partner-scanner-no-access">
          <Building2 size={40} />
          <h1>Chưa có quyền Partner Scanner</h1>
          <p>Admin hoặc OWNER cần cấp quyền STAFF/OWNER cho tài khoản này trước.</p>
          <Link to="/partner">Về Partner Portal</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="partner-scanner-page">
      <header className="partner-scanner-topbar">
        <div className="partner-scanner-brand">
          <Link to="/partner"><ArrowLeft size={18} /></Link>
          <span><QrCode size={22} /></span>
          <div>
            <small>HOLA MAPS PARTNER</small>
            <b>Voucher Scanner</b>
          </div>
        </div>

        <div className="partner-scanner-session">
          <span><UserRound size={15} /> {user?.name || 'Nhân viên'}</span>
          {shift ? (
            <button type="button" onClick={closeShift} disabled={shiftBusy}>
              <LogOut size={15} /> Kết thúc ca
            </button>
          ) : (
            <Link to="/partner">Partner Portal</Link>
          )}
        </div>
      </header>

      {!shift ? (
        <section className="partner-shift-start">
          <span className="partner-shift-start-icon"><Clock3 size={30} /></span>
          <small>BẮT ĐẦU CA LÀM VIỆC</small>
          <h1>Chọn quán để mở máy quét</h1>
          <p>
            Mỗi voucher xác nhận trong ca sẽ được ghi lại theo nhân viên và thời gian
            để OWNER đối soát cuối ngày.
          </p>

          <label>
            Địa điểm / đối tác
            <select value={selectedPartnerId} onChange={(event) => setSelectedPartnerId(event.target.value)}>
              {partners.map((partner) => (
                <option key={partner.partnerId} value={partner.partnerId}>
                  {partner.partnerName} · {partner.role}
                </option>
              ))}
            </select>
          </label>

          <button className="partner-shift-start-button" type="button" onClick={beginShift} disabled={shiftBusy}>
            <ScanLine size={18} />
            {shiftBusy ? 'Đang mở ca...' : 'Bắt đầu ca & mở máy quét'}
          </button>

          <span className="partner-shift-hardware-note">
            USB/Bluetooth scanner chuẩn HID vẫn hoạt động ngay sau khi bắt đầu ca.
          </span>
        </section>
      ) : (
        <section className="partner-scanner-workspace">
          <div className="partner-scanner-main">
            <div className="partner-scanner-toolbar">
              <div>
                <small>ĐANG TRỰC TẠI</small>
                <b>{shift.partnerName || selectedPartner?.partnerName}</b>
                <span>
                  <i /> Ca bắt đầu {formatTime(shift.startedAt)} · {Number(shift.vouchersUsed || 0)} voucher
                </span>
              </div>

              <label className="partner-quick-toggle">
                <input
                  type="checkbox"
                  checked={quickConfirm}
                  onChange={(event) => setQuickConfirm(event.target.checked)}
                />
                <span><Zap size={14} /> Quick confirm</span>
              </label>
            </div>

            <div className={scannerPaused ? 'partner-live-scanner paused' : 'partner-live-scanner'}>
              {cameraOn ? (
                <video ref={videoRef} playsInline muted />
              ) : (
                <div className="partner-camera-off">
                  <Camera size={38} />
                  <b>Camera chưa bật</b>
                  <button type="button" onClick={startCamera}>Bật camera</button>
                </div>
              )}

              {cameraOn && (
                <>
                  <span className="partner-live-frame" />
                  <span className="partner-live-status">
                    {scannerPaused
                      ? inspecting
                        ? 'Đang kiểm tra...'
                        : usingVoucher
                          ? 'Đang xác nhận...'
                          : 'Đã nhận voucher'
                      : 'Sẵn sàng quét'}
                  </span>
                </>
              )}
            </div>

            <div className="partner-scanner-manual">
              <span><ScanLine size={16} /></span>
              <input
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value.toUpperCase())}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    inspectManual();
                  }
                }}
                placeholder="Quét bằng USB/Bluetooth hoặc nhập HOLA-XXXXXXXX"
              />
              <button type="button" onClick={inspectManual} disabled={!manualCode || inspecting}>
                Kiểm tra
              </button>
            </div>

            <div className="partner-scanner-source-status">
              <span><i /> USB / Bluetooth HID sẵn sàng</span>
              <small>
                {scanSource
                  ? 'Nguồn vừa nhận: ' + scanSource.toUpperCase()
                  : 'Máy quét ngoài gửi mã + Enter sẽ được nhận tự động.'}
              </small>
            </div>
          </div>

          <aside className="partner-scanner-side">
            <section className="partner-scan-result-card">
              {!scannerPaused && !preview && (
                <div className="partner-scan-waiting">
                  <ShieldCheck size={31} />
                  <b>Đang chờ voucher</b>
                  <span>Đưa QR vào khung hoặc dùng máy quét ngoài.</span>
                </div>
              )}

              {scannerPaused && inspecting && (
                <div className="partner-scan-waiting processing">
                  <ScanLine size={30} />
                  <b>Đang kiểm tra voucher...</b>
                </div>
              )}

              {preview && (
                <div className={
                  preview.justUsed || preview.status === 'USED'
                    ? 'partner-scan-result used'
                    : preview.valid
                      ? 'partner-scan-result valid'
                      : 'partner-scan-result invalid'
                }>
                  <span className="partner-scan-result-icon">
                    {preview.justUsed || preview.status === 'USED'
                      ? <TicketCheck size={27} />
                      : preview.valid
                        ? <CheckCircle2 size={27} />
                        : <Clock3 size={27} />}
                  </span>

                  <small>
                    {preview.justUsed
                      ? 'ĐÃ SỬ DỤNG'
                      : preview.valid
                        ? 'VOUCHER HỢP LỆ'
                        : 'KHÔNG THỂ SỬ DỤNG'}
                  </small>
                  <h2>{preview.voucherValueText || preview.campaignTitle}</h2>
                  <p>{preview.message}</p>

                  <div className="partner-scan-result-meta">
                    <span><small>Khách hàng</small><b>{preview.userName}</b></span>
                    <span><small>Mã</small><b>{preview.code}</b></span>
                    <span><small>Địa điểm</small><b>{preview.placeName}</b></span>
                  </div>

                  {!preview.justUsed && (
                    <div className="partner-scan-result-actions">
                      <button type="button" className="secondary-action" onClick={resetScanner}>
                        Quét mã khác
                      </button>
                      {preview.valid && (
                        <button
                          type="button"
                          className="primary-action"
                          disabled={usingVoucher}
                          onClick={() => consumeVoucher(preview, voucherInput, scanSource || 'manual')}
                        >
                          <CheckCircle2 size={16} />
                          {usingVoucher ? 'Đang xác nhận...' : 'Xác nhận sử dụng'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="partner-scanner-recent">
              <header>
                <div><History size={16} /><b>5 giao dịch gần nhất</b></div>
                <span>Ca hiện tại: {Number(shift.vouchersUsed || 0)}</span>
              </header>

              {!recentUsage.length ? (
                <div className="partner-scanner-recent-empty">Chưa có voucher được sử dụng.</div>
              ) : (
                <div className="partner-scanner-recent-list">
                  {recentUsage.map((item) => (
                    <article key={item.id}>
                      <span><CheckCircle2 size={15} /></span>
                      <div>
                        <b>{item.voucherValueText || item.campaignTitle}</b>
                        <small>{item.customerName} · {item.code}</small>
                      </div>
                      <time>{formatTime(item.usedAt)}</time>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </section>
      )}

      {shift && (
        <footer className="partner-scanner-footer">
          <span><i /> Ca đang hoạt động</span>
          <small>
            {selectedPartner?.partnerName || shift.partnerName} · Bắt đầu {formatDateTime(shift.startedAt)}
          </small>
        </footer>
      )}
    </main>
  );
}
