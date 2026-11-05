import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { pool } from '../src/database/pool.js';
import { SERVICE_AREA_GEOJSON_STRING } from '../src/config/mapCoverage.js';
import { escapeHtml, renderPlaceSeoPage } from '../src/services/seoHtml.service.js';

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

test('SEO: homepage returns crawlable local discovery content in the initial HTML', async () => {
  const response = await fetch(url('/'));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/html/i);
  const html = await response.text();
  assert.match(html, /<title>Bản đồ cộng đồng Hòa Lạc \| HOLA Maps<\/title>/);
  assert.match(html, /<h1>Khám phá Hòa Lạc theo cách của bạn<\/h1>/);
  assert.match(html, /name="description"/);
  assert.match(html, /CollectionPage/);
  assert.match(html, /href="\/map"/);
  assert.doesNotMatch(html, /src="\/src\/main\.jsx"|type="module"/);
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
  assert.doesNotMatch(html, /src="\/src\/main\.jsx"|type="module"/);
});

test('SEO: Explore hub returns crawlable article links and filtered views are noindex', async () => {
  const response = await fetch(url('/kham-pha'));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Khám phá Hòa Lạc<\/h1>/);
  assert.match(html, /href="\/kham-pha\/hoa-lac-co-gi"/);
  assert.match(html, /CollectionPage/);

  const filtered = await fetch(url('/kham-pha?category=cafe'));
  assert.equal(filtered.status, 200);
  assert.match(filtered.headers.get('x-robots-tag') || '', /noindex/i);
  assert.match(await filtered.text(), /name="robots" content="noindex,follow"/);
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
  assert.doesNotMatch(html, /onerror=/);
  assert.doesNotMatch(html, /href="javascript:/);
});
