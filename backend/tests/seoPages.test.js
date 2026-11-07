import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { pool } from '../src/database/pool.js';
import { SERVICE_AREA_GEOJSON_STRING } from '../src/config/mapCoverage.js';
import { escapeHtml, renderExploreHubSeoPage, renderLocalSeoLandingPage, renderPlaceSeoPage } from '../src/services/seoHtml.service.js';
import { listAdminLocalSeoPages, updateLocalSeoPageStatus } from '../src/services/localSeo.service.js';

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

function url(path) {
  return baseUrl + path;
}

test('SEO: root path is not intercepted by the standalone SEO renderer', async () => {
  const response = await fetch(url('/'));
  assert.equal(response.status, 404);
  assert.doesNotMatch(response.headers.get('content-type') || '', /text\/html/i);
});

test('SEO: batch 02 local-intent guides are published, canonical and present in sitemap', async () => {
  const slugs = [
    'quan-an-sang-hoa-lac',
    'an-toi-o-hoa-lac',
    'quan-lau-hoa-lac',
    'ca-phe-gan-ho-tan-xa',
    'cam-trai-quanh-hoa-lac',
    'di-hoa-lac-tu-ha-noi'
  ];

  for (const slug of slugs) {
    const response = await fetch(url('/kham-pha/' + slug));
    assert.equal(response.status, 200, slug + ' should be published');
    const html = await response.text();
    assert.ok(html.includes('<link rel="canonical" href="https://maps.dothihoalac.vn/kham-pha/' + slug + '"'));
    assert.match(html, /<h1>[^<]+<\/h1>/);
    assert.match(html, /application\/ld\+json/);
    assert.match(html, /Article/);
  }

  const sitemap = await fetch(url('/api/sitemap-explore.xml'));
  assert.equal(sitemap.status, 200);
  assert.ok((sitemap.headers.get('content-type') || '').includes('application/xml'));
  const xml = await sitemap.text();
  assert.ok(xml.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'));
  assert.ok(xml.includes('<loc>https://maps.dothihoalac.vn/kham-pha</loc>'));
  for (const slug of slugs) {
    assert.ok(xml.includes('/kham-pha/' + slug), slug + ' must be listed in the Explore sitemap');
  }
});

test('SEO: published Explore article returns complete HTML before JavaScript', async () => {
  const response = await fetch(url('/kham-pha/hoa-lac-co-gi'));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/html/i);
  assert.match(response.headers.get('cache-control') || '', /public/);

  const html = await response.text();
  assert.match(html, /<html lang="vi">/);
  assert.match(html, /<title>.*Hòa Lạc có gì.*HOLA Maps<\/title>/);
  assert.match(html, /<meta name="description"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/maps\.dothihoalac\.vn\/kham-pha\/hoa-lac-co-gi"/);
  assert.match(html, /<h1>Hòa Lạc có gì\?/);
  assert.match(html, /<h2>/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /Article/);
  assert.match(html, /hola-app-header/);
  assert.match(html, /src="\/logo\.svg\?v=20260929-2"/);
  assert.match(html, /href="\/map"/);
  assert.match(html, /href="\/kham-pha"/);
  assert.match(html, /href="\/doi-tac"/);
  assert.match(html, /href="\/contribute"/);
  assert.match(html, /class="seo-editorial-layout"/);
  assert.match(html, /class="seo-sidebar"/);
  assert.match(html, /Mở bản đồ HOLA Maps/);
  assert.doesNotMatch(html, /src="\/src\/main\.jsx"|type="module"/);
});

test('SEO: Explore hub returns crawlable article links and filtered views are noindex', async () => {
  const response = await fetch(url('/kham-pha'));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Khám phá Hòa Lạc<\/h1>/);
  assert.match(html, /href="\/kham-pha\/hoa-lac-co-gi"/);
  assert.match(html, /class="explore-hero"/);
  assert.match(html, /class="explore-search"/);
  assert.match(html, /class="explore-categories"/);
  assert.match(html, /class="explore-featured"/);
  assert.match(html, /class="explore-grid"/);
  assert.match(html, /seo-rendered\.css\?v=20261106-local-seo-v1/);
  assert.match(html, /CollectionPage/);

  const filtered = await fetch(url('/kham-pha?category=cafe'));
  assert.equal(filtered.status, 200);
  assert.match(filtered.headers.get('x-robots-tag') || '', /noindex/i);
  assert.match(await filtered.text(), /name="robots" content="noindex,follow"/);
});

