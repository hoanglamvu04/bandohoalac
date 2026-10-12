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
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
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

export default function SeoHead({
  title,
  description = DEFAULT_DESCRIPTION,
  canonical,
  image = DEFAULT_IMAGE,
  type = 'website',
  noindex = false,
  jsonLd
}) {
  useEffect(() => {
    const resolvedTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} - Khám phá Hòa Lạc`;
    const resolvedCanonical = canonical || window.location.origin + window.location.pathname;

    document.title = resolvedTitle;
    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large'
    });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: resolvedTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: resolvedCanonical });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: resolvedTitle });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });
    upsertLink('canonical', resolvedCanonical);

    const existing = document.head.querySelector('script[data-hola-seo="jsonld"]');
    if (existing) existing.remove();

    if (jsonLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.holaSeo = 'jsonld';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
  }, [title, description, canonical, image, type, noindex, jsonLd]);

  return null;
}

export { DEFAULT_DESCRIPTION };
