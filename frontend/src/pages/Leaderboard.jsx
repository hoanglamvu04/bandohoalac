import { useEffect, useState } from 'react';
import { Camera, MapPin, Medal, Trophy } from 'lucide-react';
import { getLeaderboard } from '../services/api.js';

const PODIUM_BADGES = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function Leaderboard() {
  const [explorers, setExplorers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard()
      .then((data) => setExplorers(data.items || []))
      .catch(() => setExplorers([]))
      .finally(() => setLoading(false));
  }, []);

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
          <div><Medal size={20} /><b>Top Explorer</b></div>
          <span>{new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}</span>
        </div>

        {loading && <div className="loading-card">Đang tải xếp hạng...</div>}
        {!loading && !explorers.length && (
          <div className="empty-state"><Trophy size={24} /><b>Chưa có dữ liệu xếp hạng</b><span>Hãy là người đóng góp đầu tiên!</span></div>
        )}

        {explorers.map((person) => (
          <div className={person.rank <= 3 ? 'leader-row podium' : 'leader-row'} key={person.id}>
            <span className="rank">{PODIUM_BADGES[person.rank] || person.rank}</span>
            <div className="leader-avatar">{person.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</div>
            <div className="leader-name">
              <b>{person.name}</b>
              <span><MapPin size={14} /> {person.placesCount} địa điểm <Camera size={14} /> {person.photosCount} ảnh</span>
            </div>
            <strong>{person.points.toLocaleString('vi-VN')} <small>điểm</small></strong>
          </div>
        ))}
      </section>
    </main>
  );
}
