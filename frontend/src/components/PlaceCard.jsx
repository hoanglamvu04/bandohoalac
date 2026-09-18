export default function PlaceCard({ place }) {
  return (
    <div className="place-card">
      <h3>{place.name}</h3>
      <p>{place.category}</p>
      <strong>⭐ {place.rating}</strong>
    </div>
  );
}
