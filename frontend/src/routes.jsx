import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import RequireRole from './components/RequireRole.jsx';
import './route-error.css';

const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const MapPage = lazy(() => import('./pages/MapDiscoveryPage.jsx'));
const HaloHolaMapPage = lazy(() => import('./pages/HaloHolaMapPage.jsx'));
const LocationPickerPage = lazy(() => import('./pages/LocationPickerPage.jsx'));
const PlaceDetail = lazy(() => import('./pages/PlaceDetailV2.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const Leaderboard = lazy(() => import('./pages/Leaderboard.jsx'));
const Contribute = lazy(() => import('./pages/Contribute.jsx'));
const CommunityVerification = lazy(() => import('./pages/CommunityVerification.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const PublicInfoPage = lazy(() => import('./pages/PublicInfoPage.jsx'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const AdminContributions = lazy(() => import('./pages/admin/AdminContributions.jsx'));
const AdminDataQualityV3 = lazy(() => import('./pages/admin/AdminDataQualityV3.jsx'));
const AdminHaloSync = lazy(() => import('./pages/admin/AdminHaloSync.jsx'));
const AdminCtvManagement = lazy(() => import('./pages/admin/AdminCtvManagement.jsx'));
const MapEditor = lazy(() => import('./pages/admin/MapEditor.jsx'));
const AdminPlaces = lazy(() => import('./pages/admin/AdminPlaces.jsx'));
const AdminCoverageCleanup = lazy(() => import('./pages/admin/AdminCoverageCleanup.jsx'));
const AdminPlaceImports = lazy(() => import('./pages/admin/AdminPlaceImports.jsx'));
const AdminPhotoScanner = lazy(() => import('./pages/admin/AdminPhotoScanner.jsx'));
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
const ExplorePage = lazy(() => import('./pages/ExplorePage.jsx'));
const ExploreArticlePage = lazy(() => import('./pages/ExploreArticlePage.jsx'));
const LocalMarketplacePage = lazy(() => import('./pages/LocalMarketplacePage.jsx'));
const PartnerLandingPage = lazy(() => import('./pages/PartnerLandingPage.jsx'));
const ContributorHubPage = lazy(() => import('./pages/ContributorHubPage.jsx'));

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
    <main className="hm-route-error" role="main">
      <section className="hm-route-error__card" aria-labelledby="hm-route-error-title">
        <div className="hm-route-error__brand" aria-label="Hola Maps">
          <span className="hm-route-error__brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="10" r="2.2" fill="currentColor" />
            </svg>
          </span>
          HOLA MAPS
        </div>

        <div className="hm-route-error__icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" fill="none">
            <path d="m7.5 12.5 10-4 13 4 10-4v27l-10 4-13-4-10 4v-27Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M17.5 8.5v27M30.5 12.5v27" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M12 21c3-3 5.5-3 8.5-.5 3 2.6 5.5 2.6 8.5 0 2.8-2.4 5.2-2.5 8-.6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          <span className="hm-route-error__icon-dot">!</span>
        </div>

        <div className="hm-route-error__eyebrow">Không thể tải trang</div>
        <h1 id="hm-route-error-title">Hola Maps đang gặp chút sự cố.</h1>
        <p className="hm-route-error__description">
          Trang này chưa thể hiển thị ngay lúc này. Bạn có thể thử tải lại hoặc quay về trang chủ để tiếp tục khám phá Hòa Lạc.
        </p>

        <div className="hm-route-error__actions">
          <button
            type="button"
            className="hm-route-error__button hm-route-error__button--primary"
            onClick={() => window.location.reload()}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 11a8 8 0 1 0-2.34 5.66" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M20 5v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Thử tải lại
          </button>
          <a className="hm-route-error__button hm-route-error__button--secondary" href="/">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m3 11 9-7 9 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 10v10h14V10M9 20v-6h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Về trang chủ
          </a>
        </div>

        <div className="hm-route-error__footnote">
          <span aria-hidden="true" />
          Không cần thao tác kỹ thuật — hãy thử lại sau ít phút nếu lỗi vẫn còn.
        </div>
      </section>
    </main>
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
      { path: 'phong-tro', element: withSuspense(LocalMarketplacePage) },
      { path: 'an-uong', element: withSuspense(LocalMarketplacePage) },
      { path: 'doi-tac', element: withSuspense(PartnerLandingPage) },
      { path: 'cong-tac-vien', element: withSuspense(ContributorHubPage) },
      { path: 'kham-pha', element: withSuspense(ExplorePage) },
      { path: 'kham-pha/:slug', element: withSuspense(ExploreArticlePage) },
      { path: 'halo', element: withSuspense(HaloHolaMapPage) },
      // Embed uses the same discovery stack as /map so HALO HOLA receives
      // every mobile map capability without maintaining a second UI.
      { path: 'embed', element: withSuspense(MapPage) },
      // HALO HOLA artwork/check-in layer also has an embed-safe route so the
      // user stays inside the HALO HOLA iframe instead of opening native chrome.
      { path: 'embed/halo', element: withSuspense(HaloHolaMapPage) },
      { path: 'picker', element: withSuspense(LocationPickerPage) },
      { path: 'embed/picker', element: withSuspense(LocationPickerPage) },
      { path: 'place/:id', element: withSuspense(PlaceDetail) },
      { path: 'contribute', element: withSuspense(Contribute) },
      { path: 'verify', element: withRole(CommunityVerification) },
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
      { path: 'huong-dan', element: withSuspense(PublicInfoPage) },
      { path: 'quy-dinh-cong-dong', element: withSuspense(PublicInfoPage) },
      { path: 'dieu-khoan', element: withSuspense(PublicInfoPage) },
      { path: 'quyen-rieng-tu', element: withSuspense(PublicInfoPage) },
      { path: 'nguon-du-lieu', element: withSuspense(PublicInfoPage) },
      { path: 'admin', element: withRole(AdminDashboard, STAFF_ROLES) },
      { path: 'admin/contributions', element: withRole(AdminContributions, STAFF_ROLES) },
      { path: 'admin/data-quality', element: withRole(AdminDataQualityV3, STAFF_ROLES) },
      { path: 'admin/places', element: withRole(AdminPlaces, STAFF_ROLES) },
      { path: 'admin/coverage-cleanup', element: withRole(AdminCoverageCleanup, ['ADMIN']) },
      { path: 'admin/place-imports', element: withRole(AdminPlaceImports, STAFF_ROLES) },
      { path: 'admin/photo-scanner', element: withRole(AdminPhotoScanner, STAFF_ROLES) },
      { path: 'admin/map-editor', element: withRole(MapEditor, ['MODERATOR', 'ADMIN']) },
      { path: 'admin/ctv', element: withRole(AdminCtvManagement, ['ADMIN']) },
      { path: 'admin/ads', element: withRole(AdminAdvertisements, ['ADMIN']) },
      { path: 'admin/users', element: withRole(AdminUsers, ['ADMIN']) },
      { path: 'admin/reputation', element: withRole(AdminReputation, ['ADMIN']) },
      { path: 'admin/partners', element: withRole(AdminPartnersRewards, ['ADMIN']) },
      { path: 'admin/missions', element: withRole(AdminMissions, ['ADMIN']) },
      { path: 'admin/audit', element: withRole(AdminAudit, ['ADMIN']) },
      { path: 'admin/brand', element: withRole(AdminBranding, ['ADMIN']) },
      { path: 'admin/halo-sync', element: withRole(AdminHaloSync, ['ADMIN']) },
      { path: 'admin/developer-api', element: withRole(AdminDeveloperApi, ['ADMIN']) }
    ]
  }
]);