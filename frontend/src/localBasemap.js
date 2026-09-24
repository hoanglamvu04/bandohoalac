const GLYPHS_URL = 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';
const SPRITE_BASE = 'https://protomaps.github.io/basemaps-assets/sprites/v4/';

export const PMTILES_URL = (import.meta.env.VITE_PMTILES_URL || '/maps/hoalac.pmtiles').trim();

const FLAVORS = {
  streets: 'light',
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
function enhanceLocalDetailLayers(baseLayers, mode) {
  const palette = DETAIL_PALETTES[mode] || DETAIL_PALETTES.streets;

  return baseLayers.map((baseLayer) => {
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
}

export function createPmtilesStyle(mode = 'streets') {
  const basemaps = window.basemaps;
  if (!basemaps) throw new Error('Protomaps basemap assets are not loaded.');

  const flavorName = FLAVORS[mode] || 'light';
  const baseLayers = basemaps.layers('protomaps', basemaps.namedFlavor(flavorName), {
    lang: 'vi'
  });

  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sprite: SPRITE_BASE + flavorName,
    sources: {
      protomaps: {
        type: 'vector',
        url: 'pmtiles://' + PMTILES_URL,
        attribution: '© OpenStreetMap contributors · Protomaps'
      }
    },
    layers: enhanceLocalDetailLayers(baseLayers, mode)
  };
}

export function createFallbackStyle() {
  return 'https://tiles.openfreemap.org/styles/liberty';
}

export async function localPmtilesAvailable() {
  if (/^https?:\/\//i.test(PMTILES_URL)) return true;

  try {
    const response = await fetch(PMTILES_URL, { method: 'HEAD', cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}
