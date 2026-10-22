import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Gift,
  MapPin,
  ShieldCheck,
  UsersRound
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SeoHead from '../components/SeoHead.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const BENEFITS = [
  { icon: BadgeCheck, title: 'Xác minh chủ sở hữu', text: 'Claim địa điểm để HOLA Maps biết ai là người chịu trách nhiệm cập nhật thông tin.' },
  { icon: Building2, title: 'Quản lý địa điểm', text: 'Cập nhật số điện thoại, website, giờ mở cửa và mô tả ngay trong Partner Portal.' },
  { icon: Gift, title: 'Ưu đãi & voucher', text: 'Tham gia Rewards để đưa ưu đãi tới cộng đồng Explorer của HOLA Maps.' },
  { icon: UsersRound, title: 'Quản lý nhân viên', text: 'Chủ đối tác có thể cấp quyền nhân viên phục vụ quy trình voucher tại điểm kinh doanh.' }
];

export default function PartnerLandingPage() {
  const { user } = useAuth();
  const hasPartnerAccess = Boolean(user?.partnerAccess?.hasAccess);

  return (
    <main className="commercial-landing partner-landing">
      <SeoHead
        title="HOLA Partner"
        description="Chương trình đối tác HOLA Maps dành cho phòng trọ, quán ăn, cafe, homestay và doanh nghiệp địa phương tại Hòa Lạc."
        canonical="https://maps.dothihoalac.vn/doi-tac"
      />

      <section className="commercial-hero">
        <div className="commercial-shell commercial-hero-grid">
          <div>
            <span className="commercial-kicker"><BadgeCheck size={15} /> HOLA PARTNER</span>
            <h1>Đưa địa điểm của bạn đến đúng người ở Hòa Lạc.</h1>
            <p>
              HOLA Partner kết nối chủ phòng trọ, quán ăn, cafe, homestay và dịch vụ địa phương
              với người dùng đang tìm kiếm trực tiếp trên HOLA Maps.
            </p>
            <div className="commercial-actions">
              {hasPartnerAccess ? (
                <Link className="primary" to="/partner">Mở Partner Portal <ArrowRight size={16} /></Link>
              ) : (
                <Link className="primary" to="/map">Tìm địa điểm để claim <ArrowRight size={16} /></Link>
              )}
              <Link to="/contribute">Chưa có địa điểm? Thêm mới</Link>
            </div>
          </div>

          <div className="commercial-hero-panel">
            <span><MapPin size={27} /></span>
            <strong>Phòng trọ · Quán ăn · Cafe · Homestay · Dịch vụ</strong>
            <p>Một hồ sơ địa điểm, một vị trí trên bản đồ và một luồng quản lý thống nhất.</p>
          </div>
        </div>
      </section>

      <section className="commercial-shell commercial-section">
        <div className="commercial-section-head">
          <span>ĐÃ CÓ TRONG HỆ THỐNG</span>
          <h2>Nền tảng Partner đã có sẵn lõi vận hành</h2>
          <p>Không cần tạo một hệ thống kinh doanh tách rời khỏi HOLA Maps.</p>
        </div>

        <div className="commercial-benefit-grid">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <span><Icon size={20} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="commercial-shell commercial-process">
        <div className="commercial-section-head">
          <span>QUY TRÌNH</span>
          <h2>Từ địa điểm công khai đến HOLA Partner</h2>
        </div>

        <div className="commercial-steps">
          <article><b>01</b><h3>Tìm hoặc thêm địa điểm</h3><p>Địa điểm cần tồn tại trên HOLA Maps trước khi bắt đầu xác minh chủ sở hữu.</p></article>
          <article><b>02</b><h3>Gửi yêu cầu claim</h3><p>Chủ kinh doanh gửi thông tin xác minh. Hệ thống quản trị sẽ duyệt quyền quản lý.</p></article>
          <article><b>03</b><h3>Vận hành Partner Portal</h3><p>Sau khi được duyệt, đối tác quản lý thông tin, nhân viên và chương trình ưu đãi.</p></article>
        </div>
      </section>

      <section className="commercial-cta">
        <div className="commercial-shell commercial-cta-inner">
          <div>
            <ShieldCheck size={24} />
            <h2>Bắt đầu bằng dữ liệu đúng, rồi mới tăng traffic và doanh thu.</h2>
            <p>HOLA Maps ưu tiên chất lượng dữ liệu địa phương trước khi mở các gói thương mại nâng cao.</p>
          </div>
          <Link to={hasPartnerAccess ? '/partner' : '/map'}>
            {hasPartnerAccess ? 'Vào Partner Portal' : 'Tìm địa điểm của bạn'} <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
