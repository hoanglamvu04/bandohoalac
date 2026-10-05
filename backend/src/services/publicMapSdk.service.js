import { env } from '../config/env.js';

const DEFAULT_WEB_URL = 'https://maps.dothihoalac.vn';
const DEFAULT_CENTER = [105.515, 21.015];
const DEFAULT_ZOOM = 13.15;
const MIN_ZOOM = 12.25;
const MAX_ZOOM = 18;
const MAP_COVERAGE_BOUNDS = [
  [105.30, 20.86],
  [105.69, 21.16]
];
const SERVICE_AREA_RING = [
  [105.335, 21.145],
  [105.325, 21.080],
  [105.345, 21.030],
  [105.370, 20.985],
  [105.405, 20.950],
  [105.440, 20.930],
  [105.475, 20.905],
  [105.515, 20.888],
  [105.565, 20.885],
  [105.610, 20.900],
  [105.640, 20.935],
  [105.660, 20.975],
  [105.665, 21.015],
  [105.650, 21.055],
  [105.640, 21.095],
  [105.590, 21.110],
  [105.520, 21.122],
  [105.455, 21.118],
  [105.390, 21.145],
  [105.335, 21.145]
];

function webBaseUrl() {
  return String(env.holaMapsWebUrl || DEFAULT_WEB_URL).trim().replace(/\/$/, '');
}

function apiBaseUrl() {
  return String(env.publicBaseUrl || DEFAULT_WEB_URL).trim().replace(/\/$/, '') + '/api/public/v1';
}

export function publicMapConfig() {
  const web = webBaseUrl();
  const api = apiBaseUrl();
  return {
    name: 'Hola Maps Web SDK',
    version: 'v1',
    renderer: 'maplibre-gl',
    readOnly: true,
    styleUrl: api + '/map/style.json',
    embedUrl: web + '/embed',
    tiles: {
      protocol: 'pmtiles',
      basemap: web + '/maps/hoalac.pmtiles',
      buildings: web + '/maps/hoalac-buildings.pmtiles'
    },
    camera: {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      maxBounds: MAP_COVERAGE_BOUNDS,
      renderWorldCopies: false
    },
    serviceArea: {
      type: 'Feature',
      properties: {
        id: 'hola-service-area',
        name: 'Vùng dữ liệu Hola Maps',
        coreAreas: ['Hòa Lạc', 'Hạ Bằng', 'Thạch Thất', 'Tây Phương', 'Yên Xuân', 'Phú Cát'],
        extendedAreas: ['Một phần Ba Vì', 'Một phần Quốc Oai']
      },
      geometry: {
        type: 'Polygon',
        coordinates: [SERVICE_AREA_RING]
      }
    },
    places: {
      geojson: api + '/places/geojson',
      bounds: api + '/places/bounds',
      nearby: api + '/places/nearby'
    }
  };
}

export function publicMapStyle() {
  const { tiles } = publicMapConfig();
  return {
    version: 8,
    name: 'Hola Maps Light',
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sources: {
      protomaps: {
        type: 'vector',
        url: 'pmtiles://' + tiles.basemap,
        attribution: '© OpenStreetMap contributors · Protomaps · Hola Maps'
      },
      'overture-buildings': {
        type: 'vector',
        url: 'pmtiles://' + tiles.buildings,
        attribution: '© Overture Maps Foundation · Hola Maps'
      }
    },
    layers: [
      {
        id: 'hola-background',
        type: 'background',
        paint: { 'background-color': '#eef3ef' }
      },
      {
        id: 'hola-earth',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'earth',
        paint: { 'fill-color': '#f3f1e8' }
      },
      {
        id: 'hola-landuse',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'landuse',
        paint: {
          'fill-color': '#e5ebdd',
          'fill-opacity': 0.66
        }
      },
      {
        id: 'hola-water',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'water',
        paint: { 'fill-color': '#b8d8df' }
      },
      {
        id: 'hola-road-casing',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        paint: {
          'line-color': '#d7d7cf',
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.2, 16, 5.5, 18, 10]
        }
      },
      {
        id: 'hola-roads',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.65, 16, 3.7, 18, 7.5]
        }
      },
      {
        id: 'hola-buildings',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'buildings',
        minzoom: 14.6,
        paint: {
          'fill-color': '#d8dee5',
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14.6, 0, 15, 0.42, 17, 0.62, 18, 0.68],
          'fill-outline-color': '#b7c2ca'
        }
      },
      {
        id: 'hola-overture-building',
        type: 'fill',
        source: 'overture-buildings',
        'source-layer': 'building',
        minzoom: 14.6,
        paint: {
          'fill-color': '#d8dee5',
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14.6, 0, 15, 0.40, 17, 0.58, 18, 0.66],
          'fill-outline-color': '#b7c2ca'
        }
      },
      {
        id: 'hola-place-labels',
        type: 'symbol',
        source: 'protomaps',
        'source-layer': 'places',
        minzoom: 10,
        layout: {
          'text-field': ['coalesce', ['get', 'name:vi'], ['get', 'name']],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 14, 12, 17, 14],
          'text-font': ['Noto Sans Regular'],
          'text-max-width': 10
        },
        paint: {
          'text-color': '#33423b',
          'text-halo-color': 'rgba(255,255,255,.9)',
          'text-halo-width': 1.2
        }
      },
      {
        id: 'hola-pois',
        type: 'symbol',
        source: 'protomaps',
        'source-layer': 'pois',
        minzoom: 14.5,
        layout: {
          'text-field': ['coalesce', ['get', 'name:vi'], ['get', 'name']],
          'text-size': ['interpolate', ['linear'], ['zoom'], 15, 9, 17, 11.5, 19, 14],
          'text-font': ['Noto Sans Regular'],
          'text-max-width': 9
        },
        paint: {
          'text-color': '#294239',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.1
        }
      }
    ]
  };
}
