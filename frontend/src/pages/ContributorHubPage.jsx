import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Gift,
  MapPin,
  Target,
  Trophy,
  UsersRound
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SeoHead from '../components/SeoHead.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const CONTRIBUTIONS = [
  ['Thêm địa điểm mới', MapPin, 'Bổ sung những nơi chưa có trên bản đồ.'],
  ['Chụp ảnh thực tế', Camera, 'Giúp người dùng nhận biết địa điểm trước khi đến.'],
  ['Xác minh thông tin', BadgeCheck, 'Cập nhật giờ mở cửa, vị trí, giá và trạng thái hoạt động.'],
  ['Tham gia nhiệm vụ', Target, 'Đóng góp theo chiến dịch để nhận thêm điểm thưởng.']
];

export default function ContributorHubPage() {
  const { user } = useAuth();

  return (
    <main className="commercial-landing contributor-landing">
      <SeoHead
        title="HOLA Contributor"
        description="Cộng tác viên và cộng đồng Explorer cùng cập nhật địa điểm, ảnh và dữ liệu địa phương cho HOLA Maps."
        canonical="https://maps.dothihoalac.vn/cong-tac-vien"
      />

      <section className="commercial-hero contributor-hero">
        <div className="commercial-shell commercial-hero-grid">
          <div>
            <span className="commercial-kicker"><UsersRound size={15} /> HOLA CONTRIBUTOR</span>
            <h1>Biến hiểu biết địa phương thành giá trị cho cả cộng đồng.</h1>
            <p>
              Sinh viên và người sống quanh Hòa Lạc có thể cập nhật địa điểm, ảnh và thông tin thực tế;
              đóng góp được duyệt sẽ đi vào hệ thống điểm, cấp độ và phần thưởng Explorer.
            </p>
            <div className="commercial-actions">
              <Link className="primary" to={user ? '/contribute' : '/register'}>
                {user ? 'Đóng góp ngay' : 'Tham gia cộng đồng'} <ArrowRight size={16} />
              </Link>
              <Link to="/missions">Xem nhiệm vụ</Link>
            </div>
          </div>

          <div className="commercial-hero-panel contributor-panel">
            <span><Trophy size={27} /></span>
            <strong>Đóng góp → được duyệt → nhận điểm → lên cấp → đổi ưu đãi</strong>
            <p>Vòng lặp cộng đồng đã nối với Reputation, Missions và Rewards hiện có.</p>
          </div>
        </div>
      </section>

      <section className="commercial-shell commercial-section">
        <div className="commercial-section-head">
          <span>BẠN CÓ THỂ LÀM GÌ?</span>
          <h2>Cập nhật những thứ chỉ người địa phương biết rõ</h2>
        </div>

        <div className="commercial-benefit-grid contributor-grid">
          {CONTRIBUTIONS.map(([title, Icon, text]) => (
            <article key={title}>
              <span><Icon size={20} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="commercial-shell contributor-loop">
        <div>
          <span><Target size={21} /></span>
          <h3>Nhiệm vụ</h3>
          <p>Tham gia chiến dịch cập nhật dữ liệu theo từng giai đoạn.</p>
          <Link to="/missions">Mở Mission Board <ArrowRight size={14} /></Link>
        </div>
        <div>
          <span><Trophy size={21} /></span>
          <h3>Reputation & xếp hạng</h3>
          <p>Đóng góp tốt giúp tăng uy tín và vị trí trong cộng đồng.</p>
          <Link to="/leaderboard">Xem cộng đồng <ArrowRight size={14} /></Link>
        </div>
        <div>
          <span><Gift size={21} /></span>
          <h3>Rewards</h3>
          <p>Dùng điểm Explorer để đổi voucher từ các HOLA Partner.</p>
          <Link to="/rewards">Xem ưu đãi <ArrowRight size={14} /></Link>
        </div>
      </section>

      <section className="commercial-cta">
        <div className="commercial-shell commercial-cta-inner">
          <div>
            <UsersRound size={24} />
            <h2>Mục tiêu không phải “đăng càng nhiều càng tốt”.</h2>
            <p>HOLA Maps cần cộng tác viên giúp dữ liệu đúng hơn, mới hơn và đáng tin hơn theo thời gian.</p>
          </div>
          <Link to={user ? '/contribute' : '/register'}>
            {user ? 'Bắt đầu đóng góp' : 'Tạo tài khoản'} <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
