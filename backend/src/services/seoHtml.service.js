const SITE_URL = 'https://maps.dothihoalac.vn';
const SITE_NAME = 'HOLA Maps';
const DEFAULT_IMAGE = SITE_URL + '/pwa-icon.svg';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanText(value, fallback = '') {
  return String(value ?? fallback).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function compactText(value, fallback, maxLength = 160) {
  const text = cleanText(value, fallback);
  return text.length <= maxLength ? text : text.slice(0, maxLength - 1).trimEnd() + '…';
}

function safePublicUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, SITE_URL);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function jsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function isoDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function breadcrumbJsonLd(items, canonical) {
  return {
    '@type': 'BreadcrumbList',
    '@id': canonical + '#breadcrumb',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

function renderShell(options) {
  const title = cleanText(options.title, SITE_NAME);
  const description = compactText(options.description, 'Khám phá địa điểm và trải nghiệm địa phương tại Hòa Lạc trên HOLA Maps.');
  const canonical = options.canonical;
  const image = safePublicUrl(options.image) || DEFAULT_IMAGE;
  const robots = options.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large';
  const type = options.type === 'article' ? 'article' : 'website';
  const structuredData = options.jsonLd
    ? '<script type="application/ld+json">' + jsonForHtml(options.jsonLd) + '</script>'
    : '';

  return [
    '<!doctype html><html lang="vi"><head>',
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="theme-color" content="#102f29">',
    '<meta name="description" content="' + escapeHtml(description) + '">',
    '<meta name="robots" content="' + robots + '">',
    '<link rel="canonical" href="' + escapeHtml(canonical) + '">',
    '<link rel="icon" href="/pwa-icon.svg" type="image/svg+xml">',
    '<link rel="stylesheet" href="/seo-rendered.css">',
    '<meta property="og:locale" content="vi_VN"><meta property="og:site_name" content="' + SITE_NAME + '">',
    '<meta property="og:type" content="' + type + '">',
    '<meta property="og:title" content="' + escapeHtml(title) + '">',
    '<meta property="og:description" content="' + escapeHtml(description) + '">',
    '<meta property="og:url" content="' + escapeHtml(canonical) + '">',
    '<meta property="og:image" content="' + escapeHtml(image) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + escapeHtml(title) + '">',
    '<meta name="twitter:description" content="' + escapeHtml(description) + '">',
    '<meta name="twitter:image" content="' + escapeHtml(image) + '">',
    '<title>' + escapeHtml(title) + ' | ' + SITE_NAME + '</title>',
    structuredData,
    '</head><body><div class="seo-site-shell">',
    '<header class="seo-site-header">',
    '<a class="seo-brand" href="/" aria-label="HOLA Maps - Trang chủ">',
    '<span class="seo-brand-mark" aria-hidden="true">H</span>',
    '<span><strong>HOLA MAPS</strong><small>Khám phá Hòa Lạc</small></span></a>',
    '<nav aria-label="Điều hướng chính"><a href="/kham-pha">Cẩm nang</a><a href="/map">Bản đồ</a></nav>',
    '</header>',
    options.body,
    '<footer class="seo-site-footer"><a href="/">HOLA Maps</a>',
    '<span>Dữ liệu địa phương · Khám phá Hòa Lạc</span><a href="/map">Mở bản đồ →</a></footer>',
    '</div></body></html>'
  ].join('');
}

function renderBreadcrumbs(items) {
  return '<nav class="seo-breadcrumbs" aria-label="Breadcrumb">' + items.map((item, index) => {
    const content = item.url
      ? '<a href="' + escapeHtml(item.url) + '">' + escapeHtml(item.name) + '</a>'
      : '<span aria-current="page">' + escapeHtml(item.name) + '</span>';
    return (index ? '<span class="seo-breadcrumb-separator" aria-hidden="true">/</span>' : '') + content;
  }).join('') + '</nav>';
}

function renderEditorialSidebar({
  eyebrow = 'HOLA MAPS',
  title,
  description,
  primaryHref = '/map',
  primaryLabel = 'Mở bản đồ',
  secondaryHref = '/kham-pha',
  secondaryLabel = 'Đọc cẩm nang',
  links = []
}) {
  const quickLinks = links.length
    ? '<nav class="seo-sidebar-links" aria-label="Khám phá thêm"><h3>Khám phá thêm</h3>' +
      links.map((link) => '<a href="' + escapeHtml(link.href) + '">' + escapeHtml(link.label) + '<span aria-hidden="true">→</span></a>').join('') +
      '</nav>'
    : '';
  return [
    '<aside class="seo-sidebar" aria-label="Khám phá Hòa Lạc">',
    '<section class="seo-sidebar-card">',
    '<span class="seo-sidebar-eyebrow">' + escapeHtml(eyebrow) + '</span>',
    '<h2>' + escapeHtml(title) + '</h2>',
    '<p>' + escapeHtml(description) + '</p>',
    '<a class="seo-sidebar-primary" href="' + escapeHtml(primaryHref) + '">' + escapeHtml(primaryLabel) + '<span aria-hidden="true">→</span></a>',
    '<a class="seo-sidebar-secondary" href="' + escapeHtml(secondaryHref) + '">' + escapeHtml(secondaryLabel) + '</a>',
    '</section>',
    quickLinks,
    '</aside>'
  ].join('');
}

function renderPlaceCard(place) {
  const name = escapeHtml(place.name);
  const href = place.slug
    ? '/dia-diem/' + encodeURIComponent(place.slug)
    : '/map?place=' + encodeURIComponent(place.id);
  const image = safePublicUrl(place.coverImage);
  const rating = Number(place.rating) > 0 && Number(place.reviews) > 0
    ? '<span class="seo-place-rating">' + Number(place.rating).toFixed(1) + ' · ' + Number(place.reviews) + ' đánh giá</span>'
    : '<span class="seo-muted">Thông tin đánh giá chưa có</span>';
  return [
    '<a class="seo-place-card" href="' + escapeHtml(href) + '">',
    image ? '<img src="' + escapeHtml(image) + '" alt="' + name + '" loading="lazy">' : '<span class="seo-place-card-placeholder" aria-hidden="true">HOLA</span>',
    '<span class="seo-place-card-copy"><small>' + escapeHtml(place.category || 'Địa điểm') + '</small>',
    '<strong>' + name + '</strong><span>' + escapeHtml(place.address || 'Hòa Lạc, Hà Nội') + '</span>',
    rating, '</span><span class="seo-card-arrow" aria-hidden="true">→</span></a>'
  ].join('');
}

export function renderPlaceSeoPage(place) {
  const canonical = SITE_URL + '/dia-diem/' + encodeURIComponent(place.slug);
  const description = compactText(
    place.description,
    place.name + ' tại ' + (place.address || 'Hòa Lạc') + '. Xem vị trí, hình ảnh và thông tin địa điểm trên HOLA Maps.'
  );
  const images = (Array.isArray(place.images) ? place.images : []).map(safePublicUrl).filter(Boolean).slice(0, 8);
  const coverImage = images[0] || DEFAULT_IMAGE;
  const lat = Number(place.lat);
  const lng = Number(place.lng);
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  const placeSchema = {
    '@type': 'Place',
    '@id': canonical + '#place',
    name: String(place.name ?? ''),
    description,
    url: canonical,
    mainEntityOfPage: { '@id': canonical },
    ...(place.address ? { address: cleanText(place.address) } : {}),
    ...(place.phone ? { telephone: cleanText(place.phone) } : {}),
    ...(images.length ? { image: images } : {}),
    ...(hasGeo ? {
      geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lng },
      hasMap: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(lat + ',' + lng)
    } : {}),
    ...(Number(place.rating) > 0 && Number(place.reviews) > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: Number(place.rating),
        reviewCount: Number(place.reviews)
      }
    } : {})
  };
  const breadcrumbs = [
    { name: SITE_NAME, url: SITE_URL + '/' },
    { name: 'Bản đồ Hòa Lạc', url: SITE_URL + '/map' },
    { name: cleanText(place.name) }
  ];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [placeSchema, breadcrumbJsonLd(breadcrumbs, canonical)]
  };
  const gallery = images.length
    ? '<div class="seo-place-gallery">' + images.map((image, index) =>
      '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(place.name) + (index ? ' - ảnh ' + (index + 1) : '') + '" ' + (index ? 'loading="lazy"' : 'fetchpriority="high"') + '>').join('') + '</div>'
    : '<div class="seo-place-no-image">Địa điểm chưa có ảnh được xác minh.</div>';
  const facts = [
    place.address ? '<div><dt>Địa chỉ / khu vực</dt><dd>' + escapeHtml(place.address) + '</dd></div>' : '',
    place.openingHours ? '<div><dt>Giờ hoạt động</dt><dd>' + escapeHtml(place.openingHours) + '</dd></div>' : '',
    place.phone ? '<div><dt>Điện thoại</dt><dd><a href="tel:' + escapeHtml(place.phone) + '">' + escapeHtml(place.phone) + '</a></dd></div>' : '',
    place.website && safePublicUrl(place.website) ? '<div><dt>Website</dt><dd><a href="' + escapeHtml(safePublicUrl(place.website)) + '" rel="nofollow noopener" target="_blank">' + escapeHtml(place.website) + '</a></dd></div>' : '',
    place.lastVerifiedAt ? '<div><dt>Xác minh gần nhất</dt><dd>' + escapeHtml(formatDate(place.lastVerifiedAt)) + '</dd></div>' : ''
  ].filter(Boolean).join('');
  const mapHref = '/map?place=' + encodeURIComponent(place.id);
  const sidebar = renderEditorialSidebar({
    eyebrow: place.category || 'ĐỊA ĐIỂM HÒA LẠC',
    title: 'Xem vị trí và khám phá khu vực.',
    description: 'Mở bản đồ HOLA Maps để xem vị trí, tìm đường và khám phá những địa điểm khác quanh đây.',
    primaryHref: mapHref,
    primaryLabel: 'Xem trên bản đồ',
    secondaryHref: '/kham-pha',
    secondaryLabel: 'Đọc cẩm nang Hòa Lạc',
    links: [
      { label: 'Tìm địa điểm ăn uống', href: '/map?vertical=food' },
      { label: 'Khám phá tất cả địa điểm', href: '/map' }
    ]
  });
  const body = [
    '<main class="seo-content seo-place-page">',
    renderBreadcrumbs(breadcrumbs),
    '<div class="seo-editorial-layout">',
    '<article class="seo-editorial-main"><header class="seo-page-heading"><span class="seo-eyebrow">' + escapeHtml(place.category || 'Địa điểm Hòa Lạc') + '</span>',
    '<h1>' + escapeHtml(place.name) + '</h1><p class="seo-lead">' + escapeHtml(description) + '</p>',
    '<div class="seo-page-meta">',
    place.address ? '<span>' + escapeHtml(place.address) + '</span>' : '',
    Number(place.rating) > 0 && Number(place.reviews) > 0 ? '<span>★ ' + Number(place.rating).toFixed(1) + ' · ' + Number(place.reviews) + ' đánh giá</span>' : '',
    place.lastVerifiedAt ? '<span>Cập nhật ' + escapeHtml(formatDate(place.lastVerifiedAt)) + '</span>' : '',
    '</div></header>',
    gallery,
    facts ? '<section class="seo-facts"><h2>Thông tin địa điểm</h2><dl>' + facts + '</dl></section>' : '',
    place.description ? '<section class="seo-prose"><h2>Giới thiệu</h2><p>' + escapeHtml(place.description) + '</p></section>' : '',
    '<section class="seo-map-cta"><div><strong>Xem vị trí và đường đi</strong><p>Mở HOLA Maps để xem địa điểm trên bản đồ và khám phá các tiện ích xung quanh.</p></div>',
    '<a href="' + escapeHtml(mapHref) + '">Xem trên bản đồ →</a></section>',
    '</article>',
    sidebar,
    '</div></main>'
  ].join('');
  return renderShell({
    title: place.name,
    description,
    canonical,
    image: coverImage,
    jsonLd,
    body
  });
}

