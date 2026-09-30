import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import {
  SERVICE_AREA_BOUNDS,
  isInsideServiceCoverage
} from '../config/mapCoverage.js';

const GOOGLE_PLACES_ENDPOINT = 'https://places.googleapis.com/v1';
const GOOGLE_HOSTS = new Set([
  'google.com',
  'www.google.com',
  'maps.google.com',
  'maps.app.goo.gl',
  'goo.gl'
]);

const TEXT_SEARCH_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.types',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.regularOpeningHours',
  'places.priceLevel',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.businessStatus'
].join(',');

const DETAIL_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'primaryType',
  'primaryTypeDisplayName',
  'types',
  'nationalPhoneNumber',
  'websiteUri',
  'regularOpeningHours',
  'priceLevel',
  'rating',
  'userRatingCount',
  'googleMapsUri',
  'businessStatus'
].join(',');

function googleApiKey() {
  const key = String(
    process.env.GOOGLE_PLACES_API_KEY
    || process.env.GOOGLE_MAPS_API_KEY
    || ''
  ).trim();
  if (!key) {
    throw new AppError(
      'Google Places chưa được cấu hình. Thêm GOOGLE_PLACES_API_KEY vào backend/.env.',
      503
    );
  }
  return key;
}

function decodePathPart(value) {
  try {
    return decodeURIComponent(String(value || '').replace(/\+/g, ' ')).trim();
  } catch {
    return String(value || '').replace(/\+/g, ' ').trim();
  }
}

function isAllowedGoogleHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (GOOGLE_HOSTS.has(host)) return true;
  return host.endsWith('.google.com');
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function resolveGoogleUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AppError('Link Google Maps không hợp lệ.', 400);
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !isAllowedGoogleHost(parsed.hostname)) {
    throw new AppError('Chỉ hỗ trợ link Google Maps.', 400);
  }

  if (parsed.hostname === 'maps.app.goo.gl' || parsed.hostname === 'goo.gl') {
    try {
      const response = await fetchWithTimeout(parsed.toString(), {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 HolaMapsImporter/1.0',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.7'
        }
      }, 7000);

      if (response.url) {
        const resolved = new URL(response.url);
        if (isAllowedGoogleHost(resolved.hostname)) parsed = resolved;
      }
    } catch {
      // Keep the original URL. The caller will return a helpful parse error.
    }
  }

  return parsed;
}

function extractGoogleMapsReference(url) {
  const placeId = url.searchParams.get('query_place_id') || url.searchParams.get('place_id');

  const coordinateMatch = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const lat = coordinateMatch ? Number(coordinateMatch[1]) : null;
  const lng = coordinateMatch ? Number(coordinateMatch[2]) : null;

  let query = url.searchParams.get('q')
    || url.searchParams.get('query')
    || url.searchParams.get('destination')
    || '';

  if (!query) {
    const placeMatch = url.pathname.match(/\/maps\/(?:place|search)\/([^/]+)/i);
    if (placeMatch?.[1]) query = decodePathPart(placeMatch[1]);
  }

  // Some shared URLs contain the readable place name before /data=.
  if (!query) {
    const looseMatch = url.pathname.match(/\/place\/([^/]+)/i);
    if (looseMatch?.[1]) query = decodePathPart(looseMatch[1]);
  }

  return {
    placeId: placeId || null,
    query: String(query || '').trim(),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    resolvedUrl: url.toString()
  };
}

async function normalizeInput(input) {
  const value = String(input || '').trim();
  if (!value) throw new AppError('Nhập link Google Maps hoặc tên địa điểm.', 400);

  // Accept a Place ID directly for power users/admins.
  if (/^ChI[A-Za-z0-9_-]{8,}$/.test(value)) {
    return {
      kind: 'place_id',
      placeId: value,
      query: '',
      lat: null,
      lng: null,
      resolvedUrl: null
    };
  }

  if (/^https?:\/\//i.test(value)) {
    const url = await resolveGoogleUrl(value);
    const reference = extractGoogleMapsReference(url);

    if (!reference.placeId && !reference.query) {
      throw new AppError(
        'Không đọc được tên địa điểm từ link này. Hãy dán link Google Maps đầy đủ hoặc nhập tên địa điểm.',
        400
      );
    }

    return {
      kind: 'url',
      ...reference
    };
  }

  return {
    kind: 'text',
    placeId: null,
    query: value,
    lat: null,
    lng: null,
    resolvedUrl: null
  };
}

function serviceAreaCenter() {
  const [west, south, east, north] = SERVICE_AREA_BOUNDS;
  return {
    latitude: (south + north) / 2,
    longitude: (west + east) / 2
  };
}

