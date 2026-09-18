import { useEffect, useState } from 'react';
import { Award, BadgeCheck, MapPin, Medal, TrendingUp } from 'lucide-react';
import ExplorerProfile from '../components/ExplorerProfile.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getUserProfile } from '../services/api.js';

const TYPE_LABELS = {
  CREATE_PLACE: 'Thêm địa điểm',
  UPDATE_PLACE: 'Cập nhật thông tin',
  ADD_PHOTO: 'Thêm ảnh',
  FIX_LOCATION: 'Chỉnh vị trí',
  UPDATE_HOURS: 'Cập nhật giờ mở cửa',
  UPDATE_PRICE: 'Cập nhật giá',
  REPORT_CLOSED: 'Báo đóng cửa',
  REPORT_WRONG_INFO: 'Báo sai thông tin'
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.id)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return <main className="profile-page page-container"><div className="loading-card">Đang tải hồ sơ...</div></main>;
  }

  return (
    <main className="profile-page page-container">
      <ExplorerProfile user={profile?.user || user} stats={profile?.stats} />

      <section className="profile-grid">
        <div className="profile-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">HOẠT ĐỘNG</span><h2>Đóng góp gần đây</h2></div>
            <TrendingUp size={22} />
          </div>

          <div className="activity-list">
            {!profile?.recentActivity?.length && <div className="empty-state"><b>Chưa có hoạt động nào</b><span>Hãy gửi đóng góp đầu tiên của bạn.</span></div>}
            {profile?.recentActivity?.map((activity) => (
              <div className="activity-row" key={activity.id}>
                <span className="activity-icon"><MapPin size={18} /></span>
                <div>
                  <b>{activity.place_name || TYPE_LABELS[activity.type] || activity.type}</b>
                  <span>{TYPE_LABELS[activity.type] || activity.type} · {activity.status}</span>
                </div>
                <strong>{activity.points_awarded ? `+${activity.points_awarded}` : '—'}</strong>
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
            {!profile?.badges?.length && <div className="empty-state"><Award size={22} /><b>Chưa có huy hiệu</b><span>Đóng góp nhiều hơn để mở khóa huy hiệu.</span></div>}
            {profile?.badges?.map((badge) => (
              <div key={badge.code}>
                <BadgeCheck size={23} />
                <b>{badge.name}</b>
                <small>{badge.description}</small>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
