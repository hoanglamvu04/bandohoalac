import { Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import SearchBox from './components/SearchBox';
import CategoryBar from './components/CategoryBar';

export default function App(){
 return <main className="page">
  <Navbar />
  <section className="hero">
   <span className="tag">HOLA MAPS • KHÁM PHÁ HÒA LẠC</span>
   <h1>Bản đồ trải nghiệm được xây dựng bởi cộng đồng địa phương.</h1>
   <p>Khám phá cafe, homestay, villa, điểm check-in bằng ảnh thực tế từ những người đã đến.</p>
   <SearchBox />
   <div className="actions"><Link to="/map">Mở bản đồ</Link><Link className="light" to="/map">Đóng góp địa điểm</Link></div>
  </section>
  <CategoryBar />
 </main>
}
