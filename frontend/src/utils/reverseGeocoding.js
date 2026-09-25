const MAPTILER_KEY = (import.meta.env.VITE_MAPTILER_KEY || '').trim();

function withTimeout(promise, timeout = 7000) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = window.setTimeout(
        () => reject(new Error('Reverse geocoding timeout')),
        timeout
      );
    })
  ]).finally(() => window.clearTimeout(timer));
}

function unique(parts) {
  return [...new Set(parts.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function summarizeMapTiler(feature) {
  if (!feature) return null;

  const context = Array.isArray(feature.context) ? feature.context : [];
  const items = [feature, ...context];

  const findType = (...types) => {
    const item = items.find((entry) =>
      types.some((type) =>
        Array.isArray(entry?.place_type)
          ? entry.place_type.includes(type)
          : String(entry?.id || '').startsWith(type + '.')
      )
    );
    return item?.text || item?.place_name || null;
  };

  const locality = findType('neighbourhood', 'locality', 'place');
  const district = findType('district');
  const region = findType('region');
  const country = findType('country');

  const areaParts = unique([locality, district, region]);
  const label =
    feature.place_name ||
    unique([feature.text, ...areaParts, country]).join(', ');

  return {
    label,
    shortLabel: areaParts.join(', ') || feature.text || label,
    locality,
    district,
    region,
    country,
    source: 'MapTiler Geocoding',
    sourceUrl: 'https://www.maptiler.com/'
  };
}

async function reverseWithMapTiler(lat, lng) {
  if (!MAPTILER_KEY) return null;

  const url =
    'https://api.maptiler.com/geocoding/' +
    encodeURIComponent(lng + ',' + lat) +
    '.json?language=vi&limit=1&key=' +
    encodeURIComponent(MAPTILER_KEY);

  const response = await withTimeout(fetch(url, {
    headers: { Accept: 'application/json' }
  }));

  if (!response.ok) {
    throw new Error('MapTiler reverse geocoding failed: ' + response.status);
  }

  const data = await response.json();
  return summarizeMapTiler(data?.features?.[0]);
}

function summarizeNominatim(data) {
  if (!data) return null;
  const address = data.address || {};

  const locality =
    address.village ||
    address.hamlet ||
    address.suburb ||
    address.neighbourhood ||
    address.town ||
    address.municipality ||
    address.city_district ||
    address.city ||
    null;

  const district =
    address.county ||
    address.state_district ||
    address.city_district ||
    null;

  const region = address.state || null;
  const country = address.country || null;
  const shortLabel = unique([locality, district, region]).join(', ');

  return {
    label: data.display_name || shortLabel,
    shortLabel: shortLabel || data.display_name || '',
    locality,
    district,
    region,
    country,
    source: 'OpenStreetMap / Nominatim',
    sourceUrl: 'https://www.openstreetmap.org/'
  };
}

async function reverseWithNominatim(lat, lng) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(lat),
    lon: String(lng),
    zoom: '18',
    addressdetails: '1',
    'accept-language': 'vi'
  });

  const response = await withTimeout(
    fetch('https://nominatim.openstreetmap.org/reverse?' + params.toString(), {
      headers: {
        Accept: 'application/json'
      }
    }),
    7000
  );

  if (!response.ok) {
    throw new Error('Nominatim reverse geocoding failed: ' + response.status);
  }

  return summarizeNominatim(await response.json());
}

export async function reverseGeocodeLocation(lat, lng) {
  const y = Number(lat);
  const x = Number(lng);
  if (!Number.isFinite(y) || !Number.isFinite(x)) return null;

  try {
    const mapTiler = await reverseWithMapTiler(y, x);
    if (mapTiler?.label) return mapTiler;
  } catch (error) {
    console.warn('[Hola Maps] MapTiler reverse geocoding failed', error);
  }

  try {
    const nominatim = await reverseWithNominatim(y, x);
    if (nominatim?.label) return nominatim;
  } catch (error) {
    console.warn('[Hola Maps] Nominatim reverse geocoding failed', error);
  }

  return null;
}
