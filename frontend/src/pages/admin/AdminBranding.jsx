import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Globe2,
  Image as ImageIcon,
  ImagePlus,
  Monitor,
  Palette,
  PanelBottom,
  PanelTop,
  Save,
  Smartphone,
  Trash2,
  Upload
} from 'lucide-react';
import {
  deleteAdminBrandAsset,
  getAdminBrand,
  updateAdminBrand,
  uploadAdminBrandAsset
} from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useBrand } from '../../context/BrandContext.jsx';

const EMPTY_SETTINGS = {
  headerLogoAssetId: '',
  compactLogoAssetId: '',
  footerLogoAssetId: '',
  faviconAssetId: '',
  headerLogoDesktopWidth: 198,
  headerLogoMobileWidth: 154,
  headerLogoCompactWidth: 38,
  footerLogoDesktopWidth: 178,
  footerLogoMobileWidth: 154
};

function settingsToForm(settings = {}) {
  return {
    headerLogoAssetId: settings.headerLogo?.id || '',
    compactLogoAssetId: settings.compactLogo?.id || '',
    footerLogoAssetId: settings.footerLogo?.id || '',
    faviconAssetId: settings.favicon?.id || '',
    headerLogoDesktopWidth: settings.headerLogoDesktopWidth || 198,
    headerLogoMobileWidth: settings.headerLogoMobileWidth || 154,
    headerLogoCompactWidth: settings.headerLogoCompactWidth || 38,
    footerLogoDesktopWidth: settings.footerLogoDesktopWidth || 178,
    footerLogoMobileWidth: settings.footerLogoMobileWidth || 154
  };
}

function nullableId(value) {
  return value ? Number(value) : null;
}