export function renderExploreArticleSeoPage({ article, relatedPlaces = [] }) {
  const canonical = SITE_URL + '/kham-pha/' + encodeURIComponent(article.slug);
  const description = compactText(article.seoDescription || article.excerpt, article.title);
  const image = safePublicUrl(article.coverImage) || DEFAULT_IMAGE;
  const articleSchema = {
    '@type': 'Article',
    '@id': canonical + '#article',
    headline: cleanText(article.title),
    description,
    mainEntityOfPage: { '@id': canonical },
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL + '/' },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL + '/' },
    ...(isoDate(article.publishedAt) ? { datePublished: isoDate(article.publishedAt) } : {}),
    ...(isoDate(article.updatedAt || article.publishedAt) ? { dateModified: isoDate(article.updatedAt || article.publishedAt) } : {}),
    ...(image !== DEFAULT_IMAGE ? { image: [image] } : {})
  };
  const breadcrumbs = [
    { name: SITE_NAME, url: SITE_URL + '/' },
    { name: 'Khám phá Hòa Lạc', url: SITE_URL + '/kham-pha' },
    { name: cleanText(article.title) }
  ];
  const itemList = relatedPlaces.length ? {
    '@type': 'ItemList',
    '@id': canonical + '#related-places',
    name: 'Địa điểm liên quan',
    itemListElement: relatedPlaces.map((place, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: cleanText(place.name),
      url: place.slug ? SITE_URL + '/dia-diem/' + encodeURIComponent(place.slug) : SITE_URL + '/map?place=' + encodeURIComponent(place.id)
    }))
  } : null;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [articleSchema, breadcrumbJsonLd(breadcrumbs, canonical), ...(itemList ? [itemList] : [])]
  };
  const sections = (Array.isArray(article.body) ? article.body : []).map((section, index) => {
    const heading = cleanText(section?.heading);
    const paragraphs = Array.isArray(section?.paragraphs)
      ? section.paragraphs.map((paragraph) => '<p>' + escapeHtml(paragraph) + '</p>').join('')
      : '';
    const bullets = Array.isArray(section?.bullets) && section.bullets.length
      ? '<ul>' + section.bullets.map((bullet) => '<li>' + escapeHtml(bullet) + '</li>').join('') + '</ul>'
      : '';
    return '<section id="phan-' + (index + 1) + '">' + (heading ? '<h2>' + escapeHtml(heading) + '</h2>' : '') + paragraphs + bullets + '</section>';
  }).join('');
  const toc = (Array.isArray(article.body) ? article.body : []).map((section, index) =>
    section?.heading ? '<li><a href="#phan-' + (index + 1) + '">' + escapeHtml(section.heading) + '</a></li>' : ''
  ).filter(Boolean).join('');
  const placeCards = relatedPlaces.length
    ? '<section class="seo-related-places"><div class="seo-section-heading"><span>KHÁM PHÁ ĐỊA ĐIỂM</span><h2>Địa điểm liên quan trên HOLA Maps</h2></div><div class="seo-place-grid">' + relatedPlaces.map(renderPlaceCard).join('') + '</div></section>'
    : '';
  const sidebar = renderEditorialSidebar({
    eyebrow: 'HOLA MAPS · CẨM NANG',
    title: 'Tìm địa điểm phù hợp quanh Hòa Lạc.',
    description: 'Từ bài viết đến địa điểm thực tế: xem vị trí, tìm đường và khám phá thêm trên bản đồ cộng đồng.',
    primaryHref: '/map',
    primaryLabel: 'Mở bản đồ HOLA Maps',
    secondaryHref: '/kham-pha',
    secondaryLabel: 'Xem các cẩm nang khác',
    links: [
      { label: 'Khám phá địa điểm ăn uống', href: '/map?vertical=food' },
      { label: 'Xem toàn bộ bản đồ', href: '/map' }
    ]
  });
  const body = [
    '<main class="seo-content seo-article-page">',
    renderBreadcrumbs(breadcrumbs),
    '<div class="seo-editorial-layout">',
    '<article class="seo-editorial-main"><header class="seo-page-heading seo-article-heading">',
    '<span class="seo-eyebrow">' + escapeHtml(article.eyebrow || article.categoryLabel || 'HOLA GUIDE') + '</span>',
    '<h1>' + escapeHtml(article.title) + '</h1><p class="seo-lead">' + escapeHtml(article.excerpt) + '</p>',
    '<div class="seo-page-meta"><span>' + escapeHtml(formatDate(article.publishedAt)) + '</span><span>' + (Number(article.readingMinutes) || 5) + ' phút đọc</span></div>',
    '</header>',
    image !== DEFAULT_IMAGE ? '<figure class="seo-article-cover"><img src="' + escapeHtml(image) + '" alt="' + escapeHtml(article.title) + '" fetchpriority="high"></figure>' : '',
    toc ? '<nav class="seo-toc" aria-label="Mục lục"><strong>Trong bài viết</strong><ol>' + toc + '</ol></nav>' : '',
    '<div class="seo-article-body">' + sections + '</div>',
    Array.isArray(article.tags) && article.tags.length ? '<div class="seo-tags">' + article.tags.map((tag) => '<span>#' + escapeHtml(tag) + '</span>').join('') + '</div>' : '',
    '<section class="seo-map-cta"><div><strong>Khám phá các địa điểm trên bản đồ</strong><p>Chọn địa điểm phù hợp và xem vị trí thực tế trên HOLA Maps.</p></div><a href="/map">Mở bản đồ →</a></section>',
    '</article>',
    sidebar,
    '</div>',
    placeCards,
    '</main>'
  ].join('');
  return renderShell({
    title: article.seoTitle || article.title,
    description,
    canonical,
    image,
    type: 'article',
    jsonLd,
    body
  });
}

