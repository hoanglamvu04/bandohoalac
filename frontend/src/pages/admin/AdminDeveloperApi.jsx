import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BookOpen,
  Copy,
  ExternalLink,
  Globe2,
  KeyRound,
  Link2,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck
} from 'lucide-react';
import {
  createAdminDeveloperApiClient,
  createAdminDeveloperApiKey,
  getAdminDeveloperApiClients,
  getAdminDeveloperApiEndpoints,
  getAdminDeveloperApiKeys,
  getAdminDeveloperApiLogs,
  getAdminDeveloperApiOverview,
  revokeAdminDeveloperApiKey,
  updateAdminDeveloperApiClient,
  updateAdminDeveloperApiEndpoint,
  updateAdminDeveloperApiSettings
} from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import IntegrationSecretsPanel from '../../components/admin/IntegrationSecretsPanel.jsx';

const TABS = [
  ['overview', 'Tổng quan'],
  ['clients', 'Website kết nối'],
  ['keys', 'API Keys'],
  ['integrations', 'Nguồn ngoài'],
  ['endpoints', 'Endpoint'],
  ['logs', 'Nhật ký'],
  ['docs', 'Tài liệu']
];

function splitOrigins(value) {
  return String(value || '')
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value) {
  if (!value) return '—';
  try { return new Date(value).toLocaleString('vi-VN'); } catch { return '—'; }
}

