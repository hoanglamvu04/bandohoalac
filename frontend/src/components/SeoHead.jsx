import { useEffect } from 'react';

const SITE_NAME = 'Hola Maps';
const DEFAULT_DESCRIPTION = 'Bản đồ cộng đồng dành cho Hòa Lạc và khu vực lân cận: địa điểm, tuyến đường, trải nghiệm địa phương và dữ liệu được cộng đồng cập nhật.';
const DEFAULT_IMAGE = 'https://maps.dothihoalac.vn/pwa-icon.svg';

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function upsertLink(rel, href) {
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

function placeNodeFromJsonLd(jsonLd) {
  if (!jsonLd) return null;
  const nodes = Array.isArray(jsonLd)
    ? jsonLd
    : Array.isArray(jsonLd?.['@graph'])
      ? jsonLd['@graph']
      : [jsonLd];

  return nodes.find((node) => {
    const type = node?.['@type'];
    return type === 'Place' ||
      type === 'LocalBusiness' ||
      (Array.isArray(type) && (type.includes('Place') || type.includes('LocalBusiness')));
  }) || null;
}

function buildStructuredData(jsonLd, { canonical, title }) {
  if (!jsonLd) return null;
  const isPlace = String(canonical || '').includes('/place/');
  if (!isPlace) return jsonLd;

  const sourceNodes = Array.isArray(jsonLd)
    ? jsonLd
    : Array.isArray(jsonLd?.['@graph'])
      ? jsonLd['@graph']
      : [jsonLd];

  const normalized = sourceNodes.map((node) => {
    if (!node || typeof node !== 'object') return node;
    const copy = { ...node };
    delete copy['@context'];

    const type = copy['@type'];
    const isPlaceNode = type === 'Place' ||
      type === 'LocalBusiness' ||
      (Array.isArray(type) && (type.includes('Place') || type.includes('LocalBusiness')));

    if (!isPlaceNode) return copy;

    const lat = Number(copy?.geo?.latitude);
    const lng = Number(copy?.geo?.longitude);
    const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);

    return {
      ...copy,
      '@id': copy['@id'] || canonical + '#place',
      url: copy.url || canonical,
      mainEntityOfPage: copy.mainEntityOfPage || { '@id': canonical },
      ...(hasGeo ? {
        hasMap: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat + ',' + lng)}`
      } : {})
    };
  });

  normalized.push({
    '@type': 'BreadcrumbList',
    '@id': canonical + '#breadcrumb',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Hola Maps', item: 'https://maps.dothihoalac.vn/' },
      { '@type': 'ListItem', position: 2, name: 'Bản đồ Hòa Lạc', item: 'https://maps.dothihoalac.vn/map' },
      { '@type': 'ListItem', position: 3, name: title || 'Địa điểm', item: canonical }
    ]
  });

  return { '@context': 'https://schema.org', '@graph': normalized };
}

export default function SeoHead({
  title,
  description = DEFAULT_DESCRIPTION,
  canonical,
  image = DEFAULT_IMAGE,
  imageAlt,
  type = 'website',
  noindex = false,
  jsonLd
}) {
  useEffect(() => {
    const resolvedTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} - Khám phá Hòa Lạc`;
    const resolvedCanonical = canonical || window.location.origin + window.location.pathname;
    const resolvedImageAlt = imageAlt || title || 'Hola Maps - Bản đồ Hòa Lạc';
    const placeNode = placeNodeFromJsonLd(jsonLd);
    const resolvedType = placeNode ? 'website' : type;

    document.title = resolvedTitle;
    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large'
    });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'vi_VN' });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: resolvedTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: resolvedType });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: resolvedCanonical });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image });
    upsertMeta('meta[property="og:image:secure_url"]', { property: 'og:image:secure_url', content: image });
    upsertMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: resolvedImageAlt });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: resolvedTitle });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });
    upsertMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt', content: resolvedImageAlt });
    upsertLink('canonical', resolvedCanonical);

    document.head.querySelectorAll('meta[data-hola-seo="place-v3"]').forEach((element) => element.remove());
    if (placeNode) {
      const lat = Number(placeNode?.geo?.latitude);
      const lng = Number(placeNode?.geo?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const values = [
          { name: 'geo.position', content: `${lat};${lng}` },
          { name: 'ICBM', content: `${lat}, ${lng}` },
          { property: 'place:location:latitude', content: String(lat) },
          { property: 'place:location:longitude', content: String(lng) }
        ];
        values.forEach((attributes) => {
          const meta = document.createElement('meta');
          meta.dataset.holaSeo = 'place-v3';
          Object.entries(attributes).forEach(([key, value]) => meta.setAttribute(key, value));
          document.head.appendChild(meta);
        });
      }
    }

    document.head.querySelectorAll('script[data-hola-seo="jsonld"]').forEach((element) => element.remove());

    const structuredData = buildStructuredData(jsonLd, { canonical: resolvedCanonical, title });
    if (structuredData) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.holaSeo = 'jsonld';
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }

    return () => {
      document.head.querySelectorAll('meta[data-hola-seo="place-v3"]').forEach((element) => element.remove());
    };
  }, [title, description, canonical, image, imageAlt, type, noindex, jsonLd]);

  return null;
}

export { DEFAULT_DESCRIPTION };
