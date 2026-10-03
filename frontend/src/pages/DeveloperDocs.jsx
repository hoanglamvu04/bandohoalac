import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Copy, KeyRound, MapPinned, Server, ShieldCheck } from 'lucide-react';
import { API_URL, getPublicOpenApi } from '../services/api.js';

export default function DeveloperDocs() {
  const [schema, setSchema] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getPublicOpenApi()
      .then(setSchema)
      .catch((err) => setError(err.message || 'Không tải được tài liệu API.'));
  }, []);

  const baseUrl = useMemo(() => {
    if (schema?.servers?.[0]?.url) return schema.servers[0].url;
    return API_URL.replace(/\/$/, '') + '/public/v1';
  }, [schema]);

  const endpoints = useMemo(
    () => Object.entries(schema?.paths || {}).map(([path, config]) => ({
      path,
      method: Object.keys(config || {})[0]?.toUpperCase() || 'GET',
      summary: config?.get?.summary || 'Hola Maps API'
    })),
    [schema]
  );

  async function copy(value) {
    try { await navigator.clipboard.writeText(value); } catch {}
  }

  const fetchExample = "fetch('" + baseUrl + "/places?limit=20', {\n"
    + "  headers: {\n"
    + "    'X-Hola-API-Key': 'hm_live_...'\n"
    + "  }\n"
    + "})";

  const geoJsonExample = "const url = '" + baseUrl + "/places/geojson'\n"
    + "  + '?north=21.145&south=20.885&east=105.665&west=105.325';\n\n"
    + "const geojson = await fetch(url).then(r => r.json());\n"
    + "map.getSource('hola-places').setData(geojson);";

  const responseExample = "{\n"
    + '  "data": {\n'
    + '    "items": [\n'
    + "      {\n"
    + '        "id": 123,\n'
    + '        "name": "Hồ Đồng Mô",\n'
    + '        "category": { "name": "Khu du lịch", "slug": "khu-du-lich" },\n'
    + '        "location": { "lat": 21.0, "lng": 105.5, "address": "..." },\n'
    + '        "images": { "thumbnail": "https://..." }\n'
    + "      }\n"
    + "    ]\n"
    + "  }\n"
    + "}";

  return (
    <main className="developer-docs">
      <section className="developer-docs-hero">
        <span className="developer-docs-kicker"><BookOpen size={15} /> HOLA MAPS DEVELOPERS</span>
        <h1>Developer API v1</h1>
        <p>Dùng dữ liệu địa điểm Hola Maps cho website, bản đồ và sản phẩm trong hệ sinh thái Hòa Lạc.</p>
        <div className="developer-docs-base">
          <code>{baseUrl}</code>
          <button onClick={() => copy(baseUrl)}><Copy size={15} /> Sao chép</button>
        </div>
      </section>

      <section className="developer-docs-notes">
        <article><Server /><div><b>Read-only API</b><span>Chỉ dữ liệu công khai đã xuất bản.</span></div></article>
        <article><KeyRound /><div><b>X-Hola-API-Key</b><span>Được yêu cầu khi Admin bật Partner mode hoặc khóa endpoint.</span></div></article>
        <article><ShieldCheck /><div><b>Domain & quota</b><span>Mỗi website có origin và giới hạn request riêng.</span></div></article>
      </section>

      {error && <div className="developer-docs-error">{error}</div>}

      <section className="developer-docs-layout">
        <aside>
          <b>Bắt đầu</b>
          <a href="#auth">Xác thực</a>
          <a href="#browser">API key trên trình duyệt</a>
          <b>Endpoint</b>
          {endpoints.map((item) => (
            <a href={'#endpoint-' + item.path.replace(/[^a-z0-9]/gi, '-')} key={item.path}>{item.path}</a>
          ))}
        </aside>

        <div className="developer-docs-content">
          <article id="auth">
            <span className="docs-eyebrow">XÁC THỰC</span>
            <h2>Kết nối API</h2>
            <p>Khi endpoint yêu cầu key, gửi key qua header <code>X-Hola-API-Key</code>.</p>
            <pre>{fetchExample}</pre>
          </article>

          <article id="browser" className="developer-docs-warning">
            <ShieldCheck />
            <div>
              <h3>API key trong JavaScript trình duyệt không phải bí mật.</h3>
              <p>Nếu website gọi API trực tiếp từ frontend, người dùng có thể nhìn thấy key. Hãy dùng domain allowlist + quota. Với key cần giữ bí mật, gọi Hola Maps từ backend của website.</p>
            </div>
          </article>

          <article>
            <span className="docs-eyebrow">MAPLIBRE / GEOJSON</span>
            <h2>Hiển thị địa điểm trên bản đồ</h2>
            <pre>{geoJsonExample}</pre>
          </article>

          <section className="developer-endpoints">
            {endpoints.map((item) => (
              <article id={'endpoint-' + item.path.replace(/[^a-z0-9]/gi, '-')} key={item.path}>
                <span className="developer-method">{item.method}</span>
                <div><h3>{item.summary}</h3><code>{item.path}</code></div>
                <button onClick={() => copy(baseUrl + item.path)}><Copy size={14} /></button>
              </article>
            ))}
          </section>

          <article>
            <span className="docs-eyebrow">VÍ DỤ RESPONSE</span>
            <h2>Địa điểm</h2>
            <pre>{responseExample}</pre>
          </article>
        </div>
      </section>

      <section className="developer-docs-footer">
        <MapPinned size={18} /> Hola Maps Developer API · v1
      </section>
    </main>
  );
}
