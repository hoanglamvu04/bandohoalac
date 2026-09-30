import { useEffect, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Coins,
  Flag,
  Sparkles,
  Target,
  Trophy
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getMissions, getUserProfile } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const TYPE_LABELS = {
  CREATE_PLACE: 'Thêm địa điểm',
  UPDATE_PLACE: 'Cập nhật thông tin',
  ADD_PHOTO: 'Thêm ảnh',
  FIX_LOCATION: 'Sửa vị trí',
  UPDATE_HOURS: 'Cập nhật giờ mở cửa',
  UPDATE_PRICE: 'Cập nhật giá',
  REPORT_CLOSED: 'Báo đóng cửa',
  REPORT_WRONG_INFO: 'Báo sai thông tin'
};

export default function MissionsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.allSettled([
      getMissions(),
      user ? getUserProfile(user.id) : Promise.resolve(null)
    ])
      .then(([missionsResult, profileResult]) => {
        if (!active) return;
        if (missionsResult.status === 'fulfilled') {
          setItems(Array.isArray(missionsResult.value?.items) ? missionsResult.value.items : []);
        } else {
          showToast(missionsResult.reason?.message || 'Không tải được nhiệm vụ.', 'error');
        }
        setProfile(profileResult.status === 'fulfilled' ? profileResult.value : null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const level = profile?.user?.explorerLevel;

  return (
    <main className="missions-page page-container">
      <section className="missions-hero">
        <div>
          <span className="eyebrow">HOLA EXPLORER MISSIONS</span>
          <h1>Cùng hoàn thiện bản đồ,<br />nhận thêm điểm thưởng.</h1>
          <p>
            Tham gia các chiến dịch cộng đồng theo từng giai đoạn. Mỗi đóng góp
            được duyệt trong nhiệm vụ có thể nhận điểm bonus và phần thưởng hoàn thành.
          </p>

          {!user ? (
            <Link className="missions-login" to="/login" state={{ from: { pathname: '/missions' } }}>
              Đăng nhập để tham gia
            </Link>
          ) : (
            <div className="missions-level-card">
              <span><Trophy size={22} /></span>
              <div>
                <small>Cấp Explorer hiện tại</small>
                <b>{level?.name || 'Explorer'}</b>
                {level?.nextLevel ? (
                  <em>Còn {level.pointsToNext?.toLocaleString('vi-VN')} điểm để lên {level.nextLevel.name}</em>
                ) : (
                  <em>Bạn đang ở cấp cao nhất hiện tại.</em>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="missions-hero-art">
          <Target size={54} />
          <b>Mission Board</b>
          <span>Đóng góp đúng mục tiêu · Nhận bonus · Lên cấp</span>
        </div>
      </section>

      <section className="missions-section">
        <div className="missions-section-head">
          <div>
            <span className="eyebrow">ĐANG DIỄN RA</span>
            <h2>Chiến dịch cộng đồng</h2>
          </div>
          <span>{items.length} nhiệm vụ</span>
        </div>

        {loading ? (
          <div className="loading-card">Đang tải nhiệm vụ...</div>
        ) : !items.length ? (
          <div className="empty-state">
            <Flag size={25} />
            <b>Chưa có nhiệm vụ đang chạy</b>
            <span>Chiến dịch mới sẽ xuất hiện tại đây khi Admin kích hoạt.</span>
          </div>
        ) : (
          <div className="missions-grid">
            {items.map((item) => {
              const progressPct = Math.round((item.progress || 0) * 100);
              return (
                <article className={item.completed ? 'mission-card completed' : 'mission-card'} key={item.id}>
                  <div className="mission-card-head">
                    <span className="mission-card-icon"><Flag size={21} /></span>
                    {item.completed && <span className="mission-completed-pill"><CheckCircle2 size={13} /> Hoàn thành</span>}
                  </div>

                  <span className="mission-status-line">
                    <Sparkles size={13} />
                    +{item.bonusPoints} điểm / đóng góp
                    {item.completionBonus > 0 && <> · +{item.completionBonus} hoàn thành</>}
                  </span>

                  <h3>{item.title}</h3>
                  <p>{item.description || 'Hoàn thành các đóng góp phù hợp để nhận điểm thưởng.'}</p>

                  <div className="mission-types">
                    {!item.contributionTypes?.length
                      ? <span>Tất cả loại đóng góp</span>
                      : item.contributionTypes.map((type) => <span key={type}>{TYPE_LABELS[type] || type}</span>)}
                  </div>

                  {user ? (
                    <>
                      <div className="mission-progress-meta">
                        <span><b>{item.approvedCount}</b> / {item.targetCount} đóng góp</span>
                        <strong>{progressPct}%</strong>
                      </div>
                      <div className="mission-progress-track">
                        <span style={{ width: progressPct + '%' }} />
                      </div>
                    </>
                  ) : (
                    <Link className="mission-login-link" to="/login" state={{ from: { pathname: '/missions' } }}>
                      Đăng nhập để theo dõi tiến độ
                    </Link>
                  )}

                  <footer>
                    <span><Coins size={14} /> Bonus khi đóng góp được duyệt</span>
                    <Link to="/contribute">Đóng góp ngay →</Link>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="missions-levels">
        <div className="missions-section-head">
          <div>
            <span className="eyebrow">EXPLORER LEVEL</span>
            <h2>Cấp độ cộng đồng</h2>
          </div>
        </div>
        <div className="explorer-level-list">
          {[
            ['Explorer', '0+', 'Bắt đầu hành trình khám phá Hòa Lạc.'],
            ['Local Explorer', '100+', 'Đã có những đóng góp đầu tiên cho cộng đồng.'],
            ['Trusted Explorer', '500+', 'Thành viên tích cực với lịch sử đóng góp tốt.'],
            ['Hòa Lạc Expert', '1.500+', 'Hiểu rõ khu vực và đóng góp đều đặn.'],
            ['Hòa Lạc Insider', '5.000+', 'Nhóm Explorer kỳ cựu của Hola Maps.']
          ].map(([name, points, text], index) => (
            <div className={level?.name === name ? 'explorer-level-row active' : 'explorer-level-row'} key={name}>
              <span><Award size={18} /></span>
              <div><b>{name}</b><small>{text}</small></div>
              <strong>{points} điểm</strong>
              {level?.name === name && <em>Hiện tại</em>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
