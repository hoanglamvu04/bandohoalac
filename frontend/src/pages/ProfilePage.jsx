import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BadgeCheck,
  Building2,
  Camera,
  ChevronRight,
  Coins,
  ExternalLink,
  Flag,
  Gift,
  Heart,
  Images,
  Map,
  MapPin,
  MapPinned,
  Medal,
  Navigation,
  TrendingUp,
  X
} from 'lucide-react';
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

function ContributionListModal({
  type,
  places,
  photos,
  onClose
}) {
  const isPlaces = type === 'places';
  const items = isPlaces ? places : photos;
  const title = isPlaces ? 'Địa điểm đã đóng góp' : 'Ảnh thực tế đã đóng góp';
  const description = isPlaces
    ? 'Những địa điểm của bạn đã được duyệt và xuất bản trên Hola Maps.'
    : 'Ảnh thực tế bạn đã đóng góp cho các địa điểm đang hiển thị trên Hola Maps.';

  return (
    <div
      className="profile-contribution-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="profile-contribution-sheet">
        <div className="profile-contribution-head">
          <div>
            <span className="eyebrow">
              {isPlaces ? 'ĐỊA ĐIỂM' : 'ẢNH THỰC TẾ'}
            </span>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </div>

        <div className="profile-contribution-count">
          {isPlaces ? <MapPin size={16} /> : <Images size={16} />}
          <b>{items.length}</b>
          <span>{isPlaces ? 'địa điểm' : 'ảnh'}</span>
        </div>

        {!items.length ? (
          <div className="empty-state profile-contribution-empty">
            {isPlaces ? <MapPinned size={30} /> : <Camera size={30} />}
            <b>{isPlaces ? 'Chưa có địa điểm đã duyệt' : 'Chưa có ảnh thực tế'}</b>
            <span>
              {isPlaces
                ? 'Khi địa điểm của bạn được duyệt, danh sách sẽ xuất hiện tại đây.'
                : 'Ảnh đã được đăng lên địa điểm sẽ xuất hiện tại đây.'}
            </span>
          </div>
        ) : (
          <div className={isPlaces ? 'profile-contribution-list places' : 'profile-contribution-list photos'}>
            {isPlaces
              ? items.map((place) => (
                  <article className="profile-contribution-place" key={place.id}>
                    <Link className="profile-contribution-cover" to={'/place/' + place.id}>
                      {place.coverImage
                        ? <img src={place.coverImage} alt="" />
                        : <MapPin size={24} />}
                      {place.imageCount > 0 && (
                        <span><Camera size={12} /> {place.imageCount}</span>
                      )}
                    </Link>

                    <div className="profile-contribution-place-copy">
                      <small>{place.category || 'Địa điểm'}</small>
                      <Link to={'/place/' + place.id}>{place.name}</Link>
                      <p>{place.address || 'Hòa Lạc'}</p>

                      <div className="profile-contribution-actions">
                        <Link to={'/place/' + place.id}>
                          Chi tiết <ExternalLink size={13} />
                        </Link>
                        <Link className="map-link" to={'/map?place=' + place.id}>
                          <Map size={13} /> Xem trên bản đồ
                        </Link>
                      </div>
                    </div>
                  </article>
                ))
              : items.map((photo) => (
                  <article className="profile-contribution-photo" key={photo.id}>
                    <Link
                      className="profile-contribution-photo-image"
                      to={'/place/' + photo.placeId}
                    >
                      <img src={photo.url} alt={'Ảnh thực tế tại ' + photo.placeName} />
                    </Link>

                    <div className="profile-contribution-photo-copy">
                      <small>{photo.category || 'Địa điểm'}</small>
                      <Link to={'/place/' + photo.placeId}>{photo.placeName}</Link>
                      <p>{photo.placeAddress || 'Hòa Lạc'}</p>

                      <div className="profile-contribution-actions">
                        <Link to={'/place/' + photo.placeId}>
                          Địa điểm <ExternalLink size={13} />
                        </Link>
                        <Link className="map-link" to={'/map?place=' + photo.placeId}>
                          <Navigation size={13} /> Mở bản đồ
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeContributionView, setActiveContributionView] = useState(null);

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

  useEffect(() => {
    if (!activeContributionView || typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event) {
      if (event.key === 'Escape') setActiveContributionView(null);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeContributionView]);

  const contributedPlaces = useMemo(
    () => Array.isArray(profile?.contributedPlaces) ? profile.contributedPlaces : [],
    [profile?.contributedPlaces]
  );

  const contributedPhotos = useMemo(
    () => Array.isArray(profile?.contributedPhotos) ? profile.contributedPhotos : [],
    [profile?.contributedPhotos]
  );

  if (loading) {
    return <main className="profile-page page-container"><div className="loading-card">Đang tải hồ sơ...</div></main>;
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <main className="profile-page profile-white-dashboard page-container">
      <ExplorerProfile
        user={profile?.user || user}
        stats={profile?.stats}
        onLogout={handleLogout}
        onOpenStat={setActiveContributionView}
      />

      <div className="profile-community-links">
        <Link className="profile-rewards-entry" to="/rewards">
          <span className="profile-rewards-icon"><Gift size={24} /></span>
          <span>
            <small>ƯU ĐÃI THÀNH VIÊN</small>
            <b>Dùng điểm đóng góp để đổi voucher đối tác</b>
            <em><Coins size={13} /> Khám phá ưu đãi đang có</em>
          </span>
          <ChevronRight size={20} />
        </Link>

        <Link className="profile-rewards-entry mission" to="/missions">
          <span className="profile-rewards-icon"><Flag size={24} /></span>
          <span>
            <small>NHIỆM VỤ CỘNG ĐỒNG</small>
            <b>Tham gia nhiệm vụ để nhận thêm điểm thưởng</b>
            <em><Flag size={13} /> Theo dõi tiến độ chiến dịch</em>
          </span>
          <ChevronRight size={20} />
        </Link>

        <Link className="profile-rewards-entry partner" to="/partner">
          <span className="profile-rewards-icon"><Building2 size={24} /></span>
          <span>
            <small>DÀNH CHO ĐỐI TÁC</small>
            <b>Quản lý địa điểm đã xác minh và voucher</b>
            <em><Building2 size={13} /> Dành cho chủ quán và đối tác</em>
          </span>
          <ChevronRight size={20} />
        </Link>
      </div>

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
                <strong>{activity.points_awarded ? '+' + activity.points_awarded : '—'}</strong>
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
            {!profile?.badges?.length && (
              <div className="empty-state">
                <Award size={22} />
                <b>Chưa có huy hiệu</b>
                <span>Đóng góp nhiều hơn để mở khóa huy hiệu.</span>
              </div>
            )}
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

      {activeContributionView && (
        <ContributionListModal
          type={activeContributionView}
          places={contributedPlaces}
          photos={contributedPhotos}
          onClose={() => setActiveContributionView(null)}
        />
      )}
    </main>
  );
}
