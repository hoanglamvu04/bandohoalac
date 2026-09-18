import { Compass, MapPinned, Plus, Trophy, UserRound } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';

const navItems = [
  { to: '/map', label: 'Khám phá', icon: Compass },
  { to: '/leaderboard', label: 'Cộng đồng', icon: Trophy },
  { to: '/profile', label: 'Explorer', icon: UserRound }
];

export default function Navbar() {
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
      </nav>

      <Link className="nav-cta" to="/contribute">
        <Plus size={18} />
        Đóng góp địa điểm
      </Link>
    </header>
  );
}
