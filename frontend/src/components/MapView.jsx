import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, LocateFixed, RefreshCcw } from 'lucide-react';
import * as maplibre from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { PMTiles, Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';

// MapLibre v6 uses an ESM worker. Vite must bundle that worker explicitly;
// otherwise production builds can load the PMTiles header but never decode
// or request viewport vector tiles, leaving local vector basemaps blank.
maplibre.setWorkerUrl(maplibreWorkerUrl);
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  MAP_COVERAGE_BOUNDS,
  SERVICE_AREAS_GEOJSON,
  isInsideMapCoverageBounds,
  isInsideServiceCoverage
} from '../mapConfig.js';
import {
  PMTILES_URL,
  BUILDINGS_PMTILES_URL,
  SATELLITE_PROVIDER,
  HAS_SATELLITE_FALLBACK,
  createFallbackStyle,
  createPmtilesStyle,
  localPmtilesAvailable,
  supplementalBuildingsAvailable
} from '../localBasemap.js';
import { getBestBrowserLocation } from '../utils/geolocation.js';

const DATA_SOURCE_ID = 'hola-data-layers';
const ROUTE_SOURCE_ID = 'hola-route-source';
const COVERAGE_SOURCE_ID = 'hola-service-areas';
const PLACE_SOURCE_ID = 'hola-place-clusters';
const PLACE_CLUSTER_LAYER_ID = 'hm-place-clusters';
const PLACE_CLUSTER_COUNT_LAYER_ID = 'hm-place-cluster-count';
const PLACE_POINT_LAYER_ID = 'hm-place-cluster-point';
const PLACE_POINT_LABEL_LAYER_ID = 'hm-place-cluster-point-label';
const PLACE_NAME_LABEL_LAYER_ID = 'hm-place-name-label';
const PLACE_CLUSTER_MAX_ZOOM = 13;

const BUILDING_2D_LAYER_IDS = [
  'hola-overture-building',
  'hola-overture-building-part'
];
const BUILDING_3D_LAYER_IDS = [
  'hola-overture-building-3d',
  'hola-overture-building-part-3d'
];

const DATA_LAYER_IDS = {
  TERRAIN: 'hm-terrain',
  WATER: 'hm-water',
  BUILDING: 'hm-building',
  PLANNING: 'hm-planning',
  FLOOD: 'hm-flood',
  ROAD: 'hm-road',
  ROAD_CLOSURE: 'hm-road-closure',
  LANDMARK: 'hm-landmark',
  EVENT: 'hm-event',
  ALERT: 'hm-alert'
};

