import { ChevronDown, Compass, LogOut, MapPinned, Plus, ShieldCheck, Trophy, UserRound } from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const navItems = [
  { to: '/map', label: 'Khám phá', icon: Compass, includeHome: true },
  { to: '/leaderboard', label: 'Cộng đồng', icon: Trophy },
  { to: '/profile', label: 'Explorer', icon: UserRound }
];

export default function Navbar() {
  const { user, logout, isModerator } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const handleLogout = () => { logout(); navigate('/'); };

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
            className={({isActive}) => (isActive || (includeHome && location.pathname === '/')) ? 'nav-link active' : 'nav-link'}
          >
            <Icon size={16}/>{label}
          </NavLink>
        ))}
        {isModerator && <NavLink className="nav-link" to="/admin"><ShieldCheck size={16}/>Admin</NavLink>}
      </nav>
      <div className="nav-actions premium-nav-actions">
        <button className="location-pill" type="button"><MapPinned size={15}/>Hòa Lạc<ChevronDown size={14}/></button>
        <Link className="nav-cta" to="/contribute"><Plus size={17}/>Đóng góp</Link>
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
