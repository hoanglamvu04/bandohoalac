import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import RequireRole from './components/RequireRole.jsx';

const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const MapPage = lazy(() => import('./pages/MapPage.jsx'));
const PlaceDetail = lazy(() => import('./pages/PlaceDetail.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const Leaderboard = lazy(() => import('./pages/Leaderboard.jsx'));
const Contribute = lazy(() => import('./pages/Contribute.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const AdminContributions = lazy(() => import('./pages/admin/AdminContributions.jsx'));
const AdminDataTrust = lazy(() => import('./pages/admin/AdminDataTrust.jsx'));
const AdminCtvManagement = lazy(() => import('./pages/admin/AdminCtvManagement.jsx'));
const MapEditor = lazy(() => import('./pages/admin/MapEditor.jsx'));
const AdminPlaces = lazy(() => import('./pages/admin/AdminPlaces.jsx'));
const AdminPlaceImports = lazy(() => import('./pages/admin/AdminPlaceImports.jsx'));
const AdminAdvertisements = lazy(() => import('./pages/admin/AdminAdvertisements.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers.jsx'));
const AdminReputation = lazy(() => import('./pages/admin/AdminReputation.jsx'));
const AdminPartnersRewards = lazy(() => import('./pages/admin/AdminPartnersRewards.jsx'));
const RewardsPage = lazy(() => import('./pages/RewardsPage.jsx'));
const MissionsPage = lazy(() => import('./pages/MissionsPage.jsx'));
const ClaimPlacePage = lazy(() => import('./pages/ClaimPlacePage.jsx'));
const PartnerDashboard = lazy(() => import('./pages/PartnerDashboard.jsx'));
const PartnerScanner = lazy(() => import('./pages/PartnerScanner.jsx'));
const AdminMissions = lazy(() => import('./pages/admin/AdminMissions.jsx'));
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit.jsx'));
const AdminBranding = lazy(() => import('./pages/admin/AdminBranding.jsx'));
const AdminDeveloperApi = lazy(() => import('./pages/admin/AdminDeveloperApi.jsx'));
const DeveloperDocs = lazy(() => import('./pages/DeveloperDocs.jsx'));

function LoadingPage() {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'grid',
      placeItems: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#102f29'
    }}>
      Đang tải Hola Maps...
    </div>
  );
}

function withSuspense(Page) {
  return (
    <Suspense fallback={<LoadingPage />}>
      <Page />
    </Suspense>
  );
}

function withRole(Page, roles) {
  return (
    <RequireRole roles={roles}>
      <Suspense fallback={<LoadingPage />}>
        <Page />
      </Suspense>
    </RequireRole>
  );
}

function RouteError() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: 24,
      background: '#f7f3ea',
      color: '#102f29',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: 620 }}>
        <h1>Hola Maps gặp lỗi khi tải trang.</h1>
        <p>Hãy mở Console để xem lỗi chi tiết hoặc quay lại trang chủ.</p>
        <a href="/" style={{ color: '#102f29', fontWeight: 800 }}>Về trang chủ</a>
      </div>
    </div>
  );
}

const STAFF_ROLES = ['CTV', 'MODERATOR', 'ADMIN'];

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: withSuspense(HomePage) },
      { path: 'map', element: withSuspense(MapPage) },
      { path: 'embed', element: withSuspense(MapPage) },
      { path: 'place/:id', element: withSuspense(PlaceDetail) },
      { path: 'contribute', element: withSuspense(Contribute) },
      { path: 'profile', element: withRole(ProfilePage) },
      { path: 'leaderboard', element: withSuspense(Leaderboard) },
      { path: 'rewards', element: withSuspense(RewardsPage) },
      { path: 'missions', element: withSuspense(MissionsPage) },
      { path: 'claim-place/:id', element: withRole(ClaimPlacePage) },
      { path: 'partner', element: withRole(PartnerDashboard) },
      { path: 'partner/scanner', element: withRole(PartnerScanner) },
      { path: 'login', element: withSuspense(Login) },
      { path: 'register', element: withSuspense(Register) },
      { path: 'developers', element: withSuspense(DeveloperDocs) },
      { path: 'admin', element: withRole(AdminDashboard, STAFF_ROLES) },
      { path: 'admin/contributions', element: withRole(AdminContributions, STAFF_ROLES) },
      { path: 'admin/data-quality', element: withRole(AdminDataTrust, STAFF_ROLES) },
      { path: 'admin/places', element: withRole(AdminPlaces, STAFF_ROLES) },
      { path: 'admin/place-imports', element: withRole(AdminPlaceImports, STAFF_ROLES) },
      { path: 'admin/map-editor', element: withRole(MapEditor, ['MODERATOR', 'ADMIN']) },
      { path: 'admin/ctv', element: withRole(AdminCtvManagement, ['ADMIN']) },
      { path: 'admin/ads', element: withRole(AdminAdvertisements, ['ADMIN']) },
      { path: 'admin/users', element: withRole(AdminUsers, ['ADMIN']) },
      { path: 'admin/reputation', element: withRole(AdminReputation, ['ADMIN']) },
      { path: 'admin/partners', element: withRole(AdminPartnersRewards, ['ADMIN']) },
      { path: 'admin/missions', element: withRole(AdminMissions, ['ADMIN']) },
      { path: 'admin/audit', element: withRole(AdminAudit, ['ADMIN']) },
      { path: 'admin/brand', element: withRole(AdminBranding, ['ADMIN']) },
      { path: 'admin/developer-api', element: withRole(AdminDeveloperApi, ['ADMIN']) }
    ]
  }
]);
