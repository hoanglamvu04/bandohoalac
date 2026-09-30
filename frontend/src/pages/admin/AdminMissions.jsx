import { useEffect, useMemo, useState } from 'react';
import {
  Flag,
  Plus,
  Save,
  Sparkles,
  Target
} from 'lucide-react';
import {
  createAdminMission,
  getAdminMissions,
  updateAdminMission
} from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

const TYPES = [
  ['CREATE_PLACE', 'Thêm địa điểm'],
  ['UPDATE_PLACE', 'Cập nhật thông tin'],
  ['ADD_PHOTO', 'Thêm ảnh'],
  ['FIX_LOCATION', 'Sửa vị trí'],
  ['UPDATE_HOURS', 'Cập nhật giờ mở cửa'],
  ['UPDATE_PRICE', 'Cập nhật giá'],
  ['REPORT_CLOSED', 'Báo đóng cửa'],
  ['REPORT_WRONG_INFO', 'Báo sai thông tin']
];

const EMPTY = {
  title: '',
  description: '',
  status: 'DRAFT',
  contributionTypes: [],
  targetCount: 10,
  bonusPoints: 0,
  completionBonus: 0,
  startsAt: '',
  endsAt: ''
};

function localDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function AdminMissions() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => items.find((item) => String(item.id) === String(selectedId)) || null,
    [items, selectedId]
  );

  async function load() {
    setLoading(true);
    try {
      const data = await getAdminMissions();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startCreate() {
    setCreating(true);
    setSelectedId(null);
    setForm({ ...EMPTY });
  }

  function edit(item) {
    setCreating(false);
    setSelectedId(item.id);
    setForm({
      title: item.title || '',
      description: item.description || '',
      status: item.status || 'DRAFT',
      contributionTypes: item.contributionTypes || [],
      targetCount: item.targetCount || 1,
      bonusPoints: item.bonusPoints || 0,
      completionBonus: item.completionBonus || 0,
      startsAt: localDateTime(item.startsAt),
      endsAt: localDateTime(item.endsAt)
    });
  }

  function toggleType(type) {
    setForm((current) => ({
      ...current,
      contributionTypes: current.contributionTypes.includes(type)
        ? current.contributionTypes.filter((item) => item !== type)
        : [...current.contributionTypes, type]
    }));
  }

  async function save(event) {
    event.preventDefault();
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      contributionTypes: form.contributionTypes,
      targetCount: Number(form.targetCount),
      bonusPoints: Number(form.bonusPoints || 0),
      completionBonus: Number(form.completionBonus || 0),
      startsAt: toIso(form.startsAt),
      endsAt: toIso(form.endsAt)
    };

    setSaving(true);
    try {
      if (creating) await createAdminMission(payload);
      else await updateAdminMission(selectedId, payload);
      showToast(creating ? 'Đã tạo nhiệm vụ.' : 'Đã cập nhật nhiệm vụ.', 'success');
      setCreating(false);
      setSelectedId(null);
      setForm({ ...EMPTY });
      await load();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const editorOpen = creating || Boolean(selected);

  return (
    <main className="admin-page admin-missions-page page-container">
      <section className="section-heading">
        <div>
          <span className="eyebrow">COMMUNITY CAMPAIGNS</span>
          <h2>Nhiệm vụ Explorer</h2>
          <p>Tạo chiến dịch đóng góp, bonus theo từng đóng góp và thưởng khi hoàn thành mục tiêu.</p>
        </div>
        <button className="primary-action" type="button" onClick={startCreate}><Plus size={16} /> Tạo nhiệm vụ</button>
      </section>

      <section className={editorOpen ? 'admin-missions-layout editing' : 'admin-missions-layout'}>
        <div className="admin-mission-list-card">
          {loading ? <div className="loading-card">Đang tải nhiệm vụ...</div> : !items.length ? (
            <div className="empty-state"><Flag size={24} /><b>Chưa có nhiệm vụ</b></div>
          ) : (
            <div className="admin-mission-list">
              {items.map((item) => (
                <button type="button" className={String(item.id) === String(selectedId) ? 'active' : ''} onClick={() => edit(item)} key={item.id}>
                  <span className="admin-mission-icon"><Flag size={18} /></span>
                  <span>
                    <small>{item.status}</small>
                    <b>{item.title}</b>
                    <em>{item.targetCount} đóng góp · +{item.bonusPoints}/lượt · +{item.completionBonus} hoàn thành</em>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="admin-mission-editor">
          {!editorOpen ? (
            <div className="empty-state"><Target size={28} /><b>Chọn nhiệm vụ để chỉnh sửa</b></div>
          ) : (
            <form onSubmit={save}>
              <button className="admin-mission-mobile-back" type="button" onClick={() => { setSelectedId(null); setCreating(false); }}>← Danh sách</button>
              <div className="admin-reward-card-head">
                <div><span className="eyebrow">{creating ? 'NEW MISSION' : 'EDIT MISSION'}</span><b>{creating ? 'Tạo nhiệm vụ mới' : selected?.title}</b></div>
              </div>

              <label>Tên nhiệm vụ<input required value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} /></label>
              <label>Mô tả<textarea rows="4" value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} /></label>

              <div className="admin-mission-form-row">
                <label>Trạng thái<select value={form.status} onChange={(e) => setForm((c) => ({ ...c, status: e.target.value }))}><option>DRAFT</option><option>ACTIVE</option><option>PAUSED</option><option>ENDED</option></select></label>
                <label>Mục tiêu số đóng góp<input type="number" min="1" value={form.targetCount} onChange={(e) => setForm((c) => ({ ...c, targetCount: e.target.value }))} /></label>
              </div>

              <div className="admin-mission-form-row">
                <label>Bonus mỗi đóng góp<input type="number" min="0" value={form.bonusPoints} onChange={(e) => setForm((c) => ({ ...c, bonusPoints: e.target.value }))} /></label>
                <label>Bonus hoàn thành<input type="number" min="0" value={form.completionBonus} onChange={(e) => setForm((c) => ({ ...c, completionBonus: e.target.value }))} /></label>
              </div>

              <div className="admin-mission-form-row">
                <label>Bắt đầu<input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((c) => ({ ...c, startsAt: e.target.value }))} /></label>
                <label>Kết thúc<input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((c) => ({ ...c, endsAt: e.target.value }))} /></label>
              </div>

              <div className="admin-mission-types">
                <b>Loại đóng góp áp dụng</b>
                <small>Không chọn loại nào = áp dụng cho tất cả đóng góp được duyệt.</small>
                <div>
                  {TYPES.map(([value, label]) => (
                    <button type="button" className={form.contributionTypes.includes(value) ? 'active' : ''} onClick={() => toggleType(value)} key={value}>
                      <Sparkles size={13} /> {label}
                    </button>
                  ))}
                </div>
              </div>

              <button className="primary-action" type="submit" disabled={saving}><Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu nhiệm vụ'}</button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
