import * as basemaps from '@protomaps/basemaps';

const GLYPHS_URL = 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';
const SPRITE_BASE = 'https://protomaps.github.io/basemaps-assets/sprites/v4/';

function versionLocalArchive(url, tag) {
  const value = String(url || '').trim();
  if (!value || /^https?:\/\//i.test(value)) return value;

  const separator = value.includes('?') ? '&' : '?';
  return value + separator + 'hola-archive=' + encodeURIComponent(tag);
}

const RAW_PMTILES_URL = (import.meta.env.VITE_PMTILES_URL || '/maps/hoalac.pmtiles').trim();
const RAW_BUILDINGS_PMTILES_URL = (
  import.meta.env.VITE_BUILDINGS_PMTILES_URL || '/maps/hoalac-buildings.pmtiles'
).trim();

// Bump these tags whenever the cartography contract changes so browsers do
// not keep an older PMTiles header/style combination after deploys.
export const PMTILES_URL = versionLocalArchive(RAW_PMTILES_URL, 'basemap-v3');
export const BUILDINGS_PMTILES_URL = versionLocalArchive(
  RAW_BUILDINGS_PMTILES_URL,
  'buildings-v3'
);

const MAPTILER_KEY = (import.meta.env.VITE_MAPTILER_KEY || '').trim();
const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN || '').trim();
const CUSTOM_SATELLITE_URL = (import.meta.env.VITE_SATELLITE_TILE_URL || '').trim();

const ESRI_SATELLITE_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_SATELLITE_ATTRIBUTION =
  'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

export const SATELLITE_PROVIDER = CUSTOM_SATELLITE_URL
  ? 'custom'
  : String(import.meta.env.VITE_SATELLITE_PROVIDER || 'esri').trim().toLowerCase();

const USE_MAPTILER_SATELLITE = SATELLITE_PROVIDER === 'maptiler' && Boolean(MAPTILER_KEY);
const USE_MAPBOX_SATELLITE = SATELLITE_PROVIDER === 'mapbox' && Boolean(MAPBOX_TOKEN);

function builtInSatelliteUrl() {
  if (USE_MAPBOX_SATELLITE) {
    return 'https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=' +
      encodeURIComponent(MAPBOX_TOKEN);
  }

  if (USE_MAPTILER_SATELLITE) {
    return 'https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=' +
      encodeURIComponent(MAPTILER_KEY);
  }

  return ESRI_SATELLITE_TILE_URL;
}

export const SATELLITE_TILE_URL = (
  CUSTOM_SATELLITE_URL || builtInSatelliteUrl()
).trim();

export const SATELLITE_ATTRIBUTION = (
  import.meta.env.VITE_SATELLITE_ATTRIBUTION ||
  (USE_MAPBOX_SATELLITE
    ? '© Mapbox © OpenStreetMap contributors'
    : USE_MAPTILER_SATELLITE
      ? '© MapTiler © OpenStreetMap contributors'
      : ESRI_SATELLITE_ATTRIBUTION)
).trim();

export const HAS_SATELLITE_FALLBACK =
  !CUSTOM_SATELLITE_URL && SATELLITE_PROVIDER !== 'esri';

const HAS_CUSTOM_SATELLITE_URL = Boolean(CUSTOM_SATELLITE_URL);
export const SATELLITE_TILE_SIZE = Number(import.meta.env.VITE_SATELLITE_TILE_SIZE) ||
  (!HAS_CUSTOM_SATELLITE_URL && USE_MAPTILER_SATELLITE ? 512 : 256);
export const SATELLITE_MAX_ZOOM =
  !HAS_CUSTOM_SATELLITE_URL && USE_MAPTILER_SATELLITE
    ? 22
    : (!HAS_CUSTOM_SATELLITE_URL && USE_MAPBOX_SATELLITE ? 20 : 19);

const FLAVORS = {
  streets: 'light',
  hybrid: 'light',
  satellite: 'light',
  contrast: 'grayscale',
  dark: 'dark',
  clean: 'white'
};

