import { Mail, MapPin, MapPinned, Play, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer modern-footer reference-footer">
      <div className="footer-columns">
        <div className="footer-brand">
          <div className="footer-logo">
            <span className="footer-logo-mark"><MapPinned size={23}/></span>
            <span><b>Hola Maps</b><small>LOCAL DISCOVERY</small></span>
          </div>
          <p>Bản đồ số khu vực Hòa Lạc - Thạch Thất và vùng phụ cận. Khám phá địa điểm địa phương theo cách thông minh hơn.</p>
          <div className="footer-socials" aria-label="Kênh cộng đồng">
            <span><UsersRound size={16}/></span>
            <span><MapPin size={16}/></span>
            <span><Play size={16}/></span>
            <span><Mail size={16}/></span>
          </div>
        </div>

        <div className="footer-column">
          <h4>Khám phá</h4>
          <Link to="/map">Địa điểm</Link>
          <Link to="/map">Bản đồ</Link>
          <Link to="/contribute">Đóng góp địa điểm</Link>
          <Link to="/leaderboard">Cộng đồng Explorer</Link>
        </div>

        <div className="footer-column">
          <h4>Hỗ trợ</h4>
          <Link to="#">Hướng dẫn sử dụng</Link>
          <Link to="#">Quy định cộng đồng</Link>
          <Link to="#">Liên hệ</Link>
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
        <span>Cùng xây dựng bản đồ Hòa Lạc tốt hơn mỗi ngày <b>♥</b></span>
      </div>
    </footer>
  );
}
