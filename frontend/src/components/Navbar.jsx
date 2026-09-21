import { Compass, LogOut, MapPinned, Plus, ShieldCheck, Trophy, UserRound } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const navItems = [
  { to: '/map', label: 'Khám phá', icon: Compass },
  { to: '/leaderboard', label: 'Cộng đồng', icon: Trophy },
  { to: '/profile', label: 'Explorer', icon: UserRound }
];

export default function Navbar() {
  const { user, logout, isModerator } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <header className="navbar premium-navbar">
      <Link className="brand premium-brand" to="/" aria-label="Hola Maps - Trang chủ">
        <span className="brand-mark"><MapPinned size={21} /></span>
        <span className="brand-copy">
          <strong>HOLA <b>MAPS</b></strong>
          <small>Local discovery</small>
        </span>
      </Link>

      <nav className="desktop-nav premium-desktop-nav" aria-label="Điều hướng chính">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
        {isModerator && (
          <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <ShieldCheck size={17} /> Admin
          </NavLink>
        )}
      </nav>

      <div className="nav-actions premium-nav-actions">
        <span className="nav-live-status"><span className="live-dot" /> Hòa Lạc</span>

        <Link className="nav-cta" to="/contribute">
          <Plus size={18} />
          Đóng góp
        </Link>

        {user ? (
          <button className="nav-user" type="button" onClick={handleLogout} title="Đăng xuất">
            <span className="nav-user-avatar">{user.name?.charAt(0)?.toUpperCase() || 'U'}</span>
            <span>{user.name?.split(' ')[0] || 'Explorer'}</span>
            <LogOut size={15} />
          </button>
        ) : (
          <Link className="nav-login" to="/login">Đăng nhập</Link>
        )}
      </div>
    </header>
  );
}