const DETAIL_PALETTES = {
  streets: {
    building: '#d7ddd9',
    buildingPart: '#e6eae7',
    buildingOutline: '#aeb9b4',
    building3D: '#cbd4cf',
    buildingPart3D: '#dce3df',
    roadHighway: '#fff3d8',
    roadHighwayCasing: '#d6c9aa',
    roadMajor: '#ffffff',
    roadMajorCasing: '#cbd4d0',
    roadMinor: '#ffffff',
    roadMinorCasing: '#d8dfdc',
    roadService: '#f7f9f8',
    roadPath: '#d8cdbd',
    roadLabel: '#45534d',
    roadLabelHalo: '#ffffff',
    localityLabel: '#29473e',
    subplaceLabel: '#607069',
    placeHalo: 'rgba(255,255,255,0.96)'
  },
  contrast: {
    building: '#d5d9dc',
    buildingPart: '#e4e7e9',
    buildingOutline: '#a6aeb3',
    building3D: '#c9d0d4',
    buildingPart3D: '#dce1e4',
    roadHighway: '#ffffff',
    roadHighwayCasing: '#9ca5aa',
    roadMajor: '#f8f9fa',
    roadMajorCasing: '#aeb6ba',
    roadMinor: '#f5f6f7',
    roadMinorCasing: '#c5cbce',
    roadService: '#eceff0',
    roadPath: '#b5b8ba',
    roadLabel: '#343a3d',
    roadLabelHalo: '#ffffff',
    localityLabel: '#22292c',
    subplaceLabel: '#626a6e',
    placeHalo: 'rgba(255,255,255,0.96)'
  },
  dark: {
    building: '#606b66',
    buildingPart: '#6d7873',
    buildingOutline: '#8b9691',
    building3D: '#6a7771',
    buildingPart3D: '#78857f',
    roadHighway: '#88785c',
    roadHighwayCasing: '#4b4640',
    roadMajor: '#68736e',
    roadMajorCasing: '#414944',
    roadMinor: '#56615c',
    roadMinorCasing: '#343b38',
    roadService: '#49534f',
    roadPath: '#756c60',
    roadLabel: '#e5ebe8',
    roadLabelHalo: '#18211e',
    localityLabel: '#f0f5f2',
    subplaceLabel: '#bdc8c3',
    placeHalo: 'rgba(19,28,24,0.94)'
  },
  clean: {
    building: '#e0e4e2',
    buildingPart: '#ecefed',
    buildingOutline: '#c0c8c4',
    building3D: '#d4dbd7',
    buildingPart3D: '#e2e7e4',
    roadHighway: '#f7f2e8',
    roadHighwayCasing: '#d5cec0',
    roadMajor: '#fafafa',
    roadMajorCasing: '#d1d7d4',
    roadMinor: '#f8f9f8',
    roadMinorCasing: '#e0e4e2',
    roadService: '#f2f4f3',
    roadPath: '#d8d0c6',
    roadLabel: '#56615c',
    roadLabelHalo: '#ffffff',
    localityLabel: '#355148',
    subplaceLabel: '#718079',
    placeHalo: 'rgba(255,255,255,0.98)'
  }
};

export const LOCAL_BASEMAP_OPTIONS = [
  { id: 'streets', label: 'Bản đồ', description: 'Chi tiết đường, nhà cửa, POI, địa danh' },
  { id: 'satellite', label: 'Vệ tinh', description: 'Ảnh vệ tinh độ phân giải cao' },
  { id: 'hybrid', label: 'Hybrid', description: 'Vệ tinh + đường, địa danh và POI' },
  { id: 'contrast', label: 'Tương phản', description: 'Nền xám, dễ đọc dữ liệu' },
  { id: 'dark', label: 'Ban đêm', description: 'Nền tối' },
  { id: 'clean', label: 'Tối giản', description: 'Nền trắng cho quy hoạch / dữ liệu' }
];

function cloneLayer(layer) {
  return {
    ...layer,
    ...(layer.layout ? { layout: { ...layer.layout } } : {}),
    ...(layer.paint ? { paint: { ...layer.paint } } : {})
  };
}