test('SEO: missing and broken Explore cover images use the HOLA GUIDE fallback', () => {
  const baseArticle = {
    slug: 'fallback-image-test',
    title: 'Fallback image test',
    excerpt: 'Kiểm tra ảnh cẩm nang.',
    readingMinutes: 5
  };

  const missingImageHtml = renderExploreHubSeoPage({
    items: [{ ...baseArticle, coverImage: null }],
    categories: []
  });
  assert.match(missingImageHtml, /class="explore-card-fallback large"/);

  const brokenImageHtml = renderExploreHubSeoPage({
    items: [{ ...baseArticle, coverImage: 'https://example.com/missing-cover.jpg' }],
    categories: []
  });
  assert.match(brokenImageHtml, /data-explore-fallback="true"/);
  assert.match(brokenImageHtml, /explore-image-fallback\.js\?v=20261105-1/);
});

test('SEO: canonical place slug returns rendered content and legacy numeric URL redirects once', async (t) => {
  const query = [
    'SELECT p.id, p.slug, p.name',
    'FROM places p',
    "WHERE p.status = 'PUBLISHED'",
    "AND p.slug IS NOT NULL AND p.slug <> ''",
    'AND ST_Intersects(p.location, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))',
    'ORDER BY p.id ASC LIMIT 1'
  ].join(' ');
  const { rows } = await pool.query(query, [SERVICE_AREA_GEOJSON_STRING]);

  if (!rows[0]) {
    t.skip('No published in-coverage place exists in the CI seed database.');
    return;
  }

  const place = rows[0];
  const response = await fetch(url('/dia-diem/' + encodeURIComponent(place.slug)));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes('<h1>' + escapeHtml(place.name) + '</h1>'));
  assert.ok(html.includes('https://maps.dothihoalac.vn/dia-diem/' + encodeURIComponent(place.slug)));
  assert.match(html, /Place/);
  assert.match(html, /BreadcrumbList/);
  assert.match(html, /hola-app-header/);
  assert.match(html, /src="\/logo\.svg\?v=20260929-2"/);
  assert.match(html, /href="\/map"/);
  assert.match(html, /href="\/contribute"/);
  assert.match(html, /class="seo-editorial-layout"/);
  assert.match(html, /class="seo-sidebar"/);
  assert.match(html, /Xem trên bản đồ/);
  assert.doesNotMatch(html, /src="\/src\/main\.jsx"|type="module"/);

  const legacy = await fetch(url('/place/' + place.id), { redirect: 'manual' });
  assert.equal(legacy.status, 301);
  assert.equal(legacy.headers.get('location'), '/dia-diem/' + encodeURIComponent(place.slug));
});

