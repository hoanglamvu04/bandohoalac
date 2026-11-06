import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookmarkPlus,
  Camera,
  Check,
  Copy,
  Globe2,
  LockKeyhole,
  MapPin,
  MapPinned,
  Share2,
  Trash2
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SeoHead from '../components/SeoHead.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  deleteCollection,
  getCollectionBySlug,
  removePlaceFromCollection,
  updateCollection
} from '../services/api.js';
import '../hola-collections.css';

function PlaceCard({ place, isOwner, onRemove, removing }) {
  const image = place.cardImages?.[0] || place.images?.[0];
  return (
    <article className="hola-collection-place">
      <Link className="hola-collection-place-image" to={place.slug ? '/dia-diem/' + encodeURIComponent(place.slug) : '/place/' + place.id}>
        {image ? <img src={image} alt="" loading="lazy" /> : <MapPin size={24} />}
      </Link>
      <div className="hola-collection-place-copy">
        <small>{place.category || 'Địa điểm'}</small>
        <Link to={place.slug ? '/dia-diem/' + encodeURIComponent(place.slug) : '/place/' + place.id}>{place.name}</Link>
        <p>{place.address || 'Hòa Lạc'}{place.note ? ' · ' + place.note : ''}</p>
        <div>
          <Link to={'/map?place=' + encodeURIComponent(place.id)}><MapPin size={13} /> Xem vị trí</Link>
          {isOwner && (
            <button type="button" disabled={removing} onClick={() => onRemove(place)}>
              <Trash2 size={13} /> {removing ? 'Đang xóa...' : 'Bỏ khỏi bộ sưu tập'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function CollectionDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState('');
  const [form, setForm] = useState({ title: '', description: '', visibility: 'PRIVATE' });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await getCollectionBySlug(slug);
      setData(result);
      setForm({
        title: result.collection.title,
        description: result.collection.description || '',
        visibility: result.collection.visibility
      });
    } catch (requestError) {
      setError(requestError.message || 'Không thể tải bộ sưu tập.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [slug]);

  async function saveChanges(event) {
    event.preventDefault();
    if (!data?.isOwner || saving) return;
    setSaving(true);
    try {
      const result = await updateCollection(data.collection.id, form);
      setData(result);
      setEditing(false);
      showToast('Đã cập nhật bộ sưu tập.', 'success');
    } catch (requestError) {
      showToast(requestError.message || 'Không thể cập nhật.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function removePlace(place) {
    if (!data?.isOwner || removingId) return;
    setRemovingId(String(place.id));
    try {
      await removePlaceFromCollection(data.collection.id, place.id);
      setData((current) => ({
        ...current,
        items: current.items.filter((item) => String(item.id) !== String(place.id)),
        collection: { ...current.collection, itemCount: Math.max(0, current.collection.itemCount - 1) }
      }));
      showToast('Đã bỏ địa điểm khỏi bộ sưu tập.', 'success');
    } catch (requestError) {
      showToast(requestError.message || 'Không thể xóa địa điểm.', 'error');
    } finally {
      setRemovingId('');
    }
  }

  async function removeCollection() {
    if (!data?.isOwner || !window.confirm('Xóa bộ sưu tập này? Các địa điểm gốc vẫn được giữ nguyên.')) return;
    try {
      await deleteCollection(data.collection.id);
      showToast('Đã xóa bộ sưu tập.', 'success');
      navigate('/collections');
    } catch (requestError) {
      showToast(requestError.message || 'Không thể xóa bộ sưu tập.', 'error');
    }
  }

  async function shareCollection() {
    const url = window.location.origin + '/collections/' + encodeURIComponent(slug);
    try {
      if (navigator.share) {
        await navigator.share({
          title: data.collection.title + ' | HOLA Collections',
          text: data.collection.description || 'Khám phá bộ sưu tập địa điểm trên HOLA MAP.',
          url
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showToast('Đã sao chép liên kết chia sẻ.', 'success');
      } else {
        showToast('Hãy sao chép đường dẫn trên thanh địa chỉ để chia sẻ.', 'info');
      }
    } catch (requestError) {
      if (requestError?.name !== 'AbortError') showToast('Chưa thể chia sẻ lúc này.', 'error');
    }
  }

  if (loading) return <main className="hola-collections-page page-container"><div className="hola-collections-loading">Đang tải bộ sưu tập...</div></main>;
  if (error || !data?.collection) {
    return (
      <main className="hola-collections-page page-container">
        <div className="hola-collections-empty">
          <BookmarkPlus size={30} />
          <b>Không tìm thấy bộ sưu tập</b>
          <span>{error || 'Bộ sưu tập có thể đã bị xóa hoặc đang ở chế độ riêng tư.'}</span>
          <Link to="/collections">Quay lại HOLA Collections</Link>
        </div>
      </main>
    );
  }

  const { collection, items, isOwner } = data;
  const canonical = window.location.origin + '/collections/' + encodeURIComponent(collection.slug);

  return (
    <main className="hola-collections-page page-container">
      <SeoHead
        title={collection.title + ' | HOLA Collections'}
        description={collection.description || 'Bộ sưu tập địa điểm tại Hòa Lạc trên HOLA MAP.'}
        canonical={canonical}
        image={collection.coverImage || undefined}
        type="website"
      />
      <div className="hola-collection-back"><Link to={isOwner ? '/collections' : '/map'}><ArrowLeft size={16} /> {isOwner ? 'Bộ sưu tập của tôi' : 'Bản đồ HOLA MAP'}</Link></div>

      <header className="hola-collection-detail-hero">
        <div className="hola-collection-detail-copy">
          <span className="hola-collections-eyebrow"><BookmarkPlus size={14} /> HOLA COLLECTIONS</span>
          <div className="hola-collection-detail-title-row">
            <h1>{collection.title}</h1>
            <span className={'hola-collection-visibility ' + (collection.visibility === 'PUBLIC' ? 'public' : 'private')}>
              {collection.visibility === 'PUBLIC' ? <Globe2 size={13} /> : <LockKeyhole size={13} />}
              {collection.visibility === 'PUBLIC' ? 'Công khai' : 'Riêng tư'}
            </span>
          </div>
          <p>{collection.description || 'Chưa có mô tả cho bộ sưu tập này.'}</p>
          <div className="hola-collection-owner">
            <span>{collection.owner?.name || 'Thành viên HOLA'}</span>
            <i>·</i>
            <span>{items.length} địa điểm</span>
            {collection.updatedAt && <><i>·</i><span>Cập nhật {new Date(collection.updatedAt).toLocaleDateString('vi-VN')}</span></>}
          </div>
        </div>
        <div className="hola-collection-detail-actions">
          <Link className="hola-collections-primary" to={'/map?collection=' + encodeURIComponent(collection.slug)}><MapPinned size={16} /> Mở trên bản đồ</Link>
          <button type="button" className="hola-collections-secondary" onClick={shareCollection}><Share2 size={16} /> Chia sẻ</button>
          {isOwner && <button type="button" className="hola-collections-secondary" onClick={() => setEditing((value) => !value)}>{editing ? 'Đóng chỉnh sửa' : 'Chỉnh sửa'}</button>}
        </div>
      </header>

      {editing && isOwner && (
        <form className="hola-collection-form" onSubmit={saveChanges}>
          <div className="hola-collection-form-heading"><div><span>COLLECTION SETTINGS</span><h2>Chỉnh sửa bộ sưu tập</h2></div></div>
          <label>Tên bộ sưu tập<input required minLength={2} maxLength={100} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
          <label>Mô tả<textarea rows="3" maxLength={1000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
          <label>Quyền riêng tư<select value={form.visibility} onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value }))}><option value="PRIVATE">Riêng tư</option><option value="PUBLIC">Công khai</option></select></label>
          <div className="hola-collection-form-actions">
            <button type="button" className="hola-collections-danger" onClick={removeCollection}><Trash2 size={14} /> Xóa bộ sưu tập</button>
            <button type="submit" className="hola-collections-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
          </div>
        </form>
      )}

      <section className="hola-collections-section">
        <div className="hola-collections-section-heading">
          <div><span>PLACES IN THIS COLLECTION</span><h2>Địa điểm trong danh sách</h2></div>
          <b>{items.length} địa điểm</b>
        </div>
        {items.length ? (
          <div className="hola-collection-place-list">
            {items.map((place) => <PlaceCard key={place.id} place={place} isOwner={isOwner} onRemove={removePlace} removing={removingId === String(place.id)} />)}
          </div>
        ) : (
          <div className="hola-collections-empty">
            <Camera size={28} />
            <b>Bộ sưu tập chưa có địa điểm</b>
            <span>{isOwner ? 'Mở trang chi tiết một địa điểm và chọn “Thêm vào bộ sưu tập” để bắt đầu.' : 'Chủ bộ sưu tập chưa thêm địa điểm nào.'}</span>
            {isOwner && <Link to="/map">Khám phá địa điểm trên bản đồ</Link>}
          </div>
        )}
      </section>
      <div className="hola-collection-share-foot"><Check size={15} /> Địa điểm được tham chiếu trực tiếp từ HOLA MAP; xóa khỏi bộ sưu tập không xóa địa điểm gốc.</div>
    </main>
  );
}
