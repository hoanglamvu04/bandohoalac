import { useEffect, useState } from 'react';
import { BookmarkPlus, Globe2, LockKeyhole, MapPin, Plus, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { createCollection, getMyCollections, getPublicCollections } from '../services/api.js';
import '../hola-collections.css';

function CollectionCard({ item, mine = false }) {
  return (
    <article className="hola-collection-card">
      <Link className="hola-collection-cover" to={'/collections/' + encodeURIComponent(item.slug)}>
        {item.coverImage
          ? <img src={item.coverImage} alt="" loading="lazy" />
          : <span className="hola-collection-cover-empty"><BookmarkPlus size={30} /></span>}
        <span className={'hola-collection-visibility ' + (item.visibility === 'PUBLIC' ? 'public' : 'private')}>
          {item.visibility === 'PUBLIC' ? <Globe2 size={12} /> : <LockKeyhole size={12} />}
          {item.visibility === 'PUBLIC' ? 'Công khai' : 'Riêng tư'}
        </span>
      </Link>
      <div className="hola-collection-card-copy">
        <div className="hola-collection-card-meta">
          <span>{mine ? 'BỘ SƯU TẬP CỦA BẠN' : item.owner?.name || 'Cộng đồng HOLA'}</span>
          <b>{Number(item.itemCount || 0)} địa điểm</b>
        </div>
        <Link className="hola-collection-card-title" to={'/collections/' + encodeURIComponent(item.slug)}>
          {item.title}
        </Link>
        <p>{item.description || 'Chưa có mô tả cho bộ sưu tập này.'}</p>
        <div className="hola-collection-card-actions">
          <Link to={'/collections/' + encodeURIComponent(item.slug)}>Xem bộ sưu tập</Link>
          <Link to={'/map?collection=' + encodeURIComponent(item.slug)}>Mở bản đồ <MapPin size={13} /></Link>
        </div>
      </div>
    </article>
  );
}

export default function CollectionsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [mine, setMine] = useState([]);
  const [discover, setDiscover] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    visibility: 'PRIVATE'
  });

  async function load() {
    setLoading(true);
    try {
      const [mineData, publicData] = await Promise.all([
        user ? getMyCollections() : Promise.resolve({ items: [] }),
        getPublicCollections({ limit: 12 })
      ]);
      setMine(Array.isArray(mineData?.items) ? mineData.items : []);
      setDiscover(Array.isArray(publicData?.items) ? publicData.items : []);
    } catch (error) {
      showToast(error.message || 'Không thể tải bộ sưu tập.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [user?.id]);

  async function submit(event) {
    event.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const result = await createCollection(form);
      showToast('Đã tạo bộ sưu tập.', 'success');
      navigate('/collections/' + encodeURIComponent(result.collection.slug));
    } catch (error) {
      showToast(error.message || 'Không thể tạo bộ sưu tập.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="hola-collections-page page-container">
      <header className="hola-collections-hero">
        <div>
          <span className="hola-collections-eyebrow"><Sparkles size={14} /> HOLA MAPS · YOUR LOCAL GUIDE</span>
          <h1>HOLA Collections</h1>
          <p>Gom những địa điểm bạn yêu thích thành từng danh sách riêng. Lưu lại, chia sẻ với bạn bè và mở tất cả trên bản đồ Hòa Lạc.</p>
        </div>
        {user && (
          <button className="hola-collections-primary" type="button" onClick={() => setShowCreate((value) => !value)}>
            <Plus size={17} /> Tạo bộ sưu tập
          </button>
        )}
      </header>

      {showCreate && (
        <form className="hola-collection-form" onSubmit={submit}>
          <div className="hola-collection-form-heading">
            <div><span>NEW COLLECTION</span><h2>Tạo bộ sưu tập mới</h2></div>
            <button type="button" onClick={() => setShowCreate(false)} aria-label="Đóng">×</button>
          </div>
          <label>
            Tên bộ sưu tập
            <input
              required
              minLength={2}
              maxLength={100}
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ví dụ: Cafe học tập tại Hòa Lạc"
            />
          </label>
          <label>
            Mô tả ngắn
            <textarea
              rows="3"
              maxLength={1000}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Bộ sưu tập này dành cho những ai..."
            />
          </label>
          <label>
            Quyền riêng tư
            <select value={form.visibility} onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value }))}>
              <option value="PRIVATE">Riêng tư — chỉ mình tôi xem</option>
              <option value="PUBLIC">Công khai — mọi người có thể khám phá</option>
            </select>
          </label>
          <div className="hola-collection-form-actions">
            <button type="button" className="hola-collections-secondary" onClick={() => setShowCreate(false)}>Hủy</button>
            <button type="submit" className="hola-collections-primary" disabled={saving}>{saving ? 'Đang tạo...' : 'Tạo bộ sưu tập'}</button>
          </div>
        </form>
      )}

      <section className="hola-collections-section">
        <div className="hola-collections-section-heading">
          <div><span>MY COLLECTIONS</span><h2>Bộ sưu tập của tôi</h2></div>
          <b>{mine.length} danh sách</b>
        </div>
        {!user ? (
          <div className="hola-collections-empty">
            <BookmarkPlus size={28} />
            <b>Đăng nhập để tạo bộ sưu tập riêng</b>
            <span>Bạn vẫn có thể khám phá các bộ sưu tập công khai bên dưới.</span>
            <Link to="/login">Đăng nhập</Link>
          </div>
        ) : loading ? (
          <div className="hola-collections-loading">Đang tải bộ sưu tập...</div>
        ) : mine.length ? (
          <div className="hola-collections-grid">{mine.map((item) => <CollectionCard key={item.id} item={item} mine />)}</div>
        ) : (
          <div className="hola-collections-empty">
            <BookmarkPlus size={28} />
            <b>Bạn chưa có bộ sưu tập nào</b>
            <span>Hãy tạo danh sách đầu tiên, ví dụ “Quán ăn ngon dưới 100K”.</span>
            <button type="button" onClick={() => setShowCreate(true)}>Tạo bộ sưu tập đầu tiên</button>
          </div>
        )}
      </section>

      <section className="hola-collections-section">
        <div className="hola-collections-section-heading">
          <div><span>COMMUNITY COLLECTIONS</span><h2>Khám phá từ cộng đồng</h2></div>
          <b>{discover.length} gợi ý</b>
        </div>
        {loading ? (
          <div className="hola-collections-loading">Đang tải gợi ý...</div>
        ) : discover.length ? (
          <div className="hola-collections-grid">{discover.map((item) => <CollectionCard key={item.id} item={item} />)}</div>
        ) : (
          <div className="hola-collections-empty compact">
            <Globe2 size={26} />
            <b>Chưa có bộ sưu tập công khai</b>
            <span>Hãy là người đầu tiên chia sẻ danh sách địa điểm hữu ích tại Hòa Lạc.</span>
          </div>
        )}
      </section>
    </main>
  );
}