const DATA_AUX_LAYER_IDS = {
  FLOOD: ['hm-flood-report-point'],
  ROAD_CLOSURE: ['hm-road-closure-report-point']
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const PLACE_MARKER_LIBRARY = [
  { id: 'hm-marker-cafe', key: 'cafe', color: '#9a5b19' },
  { id: 'hm-marker-food', key: 'food', color: '#ee5a2f' },
  { id: 'hm-marker-homestay', key: 'homestay', color: '#7857c8' },
  { id: 'hm-marker-villa', key: 'villa', color: '#6d4dc2' },
  { id: 'hm-marker-tourism', key: 'tourism', color: '#1684b8' },
  { id: 'hm-marker-checkin', key: 'checkin', color: '#d84983' },
  { id: 'hm-marker-experience', key: 'experience', color: '#7148ca' },
  { id: 'hm-marker-school', key: 'school', color: '#2c6fd6' },
  { id: 'hm-marker-health', key: 'health', color: '#d64545' },
  { id: 'hm-marker-market', key: 'market', color: '#2f9561' },
  { id: 'hm-marker-bank', key: 'bank', color: '#2777a8' },
  { id: 'hm-marker-fuel', key: 'fuel', color: '#198276' },
  { id: 'hm-marker-government', key: 'government', color: '#5b6878' },
  { id: 'hm-marker-sport', key: 'sport', color: '#258967' },
  { id: 'hm-marker-service', key: 'service', color: '#6b7280' },
  { id: 'hm-marker-transport', key: 'transport', color: '#168b8a' },
  { id: 'hm-marker-property', key: 'property', color: '#8a4f31' },
  { id: 'hm-marker-default', key: 'default', color: '#174d41' }
];

const PLACE_MARKER_BY_ID = new Map(
  PLACE_MARKER_LIBRARY.map((item) => [item.id, item])
);

function normalizeMarkerCategory(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function categoryMarkerMeta(category) {
  const raw = typeof category === 'object'
    ? [category?.name, category?.slug].filter(Boolean).join(' ')
    : category;
  const normalized = normalizeMarkerCategory(raw);
  const has = (...values) => values.some((value) => normalized.includes(value));

  if (has('cafe', 'coffee', 'ca phe')) return PLACE_MARKER_BY_ID.get('hm-marker-cafe');
  if (has('an uong', 'food', 'restaurant', 'nha hang', 'quan an')) return PLACE_MARKER_BY_ID.get('hm-marker-food');
  if (has('homestay', 'luu tru', 'hotel', 'resort')) return PLACE_MARKER_BY_ID.get('hm-marker-homestay');
  if (has('villa', 'biet thu')) return PLACE_MARKER_BY_ID.get('hm-marker-villa');
  if (has('khu du lich', 'tourism', 'tourist', 'du lich')) return PLACE_MARKER_BY_ID.get('hm-marker-tourism');
  if (has('check in', 'checkin', 'chup anh')) return PLACE_MARKER_BY_ID.get('hm-marker-checkin');
  if (has('trai nghiem', 'vui choi', 'giai tri', 'experience')) return PLACE_MARKER_BY_ID.get('hm-marker-experience');
  if (has('truong', 'school', 'giao duc')) return PLACE_MARKER_BY_ID.get('hm-marker-school');
  if (has('y te', 'hospital', 'medical', 'benh vien', 'phong kham')) return PLACE_MARKER_BY_ID.get('hm-marker-health');
  if (has('sieu thi', 'cua hang', 'shop', 'market')) return PLACE_MARKER_BY_ID.get('hm-marker-market');
  if (has('ngan hang', 'atm', 'bank')) return PLACE_MARKER_BY_ID.get('hm-marker-bank');
  if (has('nhien lieu', 'tram xang', 'cay xang', 'sac', 'fuel')) return PLACE_MARKER_BY_ID.get('hm-marker-fuel');
  if (has('co quan', 'government', 'ubnd', 'hanh chinh')) return PLACE_MARKER_BY_ID.get('hm-marker-government');
  if (has('the thao', 'sport', 'gym', 'fitness')) return PLACE_MARKER_BY_ID.get('hm-marker-sport');
  if (has('dich vu', 'service', 'spa', 'salon')) return PLACE_MARKER_BY_ID.get('hm-marker-service');
  if (has('giao thong', 'transport', 'ben xe', 'tram xe')) return PLACE_MARKER_BY_ID.get('hm-marker-transport');
  if (has('bat dong san', 'real estate', 'nha dat')) return PLACE_MARKER_BY_ID.get('hm-marker-property');

  return PLACE_MARKER_BY_ID.get('hm-marker-default');
}

function strokeLine(context, points) {
  context.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
}

function drawMarkerGlyph(context, key) {
  context.save();
  context.strokeStyle = '#ffffff';
  context.fillStyle = '#ffffff';
  context.lineWidth = 3.8;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  if (key === 'cafe') {
    context.strokeRect(34, 33, 23, 14);
    context.beginPath(); context.arc(58, 40, 6, -Math.PI / 2, Math.PI / 2); context.stroke();
    strokeLine(context, [[35, 52], [58, 52]]);
    strokeLine(context, [[39, 29], [39, 24]]);
    strokeLine(context, [[47, 29], [47, 22]]);
    strokeLine(context, [[55, 29], [55, 25]]);
  } else if (key === 'food') {
    strokeLine(context, [[36, 26], [36, 53]]);
    strokeLine(context, [[31, 26], [31, 36], [41, 36], [41, 26]]);
    strokeLine(context, [[58, 26], [53, 40], [58, 40], [58, 53]]);
  } else if (key === 'homestay' || key === 'villa' || key === 'property') {
    strokeLine(context, [[31, 39], [48, 25], [65, 39]]);
    context.strokeRect(35, 38, 26, 18);
    context.strokeRect(45, 46, 7, 10);
  } else if (key === 'tourism') {
    strokeLine(context, [[29, 53], [42, 34], [50, 44], [57, 35], [67, 53]]);
    context.beginPath(); context.arc(62, 28, 5, 0, Math.PI * 2); context.stroke();
  } else if (key === 'checkin') {
    context.strokeRect(31, 32, 34, 23);
    context.strokeRect(39, 27, 12, 5);
    context.beginPath(); context.arc(48, 43, 7, 0, Math.PI * 2); context.stroke();
  } else if (key === 'experience') {
    context.beginPath(); context.arc(48, 40, 17, 0, Math.PI * 2); context.stroke();
    strokeLine(context, [[55, 31], [51, 43], [40, 49], [45, 36], [55, 31]]);
  } else if (key === 'school') {
    strokeLine(context, [[29, 36], [48, 27], [67, 36], [48, 45], [29, 36]]);
    strokeLine(context, [[36, 42], [36, 50], [48, 55], [60, 50], [60, 42]]);
  } else if (key === 'health') {
    context.fillRect(44, 27, 8, 27);
    context.fillRect(34, 37, 28, 8);
  } else if (key === 'market') {
    context.strokeRect(34, 35, 28, 21);
    context.beginPath(); context.arc(48, 35, 9, Math.PI, 0); context.stroke();
  } else if (key === 'bank' || key === 'government') {
    strokeLine(context, [[30, 35], [48, 26], [66, 35]]);
    strokeLine(context, [[33, 55], [63, 55]]);
    for (const x of [37, 48, 59]) strokeLine(context, [[x, 38], [x, 51]]);
  } else if (key === 'fuel') {
    context.strokeRect(33, 29, 19, 27);
    context.strokeRect(37, 33, 11, 8);
    strokeLine(context, [[52, 34], [59, 34], [62, 39], [62, 52]]);
    context.beginPath(); context.arc(62, 53, 2.5, 0, Math.PI * 2); context.fill();
  } else if (key === 'sport') {
    context.beginPath(); context.arc(48, 40, 17, 0, Math.PI * 2); context.stroke();
    strokeLine(context, [[33, 40], [63, 40]]);
    strokeLine(context, [[48, 24], [48, 56]]);
  } else if (key === 'service') {
    strokeLine(context, [[34, 27], [61, 54]]);
    strokeLine(context, [[61, 27], [34, 54]]);
    context.beginPath(); context.arc(34, 27, 4, 0, Math.PI * 2); context.stroke();
    context.beginPath(); context.arc(61, 54, 4, 0, Math.PI * 2); context.stroke();
  } else if (key === 'transport') {
    context.strokeRect(32, 29, 32, 23);
    strokeLine(context, [[36, 36], [60, 36]]);
    context.beginPath(); context.arc(39, 54, 3, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.arc(57, 54, 3, 0, Math.PI * 2); context.fill();
  } else {
    context.beginPath(); context.arc(48, 40, 8, 0, Math.PI * 2); context.stroke();
    context.beginPath(); context.arc(48, 40, 2.5, 0, Math.PI * 2); context.fill();
  }

  context.restore();
}

function createPlaceMarkerImage({ key, color }) {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  context.clearRect(0, 0, size, size);
  context.save();
  context.shadowColor = 'rgba(12, 43, 36, .28)';
  context.shadowBlur = 10;
  context.shadowOffsetY = 5;
  context.beginPath();
  context.moveTo(48, 89);
  context.bezierCurveTo(42, 78, 19, 59, 19, 39);
  context.bezierCurveTo(19, 22, 32, 9, 48, 9);
  context.bezierCurveTo(64, 9, 77, 22, 77, 39);
  context.bezierCurveTo(77, 59, 54, 78, 48, 89);
  context.closePath();
  context.fillStyle = color;
  context.fill();
  context.restore();

  context.beginPath();
  context.moveTo(48, 89);
  context.bezierCurveTo(42, 78, 19, 59, 19, 39);
  context.bezierCurveTo(19, 22, 32, 9, 48, 9);
  context.bezierCurveTo(64, 9, 77, 22, 77, 39);
  context.bezierCurveTo(77, 59, 54, 78, 48, 89);
  context.closePath();
  context.lineWidth = 5;
  context.strokeStyle = '#ffffff';
  context.stroke();

  context.beginPath();
  context.arc(48, 40, 22, 0, Math.PI * 2);
  context.fillStyle = 'rgba(255,255,255,.10)';
  context.fill();

  drawMarkerGlyph(context, key);
  return context.getImageData(0, 0, size, size);
}

function ensurePlaceMarkerImages(map) {
  if (typeof document === 'undefined') return;

  for (const marker of PLACE_MARKER_LIBRARY) {
    if (map.hasImage(marker.id)) continue;

    map.addImage(
      marker.id,
      createPlaceMarkerImage(marker),
      { pixelRatio: 2 }
    );
  }
}

function emptyFeatureCollection() {
  return { type: 'FeatureCollection', features: [] };
}

function placeFeatureCollection(places = []) {
  return {
    type: 'FeatureCollection',
    features: places.map((place) => {
      const marker = categoryMarkerMeta(place.category);

      return {
        type: 'Feature',
        id: String(place.id),
        geometry: {
          type: 'Point',
          coordinates: [Number(place.lng), Number(place.lat)]
        },
        properties: {
          placeId: String(place.id),
          name: place.name || '',
          category: place.category || 'Địa điểm',
          rating: Number(place.rating || 0),
          markerIcon: marker.id,
          markerColor: marker.color
        }
      };
    })
  };
}

function applyPlaceInteractionState(map, selectedPlaceId, hoveredPlaceId) {
  if (!map?.getSource(PLACE_SOURCE_ID)) return;

  try {
    map.removeFeatureState({ source: PLACE_SOURCE_ID });

    if (selectedPlaceId !== undefined && selectedPlaceId !== null) {
      map.setFeatureState(
        { source: PLACE_SOURCE_ID, id: String(selectedPlaceId) },
        { selected: true }
      );
    }

    if (
      hoveredPlaceId !== undefined &&
      hoveredPlaceId !== null &&
      String(hoveredPlaceId) !== String(selectedPlaceId)
    ) {
      map.setFeatureState(
        { source: PLACE_SOURCE_ID, id: String(hoveredPlaceId) },
        { hovered: true }
      );
    }
  } catch {
    // Feature state can briefly be unavailable while a basemap style switches.
  }
}

function addPlaceClusterLayers(map, places = []) {
  if (!map?.isStyleLoaded()) return;

  ensurePlaceMarkerImages(map);

  const data = placeFeatureCollection(places);
  const source = map.getSource(PLACE_SOURCE_ID);

  if (source) {
    source.setData(data);
  } else {
    map.addSource(PLACE_SOURCE_ID, {
      type: 'geojson',
      data,
      cluster: true,
      clusterMaxZoom: PLACE_CLUSTER_MAX_ZOOM,
      clusterRadius: 54
    });
  }

  if (!map.getLayer(PLACE_CLUSTER_LAYER_ID)) {
    map.addLayer({
      id: PLACE_CLUSTER_LAYER_ID,
      type: 'circle',
      source: PLACE_SOURCE_ID,
      maxzoom: 14,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#174d41',
          20, '#0f6a57',
          60, '#0b7c64'
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          18,
          20, 22,
          60, 27
        ],
        'circle-stroke-width': 3,
        'circle-stroke-color': 'rgba(255,255,255,.92)'
      }
    });
  }

  if (!map.getLayer(PLACE_CLUSTER_COUNT_LAYER_ID)) {
    map.addLayer({
      id: PLACE_CLUSTER_COUNT_LAYER_ID,
      type: 'symbol',
      source: PLACE_SOURCE_ID,
      maxzoom: 14,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 11,
        'text-font': ['Noto Sans Regular']
      },
      paint: {
        'text-color': '#ffffff'
      }
    });
  }

  // GPU interaction halo behind the category icon. It is invisible by default
  // and only appears for selected / hovered places.
  if (!map.getLayer(PLACE_POINT_LAYER_ID)) {
    map.addLayer({
      id: PLACE_POINT_LAYER_ID,
      type: 'circle',
      source: PLACE_SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          12.5,
          ['case',
            ['boolean', ['feature-state', 'selected'], false], 22,
            ['boolean', ['feature-state', 'hovered'], false], 20,
            16
          ],
          17,
          ['case',
            ['boolean', ['feature-state', 'selected'], false], 29,
            ['boolean', ['feature-state', 'hovered'], false], 26,
            20
          ]
        ],
        'circle-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], '#f4b942',
          ['boolean', ['feature-state', 'hovered'], false], '#ffffff',
          'rgba(255,255,255,0)'
        ],
        'circle-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], 0.34,
          ['boolean', ['feature-state', 'hovered'], false], 0.72,
          0
        ],
        'circle-stroke-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], 3,
          ['boolean', ['feature-state', 'hovered'], false], 2,
          0
        ],
        'circle-stroke-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], '#d89a1c',
          ['boolean', ['feature-state', 'hovered'], false], '#5d8f80',
          'rgba(255,255,255,0)'
        ]
      }
    });
  }

  // Real illustrated POI marker. This stays in MapLibre/WebGL instead of DOM.
  if (!map.getLayer(PLACE_POINT_LABEL_LAYER_ID)) {
    map.addLayer({
      id: PLACE_POINT_LABEL_LAYER_ID,
      type: 'symbol',
      source: PLACE_SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': ['coalesce', ['get', 'markerIcon'], 'hm-marker-default'],
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          12.5, ['case',
            ['boolean', ['feature-state', 'selected'], false], 0.80,
            ['boolean', ['feature-state', 'hovered'], false], 0.70,
            0.62
          ],
          14, ['case',
            ['boolean', ['feature-state', 'selected'], false], 0.92,
            ['boolean', ['feature-state', 'hovered'], false], 0.82,
            0.72
          ],
          17, ['case',
            ['boolean', ['feature-state', 'selected'], false], 1.08,
            ['boolean', ['feature-state', 'hovered'], false], 0.98,
            0.88
          ]
        ],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
      },
      paint: {
        'icon-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], 1,
          ['boolean', ['feature-state', 'hovered'], false], 1,
          0.94
        ]
      }
    });
  }

  // Place names only appear when the user is close enough for them to be useful.
  if (!map.getLayer(PLACE_NAME_LABEL_LAYER_ID)) {
    map.addLayer({
      id: PLACE_NAME_LABEL_LAYER_ID,
      type: 'symbol',
      source: PLACE_SOURCE_ID,
      minzoom: 15.4,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-offset': [0, 2.15],
        'text-anchor': 'top',
        'text-max-width': 12,
        'text-optional': true,
        'text-allow-overlap': false
      },
      paint: {
        'text-color': '#173f35',
        'text-halo-color': 'rgba(255,255,255,.96)',
        'text-halo-width': 1.6,
        'text-halo-blur': 0.35
      }
    });
  }
}

