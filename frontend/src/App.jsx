import { Outlet } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import BottomNav from './components/BottomNav.jsx';

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <Outlet />
      <BottomNav />
    </div>
  );
}
