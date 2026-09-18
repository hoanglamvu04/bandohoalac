import { Camera, MapPin, Medal, Trophy } from 'lucide-react';

const explorers = [
  { rank: 1, name: 'Chinh Explorer', points: 1280, places: 62, photos: 283, badge: '🥇' },
  { rank: 2, name: 'Diệp Local Guide', points: 1050, places: 49, photos: 214, badge: '🥈' },
  { rank: 3, name: 'Minh Hòa Lạc', points: 920, places: 44, photos: 168, badge: '🥉' },
  { rank: 4, name: 'Nam Explorer', points: 740, places: 31, photos: 143, badge: '4' },
  { rank: 5, name: 'Linh Weekend', points: 680, places: 28, photos: 132, badge: '5' }
];

export default function Leaderboard() {
  return (
    <main className="leaderboard-page page-container">
      <section className="leaderboard-hero">
        <div className="trophy-orb"><Trophy size={35} /></div>
        <span className="eyebrow">CỘNG ĐỒNG HOLA EXPLORER</span>
        <h1>Những người đang cùng xây bản đồ Hòa Lạc.</h1>
        <p>Mỗi ảnh thật, cập nhật chính xác và địa điểm mới đều giúp Hola Maps hữu ích hơn.</p>
      </section>

      <section className="leaderboard-card">
        <div className="leaderboard-head">
          <div><Medal size={20} /><b>Top Explorer tháng này</b></div>
          <span>Tháng 9/2026</span>
        </div>

        {explorers.map((person) => (
          <div className={person.rank <= 3 ? 'leader-row podium' : 'leader-row'} key={person.rank}>
            <span className="rank">{person.badge}</span>
            <div className="leader-avatar">{person.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</div>
            <div className="leader-name">
              <b>{person.name}</b>
              <span><MapPin size={14} /> {person.places} địa điểm <Camera size={14} /> {person.photos} ảnh</span>
            </div>
            <strong>{person.points.toLocaleString('vi-VN')} <small>điểm</small></strong>
          </div>
        ))}
      </section>
    </main>
  );
}
