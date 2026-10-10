import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, MapPin, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { client } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

const cardStyle = {
  background: '#fff',
  border: '1px solid #dfe8e4',
  borderRadius: 18,
  padding: 20,
  boxShadow: '0 10px 30px rgba(21,77,65,.06)'
};

export default function AdminCoverageCleanup() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await client.get('/admin/coverage-cleanup', { params: { limit: 100 } });
      setData(response.data);
    } catch (error) {
      showToast(error.response?.data?.error || error.message || 'Không quét được dữ liệu ngoài vùng.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  async function runCleanup() {
    const count = Number(data?.total || 0);
    if (!count) return;
    if (!window.confirm(
      `Ẩn ${count} địa điểm nằm ngoài 9 xã khỏi Hola Maps?\n\nDữ liệu không bị xóa vật lý mà chuyển sang ARCHIVED để có thể kiểm tra lại sau.`
    )) return;

    setCleaning(true);
    try {
      const response = await client.post('/admin/coverage-cleanup/run');
      showToast(response.data?.message || 'Đã dọn dữ liệu ngoài vùng.', 'success');
      await load();
    } catch (error) {
      showToast(error.response?.data?.error || error.message || 'Không dọn được dữ liệu ngoài vùng.', 'error');
    } finally {
      setCleaning(false);
    }
  }

  return (
    <main className="admin-page page-container" style={{ maxWidth: 1180, margin: '0 auto', paddingBottom: 60 }}>
      <div className="section-heading" style={{ marginBottom: 18 }}>
        <div>
          <span className="eyebrow">DATA COVERAGE</span>
          <h1>Dọn địa điểm ngoài vùng</h1>
          <p>Chỉ giữ dữ liệu thuộc 9 xã đang phục vụ. Các điểm ngoài vùng sẽ không còn xuất hiện trong tìm kiếm, gần tôi và bản đồ công khai.</p>
        </div>
      </div>

      <section style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#154d41', fontWeight: 800 }}>
              <ShieldCheck size={20} /> Phạm vi cho phép
            </div>
            <p style={{ margin: '8px 0 0', color: '#60716c', lineHeight: 1.6 }}>
              {(data?.allowedAreas || []).join(' · ') || 'Yên Xuân · Hòa Lạc · Yên Bài · Đoài Phương · Thạch Thất · Hạ Bằng · Tây Phương · Kiều Phú · Phú Cát'}
            </p>
          </div>
          <button type="button" className="button secondary" onClick={load} disabled={loading || cleaning}>
            <RefreshCw size={16} /> Quét lại
          </button>
        </div>
      </section>

      <section style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {Number(data?.total || 0) > 0
              ? <AlertTriangle size={28} color="#b45309" />
              : <CheckCircle2 size={28} color="#16815f" />}
            <div>
              <strong style={{ display: 'block', fontSize: 26, color: '#123f36' }}>
                {loading ? '…' : Number(data?.total || 0)}
              </strong>
              <span style={{ color: '#687a74' }}>địa điểm đang nằm ngoài vùng phục vụ</span>
            </div>
          </div>

          <button
            type="button"
            className="button danger"
            onClick={runCleanup}
            disabled={loading || cleaning || !Number(data?.total || 0)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <Trash2 size={16} />
            {cleaning ? 'Đang dọn…' : 'Ẩn toàn bộ ngoài vùng'}
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, color: '#123f36' }}>Danh sách cần dọn</h2>
        <p style={{ color: '#72817d', marginTop: -4 }}>Hiển thị tối đa 100 điểm để kiểm tra trước khi chạy dọn hàng loạt.</p>

        {!loading && !(data?.items || []).length && (
          <div style={{ padding: '28px 12px', textAlign: 'center', color: '#16815f' }}>
            <CheckCircle2 size={28} />
            <div style={{ marginTop: 8, fontWeight: 700 }}>Dữ liệu hiện đã sạch theo phạm vi 9 xã.</div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          {(data?.items || []).map((item) => (
            <div key={item.id} style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 14,
              padding: 14,
              border: '1px solid #e5ece9',
              borderRadius: 14,
              background: '#fbfcfb'
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#154d41', fontWeight: 800 }}>
                  <MapPin size={15} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                </div>
                <div style={{ marginTop: 5, color: '#72817d', fontSize: 13 }}>{item.category} · {item.source || 'UNKNOWN'}</div>
                <div style={{ marginTop: 3, color: '#87938f', fontSize: 13 }}>{item.address || 'Chưa có địa chỉ'}</div>
              </div>
              <div style={{ textAlign: 'right', color: '#72817d', fontSize: 12, whiteSpace: 'nowrap' }}>
                {Number(item.lat).toFixed(5)}<br />{Number(item.lng).toFixed(5)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
