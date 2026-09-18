import { BadgeCheck, Camera, MapPin, Sparkles } from 'lucide-react';

export default function ExplorerProfile() {
  return (
    <section className="explorer-card">
      <div className="explorer-cover">
        <div className="explorer-avatar">CE</div>
        <span className="trusted-badge"><BadgeCheck size={16} /> Trusted Explorer</span>
      </div>

      <div className="explorer-body">
        <div>
          <span className="eyebrow">HOLA EXPLORER</span>
          <h1>Chinh Explorer</h1>
          <p>Thích cafe có view đẹp, homestay yên tĩnh và những góc Hòa Lạc ít người biết.</p>
        </div>

        <div className="explorer-score">
          <Sparkles size={20} />
          <strong>1.280</strong>
          <span>điểm</span>
        </div>
      </div>

      <div className="explorer-stats">
        <div><MapPin size={18} /><b>62</b><span>Địa điểm</span></div>
        <div><Camera size={18} /><b>283</b><span>Ảnh thực tế</span></div>
        <div><BadgeCheck size={18} /><b>96%</b><span>Duyệt chính xác</span></div>
      </div>
    </section>
  );
}
