import { Map, Camera, Star, MapPin } from 'lucide-react';

const categories = ['☕ Cafe', '🍜 Ăn uống', '🏡 Homestay', '📸 Check-in', '🎡 Vui chơi'];

export default function App() {
  return (
    <main className="page">
      <header className="header">
        <div className="logo">HOLA <span>MAPS</span></div>
        <button>Đăng địa điểm</button>
      </header>

      <section className="hero">
        <p className="tag">Bản đồ khám phá Hòa Lạc</p>
        <h1>Khám phá nơi đáng đi.<br/>Được xây dựng bởi cộng đồng.</h1>
        <p>Ảnh thực tế, địa điểm địa phương và trải nghiệm từ những người đang sống tại Hòa Lạc.</p>
        <div className="actions">
          <button><Map /> Mở bản đồ</button>
          <button className="light"><Camera /> Đóng góp</button>
        </div>
      </section>

      <section className="categories">
        {categories.map(x => <div key={x}>{x}</div>)}
      </section>

      <section className="card">
        <MapPin />
        <div><h2>Hệ thống địa điểm cộng đồng</h2><p>Người dùng chụp ảnh, xác định GPS, gửi địa điểm và nhận điểm đóng góp.</p></div>
        <Star />
      </section>
    </main>
  );
}
