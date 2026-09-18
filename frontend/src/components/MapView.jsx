import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function MapView() {
  const mapRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [105.525, 21.005],
      zoom: 12
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    new maplibregl.Marker({ color: '#f6c453' })
      .setLngLat([105.525, 21.005])
      .setPopup(new maplibregl.Popup().setHTML('<b>Hola Maps</b><br/>Hòa Lạc'))
      .addTo(map);

    mapRef.current = map;

    return () => map.remove();
  }, []);

  return <div ref={containerRef} className="hola-map" />;
}