function basemapStyleKey(mode, usingLocalPmtiles, usingSupplementalBuildings) {
  return [
    mode,
    usingLocalPmtiles ? 'local' : 'fallback',
    usingSupplementalBuildings ? 'buildings' : 'no-buildings'
  ].join(':');
}


function loadExternalScript(src, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-hola-src="' + src + '"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window[globalName]), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.holaSrc = src;
    script.onload = () => resolve(window[globalName]);
    script.onerror = () => reject(new Error('Không tải được thư viện bản đồ: ' + src));
    document.head.appendChild(script);
  });
}

function addCoverage(map) {
  if (!map.isStyleLoaded()) return;

  // Do not use a filled outside-area mask. It can reappear during asynchronous
  // style switches and looks like missing satellite tiles. maxBounds already
  // constrains navigation, while this lightweight outline keeps the product
  // coverage visible without covering imagery.
  if (!map.getSource(COVERAGE_SOURCE_ID)) {
    map.addSource(COVERAGE_SOURCE_ID, {
      type: 'geojson',
      data: SERVICE_AREAS_GEOJSON
    });

    map.addLayer({
      id: 'hm-service-area-line',
      type: 'line',
      source: COVERAGE_SOURCE_ID,
      paint: {
        'line-color': '#0d6a56',
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.25, 16, 2],
        'line-opacity': 0.46,
        'line-dasharray': [2, 1.5]
      }
    });
  }
}

