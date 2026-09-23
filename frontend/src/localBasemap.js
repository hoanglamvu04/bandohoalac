import { layers, namedFlavor } from '@protomaps/basemaps';

const GLYPHS_URL = 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';
const SPRITE_BASE = 'https://protomaps.github.io/basemaps-assets/sprites/v4/';

export const PMTILES_URL = (import.meta.env.VITE_PMTILES_URL || '/maps/hoalac.pmtiles').trim();

const FLAVORS = {
  streets: 'light',
  contrast: 'grayscale',
  dark: 'dark',
  clean: 'white'
};

export const LOCAL_BASEMAP_OPTIONS = [
  { id: 'streets', label: 'Bản đồ', description: 'Chi tiết đường, POI, địa danh' },
  { id: 'contrast', label: 'Tương phản', description: 'Nền xám, dễ đọc dữ liệu' },
  { id: 'dark', label: 'Ban đêm', description: 'Nền tối' },
  { id: 'clean', label: 'Tối giản', description: 'Nền trắng cho quy hoạch / dữ liệu' }
];

export function createPmtilesStyle(mode = 'streets') {
  const flavorName = FLAVORS[mode] || 'light';
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
    layers: layers('protomaps', namedFlavor(flavorName), {
      lang: 'vi'
    })
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
