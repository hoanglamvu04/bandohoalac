import { Home, Map, Plus, Trophy, UserRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const items = [
  ['/', 'Trang chủ', Home],
  ['/map', 'Bản đồ', Map],
  ['/contribute', 'Đóng góp', Plus],
  ['/leaderboard', 'Xếp hạng', Trophy],
  ['/profile', 'Tôi', UserRound]
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Điều hướng di động">
      {items.map(([to, label, Icon]) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'bottom-link active' : 'bottom-link'}>
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
