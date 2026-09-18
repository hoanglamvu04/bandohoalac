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
    <header className="navbar">
      <Link className="brand" to="/" aria-label="Hola Maps - Trang chủ">
        <span className="brand-mark"><MapPinned size={21} /></span>
        <span>HOLA <b>MAPS</b></span>
      </Link>

      <nav className="desktop-nav" aria-label="Điều hướng chính">
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

      <div className="nav-actions">
        <Link className="nav-cta" to="/contribute">
          <Plus size={18} />
          Đóng góp địa điểm
        </Link>

        {user ? (
          <button className="nav-user" type="button" onClick={handleLogout} title="Đăng xuất">
            <UserRound size={16} /> {user.name.split(' ')[0]} <LogOut size={15} />
          </button>
        ) : (
          <Link className="nav-login" to="/login">Đăng nhập</Link>
        )}
      </div>
    </header>
  );
}
