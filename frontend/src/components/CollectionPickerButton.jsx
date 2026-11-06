import { useEffect, useState } from 'react';
import { BookmarkPlus, Check, ChevronDown, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { addPlaceToCollection, getMyCollections } from '../services/api.js';
import '../hola-collections.css';

export default function CollectionPickerButton({ place }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    if (!open || !user) return undefined;
    let active = true;
    setLoading(true);
    getMyCollections({ placeId: place.id })
      .then((data) => {
        if (active) setCollections(Array.isArray(data?.items) ? data.items : []);
      })
      .catch((error) => showToast(error.message || 'Không thể tải bộ sưu tập.', 'error'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, user?.id, place?.id]);

  async function add(collection) {
    if (busyId) return;
    setBusyId(collection.id);
    try {
      const result = await addPlaceToCollection(collection.id, place.id);
      setCollections((current) => current.map((item) => (
        String(item.id) === String(collection.id)
          ? { ...item, containsPlace: true, itemCount: Number(item.itemCount || 0) + (result.added ? 1 : 0) }
          : item
      )));
      showToast(result.added ? 'Đã thêm vào bộ sưu tập.' : 'Địa điểm đã có trong bộ sưu tập.', 'success');
    } catch (error) {
      showToast(error.message || 'Không thể thêm địa điểm.', 'error');
    } finally {
      setBusyId('');
    }
  }

  function toggle() {
    if (!user) {
      showToast('Đăng nhập để lưu địa điểm vào bộ sưu tập.', 'info');
      return;
    }
    setOpen((value) => !value);
  }

  return (
    <div className="hola-collection-picker">
      <button type="button" className="hola-collection-picker-trigger" onClick={toggle} aria-expanded={open}>
        <BookmarkPlus size={16} /> Bộ sưu tập <ChevronDown size={14} />
      </button>
      {open && (
        <div className="hola-collection-picker-panel">
          <div className="hola-collection-picker-heading">
            <b>Thêm vào bộ sưu tập</b>
            <button type="button" onClick={() => setOpen(false)} aria-label="Đóng">×</button>
          </div>
          {loading ? <span className="hola-collection-picker-state">Đang tải danh sách...</span> : collections.length ? (
            <div className="hola-collection-picker-list">
              {collections.map((item) => (
                <button key={item.id} type="button" disabled={Boolean(busyId) || item.containsPlace} onClick={() => add(item)}>
                  <span><b>{item.title}</b><small>{item.itemCount} địa điểm</small></span>
                  {item.containsPlace ? <Check size={16} /> : busyId === item.id ? '...' : <Plus size={16} />}
                </button>
              ))}
            </div>
          ) : (
            <span className="hola-collection-picker-state">Bạn chưa tạo bộ sưu tập nào.</span>
          )}
          <Link to="/collections" onClick={() => setOpen(false)}><Plus size={14} /> Quản lý / tạo bộ sưu tập</Link>
        </div>
      )}
    </div>
  );
}
