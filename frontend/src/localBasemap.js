import { layers, namedFlavor } from '@protomaps/basemaps';

const GLYPHS_URL = 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';
const SPRITE_LIGHT = 'https://protomaps.github.io/basemaps-assets/sprites/v4/light';

export const PMTILES_URL = (import.meta.env.VITE_PMTILES_URL || '/maps/hoalac.pmtiles').trim();

export function createPmtilesStyle() {
  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sprite: SPRITE_LIGHT,
    sources: {
      protomaps: {
        type: 'vector',
        url: 'pmtiles://' + PMTILES_URL,
        attribution: '© OpenStreetMap contributors · Protomaps'
      }
    },
    layers: layers('protomaps', namedFlavor('light'), {
      lang: 'vi'
    })
  };
}

export function createFallbackStyle() {
  return 'https://tiles.openfreemap.org/styles/liberty';
}