async function googleRequest(url, options = {}) {
  let response;

  try {
    response = await fetchWithTimeout(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        'X-Goog-Api-Key': googleApiKey()
      }
    }, 10000);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new AppError('Google Places phản hồi quá chậm. Hãy thử lại.', 504);
    }
    throw new AppError('Không thể kết nối Google Places.', 502);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || 'Google Places trả về lỗi.';
    throw new AppError(message, response.status >= 500 ? 502 : 400);
  }

  return data;
}

async function searchPlaces(query, bias = {}) {
  const center = Number.isFinite(bias.lat) && Number.isFinite(bias.lng)
    ? { latitude: bias.lat, longitude: bias.lng }
    : serviceAreaCenter();

  const data = await googleRequest(
    GOOGLE_PLACES_ENDPOINT + '/places:searchText',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-FieldMask': TEXT_SEARCH_FIELDS
      },
      body: JSON.stringify({
        textQuery: query,
        pageSize: 5,
        languageCode: 'vi',
        regionCode: 'VN',
        locationBias: {
          circle: {
            center,
            radius: 25000
          }
        }
      })
    }
  );

  return Array.isArray(data?.places) ? data.places : [];
}

async function getPlaceDetails(placeId) {
  return googleRequest(
    GOOGLE_PLACES_ENDPOINT + '/places/' + encodeURIComponent(placeId),
    {
      method: 'GET',
      headers: {
        'X-Goog-FieldMask': DETAIL_FIELDS,
        'Accept-Language': 'vi-VN,vi;q=0.9'
      }
    }
  );
}

function normalizeGoogleTypes(place) {
  const values = [
    place?.primaryType,
    ...(Array.isArray(place?.types) ? place.types : [])
  ];
  return [...new Set(values.filter(Boolean).map((value) => String(value).toLowerCase()))];
}

function inferCategory(place) {
  const name = String(place?.displayName?.text || '').toLowerCase();
  const types = normalizeGoogleTypes(place);
  const has = (...values) => values.some((value) => types.includes(value));

  if (/\bvilla\b/i.test(name)) {
    return {
      slug: 'villa',
      confidence: 0.96,
      reason: 'Tên địa điểm có từ “villa”.'
    };
  }

  if (/homestay|farmstay|farm stay/i.test(name) || has(
    'bed_and_breakfast',
    'guest_house',
    'hostel',
    'lodging'
  )) {
    return {
      slug: 'homestay',
      confidence: 0.9,
      reason: 'Google phân loại địa điểm thuộc nhóm lưu trú/homestay.'
    };
  }

  if (has('cafe', 'coffee_shop') || /coffee|cafe|cà phê/i.test(name)) {
    return {
      slug: 'cafe',
      confidence: 0.98,
      reason: 'Google phân loại địa điểm thuộc nhóm cafe/coffee shop.'
    };
  }

  if (has(
    'restaurant',
    'vietnamese_restaurant',
    'asian_restaurant',
    'fast_food_restaurant',
    'meal_delivery',
    'meal_takeaway',
    'bakery',
    'bar',
    'food'
  )) {
    return {
      slug: 'an-uong',
      confidence: 0.94,
      reason: 'Google phân loại địa điểm thuộc nhóm ăn uống.'
    };
  }

  if (has(
    'tourist_attraction',
    'historical_landmark',
    'scenic_spot',
    'observation_deck'
  )) {
    return {
      slug: 'check-in',
      confidence: 0.84,
      reason: 'Google phân loại địa điểm là điểm tham quan/check-in.'
    };
  }

  if (has(
    'amusement_center',
    'amusement_park',
    'park',
    'garden',
    'museum',
    'cultural_center',
    'event_venue',
    'sports_activity_location'
  )) {
    return {
      slug: 'trai-nghiem',
      confidence: 0.78,
      reason: 'Google phân loại địa điểm thuộc nhóm trải nghiệm/hoạt động.'
    };
  }

  return {
    slug: '',
    confidence: 0.35,
    reason: 'Chưa đủ tín hiệu để tự chọn danh mục; Admin nên kiểm tra.'
  };
}

function formatOpeningHours(place) {
  const descriptions = Array.isArray(place?.regularOpeningHours?.weekdayDescriptions)
    ? place.regularOpeningHours.weekdayDescriptions.filter(Boolean)
    : [];

  if (!descriptions.length) return '';

  const normalized = descriptions.map((line) => {
    const index = line.indexOf(':');
    return index >= 0 ? line.slice(index + 1).trim() : line.trim();
  });

  if (normalized.length && normalized.every((value) => value === normalized[0])) {
    return normalized[0].slice(0, 120);
  }

  return descriptions.join(' · ').slice(0, 120);
}

