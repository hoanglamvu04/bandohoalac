import { useEffect, useRef, useState } from 'react';
import {
  Check,
  CornerDownLeft,
  MapPin,
  MousePointer2,
  RotateCcw,
  Save,
  Trash2
} from 'lucide-react';
import { createMapLayerFeature } from '../../services/api.js';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  MAP_COVERAGE_BOUNDS,
  createLocalBasemapStyle,
  isInsideServiceCoverage
} from '../../mapConfig.js';
import { useToast } from '../../context/ToastContext.jsx';

const TYPES = [
  ['LANDMARK', 'Địa danh', 'Point'],
  ['ALERT', 'Cảnh báo', 'Point'],
  ['EVENT', 'Sự kiện', 'Point'],
  ['ROAD', 'Đường nội bộ', 'LineString'],
  ['ROAD_CLOSURE', 'Đường cấm', 'LineString'],
  ['WATER', 'Sông / hồ', 'Polygon'],
  ['BUILDING', 'Công trình', 'Polygon'],
  ['FLOOD', 'Vùng ngập', 'Polygon'],
  ['PLANNING', 'Quy hoạch', 'Polygon'],
  ['TERRAIN', 'Địa hình', 'Polygon']
];

function geometryFromPoints(mode, points) {
  if (mode === 'Point') {
    return points[0] ? { type: 'Point', coordinates: points[0] } : null;
  }
  if (mode === 'LineString') {
    return points.length >= 2 ? { type: 'LineString', coordinates: points } : null;
  }
  if (mode === 'Polygon') {
    if (points.length < 3) return null;
    return { type: 'Polygon', coordinates: [[...points, points[0]]] };
  }
  return null;
}

function draftFeature(mode, points) {
  const geometry = geometryFromPoints(mode, points);
  if (!geometry) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry }]
  };
}

