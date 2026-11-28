import '../mapInteractionBridge.js';
import { useLocation } from 'react-router-dom';
import '../map-experience-v2.css';
import '../discovery-v1.css';
import '../map-power-v3.css';
import '../map-mobile-place-fallback.css';
import '../map-ui-v8.css';
import MapPage from './MapPage.jsx';
import MapSearchV2 from '../components/MapSearchV2.jsx';
import MapPinOverlay from '../components/MapPinOverlay.jsx';
import MapHaloFilterPortal from '../components/MapHaloFilterPortal.jsx';
import MapMobileLocationButton from '../components/MapMobileLocationButton.jsx';
import MapPowerOverlay from '../components/MapPowerOverlay.jsx';
import MapMobilePlaceFallback from '../components/MapMobilePlaceFallback.jsx';

export default function MapDiscoveryPage() {
  const { pathname } = useLocation();
  // Scope V8 to the public map. Embedded and local SEO maps keep their layouts.
  return (
    <div className={'map-discovery-v1 map-experience-v2' + (pathname === '/map' ? ' map-ui-v8' : '')}>
      <MapPage />
      <MapSearchV2 />
      <MapPinOverlay />
      <MapHaloFilterPortal />
      <MapMobileLocationButton />
      <MapPowerOverlay />
      <MapMobilePlaceFallback />
    </div>
  );
}
