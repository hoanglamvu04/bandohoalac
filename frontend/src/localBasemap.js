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

export const PMTILES_URL = versionLocalArchive(RAW_PMTILES_URL, 'basemap-v2');
export const BUILDINGS_PMTILES_URL = versionLocalArchive(
  RAW_BUILDINGS_PMTILES_URL,
  'buildings-v2'
);

const MAPTILER_KEY = (import.meta.env.VITE_MAPTILER_KEY || '').trim();
const CUSTOM_SATELLITE_URL = (import.meta.env.VITE_SATELLITE_TILE_URL || '').trim();

export const SATELLITE_PROVIDER = CUSTOM_SATELLITE_URL
  ? 'custom'
  : String(import.meta.env.VITE_SATELLITE_PROVIDER || 'esri').trim().toLowerCase();

const USE_MAPTILER_SATELLITE = SATELLITE_PROVIDER === 'maptiler' && Boolean(MAPTILER_KEY);

export const SATELLITE_TILE_URL = (
  CUSTOM_SATELLITE_URL ||
  (USE_MAPTILER_SATELLITE
    ? 'https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=' + encodeURIComponent(MAPTILER_KEY)
    : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
).trim();

export const SATELLITE_ATTRIBUTION = (
  import.meta.env.VITE_SATELLITE_ATTRIBUTION ||
  (USE_MAPTILER_SATELLITE
    ? '© MapTiler © OpenStreetMap contributors'
    : 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community')
).trim();

const HAS_CUSTOM_SATELLITE_URL = Boolean(CUSTOM_SATELLITE_URL);
export const SATELLITE_TILE_SIZE = Number(import.meta.env.VITE_SATELLITE_TILE_SIZE) ||
  (!HAS_CUSTOM_SATELLITE_URL && USE_MAPTILER_SATELLITE ? 512 : 256);
export const SATELLITE_MAX_ZOOM =
  !HAS_CUSTOM_SATELLITE_URL && USE_MAPTILER_SATELLITE ? 22 : 19;

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
    buildingOutline: '#b7c2ca'
  },
  contrast: {
    buildingOutline: '#aab2b8'
  },
  dark: {
    buildingOutline: '#59636c'
  },
  clean: {
    buildingOutline: '#c8d0d5'
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

/**
 * Protomaps already ships detailed OSM buildings, roads, address points and
 * POIs. Now that Hola Maps covers a much smaller area, we can afford to make
 * those layers more useful at local zooms without cluttering the overview.
 *
 * The source itself is still the same compact PMTiles archive. This function
 * only changes cartography / progressive disclosure by zoom.
 */
function createSupplementalBuildingLayers(mode) {
  const palette = DETAIL_PALETTES[mode] || DETAIL_PALETTES.streets;
  const fillOpacity = [
    'interpolate',
    ['linear'],
    ['zoom'],
    14.4, 0,
    15, 0.46,
    16, 0.58,
    17, 0.68,
    18, 0.74
  ];

  return [
    {
      id: 'hola-overture-building',
      type: 'fill',
      source: 'overture-buildings',
      'source-layer': 'building',
      minzoom: 14.4,
      paint: {
        'fill-color': mode === 'dark' ? '#6b747d' : '#d8dee5',
        'fill-opacity': fillOpacity,
        'fill-outline-color': palette.buildingOutline
      }
    },
    {
      id: 'hola-overture-building-part',
      type: 'fill',
      source: 'overture-buildings',
      'source-layer': 'building_part',
      minzoom: 15,
      paint: {
        'fill-color': mode === 'dark' ? '#737d87' : '#e3e7eb',
        'fill-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          15, 0.18,
          16, 0.30,
          17, 0.42,
          18, 0.5
        ],
        'fill-outline-color': palette.buildingOutline
      }
    }
  ];
}

function enhanceLocalDetailLayers(baseLayers, mode, includeSupplementalBuildings = false) {
  const palette = DETAIL_PALETTES[mode] || DETAIL_PALETTES.streets;

  const enhanced = baseLayers.map((baseLayer) => {
    const layer = cloneLayer(baseLayer);
    const sourceLayer = layer['source-layer'];

    // z15+ in Protomaps contains individual OSM building footprints instead
    // of the merged low-zoom representation. Keep the overview clean, then
    // make each house/building increasingly legible while zooming in.
    if (layer.id === 'buildings' && sourceLayer === 'buildings') {
      layer.minzoom = 14.6;
      layer.paint = {
        ...layer.paint,
        'fill-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14.6, 0,
          15, 0.42,
          16, 0.52,
          17, 0.62,
          18, 0.68
        ],
        'fill-outline-color': palette.buildingOutline
      };
    }

    // Address points are styled at z18 upstream. Our local archive now has
    // real z17 tiles, so expose available house numbers one level earlier.
    if (layer.id === 'address_label' && sourceLayer === 'buildings') {
      layer.minzoom = 17;
      layer.layout = {
        ...layer.layout,
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          17, 10,
          18, 12
        ],
        'text-allow-overlap': false
      };
    }

    // Service roads become important in campuses, villages and industrial
    // areas. Keep them subtle at z14 and progressively strengthen them.
    if (layer.id === 'roads_minor_service' && sourceLayer === 'roads') {
      layer.minzoom = 13.8;
      layer.paint = {
        ...layer.paint,
        'line-width': [
          'interpolate',
          ['exponential', 1.45],
          ['zoom'],
          13.8, 0.35,
          15, 1.1,
          16, 2.2,
          17, 4.2,
          18, 7
        ]
      };
    }

    if (layer.id === 'roads_minor_service_casing' && sourceLayer === 'roads') {
      layer.minzoom = 13.8;
      layer.paint = {
        ...layer.paint,
        'line-gap-width': [
          'interpolate',
          ['exponential', 1.45],
          ['zoom'],
          13.8, 0,
          15, 1.1,
          16, 2.2,
          17, 4.2,
          18, 7
        ],
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          13.8, 0.5,
          17, 1
        ]
      };
    }

    // Paths, tracks, alleys and pedestrian links should only become visually
    // meaningful when the user is already looking at a neighbourhood.
    if (layer.id === 'roads_other' && sourceLayer === 'roads') {
      layer.minzoom = 14;
      layer.paint = {
        ...layer.paint,
        'line-width': [
          'interpolate',
          ['exponential', 1.35],
          ['zoom'],
          14, 0.45,
          15, 0.8,
          16, 1.45,
          17, 2.5,
          18, 4.2
        ],
        'line-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14, 0.55,
          16, 0.78,
          17, 0.92
        ]
      };
    }

    // Street names become useful slightly before z15 now that the map is a
    // local product rather than a regional overview.
    if (layer.id === 'roads_labels_minor' && sourceLayer === 'roads') {
      layer.minzoom = 14.4;
      layer.layout = {
        ...layer.layout,
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14.4, 10.5,
          16, 12,
          18, 13
        ],
        'text-max-width': 10
      };
    }

    // Keep one-way arrows readable without flooding z15.
    if (layer.id === 'roads_oneway' && sourceLayer === 'roads') {
      layer.minzoom = 16;
      layer.layout = {
        ...layer.layout,
        'symbol-spacing': [
          'interpolate',
          ['linear'],
          ['zoom'],
          16, 140,
          18, 90
        ]
      };
    }

    // POIs are the most useful local context. Preserve Protomaps' ranking
    // filter, but make labels more readable as soon as dense z16-z17 data
    // starts appearing.
    if (layer.id === 'pois' && sourceLayer === 'pois') {
      layer.layout = {
        ...layer.layout,
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          15, 9,
          16, 10,
          17, 11.5,
          19, 15
        ],
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
    enhanced.push(...supplementalLayers);
  }

  return enhanced;
}

