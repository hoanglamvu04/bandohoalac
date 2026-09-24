import { ArrowUpRight, BadgeCheck, Heart, MapPin, Navigation, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PlaceCard({place,index=0,onDirections,directionsActive=false,directionsLoading=false}) {
  const cover = place.images?.[0] || place.image;
  return (
    <article className="place-card premium-place-card modern-place-card">
      <div className="place-cover" style={cover ? {background:`url("${cover}") center/cover`} : undefined}>
        <span className="place-category">{place.category || 'Khám phá'}</span>
        <button className="heart-button" type="button"><Heart size={18}/></button>
      </div>
      <div className="place-content">
        <div className="place-title-row">
          <div>
            <span className="place-source">Hola Maps</span>
            <h3>{place.name}</h3>
          </div>
          <span className="place-rating"><Star size={15} fill="currentColor"/> {Number(place.rating || 4.8).toFixed(1)}</span>
        </div>
        <p className="place-meta"><MapPin size={15}/> {place.address || 'Hòa Lạc, Hà Nội'}</p>
        <div className="place-footer">
          <span className="verified"><BadgeCheck size={15}/> Đã xác thực</span>
          <div className="place-card-actions">
            {onDirections && <button className="place-directions" onClick={()=>onDirections(place)} disabled={directionsLoading}><Navigation size={14}/> {directionsActive?'Đang chỉ đường':'Chỉ đường'}</button>}
            <Link to={'/place/'+place.id}>Chi tiết <ArrowUpRight size={14}/></Link>
          </div>
        </div>
      </div>
    </article>
  );
}