export default function AdminBranding() {
  const { showToast } = useToast();
  const { reloadBrand } = useBrand();

  const [settings, setSettings] = useState(null);
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState('LOGO');
  const [assetFile, setAssetFile] = useState(null);
  const [assetPreview, setAssetPreview] = useState('');
  const [uploading, setUploading] = useState(false);

  const logoAssets = useMemo(
    () => assets.filter((item) => item.assetType === 'LOGO'),
    [assets]
  );
  const faviconAssets = useMemo(
    () => assets.filter((item) => item.assetType === 'FAVICON'),
    [assets]
  );

  function assetById(id) {
    return assets.find((item) => String(item.id) === String(id)) || null;
  }

  const preview = {
    header: assetById(form.headerLogoAssetId)?.url || '/logo.svg?v=20260929-2',
    compact: assetById(form.compactLogoAssetId)?.url || '/pwa-icon.svg',
    footer: assetById(form.footerLogoAssetId)?.url || '/logo.svg?v=20260929-2',
    favicon: assetById(form.faviconAssetId)?.url || '/pwa-icon.svg'
  };

  function isAssetUsed(id) {
    const value = String(id);
    return [
      form.headerLogoAssetId,
      form.compactLogoAssetId,
      form.footerLogoAssetId,
      form.faviconAssetId
    ].some((item) => String(item || '') === value);
  }

  async function load() {
    setLoading(true);
    try {
      const data = await getAdminBrand();
      setSettings(data.settings || null);
      setAssets(Array.isArray(data.assets) ? data.assets : []);
      setForm(settingsToForm(data.settings));
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!assetFile) {
      setAssetPreview('');
      return undefined;
    }

    const url = URL.createObjectURL(assetFile);
    setAssetPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [assetFile]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const next = await updateAdminBrand({
        headerLogoAssetId: nullableId(form.headerLogoAssetId),
        compactLogoAssetId: nullableId(form.compactLogoAssetId),
        footerLogoAssetId: nullableId(form.footerLogoAssetId),
        faviconAssetId: nullableId(form.faviconAssetId),
        headerLogoDesktopWidth: Number(form.headerLogoDesktopWidth),
        headerLogoMobileWidth: Number(form.headerLogoMobileWidth),
        headerLogoCompactWidth: Number(form.headerLogoCompactWidth),
        footerLogoDesktopWidth: Number(form.footerLogoDesktopWidth),
        footerLogoMobileWidth: Number(form.footerLogoMobileWidth)
      });

      setSettings(next);
      setForm(settingsToForm(next));
      await reloadBrand();
      showToast('Đã cập nhật thương hiệu trên toàn website.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function uploadAsset(event) {
    event.preventDefault();

    if (!assetFile) {
      showToast('Hãy chọn ảnh trước.', 'error');
      return;
    }

    if (!assetName.trim()) {
      showToast('Nhập tên để dễ nhận biết asset.', 'error');
      return;
    }

    setUploading(true);
    try {
      const item = await uploadAdminBrandAsset({
        name: assetName.trim(),
        assetType,
        image: assetFile
      });

      setAssets((current) => [item, ...current]);
      setAssetName('');
      setAssetFile(null);

      if (assetType === 'LOGO' && !form.headerLogoAssetId) {
        update('headerLogoAssetId', item.id);
      }
      if (assetType === 'FAVICON' && !form.faviconAssetId) {
        update('faviconAssetId', item.id);
      }

      showToast('Đã tải asset thương hiệu.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setUploading(false);
    }
  }

  async function removeAsset(item) {
    if (isAssetUsed(item.id)) {
      showToast('Asset đang được chọn. Hãy đổi sang asset khác rồi mới xóa.', 'info');
      return;
    }

    if (!window.confirm('Xóa asset “' + item.name + '”?')) return;

    try {
      await deleteAdminBrandAsset(item.id);
      setAssets((current) => current.filter((asset) => asset.id !== item.id));
      showToast('Đã xóa asset.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  if (loading) {
    return (
      <main className="admin-page admin-brand-page page-container">
        <div className="loading-card">Đang tải cấu hình thương hiệu...</div>
      </main>
    );
  }

  return (
    <main className="admin-page admin-brand-page page-container">
      <section className="section-heading admin-brand-heading">
        <div>
          <span className="eyebrow">BRAND MANAGEMENT</span>
          <h2>Quản lý thương hiệu</h2>
          <p>
            Quản lý thư viện logo, favicon và chọn asset sử dụng cho Header,
            Footer, mobile. Thay đổi được áp dụng toàn website sau khi lưu.
          </p>
        </div>
        <span className="admin-brand-status">
          <Palette size={18} />
          {assets.length} asset
        </span>
      </section>

      <section className="admin-brand-layout">
        <form className="admin-brand-settings-card" onSubmit={saveSettings}>
          <div className="admin-brand-card-head">
            <div>
              <span className="eyebrow">VỊ TRÍ SỬ DỤNG</span>
              <h3>Logo đang hiển thị</h3>
            </div>
            <button className="primary-action" type="submit" disabled={saving}>
              {saving ? <Check size={17} /> : <Save size={17} />}
              {saving ? 'Đang lưu...' : 'Lưu thương hiệu'}
            </button>
          </div>

          <div className="admin-brand-placement-grid">
            <label>
              <span><PanelTop size={16} /> Logo Header</span>
              <select
                value={form.headerLogoAssetId}
                onChange={(event) => update('headerLogoAssetId', event.target.value)}
              >
                <option value="">Logo mặc định hệ thống</option>
                {logoAssets.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span><Smartphone size={16} /> Header thu gọn mobile</span>
              <select
                value={form.compactLogoAssetId}
                onChange={(event) => update('compactLogoAssetId', event.target.value)}
              >
                <option value="">Icon mặc định hệ thống</option>
                {logoAssets.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span><PanelBottom size={16} /> Logo Footer</span>
              <select
                value={form.footerLogoAssetId}
                onChange={(event) => update('footerLogoAssetId', event.target.value)}
              >
                <option value="">Logo mặc định hệ thống</option>
                {logoAssets.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span><Globe2 size={16} /> Favicon trình duyệt</span>
              <select
                value={form.faviconAssetId}
                onChange={(event) => update('faviconAssetId', event.target.value)}
              >
                <option value="">Favicon mặc định hệ thống</option>
                {faviconAssets.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-brand-size-section">
            <div className="admin-brand-subhead">
              <div>
                <span className="eyebrow">KÍCH THƯỚC</span>
                <h3>Điều chỉnh logo</h3>
              </div>
              <small>Đơn vị pixel · hệ thống tự giữ đúng tỉ lệ ảnh.</small>
            </div>

            <div className="admin-brand-size-grid">
              <label>
                Header desktop
                <div>
                  <Monitor size={15} />
                  <input
                    type="number"
                    min="60"
                    max="420"
                    value={form.headerLogoDesktopWidth}
                    onChange={(event) => update('headerLogoDesktopWidth', event.target.value)}
                  />
                  <span>px</span>
                </div>
              </label>

              <label>
                Header mobile
                <div>
                  <Smartphone size={15} />
                  <input
                    type="number"
                    min="50"
                    max="300"
                    value={form.headerLogoMobileWidth}
                    onChange={(event) => update('headerLogoMobileWidth', event.target.value)}
                  />
                  <span>px</span>
                </div>
              </label>

              <label>
                Header mobile thu gọn
                <div>
                  <Smartphone size={15} />
                  <input
                    type="number"
                    min="24"
                    max="120"
                    value={form.headerLogoCompactWidth}
                    onChange={(event) => update('headerLogoCompactWidth', event.target.value)}
                  />
                  <span>px</span>
                </div>
              </label>

              <label>
                Footer desktop
                <div>
                  <Monitor size={15} />
                  <input
                    type="number"
                    min="60"
                    max="420"
                    value={form.footerLogoDesktopWidth}
                    onChange={(event) => update('footerLogoDesktopWidth', event.target.value)}
                  />
                  <span>px</span>
                </div>
              </label>

              <label>
                Footer mobile
                <div>
                  <Smartphone size={15} />
                  <input
                    type="number"
                    min="50"
                    max="300"
                    value={form.footerLogoMobileWidth}
                    onChange={(event) => update('footerLogoMobileWidth', event.target.value)}
                  />
                  <span>px</span>
                </div>
              </label>
            </div>
          </div>

          <div className="admin-brand-preview-section">
            <div className="admin-brand-subhead">
              <div>
                <span className="eyebrow">XEM TRƯỚC</span>
                <h3>Vị trí thương hiệu</h3>
              </div>
            </div>

            <div className="admin-brand-preview-grid">
              <div className="admin-brand-preview-card header">
                <span>Header desktop</span>
                <div>
                  <img
                    src={preview.header}
                    alt=""
                    style={{ width: Number(form.headerLogoDesktopWidth) + 'px' }}
                  />
                </div>
              </div>

              <div className="admin-brand-preview-card mobile">
                <span>Header mobile</span>
                <div>
                  <img
                    src={preview.header}
                    alt=""
                    style={{ width: Math.min(Number(form.headerLogoMobileWidth), 230) + 'px' }}
                  />
                  <i>
                    <img
                      src={preview.compact}
                      alt=""
                      style={{ width: Number(form.headerLogoCompactWidth) + 'px' }}
                    />
                  </i>
                </div>
              </div>

              <div className="admin-brand-preview-card footer">
                <span>Footer</span>
                <div>
                  <img
                    src={preview.footer}
                    alt=""
                    style={{ width: Number(form.footerLogoDesktopWidth) + 'px' }}
                  />
                </div>
              </div>

              <div className="admin-brand-preview-card favicon">
                <span>Favicon</span>
                <div>
                  <img src={preview.favicon} alt="" />
                  <b>Hola Maps</b>
                </div>
              </div>
            </div>
          </div>
        </form>

        <aside className="admin-brand-assets-panel">
          <form className="admin-brand-upload" onSubmit={uploadAsset}>
            <div className="admin-brand-card-head">
              <div>
                <span className="eyebrow">ASSET LIBRARY</span>
                <h3>Tải logo / favicon</h3>
              </div>
              <Upload size={21} />
            </div>

            <label>
              Tên asset
              <input
                value={assetName}
                onChange={(event) => setAssetName(event.target.value)}
                placeholder="VD: Logo xanh 2026"
              />
            </label>

            <label>
              Loại asset
              <select value={assetType} onChange={(event) => setAssetType(event.target.value)}>
                <option value="LOGO">Logo</option>
                <option value="FAVICON">Favicon</option>
              </select>
            </label>

            <label className="admin-brand-file-picker">
              <ImagePlus size={18} />
              <span>
                <b>{assetFile ? assetFile.name : 'Chọn ảnh'}</b>
                <small>PNG / WEBP / JPG · favicon nên dùng ảnh vuông.</small>
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setAssetFile(event.target.files?.[0] || null)}
              />
            </label>

            {assetPreview && (
              <div className={assetType === 'FAVICON' ? 'admin-brand-upload-preview favicon' : 'admin-brand-upload-preview'}>
                <img src={assetPreview} alt="Xem trước asset" />
              </div>
            )}

            <button className="secondary-action" type="submit" disabled={uploading}>
              <Upload size={15} />
              {uploading ? 'Đang tải...' : 'Thêm vào thư viện'}
            </button>
          </form>

          <div className="admin-brand-library">
            <div className="admin-brand-library-head">
              <div>
                <b>Thư viện thương hiệu</b>
                <span>{assets.length} asset đã tải</span>
              </div>
            </div>

            {!assets.length ? (
              <div className="empty-state">
                <ImageIcon size={24} />
                <b>Chưa có asset riêng</b>
                <span>Website đang sử dụng logo mặc định trong source code.</span>
              </div>
            ) : (
              <div className="admin-brand-asset-list">
                {assets.map((item) => {
                  const used = isAssetUsed(item.id);
                  return (
                    <article className={used ? 'admin-brand-asset-row used' : 'admin-brand-asset-row'} key={item.id}>
                      <span className={item.assetType === 'FAVICON' ? 'admin-brand-asset-thumb favicon' : 'admin-brand-asset-thumb'}>
                        <img src={item.url} alt="" />
                      </span>
                      <div>
                        <small>{item.assetType}</small>
                        <b>{item.name}</b>
                        <span>{used ? 'Đang được sử dụng' : 'Có thể chọn cho website'}</span>
                      </div>
                      <button
                        type="button"
                        disabled={used}
                        onClick={() => removeAsset(item)}
                        aria-label={'Xóa ' + item.name}
                        title={used ? 'Đổi asset đang sử dụng trước khi xóa' : 'Xóa asset'}
                      >
                        <Trash2 size={15} />
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
