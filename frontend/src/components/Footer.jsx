import { Link } from 'react-router-dom';
import { MapPinned } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="site-footer modern-footer">
      <div className="footer-columns">
        <div className="footer-brand">
          <div className="footer-logo"><MapPinned size={24}/> Hola Maps</div>
          <p>Bản đồ số khu vực Hòa Lạc - Thạch Thất và vùng phụ cận. Khám phá địa điểm địa phương theo cách thông minh hơn.</p>
        </div>
        <div><h4>Khám phá</h4><Link to="/map">Địa điểm</Link><Link to="/map">Bản đồ</Link><Link to="/contribute">Bổ sung địa điểm</Link></div>
        <div><h4>Hỗ trợ</h4><Link to="#">Hướng dẫn sử dụng</Link><Link to="#">Quy định cộng đồng</Link><Link to="#">Liên hệ</Link></div>
        <div><h4>Khu vực</h4><div className="footer-tags"><span>Yên Xuân</span><span>Hòa Lạc</span><span>Thạch Thất</span><span>Tây Phương</span><span>Phú Cát</span></div></div>
      </div>
      <div className="footer-copy">© {new Date().getFullYear()} Hola Maps. All rights reserved.</div>
    </footer>
  );
}
