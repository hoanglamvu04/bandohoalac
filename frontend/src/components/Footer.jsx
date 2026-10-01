import { ExternalLink, MessageCircle, UserRound, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBrand } from '../context/BrandContext.jsx';

export default function Footer() {
  const { brand } = useBrand();

  return (
    <footer
      className="site-footer modern-footer reference-footer"
      style={{
        '--brand-footer-desktop-width': brand.footerLogoDesktopWidth + 'px',
        '--brand-footer-mobile-width': brand.footerLogoMobileWidth + 'px'
      }}
    >
      <div className="footer-columns">
        <div className="footer-brand">
          <Link className="footer-logo footer-logo-official" to="/" aria-label="Hola Maps">
            <img src={brand.footerLogoUrl} alt="Hola Maps" />
          </Link>
          <p>
            Bản đồ cộng đồng dành cho Hòa Lạc và 8 xã lân cận.
            Khám phá địa điểm, tuyến đường và cùng cập nhật dữ liệu địa phương
            đầy đủ, chính xác hơn mỗi ngày.
          </p>
          <div className="footer-socials" aria-label="Kênh liên hệ Hola Maps">
            <a
              href="https://www.facebook.com/lamvudcba"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook cá nhân"
              title="Facebook cá nhân"
            >
              <UserRound size={16}/>
            </a>
            <a
              href="https://www.facebook.com/groups/1436045585156420"
              target="_blank"
              rel="noreferrer"
              aria-label="Nhóm Facebook Hola Maps"
              title="Nhóm Facebook"
            >
              <UsersRound size={16}/>
            </a>
            <a
              href="https://zalo.me/0376531093"
              target="_blank"
              rel="noreferrer"
              aria-label="Zalo 0376531093"
              title="Zalo 0376531093"
            >
              <MessageCircle size={16}/>
            </a>
          </div>
        </div>

        <div className="footer-column">
          <h4>Khám phá</h4>
          <Link to="/map">Địa điểm</Link>
          <Link to="/map">Bản đồ</Link>
          <Link to="/contribute">Đóng góp địa điểm</Link>
          <Link to="/leaderboard">Cộng đồng Explorer</Link>
        </div>

        <div className="footer-column footer-contact-column">
          <h4>Hỗ trợ & liên hệ</h4>
          <Link to="#">Hướng dẫn sử dụng</Link>
          <Link to="#">Quy định cộng đồng</Link>
          <a href="https://www.facebook.com/lamvudcba" target="_blank" rel="noreferrer">
            Facebook <ExternalLink size={11}/>
          </a>
          <a href="https://www.facebook.com/groups/1436045585156420" target="_blank" rel="noreferrer">
            Nhóm Facebook <ExternalLink size={11}/>
          </a>
          <a href="https://zalo.me/0376531093" target="_blank" rel="noreferrer">
            Zalo · 0376531093 <ExternalLink size={11}/>
          </a>
        </div>

        <div className="footer-column">
          <h4>Khu vực</h4>
          <div className="footer-tags">
            <span>Yên Xuân</span>
            <span>Hòa Lạc</span>
            <span>Thạch Thất</span>
            <span>Tây Phương</span>
            <span>Phú Cát</span>
          </div>
        </div>
      </div>

      <div className="footer-copy">
        <span>© {new Date().getFullYear()} Hola Maps. All rights reserved.</span>
        <span className="footer-developer">
          Đơn vị phát triển:
          <a href="https://media.xspace.vn/" target="_blank" rel="noreferrer">
            Media X Space <ExternalLink size={10} />
          </a>
        </span>
        <span>Cùng xây dựng bản đồ Hòa Lạc tốt hơn mỗi ngày <b>♥</b></span>
      </div>
    </footer>
  );
}
