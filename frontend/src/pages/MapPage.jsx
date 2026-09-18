import MapView from '../components/MapView';

const categories = ['☕ Cafe', '🍜 Ăn uống', '🏡 Homestay', '📸 Check-in', '🎡 Trải nghiệm'];

export default function MapPage() {
  return (
    <div className="map-page">
      <div className="map-sidebar">
        <h1>Khám phá Hòa Lạc</h1>
        <p>Tìm địa điểm đẹp do cộng đồng Hola Maps đóng góp.</p>
        <div className="categories">
          {categories.map((item) => <button key={item}>{item}</button>)}
        </div>
        <div className="place-card">
          <h3>The Lake Coffee</h3>
          <p>⭐ 4.8 · Cafe · 500m từ bạn</p>
          <span>✓ Đã khảo sát thực tế</span>
        </div>
      </div>
      <MapView />
    </div>
  );
}
