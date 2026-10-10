import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { BrandProvider } from './context/BrandContext.jsx';
import MapPowerOverlay from './components/MapPowerOverlay.jsx';
import { registerHolaPwa } from './pwa.js';
import './style.css';
import './premium.css';
import './modern-ui.css';
import './map-fix.css';
import './directions.css';
import './map-workspace.css';
import './footer.css';
import './community.css';
import './hola-ui-overhaul.css';
import './hola-home-redesign.css';
import './hola-blue-modern.css';
import './hola-home-modern.css';
import './category-modern.css';
import './hero-search-modern.css';
import './hero-map-polish.css';
import './home-reference.css';
import './advertisements.css';
import './community-rewards.css';
import './mobile-detail.css';
import './mobile-contribute.css';
import './mobile-profile.css';
import './mobile-community.css';
import './mobile-admin-places.css';
import './mobile-final-pass.css';
import './brand-management.css';
import './admin-control-center.css';
import './profile-white-dashboard.css';
import './partner-scanner.css';
import './admin-readability.css';
import './admin-place-imports.css';
import './developer-api.css';
import './reputation-v2.css';
import './reputation-v21.css';
import './reputation-v22.css';
import './reputation-v23.css';
import './community-verification.css';
import './community-verification-admin.css';
import './mobile-header-menu.css';
import './home-community-cleanup.css';
import './community-location-polish.css';
import './photo-scanner.css';
import './integration-secrets.css';
import './halo-hola-map.css';
import './discovery-v1.css';
import './map-power-v3.css';

createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <BrandProvider>
      <AuthProvider>
        <RouterProvider router={router} />
        <MapPowerOverlay />
      </AuthProvider>
    </BrandProvider>
  </ToastProvider>
);

registerHolaPwa();