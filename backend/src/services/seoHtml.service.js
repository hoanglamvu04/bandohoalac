const SITE_URL = 'https://maps.dothihoalac.vn';
const SITE_NAME = 'HOLA Maps';
const DEFAULT_IMAGE = SITE_URL + '/pwa-icon.svg';

export function escapeHtml(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanText(value, fallback = '') {
  return String(value ?? fallback).normalize('NFC').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
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
  return JSON.stringify(value).normalize('NFC')
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
    '<meta name="theme-color" content="' + escapeHtml(options.themeColor || '#102f29') + '">',
    '<meta name="description" content="' + escapeHtml(description) + '">',
    '<meta name="robots" content="' + robots + '">',
    '<link rel="canonical" href="' + escapeHtml(canonical) + '">',
    '<link rel="icon" href="/pwa-icon.svg" type="image/svg+xml">',
    '<link rel="stylesheet" href="/seo-rendered.css?v=20261106-local-seo-v1">',
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
    '</head><body><div class="seo-site-shell' + (options.shellClass ? ' ' + escapeHtml(options.shellClass) : '') + '">',
    '<header class="seo-site-header hola-app-header">',
    '<a class="seo-brand app-brand" href="/" aria-label="HOLA Maps - Trang chủ">',
    '<img class="seo-brand-logo" src="/logo.svg?v=20260929-2" alt="HOLA Maps" width="198" height="56"></a>',
    '<nav class="seo-primary-nav" aria-label="Điều hướng chính">',
    '<a class="seo-nav-link" href="/map"><svg class="seo-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.2"/></svg>Bản đồ</a>',
    '<a class="seo-nav-link active" href="/kham-pha"><svg class="seo-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.3 5.3-5.3 2.3 2.3-5.3 5.3-2.3Z"/></svg>Khám phá</a>',
    '<a class="seo-nav-link" href="/leaderboard"><svg class="seo-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5v2a4 4 0 0 0 4 4M16 6h3v2a4 4 0 0 1-4 4M12 12v5m-4 3h8m-6-3h4"/></svg>Cộng đồng</a>',
    '</nav>',
    '<div class="seo-header-actions">',
    '<a class="seo-header-partner" href="/doi-tac">Đối tác</a>',
    '<a class="seo-header-cta" href="/contribute"><span aria-hidden="true">＋</span>Đóng góp</a>',
    '<a class="seo-header-account" href="/login">Đăng nhập</a>',
    '</div>',
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

export function renderLocalSeoLandingPage({ page, places = [] }) {
  const canonical = SITE_URL + '/khu-vuc/' + encodeURIComponent(page.slug);
  const description = compactText(page.seoDescription || page.excerpt, page.title);
  const image = safePublicUrl(page.coverImage) || DEFAULT_IMAGE;
  const mapHref = '/local-map/' + encodeURIComponent(page.slug);
  const breadcrumbs = [
    { name: SITE_NAME, url: SITE_URL + '/' },
    { name: 'Khám phá Hòa Lạc', url: SITE_URL + '/kham-pha' },
    { name: cleanText(page.title) }
  ];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': canonical + '#collection',
        name: cleanText(page.title),
        description,
        url: canonical,
        about: { '@type': 'Place', name: cleanText(page.areaName) },
        mainEntity: {
          '@type': 'ItemList',
          '@id': canonical + '#places',
          name: 'Địa điểm thực tế tại ' + cleanText(page.areaName),
          numberOfItems: places.length,
          itemListElement: places.map((place, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: cleanText(place.name),
            url: place.slug
              ? SITE_URL + '/dia-diem/' + encodeURIComponent(place.slug)
              : SITE_URL + '/map?place=' + encodeURIComponent(place.id)
          }))
        }
      },
      breadcrumbJsonLd(breadcrumbs, canonical)
    ]
  };

  const sections = (Array.isArray(page.body) ? page.body : []).map((section, index) => {
    const heading = cleanText(section?.heading);
    const paragraphs = Array.isArray(section?.paragraphs)
      ? section.paragraphs.map((paragraph) => '<p>' + escapeHtml(paragraph) + '</p>').join('')
      : '';
    const bullets = Array.isArray(section?.bullets) && section.bullets.length
      ? '<ul>' + section.bullets.map((bullet) => '<li>' + escapeHtml(bullet) + '</li>').join('') + '</ul>'
      : '';
    return '<section id="phan-' + (index + 1) + '">' +
      (heading ? '<h2>' + escapeHtml(heading) + '</h2>' : '') +
      paragraphs + bullets + '</section>';
  }).join('');

  const placeCards = places.length
    ? '<section class="seo-related-places"><div class="seo-section-heading">' +
      '<span>ĐỊA ĐIỂM ĐÃ XUẤT BẢN</span><h2>Địa điểm thực tế tại ' +
      escapeHtml(page.areaName) + '</h2><p>Danh sách lấy từ hồ sơ địa điểm HOLA MAP và được lọc theo khu vực, danh mục.</p></div>' +
      '<div class="seo-place-grid">' + places.map(renderPlaceCard).join('') + '</div></section>'
    : '';

  const mapSection = page.mapSupported
    ? [
      '<section class="seo-local-map" aria-labelledby="seo-local-map-title">',
      '<div class="seo-local-map-heading"><span>HOLA MAPS · BẢN ĐỒ TƯƠNG TÁC</span>',
      '<h2 id="seo-local-map-title">Xem các địa điểm trên bản đồ</h2>',
      '<p>Chọn điểm ghim để xem địa điểm, kiểm tra vị trí và khám phá khu vực xung quanh.</p></div>',
      '<div class="seo-local-map-frame-wrap">',
      '<iframe src="' + escapeHtml(mapHref) + '" title="Bản đồ địa điểm ' + escapeHtml(page.areaName) +
        ' trên HOLA Maps" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>',
      '</div><a class="seo-local-map-open" href="' + escapeHtml(mapHref) +
        '" target="_blank" rel="noopener">Mở bản đồ toàn màn hình →</a>',
      '</section>'
    ].join('')
    : '';

  const sidebar = renderEditorialSidebar({
    eyebrow: 'HOLA LOCAL GUIDE',
    title: 'Khám phá địa điểm đã có dữ liệu thực tế.',
    description: 'Danh sách chỉ hiển thị hồ sơ đạt điều kiện chất lượng. Mở từng địa điểm để kiểm tra thông tin và thời điểm xác minh.',
    primaryHref: mapHref,
    primaryLabel: 'Mở bản đồ tương tác',
    secondaryHref: '/kham-pha',
    secondaryLabel: 'Xem cẩm nang Hòa Lạc',
    links: [
      { label: 'Khám phá tất cả địa điểm', href: '/map' },
      { label: 'Đóng góp thông tin địa phương', href: '/contribute' }
    ]
  });

  const body = [
    '<main class="seo-content seo-local-page">',
    renderBreadcrumbs(breadcrumbs),
    '<div class="seo-editorial-layout">',
    '<article class="seo-editorial-main">',
    '<header class="seo-page-heading"><span class="seo-eyebrow">HOLA LOCAL SEO · ' + escapeHtml(page.areaName) + '</span>',
    '<h1>' + escapeHtml(page.title) + '</h1>',
    '<p class="seo-lead">' + escapeHtml(page.excerpt) + '</p>',
    '<div class="seo-page-meta"><span>' + escapeHtml(page.areaName) + '</span>',
    '<span>' + places.length + ' địa điểm thực tế</span>',
    page.updatedAt ? '<span>Cập nhật ' + escapeHtml(formatDate(page.updatedAt)) + '</span>' : '',
    '</div></header>',
    '<div class="seo-article-body">' + sections + '</div>',
    mapSection,
    '</article>',
    sidebar,
    '</div>',
    placeCards,
    '<section class="seo-local-data-note"><strong>Về chất lượng dữ liệu</strong>',
    '<p>Danh sách này sử dụng hồ sơ địa điểm đã xuất bản, có tọa độ hợp lệ và vượt qua ngưỡng chất lượng của HOLA Maps. Thông tin có thể thay đổi; hãy kiểm tra lần xác minh gần nhất và liên hệ địa điểm khi cần xác nhận trước chuyến đi.</p></section>',
    '</main>'
  ].join('');

  return renderShell({
    title: page.seoTitle || page.title,
    description,
    canonical,
    image,
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

function formatExploreDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function renderExploreArticleVisual(article, large = false) {
  const image = safePublicUrl(article.coverImage);
  const visualClass = large ? ' large' : '';
  if (image) {
    return '<img class="explore-card-image' + visualClass + '" data-explore-fallback="true" src="' +
      escapeHtml(image) + '" alt="' + escapeHtml(article.title || 'HOLA GUIDE') +
      '" loading="' + (large ? 'eager' : 'lazy') + '">';
  }

  return [
    '<div class="explore-card-fallback' + visualClass + '">',
    '<svg viewBox="0 0 24 24" width="' + (large ? '42' : '30') + '" height="' + (large ? '42' : '30') + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
    '<circle cx="12" cy="12" r="10"></circle>',
    '<path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z"></path>',
    '</svg>',
    '<span>HOLA GUIDE</span>',
    '</div>'
  ].join('');
}

function renderExploreArticleCard(article) {
  const href = '/kham-pha/' + encodeURIComponent(article.slug);
  return [
    '<a class="explore-card" href="' + escapeHtml(href) + '">',
    renderExploreArticleVisual(article),
    '<div class="explore-card-body">',
    '<span>' + escapeHtml(article.categoryLabel || 'Cẩm nang') + '</span>',
    '<h3>' + escapeHtml(article.title) + '</h3>',
    '<p>' + escapeHtml(article.excerpt) + '</p>',
    '<footer><small>' + (Number(article.readingMinutes) || 5) + ' phút đọc</small>',
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
    '<path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>',
    '</svg></footer>',
    '</div></a>'
  ].join('');
}

export function renderExploreHubSeoPage({
  items = [],
  categories = [],
  category = 'all',
  query = '',
  noindex = false
}) {
  const canonical = SITE_URL + '/kham-pha';
  const description = 'Cẩm nang Hòa Lạc: ăn gì, chơi gì, cà phê, homestay và trải nghiệm địa phương, kết nối trực tiếp với địa điểm trên HOLA Maps.';
  const activeCategory = String(category || 'all');
  const searchQuery = String(query || '').trim();
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

  function categoryHref(slug) {
    const params = new URLSearchParams();
    if (slug && slug !== 'all') params.set('category', slug);
    if (searchQuery) params.set('q', searchQuery);
    const search = params.toString();
    return '/kham-pha' + (search ? '?' + search : '');
  }

  const categoryLinks = [
    '<a href="' + escapeHtml(categoryHref('all')) + '"' +
      (activeCategory === 'all' ? ' class="active" aria-current="page"' : '') + '>Tất cả</a>',
    ...categories.map((item) =>
      '<a href="' + escapeHtml(categoryHref(item.slug)) + '"' +
        (activeCategory === item.slug ? ' class="active" aria-current="page"' : '') + '>' +
        escapeHtml(item.label) + '<span>' + (Number(item.count) || 0) + '</span></a>'
    )
  ].join('');

  const quickLinks = [
    { label: 'Ăn gì', slug: 'an-gi' },
    { label: 'Cafe', slug: 'cafe' },
    { label: 'Homestay', slug: 'homestay' },
    { label: 'Chơi gì', slug: 'choi-gi' }
  ].map((item) =>
    '<a href="' + escapeHtml(categoryHref(item.slug)) + '">' + item.label + '</a>'
  ).join('');

  const featured = items.find((item) => item.slug === 'hoa-lac-choi-gi') ||
    items.find((item) => item.featured) ||
    items[0] ||
    null;
  const rest = featured ? items.filter((item) => item !== featured) : [];

  const featuredCard = featured
    ? [
      '<a class="explore-featured" href="/kham-pha/' + escapeHtml(encodeURIComponent(featured.slug)) + '">',
      renderExploreArticleVisual(featured, true),
      '<div class="explore-featured-copy">',
      '<span>' + escapeHtml(featured.eyebrow || featured.categoryLabel || 'Cẩm nang Hòa Lạc') + '</span>',
      '<h2>' + escapeHtml(featured.title) + '</h2>',
      '<p>' + escapeHtml(featured.excerpt) + '</p>',
      '<div><small>' + (Number(featured.readingMinutes) || 5) + ' phút đọc' +
        (featured.publishedAt ? ' · ' + escapeHtml(formatExploreDate(featured.publishedAt)) : '') + '</small>',
      '<b>Đọc cẩm nang <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
      '<path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></b>',
      '</div></div></a>'
    ].join('')
    : '';

  const articleSection = rest.length
    ? [
      '<section class="explore-section">',
      '<div class="explore-section-head"><div><span>GỢI Ý TIẾP THEO</span>',
      '<h2>Chọn theo nhu cầu của bạn</h2></div>',
      '<a href="/map">Mở bản đồ <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
      '<path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></a></div>',
      '<div class="explore-grid">' + rest.map(renderExploreArticleCard).join('') + '</div>',
      '</section>'
    ].join('')
    : '';

  const body = [
    '<div class="explore-page seo-explore-hub">',
    '<section class="explore-hero">',
    '<div class="explore-shell explore-hero-grid">',
    '<div class="explore-hero-copy">',
    '<span class="explore-kicker"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
    '<circle cx="12" cy="12" r="10"></circle><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z"></path>',
    '</svg> HOLA GUIDE</span>',
    '<h1>Khám phá Hòa Lạc</h1>',
    '<p>Ăn gì, chơi gì, cafe, homestay và những điểm đáng ghé — chọn nhanh rồi mở thẳng trên HOLA Maps.</p>',
    '<div class="explore-hero-note"><span>' + (items.length || 20) + ' cẩm nang</span>',
    '<span>Dữ liệu địa phương · cập nhật liên tục</span></div>',
    '</div>',
    '<div class="explore-hero-actions"><span class="explore-hero-actions-label">Tìm nhanh</span>',
    '<form class="explore-search" action="/kham-pha" method="get">',
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
    '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>',
    '<input name="q" value="' + escapeHtml(searchQuery) + '" placeholder="Cafe, homestay, FPT, cuối tuần..." aria-label="Tìm bài Khám phá Hòa Lạc">',
    (activeCategory !== 'all' ? '<input type="hidden" name="category" value="' + escapeHtml(activeCategory) + '">' : ''),
    '<button type="submit">Tìm</button></form>',
    '<div class="explore-quick-links" aria-label="Chủ đề tìm nhanh">' + quickLinks + '</div>',
    '</div></div></section>',
    '<main class="explore-shell explore-main">',
    '<nav class="explore-categories" aria-label="Chủ đề Khám phá">' + categoryLinks + '</nav>',
    (!featured && !searchQuery && activeCategory === 'all'
      ? '<div class="explore-state">Hiện chưa có cẩm nang được xuất bản.</div>'
      : (!featured
        ? '<div class="explore-state">Chưa có bài phù hợp với bộ lọc này.</div>'
        : '')),
    featuredCard,
    articleSection,
    '</main></div>',
    '<script src="/explore-image-fallback.js?v=20261105-1" defer></script>'
  ].join('');

  return renderShell({
    title: 'Khám phá Hòa Lạc',
    description,
    canonical,
    jsonLd,
    noindex,
    shellClass: 'seo-explore-shell',
    themeColor: '#0b6fe8',
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
