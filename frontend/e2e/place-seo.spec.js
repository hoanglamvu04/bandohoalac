import { test, expect } from '@playwright/test';

test('place detail exposes canonical, geo metadata and structured data graph', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/places/42') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '42',
          name: 'Cafe Test Hòa Lạc',
          address: 'Hòa Lạc, Hà Nội',
          description: 'Một địa điểm kiểm thử SEO Place V3 tại Hòa Lạc.',
          category: 'Cafe',
          categorySlug: 'cafe',
          phone: '0900000000',
          website: 'https://example.com',
          openingHours: '07:00 - 22:00',
          lat: 21.015,
          lng: 105.544,
          rating: 4.8,
          reviews: 12,
          images: ['https://images.example.com/cafe.jpg'],
          source: 'ADMIN'
        })
      });
    }

    if (url.pathname.startsWith('/api/places/nearby')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
    }

    if (url.pathname.startsWith('/api/halo/v1/places/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ item: null }) });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], data: [], ok: true })
    });
  });

  await page.goto('/place/42', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Cafe Test Hòa Lạc', level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(/Cafe Test Hòa Lạc \| Hola Maps/);

  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute('href', 'https://maps.dothihoalac.vn/place/42');
  await expect(page.locator('meta[name="geo.position"]')).toHaveAttribute('content', '21.015;105.544');
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'vi_VN');

  const jsonLdText = await page.locator('script[data-hola-seo="jsonld"]').textContent();
  const jsonLd = JSON.parse(jsonLdText);
  expect(jsonLd['@context']).toBe('https://schema.org');
  expect(Array.isArray(jsonLd['@graph'])).toBeTruthy();
  expect(jsonLd['@graph'].some((node) => node['@type'] === 'Place' && node['@id'] === 'https://maps.dothihoalac.vn/place/42#place')).toBeTruthy();
  expect(jsonLd['@graph'].some((node) => node['@type'] === 'BreadcrumbList')).toBeTruthy();
});
