import '../mapInteractionBridge.js';
import '../map-experience-v2.css';
import MapPage from './MapPage.jsx';
import MapSearchV2 from '../components/MapSearchV2.jsx';
import MapPinOverlay from '../components/MapPinOverlay.jsx';
import MapHaloFilterPortal from '../components/MapHaloFilterPortal.jsx';
import MapMobileLocationButton from '../components/MapMobileLocationButton.jsx';

export default function MapDiscoveryPage() {
  return (
    <div className="map-discovery-v1 map-experience-v2">
      <MapPage />
      <MapSearchV2 />
      <MapPinOverlay />
      <MapHaloFilterPortal />
      <MapMobileLocationButton />
    </div>
  );
}
