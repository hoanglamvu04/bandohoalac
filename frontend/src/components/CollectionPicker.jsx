import { useEffect, useState } from 'react';
import { BookmarkPlus, ChevronRight, Globe2, LockKeyhole, MapPin, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { addCollectionPlace, getMyCollections } from '../services/api.js';

export default function CollectionPicker({ open, place, onClose }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState('');

  useEffect(() => {
    if (!open || !user) return undefined;
    let active = true;
    setLoading(true);
    getMyCollections()
      .then((data) => {
        if (active) setCollections(Array.isArray(data?.items) ? data.items : []);
      })
      .catch((error) => {
        if (active) showToast(error.message || 'Không tải được bộ sưu tập.', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [open, user]);

  async function addToCollection(collection) {
    if (!place?.id || savingId) return;
    setSavingId(String(collection.id));
    try {
      await addCollectionPlace(collection.id, place.id);
      showToast('Đã thêm địa điểm vào "' + collection.title + '".', 'success');
      onClose();
    } catch (error) {
      showToast(error.message || 'Không thêm được địa điểm.', 'error');
    } finally {
      setSavingId('');
    }
  }

  if (!open || !place) return null;

  return (
    <div className="hc-picker-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="hc-picker-modal" role="dialog" aria-modal="true" aria-label="Thêm vào bộ sưu tập">
        <header>
          <span className="hc-picker-icon"><BookmarkPlus size={20} /></span>
          <div><small>HOLA COLLECTIONS</small><h2>Thêm vào bộ sưu tập</h2><p>{place.name}</p></div>
          <button type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        </header>

        {!user ? (
          <div className="hc-picker-empty">
            <BookmarkPlus size={30} />
            <b>Đăng nhập để tạo bộ sưu tập</b>
            <span>Lưu địa điểm theo chủ đề và chia sẻ danh sách với bạn bè.</span>
            <Link to="/login" onClick={onClose}>Đăng nhập <ChevronRight size={14} /></Link>
          </div>
        ) : loading ? (
          <div className="hc-picker-empty">Đang tải bộ sưu tập…</div>
        ) : !collections.length ? (
          <div className="hc-picker-empty">
            <BookmarkPlus size={30} />
            <b>Bạn chưa có bộ sưu tập nào</b>
            <span>Tạo danh sách đầu tiên, sau đó quay lại thêm địa điểm này.</span>
            <Link to="/collections" onClick={onClose}><Plus size={15} /> Tạo bộ sưu tập</Link>
          </div>
        ) : (
          <div className="hc-picker-list">
            {collections.map((collection) => (
              <button type="button" key={collection.id} onClick={() => addToCollection(collection)} disabled={Boolean(savingId)}>
                <span className="hc-picker-cover">
                  {collection.coverImage ? <img src={collection.coverImage} alt="" /> : <MapPin size={18} />}
                </span>
                <span><b>{collection.title}</b><small>{collection.placeCount || 0} địa điểm · {collection.visibility === 'PUBLIC' ? <><Globe2 size={11} /> Công khai</> : <><LockKeyhole size={11} /> Riêng tư</>}</small></span>
                <span className="hc-picker-add">{savingId === String(collection.id) ? 'Đang thêm…' : <Plus size={16} />}</span>
              </button>
            ))}
            <Link className="hc-picker-manage" to="/collections" onClick={onClose}>Quản lý bộ sưu tập <ChevronRight size={14} /></Link>
          </div>
        )}
      </section>
    </div>
  );
}