function addDataLayers(map, data) {
  if (!map.isStyleLoaded()) return;

  if (!map.getSource(DATA_SOURCE_ID)) {
    map.addSource(DATA_SOURCE_ID, {
      type: 'geojson',
      data: data || emptyFeatureCollection()
    });
  }

  const add = (spec) => {
    if (!map.getLayer(spec.id)) map.addLayer(spec);
  };

  add({
    id: DATA_LAYER_IDS.TERRAIN,
    type: 'fill',
    minzoom: 12,
    source: DATA_SOURCE_ID,
    filter: ['==', ['get', 'layerType'], 'TERRAIN'],
    paint: {
      'fill-color': '#a9c2a5',
      'fill-opacity': 0.10
    }
  });

  add({
    id: DATA_LAYER_IDS.WATER,
    type: 'fill',
    minzoom: 12,
    source: DATA_SOURCE_ID,
    filter: ['==', ['get', 'layerType'], 'WATER'],
    paint: {
      'fill-color': '#62b7c9',
      'fill-opacity': 0.52,
      'fill-outline-color': '#3c93a5'
    }
  });

  add({
    id: DATA_LAYER_IDS.BUILDING,
    type: 'fill',
    minzoom: 14,
    source: DATA_SOURCE_ID,
    filter: ['==', ['get', 'layerType'], 'BUILDING'],
    paint: {
      'fill-color': '#b8b0a1',
      'fill-opacity': 0.28,
      'fill-outline-color': '#8d8579'
    }
  });

  add({
    id: DATA_LAYER_IDS.PLANNING,
    type: 'fill',
    minzoom: 12.5,
    source: DATA_SOURCE_ID,
    filter: ['==', ['get', 'layerType'], 'PLANNING'],
    paint: {
      'fill-color': '#8b5cf6',
      'fill-opacity': 0.12,
      'fill-outline-color': '#6d28d9'
    }
  });

  add({
    id: DATA_LAYER_IDS.FLOOD,
    type: 'fill',
    minzoom: 12.5,
    source: DATA_SOURCE_ID,
    filter: ['==', ['get', 'layerType'], 'FLOOD'],
    paint: {
      'fill-color': [
        'match',
        ['get', 'severity'],
        'CRITICAL', '#be123c',
        'HIGH', '#dc2626',
        'MEDIUM', '#f59e0b',
        'LOW', '#38bdf8',
        '#60a5fa'
      ],
      'fill-opacity': 0.24,
      'fill-outline-color': '#2563eb'
    }
  });

  add({
    id: 'hm-flood-report-point',
    type: 'circle',
    minzoom: 12.5,
    source: DATA_SOURCE_ID,
    filter: [
      'all',
      ['==', ['get', 'layerType'], 'FLOOD'],
      ['==', ['geometry-type'], 'Point']
    ],
    paint: {
      'circle-radius': [
        'match',
        ['get', 'severity'],
        'CRITICAL', 11,
        'HIGH', 10,
        'MEDIUM', 9,
        8
      ],
      'circle-color': '#0ea5e9',
      'circle-opacity': 0.9,
      'circle-stroke-width': [
        'case',
        ['==', ['get', 'verificationStatus'], 'VERIFIED'], 3,
        2
      ],
      'circle-stroke-color': [
        'case',
        ['==', ['get', 'verificationStatus'], 'VERIFIED'], '#075985',
        '#ffffff'
      ]
    }
  });

  add({
    id: DATA_LAYER_IDS.ROAD,
    type: 'line',
    minzoom: 13,
    source: DATA_SOURCE_ID,
    filter: ['==', ['get', 'layerType'], 'ROAD'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#334155',
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.2, 17, 4.5],
      'line-opacity': 0.88
    }
  });

  add({
    id: DATA_LAYER_IDS.ROAD_CLOSURE,
    type: 'line',
    minzoom: 13,
    source: DATA_SOURCE_ID,
    filter: ['==', ['get', 'layerType'], 'ROAD_CLOSURE'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#dc2626',
      'line-width': 5,
      'line-dasharray': [1.5, 1.3]
    }
  });

  add({
    id: 'hm-road-closure-report-point',
    type: 'circle',
    minzoom: 12.5,
    source: DATA_SOURCE_ID,
    filter: [
      'all',
      ['==', ['get', 'layerType'], 'ROAD_CLOSURE'],
      ['==', ['geometry-type'], 'Point']
    ],
    paint: {
      'circle-radius': [
        'match',
        ['get', 'severity'],
        'CRITICAL', 11,
        'HIGH', 10,
        'MEDIUM', 9,
        8
      ],
      'circle-color': '#dc2626',
      'circle-opacity': 0.92,
      'circle-stroke-width': [
        'case',
        ['==', ['get', 'verificationStatus'], 'VERIFIED'], 3,
        2
      ],
      'circle-stroke-color': [
        'case',
        ['==', ['get', 'verificationStatus'], 'VERIFIED'], '#7f1d1d',
        '#ffffff'
      ]
    }
  });

  for (const [type, color, radius] of [
    ['LANDMARK', '#0f766e', 6],
    ['EVENT', '#7c3aed', 7],
    ['ALERT', '#dc2626', 8]
  ]) {
    add({
      id: DATA_LAYER_IDS[type],
      type: 'circle',
      minzoom: type === 'LANDMARK' ? 12.5 : 13,
      source: DATA_SOURCE_ID,
      filter: ['==', ['get', 'layerType'], type],
      paint: {
        'circle-radius': radius,
        'circle-color': color,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });
  }
}