function buildingHeightExpression(fallbackHeight = 7.5) {
  return [
    'case',
    ['>', ['to-number', ['get', 'height'], 0], 0],
    ['to-number', ['get', 'height'], fallbackHeight],
    ['>', ['to-number', ['get', 'num_floors'], 0], 0],
    ['*', ['to-number', ['get', 'num_floors'], 2], 3.2],
    fallbackHeight
  ];
}

function buildingBaseExpression() {
  return [
    'case',
    ['>', ['to-number', ['get', 'min_height'], 0], 0],
    ['to-number', ['get', 'min_height'], 0],
    ['>', ['to-number', ['get', 'min_floor'], 0], 0],
    ['*', ['to-number', ['get', 'min_floor'], 0], 3.2],
    0
  ];
}

function createSupplementalBuildingLayers(mode) {
  const palette = DETAIL_PALETTES[mode] || DETAIL_PALETTES.streets;

  return [
    {
      id: 'hola-overture-building',
      type: 'fill',
      source: 'overture-buildings',
      'source-layer': 'building',
      minzoom: 14.45,
      paint: {
        'fill-color': palette.building,
        'fill-opacity': [
          'interpolate', ['linear'], ['zoom'],
          14.45, 0,
          15, 0.38,
          16, 0.56,
          17, 0.68,
          18, 0.74
        ],
        'fill-outline-color': palette.buildingOutline
      }
    },
    {
      id: 'hola-overture-building-part',
      type: 'fill',
      source: 'overture-buildings',
      'source-layer': 'building_part',
      minzoom: 15.15,
      paint: {
        'fill-color': palette.buildingPart,
        'fill-opacity': [
          'interpolate', ['linear'], ['zoom'],
          15.15, 0,
          16, 0.24,
          17, 0.38,
          18, 0.48
        ],
        'fill-outline-color': palette.buildingOutline
      }
    },
    {
      id: 'hola-overture-building-3d',
      type: 'fill-extrusion',
      source: 'overture-buildings',
      'source-layer': 'building',
      minzoom: 16.35,
      filter: ['!=', ['get', 'has_parts'], true],
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': palette.building3D,
        'fill-extrusion-height': buildingHeightExpression(7.2),
        'fill-extrusion-base': buildingBaseExpression(),
        'fill-extrusion-opacity': [
          'interpolate', ['linear'], ['zoom'],
          16.35, 0.72,
          17, 0.84,
          18, 0.9
        ],
        'fill-extrusion-vertical-gradient': true
      }
    },
    {
      id: 'hola-overture-building-part-3d',
      type: 'fill-extrusion',
      source: 'overture-buildings',
      'source-layer': 'building_part',
      minzoom: 16.35,
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': palette.buildingPart3D,
        'fill-extrusion-height': buildingHeightExpression(5.8),
        'fill-extrusion-base': buildingBaseExpression(),
        'fill-extrusion-opacity': [
          'interpolate', ['linear'], ['zoom'],
          16.35, 0.7,
          17, 0.86,
          18, 0.92
        ],
        'fill-extrusion-vertical-gradient': true
      }
    }
  ];
}

function roadWidth(kind) {
  if (kind === 'highway') {
    return ['interpolate', ['exponential', 1.35], ['zoom'], 10, 1.1, 13, 2.7, 15, 5.2, 17, 9, 18, 12.5];
  }
  if (kind === 'major') {
    return ['interpolate', ['exponential', 1.35], ['zoom'], 11, 0.9, 13, 2, 15, 4, 17, 7.2, 18, 10.2];
  }
  if (kind === 'minor') {
    return ['interpolate', ['exponential', 1.35], ['zoom'], 13, 0.65, 15, 1.8, 16, 3, 17, 5.1, 18, 7.8];
  }
  return ['interpolate', ['exponential', 1.35], ['zoom'], 14, 0.4, 15, 0.95, 16, 1.8, 17, 3.3, 18, 5.3];
}

