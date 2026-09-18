import { BadgeCheck, ShieldCheck, Sparkles } from 'lucide-react';
import AddPlace from '../components/AddPlace.jsx';

export default function Contribute() {
  return (
    <main className="contribute-page page-container">
      <section className="contribute-intro">
        <span className="eyebrow"><Sparkles size={15} /> HOLA MAPS COMMUNITY</span>
        <h1>Một địa điểm thật.<br />Một đóng góp có giá trị.</h1>
        <p>Thông tin bạn gửi sẽ được kiểm tra trước khi xuất hiện công khai trên bản đồ.</p>
        <div className="contribute-points">
          <span><BadgeCheck size={17} /> Điểm chỉ cộng sau khi được duyệt</span>
          <span><ShieldCheck size={17} /> GPS chỉ dùng cho lần đóng góp này</span>
        </div>
      </section>

      <AddPlace />
    </main>
  );
}
