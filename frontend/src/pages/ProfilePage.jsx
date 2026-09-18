import { BadgeCheck, Camera, MapPin, Medal, TrendingUp } from 'lucide-react';
import ExplorerProfile from '../components/ExplorerProfile.jsx';

const recent = [
  ['The Lake Coffee', 'Thêm địa điểm', '+20'],
  ['Lucia Villa', 'Thêm 4 ảnh', '+12'],
  ['Forest View Homestay', 'Cập nhật giờ mở cửa', '+5']
];

export default function ProfilePage() {
  return (
    <main className="profile-page page-container">
      <ExplorerProfile />

      <section className="profile-grid">
        <div className="profile-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">HOẠT ĐỘNG</span><h2>Đóng góp gần đây</h2></div>
            <TrendingUp size={22} />
          </div>

          <div className="activity-list">
            {recent.map(([name, action, points]) => (
              <div className="activity-row" key={name + action}>
                <span className="activity-icon"><MapPin size={18} /></span>
                <div><b>{name}</b><span>{action}</span></div>
                <strong>{points}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="profile-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">THÀNH TÍCH</span><h2>Huy hiệu</h2></div>
            <Medal size={22} />
          </div>

          <div className="badge-grid">
            <div><span>☕</span><b>Cafe Hunter</b><small>25 quán cafe</small></div>
            <div><Camera size={23} /><b>Photographer</b><small>200+ ảnh</small></div>
            <div><BadgeCheck size={23} /><b>Trusted Explorer</b><small>Độ tin cậy cao</small></div>
          </div>
        </div>
      </section>
    </main>
  );
}