export default function MapEditor() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [layerType, setLayerType] = useState('FLOOD');
  const [geometryType, setGeometryType] = useState('Polygon');
  const [points, setPoints] = useState([]);
  const [name, setName] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    let cancelled = false;

    (async () => {
      const [maplibre] = await Promise.all([
        import('maplibre-gl'),
        import('maplibre-gl/dist/maplibre-gl.css')
      ]);
      if (cancelled || !containerRef.current) return;

      const map = new maplibre.Map({
        container: containerRef.current,
        style: createLocalBasemapStyle(),
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        maxBounds: MAP_COVERAGE_BOUNDS,
        renderWorldCopies: false,
        refreshExpiredTiles: false,
        maxTileCacheSize: 16
      });

      map.addControl(new maplibre.NavigationControl(), 'top-right');

      map.on('load', () => {
        map.addSource('hm-editor-draft', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        map.addLayer({
          id: 'hm-editor-draft-fill',
          type: 'fill',
          source: 'hm-editor-draft',
          filter: ['==', '$type', 'Polygon'],
          paint: {
            'fill-color': '#f59e0b',
            'fill-opacity': 0.24,
            'fill-outline-color': '#d97706'
          }
        });

        map.addLayer({
          id: 'hm-editor-draft-line',
          type: 'line',
          source: 'hm-editor-draft',
          filter: ['==', '$type', 'LineString'],
          paint: {
            'line-color': '#dc2626',
            'line-width': 4
          }
        });

        map.addLayer({
          id: 'hm-editor-draft-point',
          type: 'circle',
          source: 'hm-editor-draft',
          filter: ['==', '$type', 'Point'],
          paint: {
            'circle-radius': 7,
            'circle-color': '#0f766e',
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 2
          }
        });
      });

      map.on('click', (event) => {
        if (!isInsideServiceCoverage(event.lngLat.lng, event.lngLat.lat)) {
          showToast('Điểm nằm ngoài vùng Hola Maps.', 'error');
          return;
        }

        setPoints((current) => {
          if (geometryType === 'Point') {
            return [[event.lngLat.lng, event.lngLat.lat]];
          }
          return [...current, [event.lngLat.lng, event.lngLat.lat]];
        });
      });

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [geometryType, showToast]);

  useEffect(() => {
    const source = mapRef.current?.getSource('hm-editor-draft');
    if (source) source.setData(draftFeature(geometryType, points));
  }, [points, geometryType]);

  function chooseType(nextType) {
    const config = TYPES.find(([type]) => type === nextType);
    setLayerType(nextType);
    setGeometryType(config?.[2] || 'Point');
    setPoints([]);
  }

  function undo() {
    setPoints((current) => current.slice(0, -1));
  }

  function reset() {
    setPoints([]);
    setName('');
    setDescription('');
  }

  async function save() {
    const geometry = geometryFromPoints(geometryType, points);
    if (!geometry) {
      showToast('Chưa đủ điểm để tạo hình học.', 'error');
      return;
    }

    setSaving(true);
    try {
      await createMapLayerFeature({
        layerType,
        name: name.trim() || undefined,
        geometry,
        severity: ['FLOOD', 'ALERT', 'ROAD_CLOSURE'].includes(layerType) ? severity : undefined,
        properties: {
          description: description.trim() || undefined,
          source: 'ADMIN_EDITOR'
        }
      });

      showToast('Đã lưu layer vào PostGIS.', 'success');
      reset();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="hm-editor-page">
      <aside className="hm-editor-sidebar">
        <div className="hm-editor-title">
          <span>HOLA MAPS STUDIO</span>
          <h1>Biên tập bản đồ</h1>
          <p>Vẽ trực tiếp dữ liệu local và lưu vào PostGIS.</p>
        </div>

        <div className="hm-editor-block">
          <label>Loại lớp dữ liệu</label>
          <select value={layerType} onChange={(event) => chooseType(event.target.value)}>
            {TYPES.map(([type, label]) => <option key={type} value={type}>{label}</option>)}
          </select>
        </div>

        <div className="hm-editor-block">
          <label>Tên đối tượng</label>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Điểm ngập QL21..." />
        </div>

        {['FLOOD', 'ALERT', 'ROAD_CLOSURE'].includes(layerType) && (
          <div className="hm-editor-block">
            <label>Mức độ</label>
            <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
              <option value="INFO">Thông tin</option>
              <option value="LOW">Thấp</option>
              <option value="MEDIUM">Trung bình</option>
              <option value="HIGH">Cao</option>
              <option value="CRITICAL">Nghiêm trọng</option>
            </select>
          </div>
        )}

        <div className="hm-editor-block">
          <label>Mô tả</label>
          <textarea rows="4" value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>

        <div className="hm-editor-guide">
          <MousePointer2 size={17} />
          <div>
            <b>{geometryType}</b>
            <span>
              {geometryType === 'Point' && 'Click một điểm trên bản đồ.'}
              {geometryType === 'LineString' && 'Click từ 2 điểm trở lên để vẽ tuyến.'}
              {geometryType === 'Polygon' && 'Click ít nhất 3 điểm để vẽ vùng.'}
            </span>
          </div>
        </div>

        <div className="hm-editor-points">
          <span><MapPin size={14} /> {points.length} điểm</span>
          <button type="button" onClick={undo} disabled={!points.length}><CornerDownLeft size={14} /> Hoàn tác</button>
          <button type="button" onClick={reset}><RotateCcw size={14} /> Làm lại</button>
        </div>

        <button className="hm-editor-save" type="button" onClick={save} disabled={saving}>
          {saving ? <Save size={17} /> : <Check size={17} />}
          {saving ? 'Đang lưu...' : 'Lưu vào PostGIS'}
        </button>

        <div className="hm-editor-note">
          <Trash2 size={15} />
          Xóa/hiệu chỉnh đối tượng đã lưu sẽ dùng API quản trị map-layers.
        </div>
      </aside>

      <section className="hm-editor-map">
        <div ref={containerRef} className="hm-editor-canvas" />
      </section>
    </main>
  );
}