test('SEO: place sitemap contains canonical slugs and excludes legacy numeric URLs', async () => {
  const response = await fetch(url('/api/sitemap-places.xml'));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /application\/xml/i);
  const xml = await response.text();
  assert.ok(xml.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'));
  assert.match(xml, /\/dia-diem\//);
  assert.doesNotMatch(xml, /\/place\/[0-9]+<\/loc>/);
});

test('SEO: missing and unpublished content returns a noindex 404', async () => {
  const response = await fetch(url('/dia-diem/this-place-does-not-exist'));
  assert.equal(response.status, 404);
  assert.match(response.headers.get('x-robots-tag') || '', /noindex/i);
  assert.match(await response.text(), /Trang này không tồn tại/);

  const missingArticle = await fetch(url('/kham-pha/article-does-not-exist'));
  assert.equal(missingArticle.status, 404);
  assert.match(missingArticle.headers.get('x-robots-tag') || '', /noindex/i);
});

test('SEO: decomposed Vietnamese text is normalized to NFC before rendering', () => {
  const decomposed = 'ra\u0302\u0301t nhanh';
  assert.equal(escapeHtml(decomposed), 'rất nhanh');

  const html = renderPlaceSeoPage({
    id: 999998,
    slug: 'unicode-normalization-test',
    name: 'Ca\u0300 phe\u0302 Ho\u0300a La\u0323c',
    description: 'Kho\u0302ng gian ca\u0300 phe\u0302 ra\u0302\u0301t đe\u0323p.',
    address: 'Ho\u0300a La\u0323c',
    images: [],
    rating: 0,
    reviews: 0,
    lat: 0,
    lng: 0
  });
  assert.ok(html.includes('Cà phê Hòa Lạc'));
  assert.ok(html.includes('Không gian cà phê rất đẹp.'));
});

test('SEO: user-controlled place content is escaped in HTML and JSON-LD', () => {
  const html = renderPlaceSeoPage({
    id: 999999,
    slug: 'safe-test-place',
    name: '<script>alert("xss")</script>',
    description: 'A <img src=x onerror=alert(1)> place description.',
    address: 'Hòa Lạc',
    phone: null,
    website: 'javascript:alert(1)',
    openingHours: null,
    images: [],
    rating: 0,
    reviews: 0,
    lat: 0,
    lng: 0
  });

  assert.match(html, /&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;/);
  assert.match(html, /\\u003cscript\\u003e/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img[^>]+onerror=/i);
  assert.doesNotMatch(html, /href="javascript:/);
});


test('Local SEO: all five starter pages remain drafts until inventory and map quality gates pass', async () => {
  const slugs = [
    'cafe-hoa-lac',
    'quan-an-thach-that',
    'check-in-quoc-oai',
    'homestay-ba-vi',
    'dich-vu-quanh-dai-hoc-fpt'
  ];
  const { rows } = await pool.query(
    'SELECT slug, status, map_supported FROM local_seo_pages WHERE slug = ANY($1::text[]) ORDER BY slug',
    [slugs]
  );
  assert.equal(rows.length, slugs.length);
  assert.ok(rows.every((row) => row.status === 'DRAFT'));

  for (const slug of slugs) {
    const response = await fetch(url('/khu-vuc/' + slug));
    assert.equal(response.status, 404, slug + ' must not be indexable before approval');
    assert.match(response.headers.get('x-robots-tag') || '', /noindex/i);

    const mapData = await fetch(url('/api/local-seo/' + slug));
    assert.equal(mapData.status, 404, slug + ' map data must remain private before publication');
  }

  const sitemap = await fetch(url('/api/sitemap-local-seo.xml'));
  assert.equal(sitemap.status, 200);
  const xml = await sitemap.text();
  for (const slug of slugs) {
    assert.doesNotMatch(xml, new RegExp('/khu-vuc/' + slug));
  }
});

test('Local SEO: quality dashboard flags regions outside current map coverage', async () => {
  const items = await listAdminLocalSeoPages();
  const quocOai = items.find((item) => item.slug === 'check-in-quoc-oai');
  const baVi = items.find((item) => item.slug === 'homestay-ba-vi');

  assert.ok(quocOai);
  assert.ok(baVi);
  assert.equal(quocOai.mapSupported, false);
  assert.equal(baVi.mapSupported, false);
  assert.equal(quocOai.canPublish, false);
  assert.equal(baVi.canPublish, false);
  assert.ok(quocOai.quality.blockers.some((blocker) => blocker.includes('bản đồ tương tác')));
  assert.ok(baVi.quality.blockers.some((blocker) => blocker.includes('bản đồ tương tác')));
  for (const item of items) {
    assert.ok(item.quality.wordCount >= item.minWordCount, item.slug + ' must have substantive editorial copy');
    assert.ok(item.quality.sectionCount >= item.minSections, item.slug + ' must have distinct sections');
  }

  await assert.rejects(
    () => updateLocalSeoPageStatus(Number(quocOai.id), 'PUBLISHED', 1),
    (error) => error.statusCode === 409
  );
  const afterAttempt = await pool.query(
    'SELECT status FROM local_seo_pages WHERE id = $1',
    [Number(quocOai.id)]
  );
  assert.equal(afterAttempt.rows[0]?.status, 'DRAFT');
});

test('Local SEO: server renderer outputs canonical content, real place cards and a first-party interactive map', () => {
  const html = renderLocalSeoLandingPage({
    page: {
      slug: 'cafe-hoa-lac',
      title: 'Cafe Hòa Lạc: tìm quán phù hợp',
      seoTitle: 'Cafe Hòa Lạc | HOLA Maps',
      seoDescription: 'Danh sách cafe thực tế tại Hòa Lạc.',
      excerpt: 'Tìm cafe theo nhu cầu học tập và làm việc.',
      areaName: 'Hòa Lạc',
      updatedAt: '2026-11-06T08:00:00.000Z',
      coverImage: 'https://example.com/cafe-cover.jpg',
      mapSupported: true,
      body: [
        { heading: 'Chọn quán theo mục đích', paragraphs: ['Nội dung biên tập riêng cho khu vực.'] },
        { heading: 'Kiểm tra thông tin', paragraphs: ['Đối chiếu địa chỉ và giờ hoạt động.'] },
        { heading: 'Mở bản đồ', paragraphs: ['Kiểm tra vị trí trước khi đến.'] }
      ]
    },
    places: [{
      id: '987654',
      slug: 'cafe-thu-nghiem',
      name: 'Cafe thử nghiệm',
      category: 'Cafe',
      address: 'Hòa Lạc, Hà Nội',
      rating: 4.5,
      reviews: 12,
      coverImage: 'https://example.com/cafe.jpg'
    }]
  });

  assert.match(html, /<link rel="canonical" href="https:\/\/maps\.dothihoalac\.vn\/khu-vuc\/cafe-hoa-lac"/);
  assert.match(html, /<h1>Cafe Hòa Lạc: tìm quán phù hợp<\/h1>/);
  assert.match(html, /CollectionPage/);
  assert.match(html, /ItemList/);
  assert.match(html, /<iframe src="\/local-map\/cafe-hoa-lac"/);
  assert.match(html, /Cafe thử nghiệm/);
  assert.doesNotMatch(html, /<meta name="robots" content="noindex/);
});
