import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import BottomNav from './components/BottomNav.jsx';
import Footer from './components/Footer.jsx';

export default function App() {
  const location = useLocation();
  const isMapRoute = location.pathname === '/map';

  useEffect(() => {
    document.body.classList.toggle('map-route-active', isMapRoute);
    return () => document.body.classList.remove('map-route-active');
  }, [isMapRoute]);

  return (
    <div className={isMapRoute ? 'app-shell map-app-shell' : 'app-shell'}>
      <Navbar />

      <main className={isMapRoute ? 'app-main map-app-main' : 'app-main'}>
        <Outlet />
      </main>

      {!isMapRoute && <Footer />}
      {!isMapRoute && <BottomNav />}
    </div>
  );
}
