export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <strong>Hola Maps</strong>
        <p>Bản đồ số khu vực Hòa Lạc - Thạch Thất và vùng phụ cận.</p>
      </div>
      <div className="footer-links">
        <span>Yên Xuân</span>
        <span>Hòa Lạc</span>
        <span>Thạch Thất</span>
        <span>Tây Phương</span>
        <span>Phú Cát</span>
      </div>
      <div className="footer-copy">
        © {new Date().getFullYear()} Hola Maps. All rights reserved.
      </div>
    </footer>
  );
}