export default function AdminDeveloperApi() {
  const { showToast } = useToast();
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [clients, setClients] = useState([]);
  const [keys, setKeys] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [clientDrafts, setClientDrafts] = useState({});
  const [newClient, setNewClient] = useState({ name: '', origins: '', rateLimitPerMinute: 300, note: '' });
  const [newKey, setNewKey] = useState({ clientId: '', name: 'Primary key' });
  const [newSecret, setNewSecret] = useState('');

  async function loadAll() {
    setLoading(true);
    try {
      const [overviewData, clientsData, keysData, endpointsData, logsData] = await Promise.all([
        getAdminDeveloperApiOverview(),
        getAdminDeveloperApiClients(),
        getAdminDeveloperApiKeys(),
        getAdminDeveloperApiEndpoints(),
        getAdminDeveloperApiLogs({ limit: 100 })
      ]);
      const nextClients = Array.isArray(clientsData?.items) ? clientsData.items : [];
      setOverview(overviewData);
      setClients(nextClients);
      setKeys(Array.isArray(keysData?.items) ? keysData.items : []);
      setEndpoints(Array.isArray(endpointsData?.items) ? endpointsData.items : []);
      setLogs(Array.isArray(logsData?.items) ? logsData.items : []);
      setClientDrafts(Object.fromEntries(nextClients.map((item) => [
        item.id,
        { origins: (item.allowedOrigins || []).join('\n'), rateLimitPerMinute: item.rateLimitPerMinute || 300 }
      ])));
      setNewKey((current) => ({ ...current, clientId: current.clientId || nextClients[0]?.id || '' }));
    } catch (error) {
      showToast(error.message || 'Không tải được Developer API.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const settings = overview?.settings || {};
  const activeClients = Number(overview?.clients?.active || 0);
  const activeKeys = Number(overview?.keys?.active || 0);
  const requests24h = Number(overview?.usage?.requests_24h || 0);
  const errors24h = Number(overview?.usage?.errors_24h || 0);
  const selectedClient = useMemo(
    () => clients.find((item) => String(item.id) === String(newKey.clientId)),
    [clients, newKey.clientId]
  );

  async function patchSettings(patch) {
    setBusy('settings');
    try {
      await updateAdminDeveloperApiSettings(patch);
      setOverview(await getAdminDeveloperApiOverview());
      showToast('Đã cập nhật cấu hình Developer API.', 'success');
    } catch (error) { showToast(error.message, 'error'); }
    finally { setBusy(''); }
  }

  async function createClient(event) {
    event.preventDefault();
    setBusy('create-client');
    try {
      await createAdminDeveloperApiClient({
        name: newClient.name,
        allowedOrigins: splitOrigins(newClient.origins),
        permissions: ['*'],
        rateLimitPerMinute: Number(newClient.rateLimitPerMinute) || 300,
        note: newClient.note || undefined
      });
      setNewClient({ name: '', origins: '', rateLimitPerMinute: 300, note: '' });
      await loadAll();
      showToast('Đã tạo website kết nối.', 'success');
    } catch (error) { showToast(error.message, 'error'); }
    finally { setBusy(''); }
  }

  async function saveClient(client) {
    const draft = clientDrafts[client.id] || {};
    setBusy('client-' + client.id);
    try {
      await updateAdminDeveloperApiClient(client.id, {
        allowedOrigins: splitOrigins(draft.origins),
        rateLimitPerMinute: Number(draft.rateLimitPerMinute) || client.rateLimitPerMinute,
        permissions: Array.isArray(draft.permissions) && draft.permissions.length ? draft.permissions : ['*']
      });
      await loadAll();
      showToast('Đã lưu domain và quota.', 'success');
    } catch (error) { showToast(error.message, 'error'); }
    finally { setBusy(''); }
  }

  async function toggleClient(client) {
    setBusy('client-' + client.id);
    try {
      await updateAdminDeveloperApiClient(client.id, {
        status: client.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
      });
      await loadAll();
    } catch (error) { showToast(error.message, 'error'); }
    finally { setBusy(''); }
  }

  function togglePermission(clientId, endpointKey) {
    setClientDrafts((current) => {
      const draft = current[clientId] || { permissions: ['*'] };
      const currentPermissions = Array.isArray(draft.permissions) ? draft.permissions : ['*'];
      const allKeys = endpoints
        .filter((item) => !['meta', 'openapi'].includes(item.key))
        .map((item) => item.key);

      if (endpointKey === '*') {
        return {
          ...current,
          [clientId]: { ...draft, permissions: currentPermissions.includes('*') ? allKeys : ['*'] }
        };
      }

      const base = currentPermissions.includes('*') ? allKeys : currentPermissions;
      const next = base.includes(endpointKey)
        ? base.filter((item) => item !== endpointKey)
        : [...base, endpointKey];

      return {
        ...current,
        [clientId]: { ...draft, permissions: next.length ? next : [endpointKey] }
      };
    });
  }

  async function createKey(event) {
    event.preventDefault();
    if (!newKey.clientId) {
      showToast('Hãy tạo hoặc chọn website kết nối trước.', 'error');
      return;
    }
    setBusy('create-key');
    try {
      const created = await createAdminDeveloperApiKey({
        clientId: newKey.clientId,
        name: newKey.name || 'Primary key'
      });
      setNewSecret(created.secret || '');
      const data = await getAdminDeveloperApiKeys();
      setKeys(Array.isArray(data?.items) ? data.items : []);
      showToast('API Key đã được tạo. Hãy sao chép và lưu ngay.', 'success');
    } catch (error) { showToast(error.message, 'error'); }
    finally { setBusy(''); }
  }

  async function revokeKey(item) {
    if (!window.confirm('Thu hồi key ' + item.name + '? Website dùng key này sẽ ngừng truy cập ngay.')) return;
    setBusy('key-' + item.id);
    try {
      await revokeAdminDeveloperApiKey(item.id);
      const data = await getAdminDeveloperApiKeys();
      setKeys(Array.isArray(data?.items) ? data.items : []);
      showToast('Đã thu hồi API Key.', 'success');
    } catch (error) { showToast(error.message, 'error'); }
    finally { setBusy(''); }
  }

  async function patchEndpoint(item, patch) {
    setBusy('endpoint-' + item.key);
    try {
      const updated = await updateAdminDeveloperApiEndpoint(item.key, patch);
      setEndpoints((current) => current.map((entry) => entry.key === updated.key ? updated : entry));
    } catch (error) { showToast(error.message, 'error'); }
    finally { setBusy(''); }
  }

  async function copy(value) {
    try {
      await navigator.clipboard.writeText(value);
      showToast('Đã sao chép.', 'success');
    } catch { showToast('Không thể sao chép tự động.', 'error'); }
  }

  return (
    <main className="admin-page developer-api-admin page-container">
      <section className="devapi-hero">
        <div>
          <span className="eyebrow">HOLA MAPS PLATFORM</span>
          <h1>API & Tích hợp</h1>
          <p>Quản lý Public API, website kết nối, key, endpoint, quota và nguồn dữ liệu ngoài trong một nơi.</p>
        </div>
        <div className={settings.enabled ? 'devapi-health online' : 'devapi-health offline'}>
          <span />
          <div><small>PUBLIC API</small><b>{settings.enabled ? 'Đang hoạt động' : 'Đang tạm dừng'}</b></div>
        </div>
      </section>

      <nav className="devapi-tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      {loading ? (
        <div className="devapi-loading"><RefreshCw size={18} /> Đang tải cấu hình API...</div>
      ) : (
        <>
          {tab === 'overview' && (
            <section className="devapi-section">
              <div className="devapi-stat-grid">
                <article><Globe2 /><small>Website hoạt động</small><b>{activeClients}</b></article>
                <article><KeyRound /><small>Key hoạt động</small><b>{activeKeys}</b></article>
                <article><Activity /><small>Request / 24h</small><b>{requests24h}</b></article>
                <article><Server /><small>Lỗi / 24h</small><b>{errors24h}</b></article>
              </div>
              <div className="devapi-overview-grid">
                <article className="devapi-card">
                  <div className="devapi-card-head">
                    <div><small>TRẠNG THÁI</small><h2>Public API</h2></div>
                    <button className={settings.enabled ? 'devapi-toggle on' : 'devapi-toggle'} disabled={busy === 'settings'} onClick={() => patchSettings({ enabled: !settings.enabled })}><span /></button>
                  </div>
                  <p>Tắt API sẽ chặn endpoint dữ liệu bên ngoài nhưng không ảnh hưởng API nội bộ của Hola Maps.</p>
                </article>
                <article className="devapi-card">
                  <div className="devapi-card-head"><div><small>CHẾ ĐỘ TRUY CẬP</small><h2>{settings.accessMode === 'PARTNER' ? 'Partner / API Key' : 'Open'}</h2></div><ShieldCheck size={22} /></div>
                  <select value={settings.accessMode || 'OPEN'} onChange={(event) => patchSettings({ accessMode: event.target.value })}>
                    <option value="OPEN">OPEN — cho phép truy cập không key</option>
                    <option value="PARTNER">PARTNER — bắt buộc API key cho dữ liệu</option>
                  </select>
                </article>
                <article className="devapi-card devapi-url-card">
                  <small>BASE URL</small><code>{settings.baseUrl}</code>
                  <button onClick={() => copy(settings.baseUrl)}><Copy size={14} /> Sao chép</button>
                </article>
                <article className="devapi-card">
                  <div className="devapi-card-head">
                    <div><small>TÀI LIỆU</small><h2>/developers</h2></div>
                    <button className={settings.docsEnabled ? 'devapi-toggle on' : 'devapi-toggle'} onClick={() => patchSettings({ docsEnabled: !settings.docsEnabled })}><span /></button>
                  </div>
                  <p>Cho phép đối tác đọc tài liệu và OpenAPI schema công khai.</p>
                </article>
              </div>
            </section>
          )}

          {tab === 'clients' && (
            <section className="devapi-section">
              <form className="devapi-create-card" onSubmit={createClient}>
                <div className="devapi-section-heading"><div><small>CLIENT MỚI</small><h2>Thêm website kết nối</h2></div><Plus size={20} /></div>
                <div className="devapi-form-grid">
                  <label>Tên website<input required value={newClient.name} onChange={(e) => setNewClient((v) => ({ ...v, name: e.target.value }))} placeholder="HALO HOLA" /></label>
                  <label>Quota / phút<input type="number" min="30" max="600" value={newClient.rateLimitPerMinute} onChange={(e) => setNewClient((v) => ({ ...v, rateLimitPerMinute: e.target.value }))} /></label>
                </div>
                <label>Domain được phép<textarea rows="3" value={newClient.origins} onChange={(e) => setNewClient((v) => ({ ...v, origins: e.target.value }))} placeholder={'https://halohola.vn\nhttps://www.halohola.vn'} /></label>
                <label>Ghi chú<input value={newClient.note} onChange={(e) => setNewClient((v) => ({ ...v, note: e.target.value }))} placeholder="Website nội bộ / đối tác..." /></label>
                <button className="devapi-primary" disabled={busy === 'create-client'}><Plus size={15} /> Tạo website kết nối</button>
              </form>
              <div className="devapi-client-grid">
                {clients.map((client) => {
                  const draft = clientDrafts[client.id] || {};
                  return (
                    <article className="devapi-client-card" key={client.id}>
                      <div className="devapi-client-head">
                        <div><span className={client.status === 'ACTIVE' ? 'status active' : 'status'}>{client.status}</span><h3>{client.name}</h3><small>{client.slug}</small></div>
                        <button onClick={() => toggleClient(client)}>{client.status === 'ACTIVE' ? 'Tạm dừng' : 'Kích hoạt'}</button>
                      </div>
                      <div className="devapi-client-metrics">
                        <span><b>{client.activeKeyCount}</b><small>key hoạt động</small></span>
                        <span><b>{client.requests24h}</b><small>request / 24h</small></span>
                        <span><b>{client.rateLimitPerMinute}</b><small>quota / phút</small></span>
                      </div>
                      <label>Domain<textarea rows="3" value={draft.origins || ''} onChange={(e) => setClientDrafts((v) => ({ ...v, [client.id]: { ...draft, origins: e.target.value } }))} /></label>
                      <label>Quota<input type="number" min="30" max="600" value={draft.rateLimitPerMinute || 300} onChange={(e) => setClientDrafts((v) => ({ ...v, [client.id]: { ...draft, rateLimitPerMinute: e.target.value } }))} /></label>
                      <div className="devapi-permissions">
                        <span>Quyền endpoint</span>
                        <label className="devapi-permission-pill">
                          <input
                            type="checkbox"
                            checked={(draft.permissions || ['*']).includes('*')}
                            onChange={() => togglePermission(client.id, '*')}
                          />
                          Toàn bộ API
                        </label>
                        {endpoints
                          .filter((item) => !['meta', 'openapi'].includes(item.key))
                          .map((endpoint) => {
                            const permissions = draft.permissions || ['*'];
                            const checked = permissions.includes('*') || permissions.includes(endpoint.key);
                            return (
                              <label className="devapi-permission-pill" key={endpoint.key}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePermission(client.id, endpoint.key)}
                                />
                                {endpoint.label}
                              </label>
                            );
                          })}
                      </div>
                      <button className="devapi-secondary" onClick={() => saveClient(client)}>Lưu cấu hình website</button>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {tab === 'keys' && (
            <section className="devapi-section">
              {newSecret && (
                <div className="devapi-secret">
                  <div><KeyRound size={20} /><span><b>API Key mới — chỉ hiển thị một lần</b><code>{newSecret}</code></span></div>
                  <button onClick={() => copy(newSecret)}><Copy size={15} /> Sao chép</button>
                </div>
              )}
              <form className="devapi-create-card compact" onSubmit={createKey}>
                <div className="devapi-section-heading"><div><small>API KEY</small><h2>Tạo key mới</h2></div><KeyRound size={20} /></div>
                <div className="devapi-form-grid">
                  <label>Website<select value={newKey.clientId} onChange={(e) => setNewKey((v) => ({ ...v, clientId: e.target.value }))}><option value="">Chọn website</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                  <label>Tên key<input value={newKey.name} onChange={(e) => setNewKey((v) => ({ ...v, name: e.target.value }))} /></label>
                </div>
                {selectedClient && <p>Key dùng quota <b>{selectedClient.rateLimitPerMinute} request/phút</b> và domain của {selectedClient.name}.</p>}
                <button className="devapi-primary" disabled={busy === 'create-key'}><KeyRound size={15} /> Tạo API Key</button>
              </form>
              <div className="devapi-key-list">
                {keys.map((item) => (
                  <article key={item.id}>
                    <div><span className={item.status === 'ACTIVE' ? 'status active' : 'status'}>{item.status}</span><h3>{item.name}</h3><small>{item.clientName}</small></div>
                    <code>{item.prefix}••••••••{item.last4}</code>
                    <span>Lần dùng cuối: {formatDate(item.lastUsedAt)}</span>
                    {item.status === 'ACTIVE' && <button onClick={() => revokeKey(item)}>Thu hồi</button>}
                  </article>
                ))}
              </div>
            </section>
          )}

          {tab === 'integrations' && <IntegrationSecretsPanel />}

          {tab === 'endpoints' && (
            <section className="devapi-section">
              <div className="devapi-section-heading"><div><small>ENDPOINT POLICY</small><h2>Bật / tắt và yêu cầu key</h2></div><Link2 size={20} /></div>
              <div className="devapi-endpoint-list">
                {endpoints.map((item) => (
                  <article key={item.key}>
                    <span className="devapi-method">{item.method}</span>
                    <div><b>{item.label}</b><code>{item.path}</code><small>{item.key}</small></div>
                    <label><input type="checkbox" checked={item.requiresKey} onChange={(e) => patchEndpoint(item, { requiresKey: e.target.checked })} /> Bắt buộc key</label>
                    <button className={item.enabled ? 'devapi-toggle on' : 'devapi-toggle'} disabled={busy === 'endpoint-' + item.key} onClick={() => patchEndpoint(item, { enabled: !item.enabled })}><span /></button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {tab === 'logs' && (
            <section className="devapi-section">
              <div className="devapi-section-heading">
                <div><small>REQUEST LOG</small><h2>100 request gần nhất</h2></div>
                <button className="devapi-icon-button" onClick={loadAll}><RefreshCw size={16} /></button>
              </div>
              <div className="devapi-log-table">
                <div className="head"><span>Thời gian</span><span>Client</span><span>Endpoint</span><span>Status</span><span>ms</span></div>
                {logs.map((item) => (
                  <div key={item.id}>
                    <span>{formatDate(item.createdAt)}</span><span>{item.clientName}</span>
                    <span><b>{item.method}</b> {item.endpointKey || item.path}</span>
                    <span className={item.statusCode >= 400 ? 'bad' : 'good'}>{item.statusCode}</span><span>{item.durationMs}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === 'docs' && (
            <section className="devapi-section">
              <div className="devapi-doc-card">
                <BookOpen size={28} />
                <div>
                  <small>TÀI LIỆU CÔNG KHAI</small><h2>Hola Maps Developer API v1</h2>
                  <p>Đối tác xem endpoint, ví dụ JavaScript, API key header và OpenAPI schema.</p><code>{settings.docsUrl}</code>
                </div>
                <a href="/developers" target="_blank" rel="noreferrer"><ExternalLink size={16} /> Mở tài liệu</a>
              </div>
              <div className="devapi-doc-grid">
                <article><small>BASE URL</small><code>{settings.baseUrl}</code><button onClick={() => copy(settings.baseUrl)}><Copy size={14} /> Copy</button></article>
                <article><small>OPENAPI</small><code>{settings.baseUrl + '/openapi.json'}</code><button onClick={() => copy(settings.baseUrl + '/openapi.json')}><Copy size={14} /> Copy</button></article>
                <article><small>HEADER</small><code>X-Hola-API-Key</code><button onClick={() => copy('X-Hola-API-Key')}><Copy size={14} /> Copy</button></article>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
