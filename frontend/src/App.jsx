import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import BottomNav from './components/BottomNav.jsx';
import Footer from './components/Footer.jsx';

export default function App() {
  const location = useLocation();
  const isMapRoute = location.pathname === '/map';
  const isProfileRoute = location.pathname === '/profile';

  useEffect(() => {
    document.body.classList.toggle('map-route-active', isMapRoute);
    return () => document.body.classList.remove('map-route-active');
  }, [isMapRoute]);

  return (
    <div className={[
      'app-shell',
      isMapRoute ? 'map-app-shell' : '',
      isProfileRoute ? 'profile-app-shell' : ''
    ].filter(Boolean).join(' ')}>
      <Navbar />

      <main className={isMapRoute ? 'app-main map-app-main' : 'app-main'}>
        <Outlet />
      </main>

      {!isMapRoute && <Footer />}
      <BottomNav />
    </div>
  );
}
