import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  Check,
  ChevronRight,
  Globe2,
  Link2,
  LockKeyhole,
  MapPin,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';
import {
  addCollectionPlace,
  createCollection,
  deleteCollection,
  getCollection,
  getMyCollections,
  getPlaces,
  removeCollectionPlace,
  replaceCollectionPlaces,
  updateCollection
} from '../services/api.js';

const STARTER_COLLECTIONS = [
  'Cafe học tập tại Hòa Lạc',
  'Quán ăn ngon dưới 100K',
  'Địa điểm hẹn hò cuối tuần',
  'Những nơi phải check-in'
];

function formatCount(value) {
  const count = Number(value) || 0;
  return count + (count === 1 ? ' địa điểm' : ' địa điểm');
}

export default function CollectionsPage() {
  const { showToast } = useToast();
  const [collections, setCollections] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createVisibility, setCreateVisibility] = useState('PRIVATE');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('PRIVATE');
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addingPlaceId, setAddingPlaceId] = useState('');

  useEffect(() => {
    let activeRequest = true;
    getMyCollections()
      .then((data) => {
        if (!activeRequest) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setCollections(items);
        if (items.length) setActiveId((current) => current || String(items[0].id));
      })
      .catch((error) => {
        if (activeRequest) showToast(error.message || 'Không tải được bộ sưu tập.', 'error');
      })
      .finally(() => {
        if (activeRequest) setLoading(false);
      });
    return () => { activeRequest = false; };
  }, []);

  useEffect(() => {
    if (!activeId) {
      setActive(null);
      return undefined;
    }

    let activeRequest = true;
    setDetailLoading(true);
    getCollection(activeId)
      .then((data) => {
        if (!activeRequest) return;
        setActive(data);
        setTitle(data.title || '');
        setDescription(data.description || '');
        setVisibility(data.visibility || 'PRIVATE');
      })
      .catch((error) => {
        if (activeRequest) showToast(error.message || 'Không tải được bộ sưu tập này.', 'error');
      })
      .finally(() => {
        if (activeRequest) setDetailLoading(false);
      });
    return () => { activeRequest = false; };
  }, [activeId]);

  const places = useMemo(
    () => Array.isArray(active?.places) ? active.places : [],
    [active?.places]
  );

  async function refreshList(nextCollection = null) {
    const data = await getMyCollections();
    const items = Array.isArray(data?.items) ? data.items : [];
    setCollections(items);
    if (nextCollection?.id) setActiveId(String(nextCollection.id));
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (saving || createTitle.trim().length < 2) return;
    setSaving(true);
    try {
      const collection = await createCollection({
        title: createTitle.trim(),
        description: createDescription.trim(),
        visibility: createVisibility
      });
      setCollections((current) => [collection, ...current]);
      setActiveId(String(collection.id));
      setActive(collection);
      setTitle(collection.title);
      setDescription(collection.description || '');
      setVisibility(collection.visibility);
      setCreateOpen(false);
      setCreateTitle('');
      setCreateDescription('');
      setCreateVisibility('PRIVATE');
      showToast('Đã tạo bộ sưu tập mới.', 'success');
    } catch (error) {
      showToast(error.message || 'Không tạo được bộ sưu tập.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDetails() {
    if (!active || saving) return;
    setSaving(true);
    try {
      const updated = await updateCollection(active.id, {
        title: title.trim(),
        description: description.trim(),
        visibility
      });
      setActive(updated);
      await refreshList(updated);
      showToast('Đã cập nhật bộ sưu tập.', 'success');
    } catch (error) {
      showToast(error.message || 'Không cập nhật được bộ sưu tập.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!active || saving) return;
    const confirmed = window.confirm('Xóa bộ sưu tập "' + active.title + '"? Danh sách địa điểm trong bộ sưu tập này cũng sẽ bị xóa.');
    if (!confirmed) return;
    setSaving(true);
    try {
      await deleteCollection(active.id);
      const remaining = collections.filter((item) => String(item.id) !== String(active.id));
      setCollections(remaining);
      setActiveId(remaining[0] ? String(remaining[0].id) : '');
      setActive(null);
      showToast('Đã xóa bộ sưu tập.', 'success');
    } catch (error) {
      showToast(error.message || 'Không xóa được bộ sưu tập.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function searchPlaces(event) {
    event?.preventDefault();
    if (placeQuery.trim().length < 2 || searching) return;
    setSearching(true);
    try {
      const data = await getPlaces({ q: placeQuery.trim(), limit: 10 });
      const items = Array.isArray(data?.items) ? data.items : [];
      const currentIds = new Set(places.map((place) => String(place.id)));
      setPlaceResults(items.filter((place) => !currentIds.has(String(place.id))));
      if (!items.length) showToast('Chưa tìm thấy địa điểm phù hợp.', 'info');
    } catch (error) {
      showToast(error.message || 'Không tìm kiếm được địa điểm.', 'error');
    } finally {
      setSearching(false);
    }
  }

  async function handleAddPlace(place) {
    if (!active || addingPlaceId) return;
    setAddingPlaceId(String(place.id));
    try {
      const updated = await addCollectionPlace(active.id, place.id);
      setActive(updated);
      setPlaceResults((current) => current.filter((item) => String(item.id) !== String(place.id)));
      await refreshList(updated);
      showToast('Đã thêm địa điểm vào bộ sưu tập.', 'success');
    } catch (error) {
      showToast(error.message || 'Không thêm được địa điểm.', 'error');
    } finally {
      setAddingPlaceId('');
    }
  }

  async function handleRemovePlace(place) {
    if (!active || saving) return;
    setSaving(true);
    try {
      const updated = await removeCollectionPlace(active.id, place.id);
      setActive(updated);
      await refreshList(updated);
      showToast('Đã xóa địa điểm khỏi bộ sưu tập.', 'success');
    } catch (error) {
      showToast(error.message || 'Không xóa được địa điểm.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function movePlace(index, direction) {
    if (!active || saving) return;
    const next = [...places];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSaving(true);
    try {
      const updated = await replaceCollectionPlaces(active.id, next.map((place) => place.id));
      setActive(updated);
      await refreshList(updated);
    } catch (error) {
      showToast(error.message || 'Không đổi được thứ tự địa điểm.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function copyShareLink() {
    if (!active?.isPublic) {
      showToast('Hãy chuyển bộ sưu tập sang chế độ công khai trước khi chia sẻ.', 'info');
      return;
    }
    const url = window.location.origin + '/bo-suu-tap/' + encodeURIComponent(active.slug);
    try {
      await navigator.clipboard.writeText(url);
      showToast('Đã sao chép link bộ sưu tập.', 'success');
    } catch {
      showToast('Không thể sao chép link. Hãy kiểm tra quyền clipboard.', 'error');
    }
  }

  return (
    <main className="hola-collections-page page-container">
      <header className="hc-page-hero">
        <div className="hc-hero-copy">
          <span className="hc-eyebrow"><Sparkles size={14} /> HOLA MAPS · YOUR PLACES, YOUR STORIES</span>
          <h1>HOLA Collections</h1>
          <p>Gom những địa điểm bạn yêu thích thành từng danh sách có chủ đề. Lưu riêng cho mình hoặc chia sẻ để bạn bè cùng khám phá Hòa Lạc.</p>
          <button type="button" className="hc-primary-button" onClick={() => setCreateOpen(true)}>
            <Plus size={17} /> Tạo bộ sưu tập
          </button>
        </div>
        <div className="hc-hero-art" aria-hidden="true">
          <span className="hc-art-pin pin-one"><MapPin size={19} /></span>
          <span className="hc-art-pin pin-two"><MapPin size={19} /></span>
          <span className="hc-art-pin pin-three"><MapPin size={19} /></span>
          <span className="hc-art-route" />
          <span className="hc-art-card"><BookmarkPlus size={26} /></span>
        </div>
      </header>

      <div className="hc-workspace">
        <aside className="hc-library">
          <div className="hc-library-heading">
            <div><span className="hc-eyebrow">THƯ VIỆN CỦA BẠN</span><h2>Bộ sưu tập</h2></div>
            <span>{collections.length}</span>
          </div>

          {loading ? (
            <div className="hc-empty-state">Đang tải bộ sưu tập…</div>
          ) : !collections.length ? (
            <div className="hc-empty-state">
              <BookmarkPlus size={30} />
              <b>Chưa có bộ sưu tập nào</b>
              <span>Bắt đầu bằng một chủ đề bạn muốn khám phá.</span>
              <button type="button" onClick={() => setCreateOpen(true)}>Tạo bộ sưu tập đầu tiên</button>
            </div>
          ) : (
            <div className="hc-collection-list">
              {collections.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={String(item.id) === activeId ? 'hc-collection-card active' : 'hc-collection-card'}
                  onClick={() => setActiveId(String(item.id))}
                >
                  <span className="hc-collection-cover">
                    {item.coverImage
                      ? <img src={item.coverImage} alt="" />
                      : <BookmarkPlus size={23} />}
                  </span>
                  <span className="hc-collection-card-copy">
                    <b>{item.title}</b>
                    <small>{formatCount(item.placeCount)}</small>
                    <em>{item.visibility === 'PUBLIC' ? <><Globe2 size={11} /> Công khai</> : <><LockKeyhole size={11} /> Riêng tư</>}</em>
                  </span>
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="hc-editor">
          {!activeId || (!active && !detailLoading) ? (
            <div className="hc-editor-empty">
              <BookmarkPlus size={42} />
              <h2>Chọn một bộ sưu tập để bắt đầu</h2>
              <p>Tạo danh sách theo chủ đề, thêm địa điểm và sắp xếp hành trình khám phá của bạn.</p>
              <button type="button" className="hc-primary-button" onClick={() => setCreateOpen(true)}>
                <Plus size={16} /> Tạo bộ sưu tập
              </button>
            </div>
          ) : detailLoading ? (
            <div className="hc-editor-empty">Đang tải nội dung bộ sưu tập…</div>
          ) : active ? (
            <>
              <div className="hc-editor-top">
                <div>
                  <span className="hc-eyebrow">QUẢN LÝ BỘ SƯU TẬP</span>
                  <h2>{active.title}</h2>
                  <p>{formatCount(places.length)} · {active.visibility === 'PUBLIC' ? 'Đang công khai' : 'Chỉ mình tôi xem'}</p>
                </div>
                <button type="button" className="hc-delete-button" onClick={handleDelete} disabled={saving} title="Xóa bộ sưu tập">
                  <Trash2 size={17} />
                </button>
              </div>

              <div className="hc-editor-fields">
                <label>
                  <span>Tên bộ sưu tập</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} />
                </label>
                <label>
                  <span>Mô tả</span>
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} placeholder="Mô tả ngắn về danh sách địa điểm này…" />
                </label>
                <div className="hc-visibility-row">
                  <label>
                    <span>Quyền xem</span>
                    <select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
                      <option value="PRIVATE">Riêng tư · Chỉ mình tôi</option>
                      <option value="PUBLIC">Công khai · Ai có link đều xem được</option>
                    </select>
                  </label>
                  <button type="button" onClick={handleSaveDetails} disabled={saving || title.trim().length < 2}>
                    <Check size={15} /> Lưu thay đổi
                  </button>
                </div>
                {active.isPublic && (
                  <div className="hc-share-row">
                    <div><Globe2 size={17} /><span><b>Bộ sưu tập đang công khai</b><small>Người có link có thể xem và mở trên bản đồ.</small></span></div>
                    <button type="button" onClick={copyShareLink}><Share2 size={15} /> Sao chép link</button>
                    <Link to={'/bo-suu-tap/' + encodeURIComponent(active.slug)} target="_blank">Xem trang công khai <ChevronRight size={14} /></Link>
                  </div>
                )}
              </div>

              <div className="hc-place-manager">
                <div className="hc-section-heading">
                  <div><span className="hc-eyebrow">ĐỊA ĐIỂM TRONG DANH SÁCH</span><h3>Khám phá và thêm địa điểm</h3></div>
                  <span>{places.length}/100</span>
                </div>

                <form className="hc-place-search" onSubmit={searchPlaces}>
                  <Search size={17} />
                  <input value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} placeholder="Tìm quán cafe, nhà hàng, điểm check-in…" />
                  <button type="submit" disabled={searching || placeQuery.trim().length < 2}>{searching ? 'Đang tìm…' : 'Tìm'}</button>
                </form>

                {!!placeResults.length && (
                  <div className="hc-search-results">
                    {placeResults.map((place) => (
                      <article key={place.id}>
                        <span className="hc-search-thumb">
                          {place.images?.[0] || place.cardImages?.[0]
                            ? <img src={place.cardImages?.[0] || place.images[0]} alt="" />
                            : <MapPin size={18} />}
                        </span>
                        <span><b>{place.name}</b><small>{place.category || 'Địa điểm'} · {place.address || 'Hòa Lạc'}</small></span>
                        <button type="button" onClick={() => handleAddPlace(place)} disabled={Boolean(addingPlaceId) || places.length >= 100}>
                          <Plus size={15} /> {addingPlaceId === String(place.id) ? 'Đang thêm' : 'Thêm'}
                        </button>
                      </article>
                    ))}
                  </div>
                )}

                <div className="hc-place-list">
                  {!places.length ? (
                    <div className="hc-empty-state hc-place-empty">
                      <MapPin size={28} />
                      <b>Bộ sưu tập chưa có địa điểm</b>
                      <span>Tìm một địa điểm phía trên để thêm vào danh sách này.</span>
                    </div>
                  ) : places.map((place, index) => (
                    <article className="hc-place-row" key={place.id}>
                      <span className="hc-place-order">{index + 1}</span>
                      <span className="hc-place-cover">
                        {place.coverImage || place.images?.[0]
                          ? <img src={place.coverImage || place.images[0]} alt="" />
                          : <MapPin size={19} />}
                      </span>
                      <span className="hc-place-copy">
                        <b>{place.name}</b>
                        <small>{place.category} · {place.address}</small>
                      </span>
                      <div className="hc-place-actions">
                        <button type="button" onClick={() => movePlace(index, -1)} disabled={saving || index === 0} aria-label="Đưa lên"><ArrowUp size={14} /></button>
                        <button type="button" onClick={() => movePlace(index, 1)} disabled={saving || index === places.length - 1} aria-label="Đưa xuống"><ArrowDown size={14} /></button>
                        <Link to={'/map?place=' + place.id} title="Xem trên bản đồ"><MapPin size={14} /></Link>
                        <button type="button" onClick={() => handleRemovePlace(place)} disabled={saving} aria-label="Xóa khỏi bộ sưu tập"><X size={14} /></button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>

      {createOpen && (
        <div className="hc-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setCreateOpen(false)}>
          <form className="hc-create-modal" onSubmit={handleCreate}>
            <button type="button" className="hc-modal-close" onClick={() => setCreateOpen(false)} aria-label="Đóng"><X size={18} /></button>
            <span className="hc-eyebrow">BẮT ĐẦU MỘT DANH SÁCH MỚI</span>
            <h2>Tạo bộ sưu tập</h2>
            <p>Đặt tên theo chủ đề để bạn dễ tìm lại và chia sẻ với mọi người.</p>
            <label><span>Tên bộ sưu tập</span><input autoFocus value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} placeholder="Ví dụ: Cafe học tập tại Hòa Lạc" maxLength={100} required minLength={2} /></label>
            <div className="hc-starter-chips">
              {STARTER_COLLECTIONS.map((item) => (
                <button type="button" key={item} onClick={() => setCreateTitle(item)}>{item}</button>
              ))}
            </div>
            <label><span>Mô tả (không bắt buộc)</span><textarea value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} rows={2} maxLength={500} placeholder="Bộ sưu tập này dành cho ai, theo tiêu chí nào?" /></label>
            <label><span>Quyền xem</span><select value={createVisibility} onChange={(event) => setCreateVisibility(event.target.value)}><option value="PRIVATE">Riêng tư · Chỉ mình tôi</option><option value="PUBLIC">Công khai · Ai có link đều xem được</option></select></label>
            <button type="submit" className="hc-primary-button" disabled={saving || createTitle.trim().length < 2}>{saving ? 'Đang tạo…' : <><Plus size={16} /> Tạo bộ sưu tập</>}</button>
          </form>
        </div>
      )}
    </main>
  );
}
