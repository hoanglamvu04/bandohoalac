import { useEffect, useRef, useState } from 'react';
import { Clipboard, MapPin, Navigation, Plus, X } from 'lucide-react';
import * as maplibre from 'maplibre-gl';
import { Link } from 'react-router-dom';
import { getHolaMapInstance } from '../mapInteractionBridge.js';

function formatCoordinate(value) {
  return Number(value).toFixed(6);
}

export default function MapPinOverlay() {
  const [pin, setPin] = useState(null);
  const markerRef = useRef(null);

  useEffect(() => {
    const handlePin = (event) => {
      const detail = event?.detail || {};
      const lat = Number(detail.lat);
      const lng = Number(detail.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      setPin({
        lat,
        lng,
        title: detail.title || 'Điểm đã ghim',
        subtitle: detail.subtitle || 'Tọa độ trên Hola Maps',
        source: detail.source || 'map'
      });
    };

    window.addEventListener('hola-map-pin', handlePin);
    return () => window.removeEventListener('hola-map-pin', handlePin);
  }, []);

  useEffect(() => {
    markerRef.current?.remove();
    markerRef.current = null;
    if (!pin) return undefined;

    const map = getHolaMapInstance();
    if (!map) return undefined;

    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'hm-free-pin-marker';
    element.setAttribute('aria-label', pin.title);
    element.innerHTML = '<span></span>';

    markerRef.current = new maplibre.Marker({
      element,
      anchor: 'bottom'
    })
      .setLngLat([pin.lng, pin.lat])
      .addTo(map);

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [pin]);

  async function copyCoordinates() {
    if (!pin) return;
    const text = formatCoordinate(pin.lat) + ', ' + formatCoordinate(pin.lng);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
  }

  function openDirections() {
    if (!pin) return;
    const url = 'https://www.google.com/maps/dir/?api=1&destination=' +
      encodeURIComponent(pin.lat + ',' + pin.lng);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  if (!pin) {
    return (
      <div className="hm-pin-hint">
        <MapPin size={15} />
        <span>Chạm bản đồ hoặc nhấn giữ để ghim vị trí</span>
      </div>
    );
  }

  return (
    <aside className="hm-pin-card" aria-label="Điểm đã ghim">
      <div className="hm-pin-card-head">
        <span className="hm-pin-card-icon"><MapPin size={18} /></span>
        <div>
          <strong>{pin.title}</strong>
          <small>{pin.subtitle}</small>
        </div>
        <button type="button" onClick={() => setPin(null)} aria-label="Bỏ ghim"><X size={16} /></button>
      </div>

      <div className="hm-pin-coordinates">
        <span>{formatCoordinate(pin.lat)}</span>
        <span>{formatCoordinate(pin.lng)}</span>
      </div>

      <div className="hm-pin-actions">
        <button type="button" onClick={copyCoordinates}><Clipboard size={15} /> Sao chép</button>
        <button type="button" onClick={openDirections}><Navigation size={15} /> Chỉ đường</button>
        <Link to={'/contribute?lat=' + encodeURIComponent(pin.lat) + '&lng=' + encodeURIComponent(pin.lng)}>
          <Plus size={15} /> Thêm địa điểm
        </Link>
      </div>
    </aside>
  );
}