export function renderHomeSeoPage({ sections = [], featured = [] }) {
  const canonical = SITE_URL + '/';
  const description = 'Khám phá địa điểm, quán ăn, cà phê, nơi vui chơi và tiện ích quanh Hòa Lạc. Tìm vị trí thực tế và thông tin địa phương trên bản đồ cộng đồng HOLA Maps.';
  const visiblePlaces = [
    ...featured,
    ...sections.flatMap((section) => Array.isArray(section.items) ? section.items : [])
  ].filter((place, index, all) => place?.id && all.findIndex((item) => String(item.id) === String(place.id)) === index);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': canonical + '#organization',
        name: SITE_NAME,
        url: canonical
      },
      {
        '@type': 'WebSite',
        '@id': canonical + '#website',
        name: SITE_NAME,
        url: canonical,
        inLanguage: 'vi-VN',
        publisher: { '@id': canonical + '#organization' }
      },
      {
        '@type': 'CollectionPage',
        '@id': canonical + '#home',
        name: 'Bản đồ cộng đồng Hòa Lạc',
        description,
        url: canonical,
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: visiblePlaces.slice(0, 30).map((place, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: cleanText(place.name),
            url: place.slug ? SITE_URL + '/dia-diem/' + encodeURIComponent(place.slug) : SITE_URL + '/map?place=' + encodeURIComponent(place.id)
          }))
        }
      }
    ]
  };
  const featuredCards = featured.length
    ? '<section class="seo-home-section"><div class="seo-section-heading"><span>GỢI Ý ĐỊA ĐIỂM</span><h2>Địa điểm nổi bật quanh Hòa Lạc</h2></div><div class="seo-place-grid">' +
      featured.slice(0, 6).map((place) => renderPlaceCard({
        ...place,
        coverImage: place.cardImages?.[0] || place.thumbnails?.[0] || place.images?.[0] || null
      })).join('') + '</div></section>'
    : '';
  const categorySections = sections.map((section) => {
    const category = section.category || {};
    const places = Array.isArray(section.items) ? section.items : [];
    if (!places.length) return '';
    const cards = places.slice(0, 4).map((place) => renderPlaceCard({
      ...place,
      coverImage: place.cardImages?.[0] || place.thumbnails?.[0] || place.images?.[0] || null
    })).join('');
    return '<section class="seo-home-section"><div class="seo-section-heading"><span>KHÁM PHÁ THEO DANH MỤC</span><h2>' +
      escapeHtml(category.name || 'Địa điểm') + '</h2></div><div class="seo-place-grid">' + cards +
      '</div><a class="seo-inline-link" href="/map?category=' + encodeURIComponent(category.slug || '') + '">Xem trên bản đồ →</a></section>';
  }).join('');
  const body = [
    '<main class="seo-content seo-home-page">',
    '<section class="seo-home-hero"><span class="seo-eyebrow">BẢN ĐỒ CỘNG ĐỒNG HÒA LẠC</span>',
    '<h1>Khám phá Hòa Lạc theo cách của bạn</h1>',
    '<p class="seo-lead">' + escapeHtml(description) + '</p>',
    '<div class="seo-home-actions"><a href="/map">Mở bản đồ tương tác →</a><a href="/kham-pha">Đọc cẩm nang địa phương</a></div></section>',
    featuredCards,
    categorySections,
    '<section class="seo-map-cta"><div><strong>Đang tìm một địa điểm cụ thể?</strong><p>Tìm kiếm theo tên, danh mục và khu vực trên bản đồ HOLA Maps.</p></div><a href="/map">Tìm trên bản đồ →</a></section>',
    '</main>'
  ].join('');
  return renderShell({
    title: 'Bản đồ cộng đồng Hòa Lạc',
    description,
    canonical,
    jsonLd,
    body
  });
}