function setBuildingDimensionVisibility(map, enabled) {
  if (!map?.isStyleLoaded()) return;

  BUILDING_2D_LAYER_IDS.forEach((id) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', enabled ? 'none' : 'visible');
    }
  });

  BUILDING_3D_LAYER_IDS.forEach((id) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', enabled ? 'visible' : 'none');
    }
  });
}

function setLayerVisibility(map, activeLayers) {
  if (!map?.isStyleLoaded()) return;
  Object.entries(DATA_LAYER_IDS).forEach(([type, id]) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', activeLayers.includes(type) ? 'visible' : 'none');
    }
  });

  Object.entries(DATA_AUX_LAYER_IDS).forEach(([type, ids]) => {
    ids.forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', activeLayers.includes(type) ? 'visible' : 'none');
      }
    });
  });
}

function renderRoute(map, route, maplibre, fittedRouteKeyRef) {
  if (!map?.isStyleLoaded()) return;

  if (!route?.geometry?.coordinates?.length) {
    ['hm-route-line', 'hm-route-casing'].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
    fittedRouteKeyRef.current = '';
    return;
  }

  const coordinates = route.geometry.coordinates.filter(([lng, lat]) =>
    isInsideServiceCoverage(lng, lat)
  );
  if (coordinates.length < 2) return;

  const feature = {
    type: 'Feature',
    properties: {},
    geometry: { ...route.geometry, coordinates }
  };

  const source = map.getSource(ROUTE_SOURCE_ID);
  if (source) {
    source.setData(feature);
  } else {
    map.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data: feature });
    map.addLayer({
      id: 'hm-route-casing',
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.95 }
    });
    map.addLayer({
      id: 'hm-route-line',
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#0d5144', 'line-width': 6, 'line-opacity': 1 }
    });
  }

  const routeKey = route.origin?.lng + ',' + route.origin?.lat + '>' +
    route.destination?.lng + ',' + route.destination?.lat;

  if (fittedRouteKeyRef.current !== routeKey) {
    const bounds = new maplibre.LngLatBounds();
    coordinates.forEach((coordinate) => bounds.extend(coordinate));
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: { top: 120, right: 380, bottom: 100, left: 390 },
        duration: 650,
        maxZoom: 16
      });
    }
    fittedRouteKeyRef.current = routeKey;
  }
}

