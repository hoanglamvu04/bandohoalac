import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  Check,
  ImagePlus,
  LocateFixed,
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
import { DEFAULT_CENTER, isInsideServiceCoverage } from '../../mapConfig.js';

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


function formatCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(6) : '—';
}

function parseCoordinatePair(raw) {
  const parts = String(raw || '')
    .trim()
    .replace(/[;|]+/g, ',')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);

  if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
    return null;
  }

  let lat = parts[0];
  let lng = parts[1];

  // Accept both "lat,lng" and the common GIS "lng,lat" form.
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
    [lat, lng] = [lng, lat];
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

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
  const [coordinateText, setCoordinateText] = useState('');

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
    setCoordinateText('');
  }

  function closeEditor() {
    setCreating(false);
    setSelectedId(null);
    setDetail(null);
    setPhotos([]);
    setCoordinateText('');
  }

  const editorOpen = creating || Boolean(selectedId);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateCoordinate(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function applyCoordinateText() {
    const parsed = parseCoordinatePair(coordinateText);

    if (!parsed) {
      showToast('Tọa độ không hợp lệ. Ví dụ: 21.015000, 105.515000', 'error');
      return;
    }

    if (!isInsideServiceCoverage(parsed.lng, parsed.lat)) {
      showToast('Tọa độ nằm ngoài vùng hoạt động của Hola Maps.', 'error');
      return;
    }

    setForm((current) => ({
      ...current,
      lat: parsed.lat,
      lng: parsed.lng
    }));
    setCoordinateText(parsed.lat.toFixed(6) + ', ' + parsed.lng.toFixed(6));
    showToast('Đã cập nhật vị trí theo tọa độ.', 'success');
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

    const lat = Number(form.lat);
    const lng = Number(form.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      showToast('Vĩ độ / kinh độ không hợp lệ.', 'error');
      return;
    }

    if (!isInsideServiceCoverage(lng, lat)) {
      showToast('Vị trí nằm ngoài vùng hoạt động của Hola Maps.', 'error');
      return;
    }

    setSaving(true);
    try {
      let placeId = selectedId;

      if (creating) {
        const created = await createAdminPlace(changedPayload);
        placeId = created.id;
      } else if (selectedId) {
        await updateAdminPlace(selectedId, changedPayload);
      }

      if (placeId && photos.length) {
        await uploadAdminPlaceImages(placeId, photos);
      }

      const photoMessage = photos.length
        ? ' và tải ' + photos.length + ' ảnh'
        : '';

      showToast(
        creating
          ? 'Đã tạo địa điểm' + photoMessage + '.'
          : 'Đã cập nhật địa điểm' + photoMessage + '.',
        'success'
      );

      setCreating(false);
      setPhotos([]);
      await loadList();

      if (placeId) {
        await openPlace(placeId);
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
    <main className={editorOpen
      ? 'admin-page admin-places-page page-container editor-active'
      : 'admin-page admin-places-page page-container'}>
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

      <section className={editorOpen ? 'admin-places-layout editing' : 'admin-places-layout'}>
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
                  {(place.thumbnails?.[0] || place.images?.[0])
                    ? (
                      <img
                        src={place.thumbnails?.[0] || place.images?.[0]}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    )
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
                <button
                  className="admin-place-mobile-back"
                  type="button"
                  onClick={closeEditor}
                >
                  <ArrowLeft size={16} />
                  Quay lại danh sách
                </button>

                <div className="admin-place-editor-title">
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
                <div className="admin-place-location-head">
                  <div>
                    <b>Vị trí</b>
                    <span>{formatCoordinate(form.lat)}, {formatCoordinate(form.lng)}</span>
                  </div>
                  <span className="admin-coordinate-badge">
                    <LocateFixed size={13} />
                    Nhập tọa độ hoặc kéo ghim
                  </span>
                </div>

                <div className="admin-coordinate-grid">
                  <label>
                    Vĩ độ (Latitude)
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="-90"
                      max="90"
                      value={form.lat}
                      onChange={(event) => updateCoordinate('lat', event.target.value)}
                      placeholder="21.015000"
                    />
                  </label>

                  <label>
                    Kinh độ (Longitude)
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="-180"
                      max="180"
                      value={form.lng}
                      onChange={(event) => updateCoordinate('lng', event.target.value)}
                      placeholder="105.515000"
                    />
                  </label>
                </div>

                <div className="admin-coordinate-paste">
                  <input
                    value={coordinateText}
                    onChange={(event) => setCoordinateText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        applyCoordinateText();
                      }
                    }}
                    placeholder="Dán tọa độ: 21.015000, 105.515000"
                  />
                  <button type="button" onClick={applyCoordinateText}>
                    <LocateFixed size={15} />
                    Áp dụng
                  </button>
                </div>

                <p className="admin-coordinate-note">
                  Hỗ trợ cả <b>vĩ độ, kinh độ</b> và <b>kinh độ, vĩ độ</b>. Bản đồ bên dưới sẽ tự di chuyển tới tọa độ hợp lệ.
                </p>

                <LocationPicker
                  lat={Number(form.lat)}
                  lng={Number(form.lng)}
                  onChange={({ lat, lng }) => {
                    setForm((current) => ({ ...current, lat, lng }));
                    setCoordinateText(lat.toFixed(6) + ', ' + lng.toFixed(6));
                  }}
                />
              </div>

              <div className="admin-place-images">
                <div className="admin-place-images-head">
                  <div>
                    <b>Ảnh địa điểm</b>
                    <small>Tối đa 20 ảnh mỗi lần tải lên</small>
                    <span>
                      {creating
                        ? (photos.length ? photos.length + ' ảnh đã chọn' : 'Chưa chọn ảnh')
                        : ((detail?.imageItems?.length || 0) + ' ảnh hiện có')}
                    </span>
                  </div>
                  <label className="admin-image-picker">
                    <ImagePlus size={15} />
                    Chọn ảnh
                    <input
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => setPhotos(Array.from(event.target.files || []).slice(0, 20))}
                    />
                  </label>
                </div>

                {!!photos.length && (
                  <div className="admin-place-selected-photos">
                    <Check size={15} />
                    <div>
                      <b>{photos.length} ảnh sẽ được tải lên khi bấm Lưu địa điểm</b>
                      <span>{photos.map((file) => file.name).join(' · ')}</span>
                    </div>
                    <button type="button" onClick={() => setPhotos([])}>
                      <X size={14} />
                      Bỏ chọn
                    </button>
                  </div>
                )}

                {!creating && (
                  <div className="admin-place-image-grid">
                    {(detail?.imageItems || []).map((image) => (
                      <article className={image.isCover ? 'admin-place-image cover' : 'admin-place-image'} key={image.id}>
                        <img
                          src={image.thumbnailUrl || image.cardUrl || image.url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
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
                )}
              </div>

              <div className="admin-place-save-row">
                <button className="primary-action" type="submit" disabled={saving}>
                  <Check size={17} /> {saving
                    ? (photos.length ? 'Đang lưu & tải ảnh...' : 'Đang lưu...')
                    : (photos.length ? 'Lưu địa điểm & ' + photos.length + ' ảnh' : 'Lưu địa điểm')}
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
