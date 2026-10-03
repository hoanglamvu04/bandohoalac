import { useEffect, useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import BottomNav from './components/BottomNav.jsx';
import Footer from './components/Footer.jsx';

export default function App() {
  const location = useLocation();
  const isMapRoute = location.pathname === '/map';
  const isProfileRoute = location.pathname === '/profile';
  const isPartnerScannerRoute = location.pathname === '/partner/scanner';

  useEffect(() => {
    document.body.classList.toggle('map-route-active', isMapRoute);
    return () => document.body.classList.remove('map-route-active');
  }, [isMapRoute]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const root = document.documentElement;
    let frame = 0;
    let observer = null;

    const isVisible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    };

    const syncSafeViewport = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const header = document.querySelector('.navbar');
        const bottomNav = document.querySelector('.bottom-nav');
        const visualViewport = window.visualViewport;

        const visualTop = Math.max(0, Number(visualViewport?.offsetTop) || 0);
        const visualHeight = Number(visualViewport?.height) || window.innerHeight;
        const visualBottom = Math.max(
          0,
          window.innerHeight - (visualTop + visualHeight)
        );

        const headerBottom = isVisible(header)
          ? Math.max(0, header.getBoundingClientRect().bottom)
          : 0;

        const bottomNavTop = isVisible(bottomNav)
          ? bottomNav.getBoundingClientRect().top
          : window.innerHeight;
        const bottomNavInset = isVisible(bottomNav)
          ? Math.max(0, window.innerHeight - bottomNavTop)
          : 0;

        root.style.setProperty(
          '--app-safe-top',
          Math.max(visualTop, headerBottom) + 'px'
        );
        root.style.setProperty(
          '--app-safe-bottom',
          Math.max(visualBottom, bottomNavInset) + 'px'
        );
        root.style.setProperty('--app-visual-height', visualHeight + 'px');
      });
    };

    syncSafeViewport();

    if ('ResizeObserver' in window) {
      observer = new ResizeObserver(syncSafeViewport);
      const header = document.querySelector('.navbar');
      const bottomNav = document.querySelector('.bottom-nav');
      if (header) observer.observe(header);
      if (bottomNav) observer.observe(bottomNav);
    }

    window.addEventListener('resize', syncSafeViewport, { passive: true });
    window.visualViewport?.addEventListener('resize', syncSafeViewport, { passive: true });
    window.visualViewport?.addEventListener('scroll', syncSafeViewport, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', syncSafeViewport);
      window.visualViewport?.removeEventListener('resize', syncSafeViewport);
      window.visualViewport?.removeEventListener('scroll', syncSafeViewport);
    };
  }, [location.pathname]);

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
      isProfileRoute ? 'profile-app-shell' : '',
      isPartnerScannerRoute ? 'partner-scanner-app-shell' : ''
    ].filter(Boolean).join(' ')}>
      {!isPartnerScannerRoute && <Navbar />}

      <main className={[
        'app-main',
        isMapRoute ? 'map-app-main' : '',
        isPartnerScannerRoute ? 'partner-scanner-app-main' : ''
      ].filter(Boolean).join(' ')}>
        <Outlet />
      </main>

      {!isMapRoute && !isPartnerScannerRoute && <Footer />}
      {!isPartnerScannerRoute && <BottomNav />}
    </div>
  );
}