export function renderExploreHubSeoPage({ items = [], categories = [], noindex = false }) {
  const canonical = SITE_URL + '/kham-pha';
  const description = 'Cẩm nang Hòa Lạc: ăn gì, chơi gì, cà phê, homestay và trải nghiệm địa phương, kết nối trực tiếp với địa điểm trên HOLA Maps.';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': canonical + '#collection',
        name: 'Khám phá Hòa Lạc',
        description,
        url: canonical,
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: items.slice(0, 40).map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: cleanText(item.title),
            url: canonical + '/' + encodeURIComponent(item.slug)
          }))
        }
      },
      breadcrumbJsonLd([{ name: SITE_NAME, url: SITE_URL + '/' }, { name: 'Khám phá Hòa Lạc' }], canonical)
    ]
  };
  const categoryLinks = categories.map((category) =>
    '<a href="/kham-pha?category=' + encodeURIComponent(category.slug) + '">' + escapeHtml(category.label) + ' <span>' + (Number(category.count) || 0) + '</span></a>'
  ).join('');
  const cards = items.map((article) => {
    const image = safePublicUrl(article.coverImage);
    const href = '/kham-pha/' + encodeURIComponent(article.slug);
    return [
      '<a class="seo-guide-card" href="' + escapeHtml(href) + '">',
      image ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(article.title) + '" loading="lazy">' : '<span class="seo-guide-placeholder">HOLA GUIDE</span>',
      '<span class="seo-guide-card-copy"><small>' + escapeHtml(article.categoryLabel || 'Cẩm nang') + '</small>',
      '<strong>' + escapeHtml(article.title) + '</strong><span>' + escapeHtml(article.excerpt) + '</span>',
      '<em>' + (Number(article.readingMinutes) || 5) + ' phút đọc</em></span></a>'
    ].join('');
  }).join('');
  const body = [
    '<main class="seo-content seo-explore-hub">',
    renderBreadcrumbs([{ name: SITE_NAME, url: SITE_URL + '/' }, { name: 'Khám phá Hòa Lạc' }]),
    '<header class="seo-page-heading"><span class="seo-eyebrow">HOLA GUIDE</span><h1>Khám phá Hòa Lạc</h1><p class="seo-lead">' + escapeHtml(description) + '</p></header>',
    categoryLinks ? '<nav class="seo-category-links" aria-label="Chủ đề cẩm nang">' + categoryLinks + '</nav>' : '',
    cards ? '<section class="seo-guide-grid" aria-label="Danh sách cẩm nang">' + cards + '</section>' : '<p>Hiện chưa có cẩm nang được xuất bản.</p>',
    '<section class="seo-map-cta"><div><strong>Tìm địa điểm phù hợp với bạn</strong><p>Mở bản đồ để tìm quán ăn, cà phê, nơi vui chơi và tiện ích quanh Hòa Lạc.</p></div><a href="/map">Mở bản đồ →</a></section>',
    '</main>'
  ].join('');
  return renderShell({
    title: 'Khám phá Hòa Lạc',
    description,
    canonical,
    jsonLd,
    noindex,
    body
  });
}

export function renderSeoNotFoundPage() {
  return renderShell({
    title: 'Không tìm thấy nội dung',
    description: 'Nội dung bạn tìm kiếm không tồn tại hoặc chưa được xuất bản trên HOLA Maps.',
    canonical: SITE_URL + '/',
    noindex: true,
    body: '<main class="seo-content seo-not-found"><span class="seo-eyebrow">404 · KHÔNG TÌM THẤY</span><h1>Trang này không tồn tại</h1><p>Nội dung có thể đã được chuyển hoặc chưa được xuất bản.</p><a class="seo-primary-link" href="/kham-pha">Quay lại cẩm nang</a><a href="/map">Mở bản đồ HOLA Maps</a></main>'
  });
}

export const SEO_SITE_URL = SITE_URL;
