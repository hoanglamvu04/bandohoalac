import { useEffect, useRef, useState } from 'react';
import {
  BadgeCheck,
  Bell,
  Building2,
  ChevronDown,
  Compass,
  Download,
  LogOut,
  MapPinned,
  Home,
  Plus,
  Search,
  ShieldCheck,
  Trophy,
  UserRound,
  UtensilsCrossed
} from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useBrand } from '../context/BrandContext.jsx';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '../services/api.js';

const navItems = [
  { to: '/map', label: 'Bản đồ', icon: MapPinned },
  { to: '/phong-tro', label: 'Phòng trọ', icon: Home },
  { to: '/an-uong', label: 'Ăn uống', icon: UtensilsCrossed },
  { to: '/kham-pha', label: 'Khám phá', icon: Compass },
  { to: '/leaderboard', label: 'Cộng đồng', icon: Trophy }
];

function notificationTarget(item) {
  if (item?.data?.contributionType === 'REPORT_CLOSED') return '/profile';
  if (item?.data?.placeId) return '/place/' + item.data.placeId;
  if (item?.data?.contributionId) return '/profile';
  return '/profile';
}

export default function Navbar() {
  const { user, logout, isModerator } = useAuth();
  const { brand } = useBrand();
  const navigate = useNavigate();
  const location = useLocation();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false);
  const [homeSearch, setHomeSearch] = useState('');
  const [homeHeaderScrolled, setHomeHeaderScrolled] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(() =>
    typeof window !== 'undefined' && (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator?.standalone === true
    )
  );
  const notificationRef = useRef(null);
  const mobileAccountRef = useRef(null);
  const desktopAccountRef = useRef(null);

  const partnerMemberships = user?.partnerAccess?.memberships || [];
  const isPartnerStaffOnly = partnerMemberships.length > 0
    && partnerMemberships.every((membership) => membership.role === 'STAFF');
  const partnerTarget = isPartnerStaffOnly ? '/partner/scanner' : '/partner';

  const isHome = location.pathname === '/';
  const accountInitial = String(user?.name || user?.email || 'U').trim().charAt(0).toUpperCase();

  const handleLogout = () => {
    setNotificationsOpen(false);
    setMobileAccountOpen(false);
    logout();
    setNotifications([]);
    setUnreadCount(0);
    navigate('/');
  };

  function loadNotifications() {
    if (!user) return;
    getNotifications({ limit: 8 })
      .then((data) => {
        setNotifications(Array.isArray(data?.items) ? data.items : []);
        setUnreadCount(Number(data?.unreadCount) || 0);
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadNotifications();
    if (!user) return undefined;

    const timer = window.setInterval(loadNotifications, 60000);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  useEffect(() => {
    function onBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    function onAppInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!isHome || typeof window === 'undefined') {
      setHomeHeaderScrolled(false);
      return undefined;
    }

    function syncHomeHeader() {
      const hero = document.querySelector('.reference-home-hero');
      const scrolled = hero
        ? hero.getBoundingClientRect().bottom <= 92
        : window.scrollY > 320;
      setHomeHeaderScrolled(scrolled);
    }

    syncHomeHeader();
    window.addEventListener('scroll', syncHomeHeader, { passive: true });
    window.addEventListener('resize', syncHomeHeader);

    return () => {
      window.removeEventListener('scroll', syncHomeHeader);
      window.removeEventListener('resize', syncHomeHeader);
    };
  }, [isHome]);

  useEffect(() => {
    function onPointerDown(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }

      const insideMobileAccount = mobileAccountRef.current?.contains(event.target);
      const insideDesktopAccount = desktopAccountRef.current?.contains(event.target);
      if (!insideMobileAccount && !insideDesktopAccount) {
        setMobileAccountOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    setNotificationsOpen(false);
    setMobileAccountOpen(false);
  }, [location.pathname]);

  function submitHomeHeaderSearch(event) {
    event.preventDefault();
    const needle = homeSearch.trim();
    navigate('/map' + (needle ? '?q=' + encodeURIComponent(needle) : ''));
  }

  async function openNotification(item) {
    if (!item.readAt) {
      try {
        await markNotificationRead(item.id);
        setUnreadCount((current) => Math.max(0, current - 1));
        setNotifications((current) =>
          current.map((notification) =>
            notification.id === item.id
              ? { ...notification, readAt: new Date().toISOString() }
              : notification
          )
        );
      } catch {
        // Navigation should still work if marking as read fails.
      }
    }

    setNotificationsOpen(false);
    navigate(notificationTarget(item));
  }

  async function installApp() {
    if (!installPrompt) return;

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setInstalled(true);
      }
    } finally {
      setInstallPrompt(null);
      setMobileAccountOpen(false);
    }
  }

  async function markAllRead() {
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          readAt: item.readAt || new Date().toISOString()
        }))
      );
    } catch {
      // Keep dropdown usable even when the request fails.
    }
  }

  function renderAccountMenu(className) {
    if (!user || !mobileAccountOpen) return null;

    return (
      <div className={className}>
        <div className="compact-account-summary">
          <span className="compact-account-avatar">{accountInitial}</span>
          <div>
            <b>{user.name || 'Thành viên Hola Maps'}</b>
            <small>{user.email || 'Tài khoản Hola Maps'}</small>
          </div>
        </div>

        <Link to="/profile" onClick={() => setMobileAccountOpen(false)}>
          <UserRound size={16} />
          Trang cá nhân
        </Link>
        <Link to="/verify" onClick={() => setMobileAccountOpen(false)}>
          <BadgeCheck size={16} />
          Xác minh cộng đồng
        </Link>
        {user?.partnerAccess?.hasAccess && (
          <Link to={partnerTarget} onClick={() => setMobileAccountOpen(false)}>
            <Building2 size={16} />
            {isPartnerStaffOnly ? 'Máy quét Partner' : 'Partner Portal'}
          </Link>
        )}
        {isModerator && (
          <Link to="/admin" onClick={() => setMobileAccountOpen(false)}>
            <ShieldCheck size={16} />
            Quản trị
          </Link>
        )}
        <button className="compact-account-logout" type="button" onClick={handleLogout}>
          <LogOut size={16} />
          Đăng xuất
        </button>
      </div>
    );
  }

  return (
    <header
      className={[
        'navbar premium-navbar modern-blue-navbar reference-navbar compact-product-navbar balanced-product-navbar',
        isHome ? 'home-navbar' : '',
        isHome && homeHeaderScrolled ? 'home-navbar-scrolled' : ''
      ].filter(Boolean).join(' ')}
      style={{
        '--brand-header-desktop-width': brand.headerLogoDesktopWidth + 'px',
        '--brand-header-mobile-width': brand.headerLogoMobileWidth + 'px',
        '--brand-header-compact-width': brand.headerLogoCompactWidth + 'px'
      }}
    >
      <Link className="brand premium-brand brand-official" to="/" aria-label="Hola Maps">
        <span className="brand-official-lockup">
          <img className="brand-official-logo brand-logo-main" src={brand.headerLogoUrl} alt="Hola Maps" />
          <img className="brand-official-logo brand-logo-compact" src={brand.compactLogoUrl} alt="Hola Maps" />
        </span>
      </Link>

      {isHome && (
        <form className="mobile-home-search" onSubmit={submitHomeHeaderSearch}>
          <Search size={16} />
          <input
            value={homeSearch}
            onChange={(event) => setHomeSearch(event.target.value)}
            placeholder="Tìm ở Hòa Lạc..."
            aria-label="Tìm địa điểm ở Hòa Lạc"
          />
        </form>
      )}

      <nav className="desktop-nav premium-desktop-nav compact-primary-nav">
        {navItems.map(({to,label,icon:Icon}) => (
          <NavLink
            key={to}
            to={to}
            className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}
          >
            <Icon size={16}/>{label}
          </NavLink>
        ))}
      </nav>

      <div className="nav-actions premium-nav-actions compact-nav-actions">
        <Link className="nav-partner-entry" to="/doi-tac"><Building2 size={16}/>Đối tác</Link>
        <Link className="nav-cta" to="/contribute"><Plus size={17}/>Đóng góp</Link>

        {!installed && installPrompt && (
          <button className="nav-install compact-install-button" type="button" onClick={installApp}>
            <Download size={16} />
            <span>Cài app</span>
          </button>
        )}

        {user && (
          <div className="nav-notification-control" ref={notificationRef}>
            <button
              className="nav-notification-button"
              type="button"
              onClick={() => {
                setMobileAccountOpen(false);
                setNotificationsOpen((value) => !value);
              }}
              aria-label="Thông báo"
            >
              <Bell size={18} />
              {unreadCount > 0 && <span>{Math.min(unreadCount, 99)}</span>}
            </button>

            {notificationsOpen && (
              <div className="nav-notification-menu">
                <div className="nav-notification-head">
                  <div><b>Thông báo</b><span>{unreadCount} chưa đọc</span></div>
                  {unreadCount > 0 && <button type="button" onClick={markAllRead}>Đọc tất cả</button>}
                </div>

                {!notifications.length ? (
                  <div className="nav-notification-empty">Chưa có thông báo mới.</div>
                ) : (
                  notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={item.readAt ? 'nav-notification-item' : 'nav-notification-item unread'}
                      onClick={() => openNotification(item)}
                    >
                      <i />
                      <span>
                        <b>{item.title}</b>
                        <p>{item.message}</p>
                        <small>{new Date(item.createdAt).toLocaleString('vi-VN')}</small>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {user ? (
          <div className="desktop-account-control desktop-account-menu-control" ref={desktopAccountRef}>
            <button
              className="nav-user compact-account-button"
              type="button"
              onClick={() => {
                setNotificationsOpen(false);
                setMobileAccountOpen((value) => !value);
              }}
              aria-label="Mở tài khoản"
              aria-expanded={mobileAccountOpen}
            >
              <span className="nav-user-avatar">{accountInitial}</span>
              <ChevronDown size={14}/>
            </button>
            {renderAccountMenu('desktop-account-menu')}
          </div>
        ) : (
          <Link className="nav-login desktop-account-control" to="/login">Đăng nhập</Link>
        )}

        <div className="mobile-account-control" ref={mobileAccountRef}>
          <button
            className="mobile-account-button"
            type="button"
            onClick={() => {
              if (!user) {
                navigate('/login');
                return;
              }
              setNotificationsOpen(false);
              setMobileAccountOpen((value) => !value);
            }}
            aria-label={user ? 'Mở tài khoản' : 'Đăng nhập'}
            aria-expanded={user ? mobileAccountOpen : undefined}
          >
            {user ? <span>{accountInitial}</span> : <UserRound size={18} />}
          </button>

          {renderAccountMenu('mobile-account-menu compact-mobile-account-menu')}
        </div>
      </div>
    </header>
  );
}