function enhanceRoadLayer(layer, palette) {
  const id = String(layer.id || '');
  if (layer['source-layer'] !== 'roads' || layer.type !== 'line') return layer;

  const isCasing = id.includes('casing');
  const isHighway = id.includes('highway');
  const isMajor = id.includes('major');
  const isMinor = id.includes('minor') && !id.includes('service');
  const isService = id.includes('minor_service');
  const isOther = id === 'roads_other';

  if (isHighway) {
    layer.paint = {
      ...layer.paint,
      'line-color': isCasing ? palette.roadHighwayCasing : palette.roadHighway,
      ...(isCasing ? {} : { 'line-width': roadWidth('highway') })
    };
  } else if (isMajor) {
    layer.paint = {
      ...layer.paint,
      'line-color': isCasing ? palette.roadMajorCasing : palette.roadMajor,
      ...(isCasing ? {} : { 'line-width': roadWidth('major') })
    };
  } else if (isMinor) {
    layer.paint = {
      ...layer.paint,
      'line-color': isCasing ? palette.roadMinorCasing : palette.roadMinor,
      ...(isCasing ? {} : { 'line-width': roadWidth('minor') })
    };
  }

  if (isService) {
    layer.minzoom = 13.65;
    layer.paint = {
      ...layer.paint,
      'line-color': isCasing ? palette.roadMinorCasing : palette.roadService,
      ...(isCasing
        ? {
            'line-gap-width': roadWidth('service'),
            'line-width': ['interpolate', ['linear'], ['zoom'], 13.65, 0.45, 17, 0.9]
          }
        : { 'line-width': roadWidth('service') })
    };
  }

  if (isOther) {
    layer.minzoom = 14;
    layer.paint = {
      ...layer.paint,
      'line-color': palette.roadPath,
      'line-width': ['interpolate', ['exponential', 1.3], ['zoom'], 14, 0.4, 15, 0.72, 16, 1.25, 17, 2.1, 18, 3.5],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.46, 16, 0.72, 17, 0.84]
    };
  }

  return layer;
}

function enhancePlaceLayer(layer, palette) {
  if (layer['source-layer'] !== 'places') return layer;

  if (layer.id === 'places_locality') {
    layer.minzoom = 10.5;
    layer.layout = {
      ...layer.layout,
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        10.5,
        [
          'match', ['get', 'kind_detail'],
          ['city', 'town'], 13,
          'village', 12,
          ['hamlet', 'locality'], 10.5,
          11
        ],
        13,
        [
          'match', ['get', 'kind_detail'],
          ['city', 'town'], 16,
          'village', 14,
          ['hamlet', 'locality'], 12,
          12.5
        ],
        16,
        [
          'match', ['get', 'kind_detail'],
          ['city', 'town'], 18,
          'village', 16,
          ['hamlet', 'locality'], 13.5,
          14
        ]
      ],
      'text-padding': ['interpolate', ['linear'], ['zoom'], 10.5, 2, 13, 4, 16, 7],
      'text-letter-spacing': [
        'match', ['get', 'kind_detail'],
        ['city', 'town'], 0.02,
        0
      ],
      'text-transform': 'none',
      'text-max-width': 9,
      'text-optional': true
    };
    layer.paint = {
      ...layer.paint,
      'text-color': palette.localityLabel,
      'text-halo-color': palette.placeHalo,
      'text-halo-width': 1.45,
      'text-halo-blur': 0.2
    };
  }

  if (layer.id === 'places_subplace') {
    layer.minzoom = 12.4;
    layer.layout = {
      ...layer.layout,
      'text-size': ['interpolate', ['linear'], ['zoom'], 12.4, 9.5, 14, 11.5, 16, 13],
      'text-padding': ['interpolate', ['linear'], ['zoom'], 12.4, 2, 15, 5],
      'text-transform': 'none',
      'text-letter-spacing': 0,
      'text-max-width': 9,
      'text-optional': true
    };
    layer.paint = {
      ...layer.paint,
      'text-color': palette.subplaceLabel,
      'text-halo-color': palette.placeHalo,
      'text-halo-width': 1.25,
      'text-halo-blur': 0.2
    };
  }

  return layer;
}

