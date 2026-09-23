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
const MapEditor = lazy(() => import('./pages/admin/MapEditor.jsx'));

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

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: withSuspense(HomePage) },
      { path: 'map', element: withSuspense(MapPage) },
      { path: 'place/:id', element: withSuspense(PlaceDetail) },
      { path: 'contribute', element: withSuspense(Contribute) },
      { path: 'profile', element: withRole(ProfilePage) },
      { path: 'leaderboard', element: withSuspense(Leaderboard) },
      { path: 'login', element: withSuspense(Login) },
      { path: 'register', element: withSuspense(Register) },
      { path: 'admin', element: withRole(AdminDashboard, ['MODERATOR', 'ADMIN']) },
      { path: 'admin/contributions', element: withRole(AdminContributions, ['MODERATOR', 'ADMIN']) },
      { path: 'admin/map-editor', element: withRole(MapEditor, ['MODERATOR', 'ADMIN']) }
    ]
  }
]);
