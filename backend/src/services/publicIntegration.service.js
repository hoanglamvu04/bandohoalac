import {
  getNearbyPlaces,
  getPlaceById,
  getPlaceBySlug,
  getPlacesInBoundsCached,
  listPlaces
} from './place.service.js';
import { listCategories } from './category.service.js';
import { env } from '../config/env.js';

const API_VERSION = 'v1';

function absoluteApiUrl(pathname) {
  return String(env.publicBaseUrl || '').replace(/\/$/, '') + pathname;
}

function holaMapsUrl(placeId) {
  const base = String(env.holaMapsWebUrl || '').trim().replace(/\/$/, '');
  if (!base) return null;
  return base + '/map?place=' + encodeURIComponent(String(placeId));
}

export function publicPlace(place) {
  if (!place) return null;

  const thumbnails = Array.isArray(place.thumbnails) ? place.thumbnails.filter(Boolean) : [];
  const cards = Array.isArray(place.cardImages) ? place.cardImages.filter(Boolean) : [];
  const originals = Array.isArray(place.images) ? place.images.filter(Boolean) : [];

  return {
    id: place.id,
    name: place.name,
    slug: place.slug,
    description: place.description || null,
    category: {
      name: place.category || 'Địa điểm',
      slug: place.categorySlug || 'other'
    },
    location: {
      lat: Number(place.lat),
      lng: Number(place.lng),
      address: place.address || null
    },
    contact: {
      phone: place.phone || null,
      website: place.website || null
    },
    openingHours: place.openingHours || null,
    priceLevel: place.priceLevel || null,
    rating: {
      average: Number(place.rating) || 0,
      count: Number(place.reviews) || 0
    },
    partner: place.isPartner
      ? { isPartner: true, name: place.partnerName || null }
      : { isPartner: false, name: null },
    images: {
      thumbnail: thumbnails[0] || cards[0] || originals[0] || null,
      card: cards[0] || thumbnails[0] || originals[0] || null,
      original: originals[0] || cards[0] || thumbnails[0] || null,
      thumbnails,
      cards,
      originals
    },
    updatedAt: place.updatedAt || null,
    links: {
      api: absoluteApiUrl('/api/public/v1/places/' + place.id),
      holaMaps: holaMapsUrl(place.id)
    }
  };
}

export function publicPlaceFeature(place) {
  const item = publicPlace(place);

  return {
    type: 'Feature',
    id: String(item.id),
    geometry: {
      type: 'Point',
      coordinates: [item.location.lng, item.location.lat]
    },
    properties: {
      id: item.id,
      name: item.name,
      slug: item.slug,
      category: item.category.name,
      categorySlug: item.category.slug,
      address: item.location.address,
      rating: item.rating.average,
      reviews: item.rating.count,
      thumbnail: item.images.thumbnail,
      cardImage: item.images.card,
      isPartner: item.partner.isPartner,
      apiUrl: item.links.api,
      holaMapsUrl: item.links.holaMaps
    }
  };
}

export async function publicCategories() {
  const categories = await listCategories();
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    icon: category.icon || null
  }));
}

export async function publicPlaces(params = {}) {
  const items = await listPlaces({
    q: params.q,
    category: params.category,
    minRating: params.minRating,
    limit: params.limit,
    offset: params.offset,
    status: 'PUBLISHED'
  });

  return items.map(publicPlace);
}

export async function publicPlacesBounds(params = {}) {
  const { items, cacheStatus } = await getPlacesInBoundsCached({
    north: Number(params.north),
    south: Number(params.south),
    east: Number(params.east),
    west: Number(params.west),
    category: params.category,
    minRating: params.minRating,
    status: 'PUBLISHED'
  });

  return { items: items.map(publicPlace), cacheStatus };
}

export async function publicPlacesGeoJson(params = {}) {
  const { items, cacheStatus } = await getPlacesInBoundsCached({
    north: Number(params.north),
    south: Number(params.south),
    east: Number(params.east),
    west: Number(params.west),
    category: params.category,
    minRating: params.minRating,
    status: 'PUBLISHED'
  });

  return {
    collection: {
      type: 'FeatureCollection',
      features: items.map(publicPlaceFeature)
    },
    cacheStatus
  };
}

export async function publicNearbyPlaces(params = {}) {
  const items = await getNearbyPlaces({
    lat: Number(params.lat),
    lng: Number(params.lng),
    radius: Number(params.radius) || 5000,
    category: params.category,
    minRating: params.minRating,
    status: 'PUBLISHED'
  });

  return items.map(publicPlace);
}

export async function publicPlaceById(id) {
  const place = await getPlaceById(Number(id));
  if (!place || place.status !== 'PUBLISHED') return null;
  return publicPlace(place);
}

export async function publicPlaceBySlug(slug) {
  const place = await getPlaceBySlug(slug);
  if (!place || place.status !== 'PUBLISHED') return null;
  return publicPlace(place);
}

export function publicApiMeta() {
  return {
    name: 'Hola Maps Public Integration API',
    apiVersion: API_VERSION,
    readOnly: true,
    serviceArea: 'Hòa Lạc',
    capabilities: [
      'places',
      'search',
      'bounds',
      'geojson',
      'nearby',
      'categories',
      'optimized-images',
      'maplibre-style',
      'pmtiles',
      'embed'
    ],
    endpoints: {
      mapConfig: '/api/public/v1/map/config',
      mapStyle: '/api/public/v1/map/style.json',
      categories: '/api/public/v1/categories',
      places: '/api/public/v1/places',
      bounds: '/api/public/v1/places/bounds',
      geojson: '/api/public/v1/places/geojson',
      nearby: '/api/public/v1/places/nearby',
      placeById: '/api/public/v1/places/:id',
      placeBySlug: '/api/public/v1/places/slug/:slug'
    }
  };
}