function enhanceLocalDetailLayers(baseLayers, mode, includeSupplementalBuildings = false) {
  const palette = DETAIL_PALETTES[mode] || DETAIL_PALETTES.streets;

  const enhanced = baseLayers.map((baseLayer) => {
    let layer = cloneLayer(baseLayer);
    const sourceLayer = layer['source-layer'];

    layer = enhanceRoadLayer(layer, palette);
    layer = enhancePlaceLayer(layer, palette);

    if (layer.id === 'buildings' && sourceLayer === 'buildings') {
      layer.minzoom = 14.55;
      layer.paint = {
        ...layer.paint,
        'fill-color': palette.building,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14.55, 0, 15, 0.38, 16, 0.5, 17, 0.6, 18, 0.66],
        'fill-outline-color': palette.buildingOutline
      };
    }

    if (layer.id === 'address_label' && sourceLayer === 'buildings') {
      layer.minzoom = 17;
      layer.layout = {
        ...layer.layout,
        'text-size': ['interpolate', ['linear'], ['zoom'], 17, 9.5, 18, 11.5],
        'text-allow-overlap': false
      };
    }

    if (layer.id === 'roads_labels_major' && sourceLayer === 'roads') {
      layer.minzoom = 10.7;
      layer.layout = {
        ...layer.layout,
        'text-size': ['interpolate', ['linear'], ['zoom'], 10.7, 10.5, 13, 11.5, 16, 13, 18, 14],
        'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 11, 420, 15, 300, 18, 220],
        'text-max-width': 12
      };
      layer.paint = {
        ...layer.paint,
        'text-color': palette.roadLabel,
        'text-halo-color': palette.roadLabelHalo,
        'text-halo-width': 1.35,
        'text-halo-blur': 0.15
      };
    }

    if (layer.id === 'roads_labels_minor' && sourceLayer === 'roads') {
      layer.minzoom = 14.15;
      layer.layout = {
        ...layer.layout,
        'text-size': ['interpolate', ['linear'], ['zoom'], 14.15, 10, 16, 11.5, 18, 12.5],
        'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 14.15, 360, 18, 240],
        'text-max-width': 10
      };
      layer.paint = {
        ...layer.paint,
        'text-color': palette.roadLabel,
        'text-halo-color': palette.roadLabelHalo,
        'text-halo-width': 1.2,
        'text-halo-blur': 0.15
      };
    }

    if (layer.id === 'roads_oneway' && sourceLayer === 'roads') {
      layer.minzoom = 16;
      layer.layout = {
        ...layer.layout,
        'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 16, 145, 18, 95]
      };
    }

    if (layer.id === 'pois' && sourceLayer === 'pois') {
      layer.layout = {
        ...layer.layout,
        'text-size': ['interpolate', ['linear'], ['zoom'], 15, 9, 16, 10, 17, 11.5, 19, 15],
        'text-max-width': 9,
        'text-padding': 2
      };
    }

    return layer;
  });

  if (!includeSupplementalBuildings) return enhanced;

  const supplementalLayers = createSupplementalBuildingLayers(mode);
  const buildingIndex = enhanced.findIndex((layer) => layer.id === 'buildings');
  if (buildingIndex >= 0) {
    enhanced.splice(buildingIndex, 1, ...supplementalLayers);
  } else {
    const firstRoadIndex = enhanced.findIndex((layer) => layer['source-layer'] === 'roads');
    if (firstRoadIndex >= 0) enhanced.splice(firstRoadIndex, 0, ...supplementalLayers);
    else enhanced.push(...supplementalLayers);
  }

  return enhanced;
}

function createSatelliteRasterLayer({
  id = 'hola-satellite-imagery',
  source = 'satellite-imagery',
  opacity = 1,
  enhance = true
} = {}) {
  return {
    id,
    type: 'raster',
    source,
    minzoom: 0,
    maxzoom: 22,
    paint: {
      'raster-opacity': opacity,
      'raster-fade-duration': 0,
      'raster-resampling': 'linear',
      'raster-saturation': enhance ? 0.04 : 0,
      'raster-contrast': enhance ? 0.05 : 0,
      'raster-brightness-min': 0.01,
      'raster-brightness-max': 0.98
    }
  };
}

