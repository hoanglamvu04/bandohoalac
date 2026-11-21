import { useEffect, useState } from 'react';
import {
  getXHubConsent, isXHubPrivacyBlocked, setXHubConsent,
  trackXHubRoutePageView, xhubBridgeAvailable, disableXHubTracking,
  XHUB_CONSENT_KEY
} from '../lib/xhubAnalytics.js';
import '../xhub-analytics-consent.css';

// Optional, separate from the website's existing GA/soft-launch system.
export default function XHubAnalyticsConsent() {
  const [choice, setChoice] = useState(() => getXHubConsent());
  const [expanded, setExpanded] = useState(() => getXHubConsent() === 'unset');
  const [disabledByBrowser, setDisabledByBrowser] = useState(() => isXHubPrivacyBlocked());
  const [available, setAvailable] = useState(null);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key && event.key !== XHUB_CONSENT_KEY) return;
      disableXHubTracking();
      const next = getXHubConsent();
      setChoice(next);
      setExpanded(next === 'unset');
      setAvailable(null);
    };
    window.addEventListener('storage', onStorage);
    setDisabledByBrowser(isXHubPrivacyBlocked());
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  async function decide(next) {
    if (!setXHubConsent(next)) return;
    setChoice(next);
    setExpanded(false);
    setAvailable(null);
    if (next === 'granted') {
      const ready = await xhubBridgeAvailable();
      setAvailable(ready);
      if (ready) void trackXHubRoutePageView(window.location.pathname);
    }
  }

  return (
    <aside className="xhub-consent-root" aria-label="Tùy chọn phân tích ẩn danh"
      data-testid="xhub-consent">
      {expanded ? (
        <div className="xhub-consent-panel">
          <strong>Cho phép thống kê ẩn danh?</strong>
          <p>
            HOLA Maps chỉ gửi loại tương tác và mã địa điểm công khai tới X-HUB khi bạn
            đồng ý. Không gửi GPS, từ khóa tìm kiếm, số điện thoại, tài khoản hay nội dung biểu mẫu.
          </p>
          {disabledByBrowser && (
            <p role="status">Trình duyệt đang bật GPC/Do Not Track, nên thống kê này bị tắt.</p>
          )}
          <div className="xhub-consent-actions">
            <button type="button" onClick={() => decide('denied')}
              data-testid="xhub-consent-deny">Không đồng ý</button>
            <button type="button" onClick={() => decide('granted')}
              disabled={disabledByBrowser} data-testid="xhub-consent-allow">
              Đồng ý thống kê
            </button>
          </div>
          <a href="/quyen-rieng-tu">Chính sách quyền riêng tư</a>
        </div>
      ) : (
        <div className="xhub-consent-compact">
          <button type="button" onClick={() => setExpanded(true)}
            aria-label="Cài đặt thống kê ẩn danh" data-testid="xhub-consent-settings">
            Tùy chọn thống kê
          </button>
          {choice === 'granted' && available === false &&
            <span role="status">X-HUB chưa được kích hoạt.</span>}
        </div>
      )}
    </aside>
  );
}
