import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Camera,
  Check,
  ImagePlus,
  MapPin,
  PencilLine,
  Plus,
  Search,
  Star,
  Trash2,
  X
} from 'lucide-react';
import {
  archiveAdminPlace,
  createAdminPlace,
  deleteAdminPlaceImage,
  getAdminPlace,
  getAdminPlaces,
  getCategories,
  setAdminPlaceCover,
  updateAdminPlace,
  uploadAdminPlaceImages
} from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import LocationPicker from '../../components/LocationPicker.jsx';
import { DEFAULT_CENTER } from '../../mapConfig.js';

const EMPTY_FORM = {
  name: '',
  categorySlug: '',
  address: '',
  description: '',
  phone: '',
  website: '',
  priceLevel: '',
  openingHours: '',
  status: 'PUBLISHED',
  lat: DEFAULT_CENTER[1],
  lng: DEFAULT_CENTER[0]
};

function toForm(place) {
  if (!place) return { ...EMPTY_FORM };
  return {
    name: place.name || '',
    categorySlug: place.categorySlug || '',
    address: place.address || '',
    description: place.description || '',
    phone: place.phone || '',
    website: place.website || '',
    priceLevel: place.priceLevel || '',
    openingHours: place.openingHours || '',
    status: place.status || 'PUBLISHED',
    lat: Number(place.lat) || DEFAULT_CENTER[1],
    lng: Number(place.lng) || DEFAULT_CENTER[0]
  };
}