function createSatelliteRasterLayers() {
  const layers = [];

  if (HAS_SATELLITE_FALLBACK) {
    layers.push(
      createSatelliteRasterLayer({
        id: 'hola-satellite-fallback',
        source: 'satellite-fallback',
        opacity: 1,
        enhance: false
      })
    );
  }

  layers.push(createSatelliteRasterLayer());
  return layers;
}

function createHybridOverlayLayers(layers) {
  return layers
    .filter((layer) => {
      if (layer.type === 'symbol') return true;
      if (layer.type === 'line' && layer['source-layer'] === 'roads') return true;
      return false;
    })
    .map((baseLayer) => {
      const layer = cloneLayer(baseLayer);

      if (layer.type === 'symbol') {
        layer.paint = {
          ...layer.paint,
          ...(layer.paint?.['text-color'] !== undefined
            ? {
                'text-color': '#17202a',
                'text-halo-color': 'rgba(255,255,255,0.94)',
                'text-halo-width': 1.6,
                'text-halo-blur': 0.25
              }
            : {})
        };
      }

      if (layer.type === 'line' && layer['source-layer'] === 'roads') {
        const isCasing = String(layer.id).includes('casing');
        layer.paint = {
          ...layer.paint,
          'line-opacity': isCasing ? 0.74 : 0.9,
          ...(isCasing ? { 'line-color': 'rgba(255,255,255,0.92)' } : {})
        };
      }

      return layer;
    });
}

export function createPmtilesStyle(mode = 'streets', options = {}) {
  const flavorName = FLAVORS[mode] || 'light';
  const baseLayers = basemaps.layers('protomaps', basemaps.namedFlavor(flavorName), {
    lang: 'vi'
  });
  const includeSupplementalBuildings = Boolean(options.includeSupplementalBuildings);
  const imageryMode = mode === 'satellite' || mode === 'hybrid';

  const sources = {
    protomaps: {
      type: 'vector',
      url: 'pmtiles://' + PMTILES_URL,
      attribution: '© OpenStreetMap contributors · Protomaps'
    }
  };

  if (includeSupplementalBuildings && !imageryMode) {
    sources['overture-buildings'] = {
      type: 'vector',
      url: 'pmtiles://' + BUILDINGS_PMTILES_URL,
      attribution: '© OpenStreetMap contributors · Overture Maps Foundation'
    };
  }

  if (imageryMode) {
    if (HAS_SATELLITE_FALLBACK) {
      sources['satellite-fallback'] = {
        type: 'raster',
        tiles: [ESRI_SATELLITE_TILE_URL],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution: ESRI_SATELLITE_ATTRIBUTION
      };
    }

    sources['satellite-imagery'] = {
      type: 'raster',
      tiles: [SATELLITE_TILE_URL],
      tileSize: SATELLITE_TILE_SIZE,
      minzoom: 0,
      maxzoom: SATELLITE_MAX_ZOOM,
      attribution: SATELLITE_ATTRIBUTION
    };
  }

  const detailedLayers = enhanceLocalDetailLayers(
    baseLayers,
    mode,
    includeSupplementalBuildings && !imageryMode
  );

  let layers = detailedLayers;

  if (mode === 'satellite') {
    layers = createSatelliteRasterLayers();
  } else if (mode === 'hybrid') {
    layers = [
      ...createSatelliteRasterLayers(),
      ...createHybridOverlayLayers(detailedLayers)
    ];
  }

  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sprite: SPRITE_BASE + flavorName,
    sources,
    layers
  };
}

export function createFallbackStyle() {
  return 'https://tiles.openfreemap.org/styles/liberty';
}

const archiveAvailabilityCache = new Map();

async function archiveAvailable(url) {
  if (/^https?:\/\//i.test(url)) return true;

  if (archiveAvailabilityCache.has(url)) {
    return archiveAvailabilityCache.get(url);
  }

  const check = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timeout);
    }
  })();

  archiveAvailabilityCache.set(url, check);
  return check;
}

export function localPmtilesAvailable() {
  return archiveAvailable(PMTILES_URL);
}

export function supplementalBuildingsAvailable() {
  return archiveAvailable(BUILDINGS_PMTILES_URL);
}
