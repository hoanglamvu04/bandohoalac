import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function VoucherQr({ code, token, size = 160 }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let active = true;
    if (!code) {
      setSrc('');
      return undefined;
    }

    const payload = token
      ? 'HOLA-VOUCHER:' + code + ':' + token
      : 'HOLA-VOUCHER:' + code;

    QRCode.toDataURL(payload, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M'
    })
      .then((value) => {
        if (active) setSrc(value);
      })
      .catch(() => {
        if (active) setSrc('');
      });

    return () => {
      active = false;
    };
  }, [code, token, size]);

  if (!src) {
    return <div className="voucher-qr-placeholder">QR</div>;
  }

  return <img className="voucher-qr-image" src={src} alt={'QR voucher ' + code} />;
}