function createSatelliteRasterLayer() {
  return {
    id: 'hola-satellite-imagery',
    type: 'raster',
    source: 'satellite-imagery',
    minzoom: 0,
    maxzoom: 22,
    paint: {
      'raster-opacity': 1,
      'raster-fade-duration': 120,
      'raster-resampling': 'linear',
      'raster-saturation': 0.04,
      'raster-contrast': 0.05,
      'raster-brightness-min': 0.01,
      'raster-brightness-max': 0.98
    }
  };
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
          'line-opacity': isCasing ? 0.72 : 0.88,
          ...(isCasing ? { 'line-color': 'rgba(255,255,255,0.9)' } : {})
        };
      }

      return layer;
    });
}

export function createPmtilesStyle(mode = 'streets', options = {}) {
  const basemaps = window.basemaps;
  if (!basemaps) throw new Error('Protomaps basemap assets are not loaded.');

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
    layers = [createSatelliteRasterLayer()];
  } else if (mode === 'hybrid') {
    layers = [
      createSatelliteRasterLayer(),
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

async function archiveAvailable(url) {
  if (/^https?:\/\//i.test(url)) return true;

  try {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

export function localPmtilesAvailable() {
  return archiveAvailable(PMTILES_URL);
}

export function supplementalBuildingsAvailable() {
  return archiveAvailable(BUILDINGS_PMTILES_URL);
}