export default function MapView({
  places = [],
  selectedPlaceId,
  hoveredPlaceId,
  onSelectPlace,
  onHoverPlace,
  onSelectStatusFeature,
  onUserLocation,
  userLocation,
  route,
  mapData = emptyFeatureCollection(),
  activeLayers = [],
  basemapMode = 'streets',
  onViewportChange,
  focusRegion
}) {
  const mapRef = useRef(null);
  const maplibreRef = useRef(null);
  const containerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const fittedRouteKeyRef = useRef('');
  const latestMapDataRef = useRef(mapData);
  const latestActiveLayersRef = useRef(activeLayers);
  const latestRouteRef = useRef(route);
  const latestPlacesRef = useRef([]);
  const latestSelectPlaceRef = useRef(onSelectPlace);
  const latestHoverPlaceRef = useRef(onHoverPlace);
  const latestSelectStatusFeatureRef = useRef(onSelectStatusFeature);
  const latestSelectedPlaceIdRef = useRef(selectedPlaceId);
  const latestHoveredPlaceIdRef = useRef(hoveredPlaceId);
  const hoveredPointerPlaceIdRef = useRef(null);
  const styleSwitchIdRef = useRef(0);
  const styleSwitchTimerRef = useRef(null);
  const appliedStyleKeyRef = useRef('');
  const locationNoticeTimerRef = useRef(null);
  const lastFocusRegionRef = useRef('');

  const [interactiveReady, setInteractiveReady] = useState(false);
  const [mapBooted, setMapBooted] = useState(false);
  const [mapError, setMapError] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState(null);
  const [usingLocalPmtiles, setUsingLocalPmtiles] = useState(false);
  const [usingSupplementalBuildings, setUsingSupplementalBuildings] = useState(false);
  const [basemapHealth, setBasemapHealth] = useState('checking');
  const [building3D, setBuilding3D] = useState(false);
  const [attributionOpen, setAttributionOpen] = useState(false);

  const validPlaces = useMemo(
    () => places.filter((place) =>
      Number.isFinite(Number(place.lng)) &&
      Number.isFinite(Number(place.lat)) &&
      isInsideServiceCoverage(place.lng, place.lat)
    ),
    [places]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    let cancelled = false;
    let idleHandle = null;

    const initialize = async () => {
      try {
        // Same-origin map archives are part of the production app contract.
        // Do not block MapLibre startup behind HEAD probes: some reverse-proxy /
        // browser combinations delay HEAD even though byte-range GET works.
        // Remote archive URLs are still probed before use.
        const sameOriginBasemap = PMTILES_URL.startsWith('/');
        const sameOriginBuildings = BUILDINGS_PMTILES_URL.startsWith('/');

        const [hasLocalPmtiles, hasSupplementalBuildings] = await Promise.all([
          sameOriginBasemap ? Promise.resolve(true) : localPmtilesAvailable(),
          sameOriginBuildings ? Promise.resolve(true) : supplementalBuildingsAvailable()
        ]);
        if (cancelled || !containerRef.current) return;

        const protocol = new Protocol();
        try {
          maplibre.addProtocol('pmtiles', protocol.tile);
        } catch {
          // Protocol may already exist after a hot reload.
        }

        if (cancelled) return;

        const canUseSupplementalBuildings = hasLocalPmtiles && hasSupplementalBuildings;
        setUsingLocalPmtiles(hasLocalPmtiles);
        setUsingSupplementalBuildings(canUseSupplementalBuildings);

        if (hasLocalPmtiles) {
          protocol.add(new PMTiles(PMTILES_URL));
        }
        if (canUseSupplementalBuildings) {
          protocol.add(new PMTiles(BUILDINGS_PMTILES_URL));
        }

        maplibreRef.current = maplibre;
        const map = new maplibre.Map({
          container: containerRef.current,
          style: (hasLocalPmtiles || basemapMode === 'satellite')
            ? createPmtilesStyle(basemapMode, {
                includeSupplementalBuildings: canUseSupplementalBuildings
              })
            : createFallbackStyle(),
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          maxBounds: MAP_COVERAGE_BOUNDS,
          renderWorldCopies: false,
          refreshExpiredTiles: false,
          fadeDuration: 0,
          maxTileCacheSize: 18,
          attributionControl: false
        });

        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), 'bottom-right');
        map.addControl(new maplibre.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-right');

        // The MapLibre instance is interactive immediately. Do not keep the
        // full-screen placeholder over it while glyphs/sprites/vector tiles
        // continue loading in the background.
        setMapBooted(true);

        const notifyViewport = () => {
          const b = map.getBounds();
          const zoom = map.getZoom();
          onViewportChange?.({
            west: b.getWest(),
            south: b.getSouth(),
            east: b.getEast(),
            north: b.getNorth(),
            zoom
          });
        };

        map.on('load', () => {
          addCoverage(map);
          addDataLayers(map, mapData);
          addPlaceClusterLayers(map, validPlaces);
          applyPlaceInteractionState(
            map,
            latestSelectedPlaceIdRef.current,
            latestHoveredPlaceIdRef.current
          );
          setLayerVisibility(map, activeLayers);
          appliedStyleKeyRef.current = basemapStyleKey(
            basemapMode,
            hasLocalPmtiles,
            canUseSupplementalBuildings
          );
          setInteractiveReady(true);
          notifyViewport();
          requestAnimationFrame(() => map.resize());

          if (basemapMode === 'satellite') {
            setBasemapHealth('ok');
            return;
          }

          if (!hasLocalPmtiles) {
            setBasemapHealth('fallback');
            return;
          }

          // A valid local archive is enough to keep the local renderer active.
          // Do not fall back merely because vector features have not rendered
          // within a short timeout: after a Vite restart / cold browser cache,
          // z15-z17 PMTiles can legitimately take longer than 1.8 seconds.
          setBasemapHealth('ok');
        });

        map.on('moveend', notifyViewport);

        const zoomToCluster = (event) => {
          const feature = event.features?.[0];
          const clusterId = feature?.properties?.cluster_id;
          if (clusterId === undefined || clusterId === null) return;

          const source = map.getSource(PLACE_SOURCE_ID);
          if (!source?.getClusterExpansionZoom) return;

          const go = (zoom) => {
            if (!Number.isFinite(Number(zoom))) return;
            map.easeTo({
              center: feature.geometry.coordinates,
              zoom: Math.min(Number(zoom) + 0.15, 15),
              duration: 450
            });
          };

          if (source.getClusterExpansionZoom.length >= 2) {
            source.getClusterExpansionZoom(clusterId, (error, zoom) => {
              if (!error) go(zoom);
            });
          } else {
            Promise.resolve(source.getClusterExpansionZoom(clusterId))
              .then(go)
              .catch(() => {});
          }
        };

        const selectClusterPoint = (event) => {
          const feature = event.features?.[0];
          const placeId = feature?.properties?.placeId;
          if (!placeId) return;

          const place = latestPlacesRef.current.find(
            (item) => String(item.id) === String(placeId)
          );
          if (place) latestSelectPlaceRef.current?.(place);
        };

        const hoverClusterPoint = (event) => {
          const placeId = event.features?.[0]?.properties?.placeId;
          if (!placeId || String(hoveredPointerPlaceIdRef.current) === String(placeId)) {
            return;
          }

          hoveredPointerPlaceIdRef.current = String(placeId);
          latestHoverPlaceRef.current?.(String(placeId));
        };

        const clearClusterPointHover = () => {
          if (hoveredPointerPlaceIdRef.current === null) return;
          hoveredPointerPlaceIdRef.current = null;
          latestHoverPlaceRef.current?.(null);
        };

        map.on('click', PLACE_CLUSTER_LAYER_ID, zoomToCluster);
        map.on('click', PLACE_POINT_LABEL_LAYER_ID, selectClusterPoint);
        map.on('mousemove', PLACE_POINT_LABEL_LAYER_ID, hoverClusterPoint);
        map.on('mouseleave', PLACE_POINT_LABEL_LAYER_ID, clearClusterPointHover);

        map.on('mouseenter', PLACE_CLUSTER_LAYER_ID, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', PLACE_CLUSTER_LAYER_ID, () => {
          map.getCanvas().style.cursor = '';
        });
        map.on('mouseenter', PLACE_POINT_LABEL_LAYER_ID, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', PLACE_POINT_LABEL_LAYER_ID, () => {
          map.getCanvas().style.cursor = '';
        });

        let localSourceErrorCount = 0;

        map.on('error', (event) => {
          const message = event?.error?.message || '';
          const sourceId = event?.sourceId || event?.source?.id || '';

          if (message.toLowerCase().includes('webgl')) {
            setMapError('Trình duyệt hiện không hỗ trợ WebGL cho bản đồ.');
            return;
          }

          // Supplemental buildings are optional. If their archive is broken,
          // disable only that source instead of throwing away the whole local
          // basemap and all Overture/OSM detail.
          if (
            sourceId === 'overture-buildings' ||
            message.toLowerCase().includes('hoalac-buildings.pmtiles')
          ) {
            console.warn('[Hola Maps] Supplemental building archive failed:', message);
            setUsingSupplementalBuildings(false);
            return;
          }

          const isLocalPmtilesError =
            sourceId === 'protomaps' ||
            message.toLowerCase().includes('hoalac.pmtiles') ||
            message.toLowerCase().includes('pmtiles://');

          if (!isLocalPmtilesError) return;

          localSourceErrorCount += 1;
          console.warn('[Hola Maps] Local PMTiles source error', localSourceErrorCount, message);

          // Only abandon the local map after repeated real source failures.
          if (localSourceErrorCount < 3 || !mapRef.current) return;

          setBasemapHealth('broken');
          setUsingLocalPmtiles(false);
        });

        map.on('click', (event) => {
          const ids = [
            ...Object.values(DATA_LAYER_IDS),
            ...Object.values(DATA_AUX_LAYER_IDS).flat()
          ].filter((id) => map.getLayer(id));
          if (!ids.length) return;
          const features = map.queryRenderedFeatures(event.point, { layers: ids });
          const feature = features[0];
          if (!feature) return;

          const props = feature.properties || {};
          const sourceLine = props.sourceLabel
            ? '<small>' + escapeHtml(props.sourceLabel) +
              (props.verificationStatus === 'VERIFIED' ? ' · Đã xác minh' : ' · Chưa xác minh') +
              '</small>'
            : '';
          const confirmationLine = props.reportId
            ? '<small>' +
              escapeHtml(String(props.activeConfirmations || 0)) + ' vẫn còn · ' +
              escapeHtml(String(props.resolvedConfirmations || 0)) + ' đã hết' +
              '</small>'
            : '';

          new maplibre.Popup({ closeButton: true, className: 'hm-data-popup' })
            .setLngLat(event.lngLat)
            .setHTML(
              '<div class="hm-popup-card">' +
              '<span>' + escapeHtml(props.layerType || 'DATA') + '</span>' +
              '<strong>' + escapeHtml(props.name || 'Dữ liệu Hola Maps') + '</strong>' +
              sourceLine +
              (props.description ? '<p>' + escapeHtml(props.description) + '</p>' : '') +
              confirmationLine +
              '</div>'
            )
            .addTo(map);

          if (props.reportId) {
            latestSelectStatusFeatureRef.current?.({
              ...props,
              lng: event.lngLat.lng,
              lat: event.lngLat.lat
            });
          }
        });
      } catch (error) {
        console.error('[Hola Maps] initialize error', error);
        setMapError('Không thể khởi tạo bản đồ cục bộ.');
      }
    };

    if ('requestIdleCallback' in window) {
      idleHandle = window.requestIdleCallback(initialize, { timeout: 100 });
    } else {
      requestAnimationFrame(initialize);
    }

    return () => {
      cancelled = true;
      if (idleHandle && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleHandle);
      if (styleSwitchTimerRef.current) window.clearTimeout(styleSwitchTimerRef.current);
      if (locationNoticeTimerRef.current) window.clearTimeout(locationNoticeTimerRef.current);
      userMarkerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
    };
  }, []);

  useEffect(() => {
    latestMapDataRef.current = mapData;
  }, [mapData]);

  useEffect(() => {
    latestActiveLayersRef.current = activeLayers;
  }, [activeLayers]);

  useEffect(() => {
    latestRouteRef.current = route;
  }, [route]);

  useEffect(() => {
    latestPlacesRef.current = validPlaces;
  }, [validPlaces]);

  useEffect(() => {
    latestSelectPlaceRef.current = onSelectPlace;
  }, [onSelectPlace]);

  useEffect(() => {
    latestHoverPlaceRef.current = onHoverPlace;
  }, [onHoverPlace]);

  useEffect(() => {
    latestSelectStatusFeatureRef.current = onSelectStatusFeature;
  }, [onSelectStatusFeature]);

  useEffect(() => {
    latestSelectedPlaceIdRef.current = selectedPlaceId;
    const map = mapRef.current;
    if (!map || !interactiveReady) return;
    applyPlaceInteractionState(
      map,
      selectedPlaceId,
      latestHoveredPlaceIdRef.current
    );
  }, [selectedPlaceId, interactiveReady]);

  useEffect(() => {
    latestHoveredPlaceIdRef.current = hoveredPlaceId;
    const map = mapRef.current;
    if (!map || !interactiveReady) return;
    applyPlaceInteractionState(
      map,
      latestSelectedPlaceIdRef.current,
      hoveredPlaceId
    );
  }, [hoveredPlaceId, interactiveReady]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !mapBooted) return undefined;

    const nextStyleKey = basemapStyleKey(
      basemapMode,
      usingLocalPmtiles,
      usingSupplementalBuildings
    );

    if (appliedStyleKeyRef.current === nextStyleKey) return undefined;

    const switchId = ++styleSwitchIdRef.current;
    let restoreHandler = null;
    let resizeTimer = null;

    if (styleSwitchTimerRef.current) {
      window.clearTimeout(styleSwitchTimerRef.current);
    }

    // Small debounce means clicking Satellite → Hybrid → Vector quickly only
    // applies the last requested mode. Previously interactiveReady=false made
    // later clicks get ignored until the first style.load completed.
    styleSwitchTimerRef.current = window.setTimeout(() => {
      if (switchId !== styleSwitchIdRef.current || !mapRef.current) return;

      const canRenderSelectedStyle =
        usingLocalPmtiles ||
        basemapMode === 'satellite' ||
        basemapMode === 'hybrid';

      const nextStyle = canRenderSelectedStyle
        ? createPmtilesStyle(basemapMode, {
            includeSupplementalBuildings: usingSupplementalBuildings
          })
        : createFallbackStyle();

      restoreHandler = () => {
        if (switchId !== styleSwitchIdRef.current || !mapRef.current) return;

        addCoverage(map);
        addDataLayers(map, latestMapDataRef.current);
        addPlaceClusterLayers(map, latestPlacesRef.current);
        applyPlaceInteractionState(
          map,
          latestSelectedPlaceIdRef.current,
          latestHoveredPlaceIdRef.current
        );
        setLayerVisibility(map, latestActiveLayersRef.current);
        setBuildingDimensionVisibility(map, building3D);
        renderRoute(map, latestRouteRef.current, maplibre, fittedRouteKeyRef);

        appliedStyleKeyRef.current = nextStyleKey;
        setInteractiveReady(true);

        requestAnimationFrame(() => {
          map.resize();
          resizeTimer = window.setTimeout(() => {
            if (switchId === styleSwitchIdRef.current && mapRef.current) {
              map.resize();
            }
          }, 120);
        });
      };

      map.once('style.load', restoreHandler);

      try {
        map.setStyle(nextStyle, { diff: false });
      } catch (error) {
        map.off('style.load', restoreHandler);
        console.error('[Hola Maps] basemap switch failed', error);
        setMapError('Không thể chuyển chế độ bản đồ. Hãy thử lại.');
      }
    }, 120);

    return () => {
      if (styleSwitchTimerRef.current) {
        window.clearTimeout(styleSwitchTimerRef.current);
        styleSwitchTimerRef.current = null;
      }
      if (resizeTimer) window.clearTimeout(resizeTimer);
      if (restoreHandler) map.off('style.load', restoreHandler);
    };
  }, [
    basemapMode,
    usingLocalPmtiles,
    usingSupplementalBuildings,
    building3D,
    mapBooted
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !interactiveReady) return;
    const source = map.getSource(DATA_SOURCE_ID);
    if (source) source.setData(mapData || emptyFeatureCollection());
  }, [mapData, interactiveReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !interactiveReady) return;
    setLayerVisibility(map, activeLayers);
  }, [activeLayers, interactiveReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !interactiveReady) return;
    addPlaceClusterLayers(map, validPlaces);
  }, [validPlaces, interactiveReady]);


  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !interactiveReady) return;

    if (
      !userLocation ||
      !Number.isFinite(Number(userLocation.lat)) ||
      !Number.isFinite(Number(userLocation.lng)) ||
      !isInsideMapCoverageBounds(userLocation.lng, userLocation.lat)
    ) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }

    userMarkerRef.current?.remove();
    const dot = document.createElement('div');
    dot.className = 'hm-user-location';
    dot.title = userLocation.accuracy
      ? 'Độ chính xác khoảng ±' + userLocation.accuracy + ' m'
      : 'Vị trí hiện tại';
    dot.innerHTML = '<span></span>' +
      (userLocation.accuracy
        ? '<i>±' + Math.max(1, Math.round(userLocation.accuracy)) + 'm</i>'
        : '');

    userMarkerRef.current = new maplibre.Marker({ element: dot })
      .setLngLat([Number(userLocation.lng), Number(userLocation.lat)])
      .addTo(map);
  }, [userLocation, interactiveReady]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !interactiveReady) return;
    renderRoute(map, route, maplibre, fittedRouteKeyRef);
  }, [route, interactiveReady]);

  useEffect(() => {
    const supports3D =
      usingSupplementalBuildings &&
      !['satellite', 'hybrid'].includes(basemapMode);

    if (supports3D || !building3D) return;

    setBuilding3D(false);
    setBuildingDimensionVisibility(mapRef.current, false);
    mapRef.current?.easeTo({
      pitch: 0,
      bearing: 0,
      duration: 320,
      essential: true
    });
  }, [basemapMode, usingSupplementalBuildings, building3D]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !interactiveReady || !focusRegion?.center) return;
    if (lastFocusRegionRef.current === focusRegion.id) return;

    lastFocusRegionRef.current = focusRegion.id;
    map.flyTo({
      center: focusRegion.center,
      zoom: Number(focusRegion.zoom) || DEFAULT_ZOOM,
      duration: 650,
      essential: true
    });
  }, [focusRegion?.id, interactiveReady]);

  useEffect(() => {
    const map = mapRef.current;
    const selected = validPlaces.find((place) => place.id === selectedPlaceId);
    if (!map || !selected || route || !interactiveReady) return;
    map.flyTo({
      center: [Number(selected.lng), Number(selected.lat)],
      zoom: Math.max(map.getZoom(), 14.5),
      duration: 450
    });
  }, [selectedPlaceId, validPlaces, route, interactiveReady]);

  function showLocationNotice(type, text, timeout = 5500) {
    setLocationNotice({ type, text });

    if (locationNoticeTimerRef.current) {
      window.clearTimeout(locationNoticeTimerRef.current);
    }

    if (timeout > 0) {
      locationNoticeTimerRef.current = window.setTimeout(() => {
        setLocationNotice(null);
        locationNoticeTimerRef.current = null;
      }, timeout);
    }
  }

  function toggleBuilding3D() {
    const map = mapRef.current;
    const supports3D =
      usingSupplementalBuildings &&
      !['satellite', 'hybrid'].includes(basemapMode);

    if (!map || !interactiveReady || !supports3D) return;

    const next = !building3D;
    setBuilding3D(next);
    setBuildingDimensionVisibility(map, next);

    map.easeTo({
      pitch: next ? 52 : 0,
      bearing: next ? -18 : 0,
      zoom: next ? Math.max(map.getZoom(), 16.6) : map.getZoom(),
      duration: 520,
      essential: true
    });
  }

  async function locateUser() {
    if (locating) return;

    setLocating(true);
    setLocationNotice(null);

    try {
      const location = await getBestBrowserLocation({
        timeout: 10000,
        targetAccuracy: 40
      });

      onUserLocation?.(location);

      if (!isInsideMapCoverageBounds(location.lng, location.lat)) {
        showLocationNotice(
          'warning',
          'Đã lấy được vị trí, nhưng bạn đang ngoài phạm vi bản đồ Hòa Lạc.',
          7000
        );
        return;
      }

      const accuracy = Math.max(1, Math.round(Number(location.accuracy) || 0));
      const coarse = accuracy > 120;

      mapRef.current?.flyTo({
        center: [location.lng, location.lat],
        zoom: coarse ? 14.5 : 16,
        duration: 650,
        essential: true
      });

      showLocationNotice(
        coarse ? 'warning' : 'success',
        coarse
          ? 'Đã định vị nhưng sai số khoảng ±' + accuracy + ' m. Hãy bật vị trí chính xác trên thiết bị.'
          : 'Đã định vị · độ chính xác khoảng ±' + accuracy + ' m'
      );
    } catch (error) {
      showLocationNotice(
        'error',
        error?.message || 'Không thể lấy vị trí hiện tại.',
        7500
      );
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="hm-map-shell">
      {!mapBooted && (
        <div className="hm-map-placeholder">
            <div className="hm-map-placeholder-grid" />
            <strong>HOLA MAPS</strong>
            <span>Đang mở bản đồ vector Hòa Lạc…</span>
      </div>
      )}

      <div ref={containerRef} className="hm-map-canvas" />

      <div className="hm-attribution-wrap">
        <button
          className="hm-attribution-mini"
          type="button"
          onClick={() => setAttributionOpen((value) => !value)}
          aria-label="Nguồn dữ liệu bản đồ"
          aria-expanded={attributionOpen}
          title="Nguồn dữ liệu bản đồ"
        >
          i
        </button>

        {attributionOpen && (
          <div className="hm-attribution-popover">
            <b>Nguồn bản đồ</b>
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              © OpenStreetMap contributors
            </a>
            <a
              href="https://protomaps.com"
              target="_blank"
              rel="noreferrer"
            >
              Protomaps
            </a>
            <small>Map rendering powered by MapLibre.</small>
          </div>
        )}
      </div>

      {usingSupplementalBuildings && !['satellite', 'hybrid'].includes(basemapMode) && (
        <button
          className={'hm-3d' + (building3D ? ' active' : '')}
          type="button"
          onClick={toggleBuilding3D}
          aria-pressed={building3D}
          title={building3D ? 'Trở về bản đồ 2D' : 'Xem khối nhà 3D'}
        >
          <Box size={18} />
          {building3D ? '2D' : '3D'}
        </button>
      )}

      <button className="hm-locate" type="button" onClick={locateUser} disabled={locating}>
        <LocateFixed size={18} />
        {locating ? 'Đang lấy GPS…' : 'Vị trí của tôi'}
      </button>

      {locationNotice && (
        <div className={'hm-location-notice ' + locationNotice.type}>
          <LocateFixed size={14} />
          <span>{locationNotice.text}</span>
        </div>
      )}

      {mapError && (
        <div className="hm-map-error">
          <span>{mapError}</span>
          <button type="button" onClick={() => window.location.reload()}>
            <RefreshCcw size={14} /> Tải lại
          </button>
        </div>
      )}
    </div>
  );
}
