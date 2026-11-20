import { Building2, Home, Map, Plus, ShieldCheck, Trophy, UserRound } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function BottomNav() {
  const { user, isModerator } = useAuth();
  const location = useLocation();
  const isHousingMap = location.pathname === '/map'
    && new URLSearchParams(location.search).get('vertical') === 'housing';
  const isEstateSubmission = location.pathname === '/dang-tin-bat-dong-san';
  const showEstateAction = isHousingMap || isEstateSubmission;
  const partnerMemberships = user?.partnerAccess?.memberships || [];
  const isPartnerStaffOnly = partnerMemberships.length > 0
    && partnerMemberships.every((membership) => membership.role === 'STAFF');
  const partnerTarget = isPartnerStaffOnly ? '/partner/scanner' : '/partner';

  const items = [
    ['/', 'Trang chủ', Home],
    ['/map', 'Bản đồ', Map],
    showEstateAction
      ? ['/dang-tin-bat-dong-san', 'Đăng tin', Building2]
      : ['/contribute', 'Đóng góp', Plus],
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
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => [
            'bottom-link',
            isActive ? 'active' : '',
            to === '/dang-tin-bat-dong-san' ? 'bottom-estate-entry' : ''
          ].filter(Boolean).join(' ')}
        >
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
