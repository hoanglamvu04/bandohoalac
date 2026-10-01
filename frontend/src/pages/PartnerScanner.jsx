import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  Building2,
  Camera,
  CheckCircle2,
  History,
  QrCode,
  ScanLine,
  ShieldCheck,
  TicketCheck,
  UserRound
} from 'lucide-react';
import { Link } from 'react-router-dom';
import jsQR from 'jsqr';
import {
  getPartnerScannerState,
  inspectPartnerVoucher,
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

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  return amount.toLocaleString('vi-VN') + 'đ';
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

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [scannerPaused, setScannerPaused] = useState(false);
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
      setSelectedPartnerId((current) => current || String(next?.partners?.[0]?.partnerId || ''));
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
      if (now - hardwareLastKeyAtRef.current > 120) hardwareBufferRef.current = '';
      hardwareLastKeyAtRef.current = now;

      if (event.key === 'Enter') {
        const raw = hardwareBufferRef.current.trim();
        hardwareBufferRef.current = '';
        const upper = raw.toUpperCase();
        if (raw.length >= 8 && (upper.startsWith('HOLA-') || upper.startsWith('HOLA-VOUCHER:'))) {
          event.preventDefault();
          scanHandlerRef.current?.(raw, 'hardware');
        }
        return;
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
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
      if (navigator.vibrate) navigator.vibrate(type === 'success' ? [70, 45, 110] : 60);
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = context;
      context.resume?.();

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      const duration = type === 'success' ? 0.14 : 0.08;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(type === 'success' ? 1046 : 880, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    } catch {
      // Sound and vibration are optional enhancements.
    }
  }

  function resetScanner() {
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
    return jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'attemptBoth' });
  }

  async function startCamera() {
    if (!selectedPartnerId) {
      showToast('Hãy chọn đối tác trước khi quét voucher.', 'error');
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
      if (AudioContextClass && !audioContextRef.current) audioContextRef.current = new AudioContextClass();
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
            // Continue with the next frame.
          }
        }, 220);
      }, 80);
    } catch (error) {
      stopCamera();
      showToast(
        error?.name === 'NotAllowedError'
          ? 'Camera đang bị chặn. Hãy cấp quyền hoặc dùng máy quét USB/Bluetooth.'
          : 'Không thể mở camera.',
        'error'
      );
    }
  }

  async function handleScan(rawValue, source = 'camera') {
    if (!selectedPartnerId || scanLockedRef.current) return;
    const parsed = parseVoucherPayload(rawValue);
    if (!parsed.code) return;

    const signature = parsed.code + ':' + (parsed.qrToken || '');
    const now = Date.now();
    if (lastScanRef.current.value === signature && now - lastScanRef.current.at < 2200) return;

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
        qrToken: parsed.qrToken || null,
        partnerId: Number(selectedPartnerId)
      });
      setPreview(item);
    } catch (error) {
      showToast(error.message, 'error');
      resetScanner();
    } finally {
      setInspecting(false);
    }
  }

  scanHandlerRef.current = handleScan;

  async function inspectManual() {
    if (!manualCode.trim()) return;
    await handleScan(manualCode, 'manual');
  }

  async function confirmVoucherUse() {
    if (!preview?.id || !preview.valid || usingVoucher) return;
    setUsingVoucher(true);
    try {
      const used = await usePartnerVoucher(preview.id, {
        code: voucherInput.code || preview.code,
        qrToken: voucherInput.qrToken || null,
        partnerId: Number(selectedPartnerId)
      });

      const recentItem = {
        id: used.id,
        code: used.code,
        usedAt: used.usedAt || new Date().toISOString(),
        campaignTitle: used.campaignTitle,
        voucherValueText: used.voucherValueText,
        voucherValueAmount: used.voucherValueAmount,
        partnerReceivableAmount: used.partnerReceivableAmount,
        settlementStatus: used.settlementStatus,
        partnerName: used.partnerName,
        placeName: used.placeName,
        customerName: used.userName,
        cashierName: user?.name || null
      };

      setRecentUsage((current) => [
        recentItem,
        ...current.filter((row) => row.id !== recentItem.id)
      ].slice(0, 5));
      setPreview({ ...preview, ...used, valid: false, status: 'USED', justUsed: true });
      playFeedback('success');
      showToast('Đã ghi nhận khoản Hola Map cần thanh toán cho đối tác.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setUsingVoucher(false);
    }
  }

  if (loading) {
    return <main className="partner-scanner-page"><div className="partner-scanner-loading">Đang mở máy quét...</div></main>;
  }

  if (!data?.hasAccess) {
    return (
      <main className="partner-scanner-page">
        <section className="partner-scanner-