import { useEffect, useState } from 'react';
import { MessageSquareText, Star, Trash2 } from 'lucide-react';
import {
  deletePlaceReview,
  getPlaceReviews,
  savePlaceReview
} from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Link } from 'react-router-dom';

function ReviewStars({ value, onChange, readOnly = false }) {
  return (
    <div className={readOnly ? 'place-review-stars readonly' : 'place-review-stars'}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          className={star <= value ? 'active' : ''}
          onClick={() => onChange?.(star)}
          aria-label={star + ' sao'}
        >
          <Star size={18} fill={star <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}

export default function PlaceReviews({ placeId, onChanged }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [myReviewId, setMyReviewId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    getPlaceReviews(placeId)
      .then((data) => {
        const next = Array.isArray(data?.items) ? data.items : [];
        setItems(next);
        const mine = user ? next.find((item) => Number(item.user?.id) === Number(user.id)) : null;
        if (mine) {
          setMyReviewId(mine.id);
          setRating(Number(mine.rating) || 5);
          setComment(mine.comment || '');
        } else {
          setMyReviewId(null);
        }
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }

  useEffect(load, [placeId, user?.id]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await savePlaceReview(placeId, { rating, comment: comment.trim() });
      showToast(myReviewId ? 'Đã cập nhật đánh giá.' : 'Đã gửi đánh giá.', 'success');
      await load();
      onChanged?.();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function removeMine() {
    if (!myReviewId) return;
    setSaving(true);
    try {
      await deletePlaceReview(placeId);
      setMyReviewId(null);
      setRating(5);
      setComment('');
      showToast('Đã xóa đánh giá.', 'info');
      await load();
      onChanged?.();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="place-reviews-block">
      <div className="place-reviews-head">
        <div>
          <span className="eyebrow">CỘNG ĐỒNG</span>
          <h2>Đánh giá địa điểm</h2>
        </div>
        <span className="place-review-count">
          <MessageSquareText size={16} /> {items.length}
        </span>
      </div>

      {user ? (
        <form className="place-review-editor" onSubmit={submit}>
          <div>
            <b>{myReviewId ? 'Đánh giá của bạn' : 'Bạn thấy địa điểm này thế nào?'}</b>
            <ReviewStars value={rating} onChange={setRating} />
          </div>
          <textarea
            rows="3"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={1200}
            placeholder="Chia sẻ trải nghiệm thực tế để giúp cộng đồng..."
          />
          <div className="place-review-editor-actions">
            <button className="primary-action" type="submit" disabled={saving}>
              {saving ? 'Đang lưu...' : (myReviewId ? 'Cập nhật đánh giá' : 'Gửi đánh giá')}
            </button>
            {myReviewId && (
              <button className="secondary-action" type="button" onClick={removeMine} disabled={saving}>
                <Trash2 size={15} /> Xóa
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="place-review-login">
          <span>Đăng nhập để đánh giá và lưu trải nghiệm của bạn.</span>
          <Link to="/login">Đăng nhập</Link>
        </div>
      )}

      {loading && <div className="loading-card">Đang tải đánh giá...</div>}

      {!loading && !items.length && (
        <div className="empty-state">
          <Star size={22} />
          <b>Chưa có đánh giá</b>
          <span>Hãy là người đầu tiên chia sẻ trải nghiệm tại đây.</span>
        </div>
      )}

      <div className="place-review-list">
        {items.map((review) => (
          <article className="place-review-item" key={review.id}>
            <span className="place-review-avatar">
              {review.user?.avatarUrl
                ? <img src={review.user.avatarUrl} alt="" />
                : String(review.user?.name || 'H')[0].toUpperCase()}
            </span>
            <div>
              <div className="place-review-meta">
                <b>{review.user?.name || 'Hola Explorer'}</b>
                <ReviewStars value={Number(review.rating)} readOnly />
                <time>{new Date(review.updatedAt || review.createdAt).toLocaleDateString('vi-VN')}</time>
              </div>
              {review.comment && <p>{review.comment}</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
