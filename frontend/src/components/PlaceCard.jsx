import { ArrowUpRight, BadgeCheck, Heart, MapPin, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

const gradients = [
  'linear-gradient(135deg,#dbe7df,#93b9a8)',
  'linear-gradient(135deg,#f3e3c3,#d2a85c)',
  'linear-gradient(135deg,#d7e9ee,#84b7c1)',
  'linear-gradient(135deg,#eadfd4,#ba9c83)'
];

export default function PlaceCard({ place, index = 0, compact = false, selected = false, onSelect }) {
  const distance = place.distance_m ?? place.distance;
  return (
    <article
      className={`place-card ${compact ? 'compact' : ''} ${selected ? 'selected' : ''}`}
      onClick={() => onSelect?.(place)}
    >
      <div
        className="place-cover"
        style={{ background: place.image ? `url(${place.image}) center/cover` : gradients[index % gradients.length] }}
      >
        <span className="place-category">{place.category || 'Khám phá'}</span>
        <button className="heart-button" type="button" aria-label="Lưu địa điểm" onClick={(event) => event.stopPropagation()}>
          <Heart size={18} />
        </button>
      </div>

      <div className="place-content">
        <div className="place-title-row">
          <h3>{place.name}</h3>
          <span className="place-rating"><Star size={15} fill="currentColor" /> {place.rating || '4.8'}</span>
        </div>

        <p className="place-meta">
          <MapPin size={15} />
          {place.address || 'Hòa Lạc, Hà Nội'}
          {distance ? <><span>•</span>{distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`}</> : null}
        </p>

        <div className="place-footer">
          <span className="verified"><BadgeCheck size={16} /> Cộng đồng xác minh</span>
          <Link to={`/place/${place.id}`} onClick={(event) => event.stopPropagation()}>
            Chi tiết <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}