export default function AdminPlaces() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState('ALL');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [creating, setCreating] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function loadList() {
    setLoading(true);
    return getAdminPlaces({
      status,
      q: query.trim() || undefined,
      limit: 100
    })
      .then((data) => setItems(Array.isArray(data?.items) ? data.items : []))
      .catch((error) => {
        setItems([]);
        showToast(error.message, 'error');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(loadList, query.trim() ? 260 : 0);
    return () => window.clearTimeout(timer);
  }, [status, query]);

  useEffect(() => {
    getCategories()
      .then((data) => setCategories(Array.isArray(data?.items) ? data.items : []))
      .catch(() => setCategories([]));
  }, []);

  async function openPlace(id) {
    setCreating(false);
    setSelectedId(id);
    try {
      const data = await getAdminPlace(id);
      setDetail(data);
      setForm(toForm(data));
      setPhotos([]);
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  function startCreate() {
    setCreating(true);
    setSelectedId(null);
    setDetail(null);
    setForm({
      ...EMPTY_FORM,
      categorySlug: categories[0]?.slug || ''
    });
    setPhotos([]);
  }

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  const changedPayload = useMemo(() => ({
    name: form.name.trim(),
    categorySlug: form.categorySlug || null,
    address: form.address.trim() || null,
    description: form.description.trim() || null,
    phone: form.phone.trim() || null,
    website: form.website.trim() || null,
    priceLevel: form.priceLevel.trim() || null,
    openingHours: form.openingHours.trim() || null,
    status: form.status,
    lat: Number(form.lat),
    lng: Number(form.lng)
  }), [form]);

  async function save(event) {
    event.preventDefault();
    if (!form.name.trim()) {
      showToast('Tên địa điểm không được để trống.', 'error');
      return;
    }

    setSaving(true);
    try {
      if (creating) {
        const created = await createAdminPlace(changedPayload);
        showToast('Đã tạo địa điểm.', 'success');
        setCreating(false);
        await loadList();
        await openPlace(created.id);
      } else if (selectedId) {
        await updateAdminPlace(selectedId, changedPayload);
        showToast('Đã cập nhật địa điểm.', 'success');
        await loadList();
        await openPlace(selectedId);
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function archivePlace() {
    if (!selectedId) return;
    if (!window.confirm('Ẩn địa điểm này khỏi Hola Maps?')) return;

    setSaving(true);
    try {
      await archiveAdminPlace(selectedId);
      showToast('Đã chuyển địa điểm sang ARCHIVED.', 'info');
      setSelectedId(null);
      setDetail(null);
      await loadList();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function uploadImages() {
    if (!selectedId || !photos.length) return;
    setSaving(true);
    try {
      const data = await uploadAdminPlaceImages(selectedId, photos);
      setDetail((current) => ({ ...current, imageItems: data.items }));
      setPhotos([]);
      showToast('Đã thêm ảnh địa điểm.', 'success');
      await loadList();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function makeCover(imageId) {
    if (!selectedId) return;
    try {
      const data = await setAdminPlaceCover(selectedId, imageId);
      setDetail((current) => ({ ...current, imageItems: data.items }));
      showToast('Đã đổi ảnh đại diện.', 'success');
      await loadList();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function removeImage(imageId) {
    if (!selectedId || !window.confirm('Xóa ảnh này?')) return;
    try {
      const data = await deleteAdminPlaceImage(selectedId, imageId);
      setDetail((current) => ({ ...current, imageItems: data.items }));
      showToast('Đã xóa ảnh.', 'info');
      await loadList();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  return (
    <main className="admin-page admin-places-page page-container">
      <div className="section-heading admin-places-heading">
        <div>
          <span className="eyebrow">PLACE MANAGEMENT</span>
          <h2>Quản lý địa điểm</h2>
          <p>Thêm, sửa, ẩn và quản lý ảnh của mọi địa điểm trên Hola Maps.</p>
        </div>
        <button className="primary-action" type="button" onClick={startCreate}>
          <Plus size={17} /> Thêm địa điểm
        </button>
      </div>

      <section className="admin-places-layout">
        <aside className="admin-place-browser">
          <div className="admin-place-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm tên, địa chỉ..."
            />
          </div>

          <div className="admin-status-tabs admin-place-status-tabs">
            {['ALL', 'PUBLISHED', 'PENDING', 'ARCHIVED', 'REJECTED'].map((value) => (
              <button
                key={value}
                className={status === value ? 'active' : ''}
                onClick={() => setStatus(value)}
              >
                {value}
              </button>
            ))}
          </div>

          {loading && <div className="loading-card">Đang tải địa điểm...</div>}

          {!loading && !items.length && (
            <div className="empty-state">
              <MapPin size={23} />
              <b>Không có địa điểm</b>
              <span>Thử đổi trạng thái hoặc từ khóa.</span>
            </div>
          )}

          <div className="admin-place-list">
            {items.map((place) => (
              <button
                key={place.id}
                type="button"
                className={selectedId === place.id ? 'admin-place-row active' : 'admin-place-row'}
                onClick={() => openPlace(place.id)}
              >
                <span className="admin-place-row-cover">
                  {place.images?.[0]
                    ? <img src={place.images[0]} alt="" />
                    : <MapPin size={18} />}
                </span>
                <span>
                  <small>{place.category || 'Địa điểm'} · {place.status}</small>
                  <b>{place.name}</b>
                  <em>{place.address || 'Chưa có địa chỉ'}</em>
                </span>
                <strong><Star size={12} fill="currentColor" /> {Number(place.rating || 0).toFixed(1)}</strong>
              </button>
            ))}
          </div>
        </aside>

        <section className="admin-place-editor">
          {!creating && !selectedId ? (
            <div className="admin-place-placeholder">
              <PencilLine size={30} />
              <b>Chọn một địa điểm để quản lý</b>
              <span>Hoặc tạo địa điểm mới bằng nút phía trên.</span>
            </div>
          ) : (
            <form onSubmit={save}>
              <div className="admin-place-editor-head">
                <div>
                  <span className="eyebrow">{creating ? 'NEW PLACE' : 'EDIT PLACE #' + selectedId}</span>
                  <h2>{creating ? 'Tạo địa điểm' : (detail?.name || form.name)}</h2>
                </div>
                {!creating && (
                  <button className="admin-archive-button" type="button" onClick={archivePlace}>
                    <Archive size={16} /> Archive
                  </button>
                )}
              </div>

              <div className="admin-place-form-grid">
                <label className="full">
                  Tên địa điểm
                  <input value={form.name} onChange={(e) => update('name', e.target.value)} />
                </label>

                <label>
                  Danh mục
                  <select value={form.categorySlug} onChange={(e) => update('categorySlug', e.target.value)}>
                    <option value="">Không phân loại</option>
                    {categories.map((category) => (
                      <option key={category.slug} value={category.slug}>{category.name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Trạng thái
                  <select value={form.status} onChange={(e) => update('status', e.target.value)}>
                    {['PUBLISHED', 'PENDING', 'ARCHIVED', 'REJECTED'].map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>

                <label className="full">
                  Địa chỉ
                  <input value={form.address} onChange={(e) => update('address', e.target.value)} />
                </label>

                <label>
                  Điện thoại
                  <input value={form.phone} onChange={(e) => update('phone', e.target.value)} />
                </label>

                <label>
                  Website
                  <input value={form.website} onChange={(e) => update('website', e.target.value)} />
                </label>

                <label>
                  Mức giá
                  <input value={form.priceLevel} onChange={(e) => update('priceLevel', e.target.value)} />
                </label>

                <label>
                  Giờ mở cửa
                  <input value={form.openingHours} onChange={(e) => update('openingHours', e.target.value)} />
                </label>

                <label className="full">
                  Mô tả
                  <textarea rows="5" value={form.description} onChange={(e) => update('description', e.target.value)} />
                </label>
              </div>

              <div className="admin-place-location">
                <div>
                  <b>Vị trí</b>
                  <span>{Number(form.lat).toFixed(6)}, {Number(form.lng).toFixed(6)}</span>
                </div>
                <LocationPicker
                  lat={Number(form.lat)}
                  lng={Number(form.lng)}
                  onChange={({ lat, lng }) => setForm((current) => ({ ...current, lat, lng }))}
                />
              </div>

              {!creating && (
                <div className="admin-place-images">
                  <div className="admin-place-images-head">
                    <div>
                      <b>Ảnh địa điểm</b>
                      <span>{detail?.imageItems?.length || 0} ảnh</span>
                    </div>
                    <label className="admin-image-picker">
                      <ImagePlus size={15} />
                      Chọn ảnh
                      <input
                        type="file"
                        multiple
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => setPhotos(Array.from(event.target.files || []).slice(0, 8))}
                      />
                    </label>
                  </div>

                  {!!photos.length && (
                    <button className="secondary-action" type="button" onClick={uploadImages} disabled={saving}>
                      <Camera size={15} /> Tải {photos.length} ảnh lên
                    </button>
                  )}

                  <div className="admin-place-image-grid">
                    {(detail?.imageItems || []).map((image) => (
                      <article className={image.isCover ? 'admin-place-image cover' : 'admin-place-image'} key={image.id}>
                        <img src={image.url} alt="" />
                        {image.isCover && <span><Check size={12} /> Cover</span>}
                        <div>
                          {!image.isCover && (
                            <button type="button" onClick={() => makeCover(image.id)}>
                              <Star size={14} /> Cover
                            </button>
                          )}
                          <button type="button" onClick={() => removeImage(image.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              <div className="admin-place-save-row">
                <button className="primary-action" type="submit" disabled={saving}>
                  <Check size={17} /> {saving ? 'Đang lưu...' : 'Lưu địa điểm'}
                </button>
                {creating && (
                  <button className="secondary-action" type="button" onClick={() => setCreating(false)}>
                    <X size={16} /> Hủy
                  </button>
                )}
              </div>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}
