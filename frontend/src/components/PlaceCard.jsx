import { ArrowUpRight, BadgeCheck, Camera, Clock3, Heart, MapPin, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

const gradients = [
  'linear-gradient(135deg,#dce9e2 0%,#8fb5a6 100%)',
  'linear-gradient(135deg,#f1e1bd 0%,#d0a34e 100%)',
  'linear-gradient(135deg,#d9ebef 0%,#7fb4c1 100%)',
  'linear-gradient(135deg,#eadfd5 0%,#b89479 100%)'
];

function formatDistance(distance) {
  const value = Number(distance);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value >= 1000 ? (value / 1000).toFixed(1) + ' km' : Math.round(value) + ' m';
}

export default function PlaceCard({ place, index = 0, compact = false, selected = false, onSelect }) {
  const distance = formatDistance(place.distance_m ?? place.distance);
  const cover = place.images?.[0] || place.image;
  const photoCount = Array.isArray(place.images) ? place.images.length : 0;
  const rating = Number(place.rating);
  const hasRating = Number.isFinite(rating) && rating > 0;
  const cardClass = 'place-card premium-place-card ' + (compact ? 'compact ' : '') + (selected ? 'selected' : '');
  const coverStyle = cover ? { background: 'url("' + cover + '") center/cover' } : { background: gradients[index % gradients.length] };

  return (
    <article className={cardClass} onClick={() => onSelect?.(place)}>
      <div className="place-cover" style={coverStyle}>
        {!cover && (
          <div className="place-cover-placeholder" aria-hidden="true">
            <MapPin size={30} />
            <span>Hola Maps</span>
          </div>
        )}

        <div className="place-cover-badges">
          <span className="place-category">{place.category || 'Khám phá'}</span>
          {place.status === 'PUBLISHED' && <span className="place-published"><BadgeCheck size={13} /> Đã duyệt</span>}
        </div>

        <button
          className="heart-button"
          type="button"
          aria-label="Lưu địa điểm"
          onClick={(event) => event.stopPropagation()}
        >
          <Heart size={18} />
        </button>

        {photoCount > 0 && <span className="photo-count"><Camera size={13} /> {photoCount}</span>}
      </div>

      <div className="place-content">
        <div className="place-title-row">
          <div>
            <span className="place-source">{place.source === 'ADMIN' ? 'Hola Maps' : 'Cộng đồng'}</span>
            <h3>{place.name}</h3>
          </div>
          <span className={hasRating ? 'place-rating' : 'place-rating muted'}>
            <Star size={15} fill={hasRating ? 'currentColor' : 'none'} />
            {hasRating ? rating.toFixed(1) : 'Mới'}
          </span>
        </div>

        <p className="place-meta">
          <MapPin size={15} />
          <span>{place.address || 'Hòa Lạc, Hà Nội'}</span>
          {distance ? <><i>•</i><b>{distance}</b></> : null}
        </p>

        <div className="place-utility-row">
          {place.openingHours && <span><Clock3 size={14} /> {place.openingHours}</span>}
          {place.priceLevel && <span className="place-price">{place.priceLevel}</span>}
        </div>

        <div className="place-footer">
          <span className="verified"><BadgeCheck size={16} /> Dữ liệu đã xuất bản</span>
          <Link to={'/place/' + place.id} onClick={(event) => event.stopPropagation()}>
            Chi tiết <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}
