import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle
} from 'lucide-react';
import {
  deleteAdminIntegration,
  getAdminIntegrations,
  saveAdminIntegration,
  testAdminIntegration
} from '../../services/integrationSecretsApi.js';
import { useToast } from '../../context/ToastContext.jsx';

function formatDate(value) {
  if (!value) return 'Chưa kiểm tra';
  try { return new Date(value).toLocaleString('vi-VN'); } catch { return 'Chưa kiểm tra'; }
}

function sourceLabel(source) {
  if (source === 'ADMIN_DB') return 'Admin · mã hóa trên VPS';
  if (source === 'ENV_LEGACY') return 'VPS .env · cấu hình cũ';
  return 'Chưa cấu hình';
}

export default function IntegrationSecretsPanel() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await getAdminIntegrations();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      showToast(error.message || 'Không tải được cấu hình tích hợp.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const configuredCount = useMemo(
    () => items.filter((item) => item.configured).length,
    [items]
  );

  async function testProvider(item) {
    const secret = String(drafts[item.provider] || '').trim();
    setBusy('test-' + item.provider);
    try {
      const result = await testAdminIntegration(item.provider, secret || undefined);
      setResults((current) => ({ ...current, [item.provider]: result }));
      showToast(
        result.ok ? result.message : (result.message || 'Kết nối thất bại.'),
        result.ok ? 'success' : 'error'
      );
      if (!secret) await load();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function saveProvider(item) {
    const secret = String(drafts[item.provider] || '').trim();
    if (!secret) {
      showToast('Hãy dán API key mới trước khi lưu.', 'error');
      return;
    }

    setBusy('save-' + item.provider);
    try {
      const data = await saveAdminIntegration(item.provider, secret);
      setDrafts((current) => ({ ...current, [item.provider]: '' }));
      setResults((current) => ({
        ...current,
        [item.provider]: {
          ok: true,
          message: 'Key đã được kiểm tra và lưu mã hóa.',
          source: 'ADMIN_DB'
        }
      }));
      setItems((current) => current.map((entry) =>
        entry.provider === item.provider ? data.item : entry
      ));
      showToast('Đã kiểm tra và lưu API key. Photo Scanner dùng key mới ngay.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function removeProvider(item) {
    if (!window.confirm('Xóa API key ' + item.label + ' đã lưu trong Admin?')) return;
    setBusy('delete-' + item.provider);
    try {
      const data = await deleteAdminIntegration(item.provider);
      setItems((current) => current.map((entry) =>
        entry.provider === item.provider ? data.item : entry
      ));
      setResults((current) => ({ ...current, [item.provider]: null }));
      showToast(
        data.item?.source === 'ENV_LEGACY'
          ? 'Đã xóa key Admin. Hệ thống đang quay về key trong VPS .env.'
          : 'Đã xóa API key khỏi cấu hình tích hợp.',
        'success'
      );
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy('');
    }
  }

  if (loading) {
    return <div className="integration-loading"><RefreshCw size={17} /> Đang tải nguồn dữ liệu ngoài...</div>;
  }

  return (
    <section className="devapi-section integration-secrets-panel">
      <div className="integration-security-note">
        <div className="integration-security-icon"><ShieldCheck size={22} /></div>
        <div>
          <small>INTEGRATION SECRETS V1</small>
          <h2>Khóa API nguồn dữ liệu ngoài</h2>
          <p>
            Key được gửi qua HTTPS tới backend, mã hóa AES-256-GCM trước khi lưu trong PostgreSQL trên VPS.
            Sau khi lưu, frontend chỉ nhận chuỗi đã che và không thể đọc lại key đầy đủ.
          </p>
        </div>
        <span><b>{configuredCount}</b> nguồn đã cấu hình</span>
      </div>

      <div className="integration-trust-strip">
        <span><CheckCircle2 size={14} /> Có hiệu lực ngay · không restart PM2</span>
        <span><ShieldCheck size={14} /> Không ghi secret vào Audit Log</span>
        <span><KeyRound size={14} /> Photo Scanner đọc key động mỗi lần chạy</span>
      </div>

      <div className="integration-provider-list">
        {items.map((item) => {
          const draft = drafts[item.provider] || '';
          const result = results[item.provider];
          const testing = busy === 'test-' + item.provider;
          const saving = busy === 'save-' + item.provider;
          const deleting = busy === 'delete-' + item.provider;
          const testState = result || (
            item.lastTestStatus
              ? {
                  ok: item.lastTestStatus === 'SUCCESS',
                  message: item.lastTestMessage,
                  source: item.source
                }
              : null
          );

          return (
            <article className="integration-provider-card" key={item.provider}>
              <div className="integration-provider-head">
                <div className="integration-provider-logo"><PlugZap size={20} /></div>
                <div>
                  <span className={item.configured ? 'integration-state connected' : 'integration-state'}>
                    {item.configured ? 'ĐÃ KẾT NỐI' : 'CHƯA CẤU HÌNH'}
                  </span>
                  <h3>{item.label}</h3>
                  <p>{item.description}</p>
                </div>
                <div className="integration-provider-source">
                  <small>NGUỒN KEY</small>
                  <b>{sourceLabel(item.source)}</b>
                  {item.masked && <code>{item.masked}</code>}
                </div>
              </div>

              <div className="integration-secret-entry">
                <label>
                  API key mới
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={draft}
                    onChange={(event) => setDrafts((current) => ({
                      ...current,
                      [item.provider]: event.target.value
                    }))}
                    placeholder={item.configured ? 'Dán key mới để thay thế key hiện tại' : 'Dán Foursquare Service API Key'}
                  />
                </label>
                <button
                  type="button"
                  className="integration-test-button"
                  onClick={() => testProvider(item)}
                  disabled={testing || saving || deleting || (!draft && !item.configured)}
                >
                  <PlugZap size={15} /> {testing ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
                </button>
                <button
                  type="button"
                  className="integration-save-button"
                  onClick={() => saveProvider(item)}
                  disabled={saving || testing || deleting || !draft.trim()}
                >
                  <ShieldCheck size={15} /> {saving ? 'Đang lưu…' : 'Kiểm tra & lưu'}
                </button>
              </div>

              <div className="integration-provider-footer">
                <div className={testState?.ok ? 'integration-test-result ok' : 'integration-test-result'}>
                  {testState ? (
                    <>
                      {testState.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                      <span>
                        <b>{testState.ok ? 'Kết nối tốt' : 'Cần kiểm tra'}</b>
                        <small>{testState.message || 'Không có thông tin.'}</small>
                      </span>
                    </>
                  ) : (
                    <>
                      <PlugZap size={15} />
                      <span><b>Chưa kiểm tra</b><small>Dán key rồi kiểm tra trước khi lưu.</small></span>
                    </>
                  )}
                </div>

                <div className="integration-last-test">
                  <small>Lần kiểm tra đã lưu</small>
                  <b>{formatDate(item.lastTestedAt)}</b>
                </div>

                {item.source === 'ADMIN_DB' && (
                  <button
                    type="button"
                    className="integration-delete-button"
                    onClick={() => removeProvider(item)}
                    disabled={deleting || saving || testing}
                  >
                    <Trash2 size={14} /> {deleting ? 'Đang xóa…' : 'Xóa key Admin'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
