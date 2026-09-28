import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Check,
  ChevronDown,
  Compass,
  LogOut,
  MapPinned,
  Plus,
  ShieldCheck,
  Trophy,
  UserRound
} from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { REGION_PRESETS } from '../mapConfig.js';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '../services/api.js';

const navItems = [
  { to: '/map', label: 'Khám phá', icon: Compass, includeHome: true },
  { to: '/leaderboard', label: 'Cộng đồng', icon: Trophy },
  { to: '/profile', label: 'Explorer', icon: UserRound }
];

function notificationTarget(item) {
  if (item?.data?.contributionType === 'REPORT_CLOSED') return '/profile';
  if (item?.data?.placeId) return '/place/' + item.data.placeId;
  if (item?.data?.contributionId) return '/profile';
  return '/profile';
}

export default function Navbar() {
  const { user, logout, isModerator } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [regionOpen, setRegionOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const regionRef = useRef(null);
  const notificationRef = useRef(null);

  const params = new URLSearchParams(location.search);
  const regionId = params.get('region') || 'all';
  const activeRegion = REGION_PRESETS.find((item) => item.id === regionId) || REGION_PRESETS[0];

  const handleLogout = () => {
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
    function onPointerDown(event) {
      if (regionRef.current && !regionRef.current.contains(event.target)) {
        setRegionOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function chooseRegion(region) {
    setRegionOpen(false);
    const next = new URLSearchParams(location.pathname === '/map' ? location.search : '');
    next.set('region', region.id);
    navigate('/map?' + next.toString());
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

  return (
    <header className="navbar premium-navbar modern-blue-navbar reference-navbar">
      <Link className="brand premium-brand" to="/">
        <span className="brand-mark"><MapPinned size={24}/></span>
        <span className="brand-copy"><strong>Hola Maps</strong><small>LOCAL DISCOVERY</small></span>
      </Link>

      <nav className="desktop-nav premium-desktop-nav">
        {navItems.map(({to,label,icon:Icon,includeHome}) => (
          <NavLink
            key={to}
            to={to}
            className={({isActive}) =>
              (isActive || (includeHome && location.pathname === '/'))
                ? 'nav-link active'
                : 'nav-link'}
          >
            <Icon size={16}/>{label}
          </NavLink>
        ))}
        {isModerator && (
          <NavLink className="nav-link" to="/admin">
            <ShieldCheck size={16}/>Admin
          </NavLink>
        )}
      </nav>

      <div className="nav-actions premium-nav-actions">
        <div className="nav-region-control" ref={regionRef}>
          <button
            className="location-pill"
            type="button"
            onClick={() => setRegionOpen((value) => !value)}
            aria-expanded={regionOpen}
          >
            <MapPinned size={15}/>
            {activeRegion.label}
            <ChevronDown size={14}/>
          </button>

          {regionOpen && (
            <div className="nav-region-menu">
              <span>Khám phá khu vực</span>
              {REGION_PRESETS.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  className={region.id === activeRegion.id ? 'active' : ''}
                  onClick={() => chooseRegion(region)}
                >
                  <span>{region.label}</span>
                  {region.id === activeRegion.id && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <Link className="nav-cta" to="/contribute"><Plus size={17}/>Đóng góp</Link>

        {user && (
          <div className="nav-notification-control" ref={notificationRef}>
            <button
              className="nav-notification-button"
              type="button"
              onClick={() => setNotificationsOpen((value) => !value)}
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
          <button className="nav-user" type="button" onClick={handleLogout}>
            <span className="nav-user-avatar">{user.name?.[0] || 'U'}</span><LogOut size={15}/>
          </button>
        ) : (
          <Link className="nav-login" to="/login">Đăng nhập</Link>
        )}
      </div>
    </header>
  );
}
