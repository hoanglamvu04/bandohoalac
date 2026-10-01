import { Building2, Home, Map, Plus, ShieldCheck, Trophy, UserRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function BottomNav() {
  const { user, isModerator } = useAuth();
  const partnerMemberships = user?.partnerAccess?.memberships || [];
  const isPartnerStaffOnly = partnerMemberships.length > 0
    && partnerMemberships.every((membership) => membership.role === 'STAFF');
  const partnerTarget = isPartnerStaffOnly ? '/partner/scanner' : '/partner';

  const items = [
    ['/', 'Trang chủ', Home],
    ['/map', 'Bản đồ', Map],
    ['/contribute', 'Đóng góp', Plus],
    isModerator
      ? ['/admin', 'Admin', ShieldCheck]
      : user?.partnerAccess?.hasAccess
        ? [partnerTarget, isPartnerStaffOnly ? 'Scanner' : 'Partner', Building2]
        : ['/leaderboard', 'Xếp hạng', Trophy],
    [user ? '/profile' : '/login', user ? 'Tôi' : 'Đăng nhập', UserRound]
  ];

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