function formatPriceLevel(value) {
  const labels = {
    PRICE_LEVEL_FREE: 'Miễn phí',
    PRICE_LEVEL_INEXPENSIVE: 'Phổ thông',
    PRICE_LEVEL_MODERATE: 'Trung bình',
    PRICE_LEVEL_EXPENSIVE: 'Cao',
    PRICE_LEVEL_VERY_EXPENSIVE: 'Cao cấp'
  };
  return labels[value] || '';
}

function shortArea(address) {
  const parts = String(address || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return parts.slice(0, 3).join(', ');
}

function suggestedDescription(place, categorySlug) {
  const name = place?.displayName?.text || 'Địa điểm';
  const address = shortArea(place?.formattedAddress);
  const categoryText = {
    cafe: 'quán cafe',
    'an-uong': 'địa điểm ăn uống',
    homestay: 'địa điểm lưu trú',
    villa: 'villa',
    'check-in': 'điểm check-in',
    'trai-nghiem': 'địa điểm trải nghiệm'
  }[categorySlug] || 'địa điểm';

  if (address) {
    return (name + ' là ' + categoryText + ' tại ' + address + '.').slice(0, 2000);
  }

  return (name + ' là ' + categoryText + ' trong khu vực Hola Maps.').slice(0, 2000);
}

function suggestedTags(place, categorySlug) {
  const tags = new Set();
  if (categorySlug) tags.add(categorySlug);

  for (const type of normalizeGoogleTypes(place)) {
    if (type.includes('coffee') || type === 'cafe') tags.add('cafe');
    if (type.includes('restaurant') || type === 'food') tags.add('ăn uống');
    if (type.includes('park') || type.includes('garden')) tags.add('ngoài trời');
    if (type.includes('tourist') || type.includes('scenic')) tags.add('check-in');
    if (type.includes('lodging') || type.includes('guest_house')) tags.add('lưu trú');
  }

  return [...tags].slice(0, 6);
}

async function existingPlaceByGoogleId(googlePlaceId) {
  if (!googlePlaceId) return null;

  const { rows } = await pool.query(
    'SELECT id, name, status FROM places WHERE google_place_id = $1 LIMIT 1',
    [googlePlaceId]
  );

  return rows[0] || null;
}

async function mapCandidate(place) {
  const lat = Number(place?.location?.latitude);
  const lng = Number(place?.location?.longitude);
  const inferred = inferCategory(place);
  const existing = await existingPlaceByGoogleId(place?.id);

  return {
    googlePlaceId: place?.id || null,
    googleMapsUri: place?.googleMapsUri || null,
    name: place?.displayName?.text || '',
    address: place?.formattedAddress || '',
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    phone: place?.nationalPhoneNumber || '',
    website: place?.websiteUri || '',
    openingHours: formatOpeningHours(place),
    priceLevel: formatPriceLevel(place?.priceLevel),
    googleRating: Number(place?.rating || 0),
    googleUserRatingCount: Number(place?.userRatingCount || 0),
    googlePrimaryType: place?.primaryType || '',
    googlePrimaryTypeLabel: place?.primaryTypeDisplayName?.text || '',
    googleTypes: normalizeGoogleTypes(place),
    businessStatus: place?.businessStatus || '',
    categorySlug: inferred.slug,
    description: suggestedDescription(place, inferred.slug),
    tags: suggestedTags(place, inferred.slug),
    analysis: {
      categoryConfidence: inferred.confidence,
      categoryReason: inferred.reason
    },
    insideServiceArea: Number.isFinite(lat) && Number.isFinite(lng)
      ? isInsideServiceCoverage(lng, lat)
      : false,
    existingPlace: existing
      ? {
          id: String(existing.id),
          name: existing.name,
          status: existing.status
        }
      : null
  };
}

export async function previewGooglePlaceImport(input) {
  const normalized = await normalizeInput(input);

  let places = [];
  let query = normalized.query;

  if (normalized.placeId) {
    places = [await getPlaceDetails(normalized.placeId)];
  } else {
    if (!query) {
      throw new AppError('Không tìm thấy từ khóa địa điểm trong link Google Maps.', 400);
    }

    places = await searchPlaces(query, {
      lat: normalized.lat,
      lng: normalized.lng
    });
  }

  const candidates = await Promise.all(
    places.slice(0, 5).map((place) => mapCandidate(place))
  );

  return {
    inputKind: normalized.kind,
    resolvedUrl: normalized.resolvedUrl,
    query,
    candidates
  };
}
