import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  ImagePlus,
  LocateFixed,
  MapPin,
  PencilLine,
  Plus,
  Search,
  Sparkles,
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
  previewGooglePlaceImport,
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
  googlePlaceId: '',
  googleMapsUri: '',
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
    googlePlaceId: place.googlePlaceId || '',
    googleMapsUri: place.googleMapsUri || '',
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
  const [googleImportOpen, setGoogleImportOpen] = useState(false);
  const [googleImportInput, setGoogleImportInput] = useState('');
  const [googleImportLoading, setGoogleImportLoading] = useState(false);
  const [googleImportResult, setGoogleImportResult] = useState(null);

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
      setGoogleImportResult(null);
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
    setGoogleImportResult(null);
  }

  function closeEditor() {
    setCreating(false);
    setSelectedId(null);
    setDetail(null);
    setPhotos([]);
    setCoordinateText('');
    setGoogleImportResult(null);
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

  function openGoogleImport() {
    setGoogleImportInput('');
    setGoogleImportResult(null);
    setGoogleImportOpen(true);
  }

  function closeGoogleImport() {
    if (googleImportLoading) return;
    setGoogleImportOpen(false);
  }

  async function analyzeGoogleImport(event) {
    event?.preventDefault?.();

    const input = googleImportInput.trim();
    if (!input) {
      showToast('Dán link Google Maps hoặc nhập tên địa điểm.', 'error');
      return;
    }

    setGoogleImportLoading(true);
    try {
      const data = await previewGooglePlaceImport(input);
      setGoogleImportResult(data);
      if (!data?.candidates?.length) {
        showToast('Google Places không tìm thấy địa điểm phù hợp.', 'info');
      }
    } catch (error) {
      setGoogleImportResult(null);
      showToast(error.message, 'error');
    } finally {
      setGoogleImportLoading(false);
    }
  }

  function applyGoogleCandidate(candidate) {
    if (candidate?.existingPlace?.id) {
      setGoogleImportOpen(false);
      openPlace(Number(candidate.existingPlace.id));
      showToast('Địa điểm này đã có trên Hola Maps.', 'info');
      return;
    }

    if (!candidate?.insideServiceArea) {
      showToast('Địa điểm này nằm ngoài vùng hoạt động hiện tại của Hola Maps.', 'error');
      return;
    }

    const categoryExists = categories.some((item) => item.slug === candidate.categorySlug);

    setCreating(true);
    setSelectedId(null);
    setDetail(null);
    setPhotos([]);
    setForm({
      ...EMPTY_FORM,
      name: candidate.name || '',
      categorySlug: categoryExists ? candidate.categorySlug : '',
      address: candidate.address || '',
      description: candidate.description || '',
      phone: candidate.phone || '',
      website: candidate.website || '',
      priceLevel: candidate.priceLevel || '',
      openingHours: candidate.openingHours || '',
      googlePlaceId: candidate.googlePlaceId || '',
      googleMapsUri: candidate.googleMapsUri || '',
      status: 'PUBLISHED',
      lat: Number(candidate.lat) || DEFAULT_CENTER[1],
      lng: Number(candidate.lng) || DEFAULT_CENTER[0]
    });
    setCoordinateText(
      Number(candidate.lat).toFixed(6) + ', ' + Number(candidate.lng).toFixed(6)
    );
    setGoogleImportOpen(false);
    setGoogleImportResult(null);
    showToast('Đã điền dữ liệu Google Maps vào form. Kiểm tra lại rồi bấm Lưu địa điểm.', 'success');
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
    googlePlaceId: form.googlePlaceId.trim() || null,
    googleMapsUri: form.googleMapsUri.trim() || null,
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
        <div className="admin-places-heading-actions">
          <button className="secondary-action admin-google-import-button" type="button" onClick={openGoogleImport}>
            <Download size={17} /> Nhập từ Google Maps
          </button>
          <button className="primary-action" type="button" onClick={startCreate}>
            <Plus size={17} /> Thêm địa điểm
          </button>
        </div>
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

              {form.googlePlaceId && (
                <div className="admin-google-import-source">
                  <span className="admin-google-import-source-icon"><Sparkles size={18} /></span>
                  <div>
                    <small>NGUỒN NHẬP</small>
                    <b>Google Maps đã được dùng để điền dữ liệu ban đầu</b>
                    <span>Place ID: {form.googlePlaceId}</span>
                  </div>
                  {form.googleMapsUri && (
                    <a href={form.googleMapsUri} target="_blank" rel="noreferrer">
                      Mở Google Maps <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              )}

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
                      onChange={(event) => setPhotos(Array.from(event.target.files || []).slice(0, 8))}
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

      {googleImportOpen && (
        <div
          className="admin-google-import-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Nhập địa điểm từ Google Maps"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeGoogleImport();
          }}
        >
          <div className="admin-google-import-card">
            <div className="admin-google-import-head">
              <div>
                <span className="eyebrow">GOOGLE MAPS IMPORT</span>
                <h2>Nhập địa điểm tự động</h2>
                <p>Dán link Google Maps hoặc nhập tên địa điểm. Hola Maps sẽ tìm, phân loại và điền sẵn form để Admin kiểm tra.</p>
              </div>
              <button type="button" onClick={closeGoogleImport} aria-label="Đóng"><X size={20} /></button>
            </div>

            <form className="admin-google-import-search" onSubmit={analyzeGoogleImport}>
              <label>
                Link Google Maps / tên địa điểm
                <div>
                  <Search size={18} />
                  <input
                    autoFocus
                    value={googleImportInput}
                    onChange={(event) => setGoogleImportInput(event.target.value)}
                    placeholder="VD: https://maps.app.goo.gl/... hoặc Hanashi Coffee Hạ Bằng"
                  />
                </div>
              </label>
              <button className="primary-action" type="submit" disabled={googleImportLoading}>
                <Sparkles size={17} />
                {googleImportLoading ? 'Đang phân tích...' : 'Phân tích địa điểm'}
              </button>
            </form>

            <div className="admin-google-import-note">
              <b>Hola Maps chỉ dùng dữ liệu này làm bản nháp.</b>
              <span>Admin vẫn kiểm tra và bấm Lưu. Ảnh từ Google không tự sao chép vào kho ảnh Hola Maps.</span>
            </div>

            {googleImportResult && (
              <div className="admin-google-import-results">
                <div className="admin-google-import-results-head">
                  <div>
                    <b>Kết quả phù hợp</b>
                    <span>
                      {googleImportResult.query
                        ? 'Tìm theo: ' + googleImportResult.query
                        : 'Tìm theo Google Place ID'}
                    </span>
                  </div>
                  <strong>{googleImportResult.candidates?.length || 0} kết quả</strong>
                </div>

                {!googleImportResult.candidates?.length ? (
                  <div className="admin-google-import-empty">
                    <MapPin size={22} />
                    <b>Không tìm thấy địa điểm</b>
                    <span>Thử link Google Maps đầy đủ hoặc thêm “Hòa Lạc / Thạch Thất” vào tên tìm kiếm.</span>
                  </div>
                ) : (
                  <div className="admin-google-import-list">
                    {googleImportResult.candidates.map((candidate) => (
                      <article
                        key={candidate.googlePlaceId || candidate.name}
                        className={[
                          'admin-google-import-result',
                          !candidate.insideServiceArea ? 'outside' : '',
                          candidate.existingPlace ? 'existing' : ''
                        ].filter(Boolean).join(' ')}
                      >
                        <div className="admin-google-import-result-main">
                          <div className="admin-google-import-result-title">
                            <span className="admin-google-import-pin"><MapPin size={18} /></span>
                            <div>
                              <small>{candidate.googlePrimaryTypeLabel || candidate.googlePrimaryType || 'Google Place'}</small>
                              <h3>{candidate.name}</h3>
                              <p>{candidate.address || 'Chưa có địa chỉ'}</p>
                            </div>
                          </div>

                          <div className="admin-google-import-meta">
                            <span>
                              <b>Danh mục đề xuất</b>
                              {categories.find((item) => item.slug === candidate.categorySlug)?.name || 'Cần Admin chọn'}
                            </span>
                            <span>
                              <b>Đánh giá Google</b>
                              {candidate.googleRating
                                ? candidate.googleRating.toFixed(1) + ' · ' + candidate.googleUserRatingCount + ' lượt'
                                : 'Chưa có'}
                            </span>
                            <span>
                              <b>Vị trí</b>
                              {candidate.insideServiceArea ? 'Trong vùng Hola Maps' : 'Ngoài vùng Hola Maps'}
                            </span>
                          </div>

                          <div className="admin-google-import-analysis">
                            <Sparkles size={14} />
                            <span>
                              {candidate.analysis?.categoryReason}
                              {candidate.tags?.length ? ' · Tags: ' + candidate.tags.join(', ') : ''}
                            </span>
                          </div>

                          {(candidate.phone || candidate.website || candidate.openingHours) && (
                            <div className="admin-google-import-details">
                              {candidate.phone && <span><b>Điện thoại:</b> {candidate.phone}</span>}
                              {candidate.openingHours && <span><b>Giờ mở cửa:</b> {candidate.openingHours}</span>}
                              {candidate.website && <span><b>Website:</b> {candidate.website}</span>}
                            </div>
                          )}
                        </div>

                        <div className="admin-google-import-result-actions">
                          {candidate.existingPlace ? (
                            <button type="button" className="secondary-action" onClick={() => applyGoogleCandidate(candidate)}>
                              Đã có · Mở #{candidate.existingPlace.id}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="primary-action"
                              disabled={!candidate.insideServiceArea}
                              onClick={() => applyGoogleCandidate(candidate)}
                            >
                              <Check size={16} />
                              {candidate.insideServiceArea ? 'Dùng dữ liệu này' : 'Ngoài vùng'}
                            </button>
                          )}
                          {candidate.googleMapsUri && (
                            <a href={candidate.googleMapsUri} target="_blank" rel="noreferrer">
                              Google Maps <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
