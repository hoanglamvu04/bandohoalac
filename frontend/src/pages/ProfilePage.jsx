import { useEffect, useState } from 'react';
import { Award, BadgeCheck, ChevronRight, Heart, MapPin, MapPinned, Medal, TrendingUp } from 'lucide-react';
import ExplorerProfile from '../components/ExplorerProfile.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getMyFavorites, getUserProfile } from '../services/api.js';
import { Link, useNavigate } from 'react-router-dom';

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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.allSettled([
      getUserProfile(user.id),
      getMyFavorites()
    ])
      .then(([profileResult, favoritesResult]) => {
        setProfile(profileResult.status === 'fulfilled' ? profileResult.value : null);
        setFavorites(
          favoritesResult.status === 'fulfilled' && Array.isArray(favoritesResult.value?.items)
            ? favoritesResult.value.items
            : []
        );
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return <main className="profile-page page-container"><div className="loading-card">Đang tải hồ sơ...</div></main>;
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <main className="profile-page page-container">
      <ExplorerProfile
        user={profile?.user || user}
        stats={profile?.stats}
        onLogout={handleLogout}
      />

      <section className="profile-grid">
        <div className="profile-panel">
          <div className="panel-heading">
            <span className="profile-panel-icon"><TrendingUp size={20} /></span>
            <div><span className="eyebrow">HOẠT ĐỘNG</span><h2>Đóng góp gần đây</h2></div>
            <span className="profile-panel-arrow"><ChevronRight size={20} /></span>
            <TrendingUp className="profile-panel-desktop-icon" size={22} />
          </div>

          <div className="activity-list">
            {!profile?.recentActivity?.length && (
              <div className="empty-state profile-activity-empty">
                <span className="profile-empty-illustration"><MapPinned size={42} /></span>
                <b>Chưa có hoạt động nào</b>
                <span>Hãy gửi đóng góp đầu tiên của bạn.</span>
              </div>
            )}
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
            <span className="profile-panel-icon"><Medal size={20} /></span>
            <div><span className="eyebrow">THÀNH TÍCH</span><h2>Huy hiệu</h2></div>
            <span className="profile-panel-arrow"><ChevronRight size={20} /></span>
            <Medal className="profile-panel-desktop-icon" size={22} />
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

      <section className="profile-panel profile-favorites-panel">
        <div className="panel-heading">
          <span className="profile-panel-icon"><Heart size={20} /></span>
          <div><span className="eyebrow">ĐÃ LƯU</span><h2>Địa điểm yêu thích</h2></div>
          <span className="profile-panel-arrow"><ChevronRight size={20} /></span>
          <Heart className="profile-panel-desktop-icon" size={22} />
        </div>

        {!favorites.length ? (
          <div className="empty-state">
            <Heart size={22} />
            <b>Chưa lưu địa điểm nào</b>
            <span>Lưu những nơi bạn muốn ghé lại để tìm nhanh hơn.</span>
          </div>
        ) : (
          <div className="profile-favorite-grid">
            {favorites.slice(0, 8).map((place) => (
              <Link className="profile-favorite-card" to={'/place/' + place.id} key={place.id}>
                <span className="profile-favorite-cover">
                  {place.images?.[0]
                    ? <img src={place.images[0]} alt="" />
                    : <MapPin size={20} />}
                </span>
                <span>
                  <small>{place.category || 'Địa điểm'}</small>
                  <b>{place.name}</b>
                  <em>{place.address || 'Hòa Lạc'}</em>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
