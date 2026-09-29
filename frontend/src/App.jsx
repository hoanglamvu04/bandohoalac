import { useEffect, useLayoutEffect } from 'react';
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

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const previousInlineBehavior = root.style.scrollBehavior;

    // The global stylesheet enables smooth scrolling. Temporarily disable it
    // so route changes start at the top before the new page is painted.
    root.style.scrollBehavior = 'auto';
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    root.scrollTop = 0;
    document.body.scrollTop = 0;

    const frame = window.requestAnimationFrame(() => {
      root.style.scrollBehavior = previousInlineBehavior;
    });

    return () => {
      window.cancelAnimationFrame(frame);
      root.style.scrollBehavior = previousInlineBehavior;
    };
  }, [location.pathname]);

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
