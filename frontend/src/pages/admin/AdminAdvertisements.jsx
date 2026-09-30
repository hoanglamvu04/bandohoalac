import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Check,
  ExternalLink,
  ImagePlus,
  Megaphone,
  Plus,
  Save,
  X
} from 'lucide-react';
import {
  archiveAdminAdvertisement,
  createAdminAdvertisement,
  getAdminAdvertisements,
  updateAdminAdvertisement,
  uploadAdminAdvertisementImage
} from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';

const EMPTY_FORM = {
  title: '',
  targetUrl: '',
  altText: '',
  status: 'DRAFT',
  sortOrder: 0,
  startsAt: '',
  endsAt: ''
};

function toLocalDateTime(value) {
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

function toForm(ad) {
  if (!ad) return { ...EMPTY_FORM };
  return {
    title: ad.title || '',
    targetUrl: ad.targetUrl || '',
    altText: ad.altText || '',
    status: ad.status || 'DRAFT',
    sortOrder: Number(ad.sortOrder || 0),
    startsAt: toLocalDateTime(ad.startsAt),
    endsAt: toLocalDateTime(ad.endsAt)
  };
}

export default function AdminAdvertisements() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [imageFile, setImageFile] = useState(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => items.find((item) => String(item.id) === String(selectedId)) || null,
    [items, selectedId]
  );

  function load() {
    setLoading(true);
    return getAdminAdvertisements()
      .then((data) => setItems(Array.isArray(data?.items) ? data.items : []))
      .catch((error) => {
        setItems([]);
        showToast(error.message, 'error');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function startCreate() {
    setCreating(true);
    setSelectedId(null);
    setForm({ ...EMPTY_FORM });
    setImageFile(null);
  }

  function openAd(ad) {
    setCreating(false);
    setSelectedId(ad.id);
    setForm(toForm(ad));
    setImageFile(null);
  }

  function closeEditor() {
    setCreating(false);
    setSelectedId(null);
    setForm({ ...EMPTY_FORM });
    setImageFile(null);
  }

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function save(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      showToast('Nhập tên quảng cáo.', 'error');
      return;
    }
    if (!form.targetUrl.trim()) {
      showToast('Nhập link chuyển hướng.', 'error');
      return;
    }
    if (form.status === 'ACTIVE' && !imageFile && !selected?.imageUrl) {
      showToast('Quảng cáo ACTIVE cần có ảnh banner.', 'error');
      return;
    }

    const startsAt = toIso(form.startsAt);
    const endsAt = toIso(form.endsAt);

    if (startsAt && endsAt && new Date(endsAt) < new Date(startsAt)) {
      showToast('Thời gian kết thúc phải sau thời gian bắt đầu.', 'error');
      return;
    }

    const payload = {
      title: form.title.trim(),
      targetUrl: form.targetUrl.trim(),
      altText: form.altText.trim() || null,
      status: form.status,
      sortOrder: Number(form.sortOrder || 0),
      startsAt,
      endsAt
    };

    setSaving(true);
    try {
      let id = selectedId;
      if (creating) {
        const created = await createAdminAdvertisement(payload);
        id = created.id;
      } else {
        await updateAdminAdvertisement(selectedId, payload);
      }

      if (imageFile && id) {
        await uploadAdminAdvertisementImage(id, imageFile);
      }

      showToast(creating ? 'Đã tạo quảng cáo.' : 'Đã cập nhật quảng cáo.', 'success');
      setCreating(false);
      setImageFile(null);
      await load();

      if (id) {
        const fresh = await getAdminAdvertisements();
        const nextItems = Array.isArray(fresh?.items) ? fresh.items : [];
        setItems(nextItems);
        const next = nextItems.find((item) => String(item.id) === String(id));
        if (next) {
          setSelectedId(next.id);
          setForm(toForm(next));
        }
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function archiveSelected() {
    if (!selectedId || !window.confirm('Lưu trữ quảng cáo này?')) return;
    setSaving(true);
    try {
      await archiveAdminAdvertisement(selectedId);
      showToast('Đã lưu trữ quảng cáo.', 'info');
      closeEditor();
      await load();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const editorOpen = creating || Boolean(selectedId);
  const previewUrl = imageFile ? URL.createObjectURL(imageFile) : selected?.imageUrl || '';

  return (
    <main className="admin-page admin-ads-page page-container">
      <div className="section-heading admin-ads-heading">
        <div>
          <span className="eyebrow">ADVERTISEMENT MANAGEMENT</span>
          <h2>Quản lý quảng cáo</h2>
          <p>Tạo banner, đặt link chuyển hướng, lịch chạy và thứ tự hiển thị trên trang chủ.</p>
        </div>
        <button className="primary-action" type="button" onClick={startCreate}>
          <Plus size={17} /> Thêm quảng cáo
        </button>
      </div>

      <section className={editorOpen ? 'admin-ads-layout editing' : 'admin-ads-layout'}>
        <aside className="admin-ad-list-panel">
          <div className="admin-ad-list-head">
            <b>Danh sách quảng cáo</b>
            <span>{items.length} mục</span>
          </div>

          {loading && <div className="loading-card">Đang tải quảng cáo...</div>}

          {!loading && !items.length && (
            <div className="empty-state">
              <Megaphone size={24} />
              <b>Chưa có quảng cáo</b>
              <span>Tạo banner đầu tiên để hiển thị trên trang chủ.</span>
            </div>
          )}

          <div className="admin-ad-list">
            {items.map((ad) => (
              <button
                type="button"
                className={String(selectedId) === String(ad.id) ? 'admin-ad-row active' : 'admin-ad-row'}
                onClick={() => openAd(ad)}
                key={ad.id}
              >
                <span className="admin-ad-thumb">
                  {ad.imageUrl ? <img src={ad.imageUrl} alt="" /> : <Megaphone size={18} />}
                </span>
                <span className="admin-ad-row-copy">
                  <small>{ad.status} · thứ tự {ad.sortOrder}</small>
                  <b>{ad.title}</b>
                  <em>{ad.targetUrl}</em>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="admin-ad-editor">
          {!editorOpen ? (
            <div className="admin-ad-placeholder">
              <Megaphone size={32} />
              <b>Chọn quảng cáo để chỉnh sửa</b>
              <span>Hoặc bấm “Thêm quảng cáo” để tạo banner mới.</span>
            </div>
          ) : (
            <form onSubmit={save}>
              <div className="admin-ad-editor-head">
                <button className="admin-ad-mobile-close" type="button" onClick={closeEditor}>
                  <X size={15} /> Quay lại
                </button>
                <div>
                  <span className="eyebrow">{creating ? 'NEW ADVERTISEMENT' : 'EDIT AD #' + selectedId}</span>
                  <h2>{creating ? 'Tạo quảng cáo mới' : selected?.title || form.title}</h2>
                </div>
                {!creating && (
                  <button className="admin-ad-archive" type="button" onClick={archiveSelected}>
                    <Archive size={15} /> Lưu trữ
                  </button>
                )}
              </div>

              <div className="admin-ad-form-grid">
                <label className="full">
                  Tên quảng cáo
                  <input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="VD: Hola House - Ưu đãi tháng 10" />
                </label>

                <label className="full">
                  Link khi bấm banner
                  <input value={form.targetUrl} onChange={(e) => update('targetUrl', e.target.value)} placeholder="https://... hoặc /place/123" />
                </label>

                <label className="full">
                  Mô tả ảnh (alt text)
                  <input value={form.altText} onChange={(e) => update('altText', e.target.value)} placeholder="Mô tả ngắn cho banner" />
                </label>

                <label>
                  Trạng thái
                  <select value={form.status} onChange={(e) => update('status', e.target.value)}>
                    <option value="DRAFT">DRAFT</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </label>

                <label>
                  Thứ tự hiển thị
                  <input type="number" value={form.sortOrder} onChange={(e) => update('sortOrder', e.target.value)} />
                </label>

                <label>
                  Bắt đầu
                  <input type="datetime-local" value={form.startsAt} onChange={(e) => update('startsAt', e.target.value)} />
                </label>

                <label>
                  Kết thúc
                  <input type="datetime-local" value={form.endsAt} onChange={(e) => update('endsAt', e.target.value)} />
                </label>
              </div>

              <div className="admin-ad-image-section">
                <div className="admin-ad-image-head">
                  <div>
                    <b>Ảnh banner</b>
                    <span>Khuyến nghị 1600 × 600px, JPG/PNG/WEBP.</span>
                  </div>
                  <label className="admin-ad-image-picker">
                    <ImagePlus size={16} />
                    {previewUrl ? 'Đổi ảnh' : 'Chọn ảnh'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                    />
                  </label>
                </div>

                {previewUrl ? (
                  <div className="admin-ad-preview">
                    <img src={previewUrl} alt={form.altText || form.title || 'Xem trước banner'} />
                  </div>
                ) : (
                  <div className="admin-ad-preview empty">
                    <ImagePlus size={26} />
                    <span>Chưa có ảnh banner</span>
                  </div>
                )}
              </div>

              <div className="admin-ad-save-row">
                <button className="primary-action" type="submit" disabled={saving}>
                  {saving ? <Check size={17} /> : <Save size={17} />}
                  {saving ? 'Đang lưu...' : 'Lưu quảng cáo'}
                </button>

                {form.targetUrl && (
                  <a
                    className="secondary-action"
                    href={form.targetUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={15} /> Mở thử link
                  </a>
                )}
              </div>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}
