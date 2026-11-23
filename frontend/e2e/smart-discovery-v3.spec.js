import { expect, test } from '@playwright/test';

const samplePlace = {
  id: 611, name: 'Cà phê khu FPT', slug: 'ca-phe-khu-fpt',
  category: 'Cà phê', categorySlug: 'cafe',
  address: 'Hòa Lạc, Hà Nội', status: 'PUBLISHED',
  lat: 21.01354, lng: 105.52522, images: [],
  rating: 4.6, reviews: 12, durationSeconds: 245, travelMinutes: 4.1
};

async function stubSite(page, { routingUnavailable = false } = {}) {
  const requests = [];
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/places/travel-time') {
      requests.push({
        anchor: url.searchParams.get('anchor'),
        minutes: url.searchParams.get('minutes'),
        category: url.searchParams.get('category'),
        limit: url.searchParams.get('limit')
      });
      return route.fulfill(routingUnavailable
        ? { status: 503, json: { error: 'Router temporarily unavailable' } }
        : { status: 200, json: {
          anchor: { id: 10, name: 'Trường Đại học FPT', lat: 21.0135, lng: 105.5252 },
          profile: 'driving', minutes: 5,
          items: [samplePlace],
          meta: { provider: 'OSRM', method: 'road-network-duration',
            candidatesChecked: 1, candidateLimit: 40, limitedCoverage: false }
        } });
    }
    if (url.pathname === '/api/places/bounds') {
      return route.fulfill({ json: { items: [samplePlace], total: 1, hasMore: false } });
    }
    if (url.pathname === '/api/places/611') return route.fulfill({ json: samplePlace });
    if (url.pathname === '/api/map-layers') {
      return route.fulfill({ json: { type: 'FeatureCollection', features: [] } });
    }
    if (url.pathname === '/api/categories') return route.fulfill({ json: { items: [] } });
    return route.fulfill({ json: { items: [], data: [], ok: true } });
  });
  return requests;
}

test('Smart Discovery V3 calculates real driving-time results and opens a map pin', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const requests = await stubSite(page);
  await page.goto('/map', { waitUntil: 'domcontentloaded' });

  const panel = page.getByTestId('travel-time-discovery');
  await expect(panel).toBeVisible();
  expect(requests).toHaveLength(0); // no eager OSRM requests
  await panel.getByRole('button', { name: /Khám phá theo phút lái xe/ }).click();
  await panel.getByRole('button', { name: '5 phút', exact: true }).click();
  await panel.getByLabel('Loại địa điểm theo thời gian').selectOption('cafe');
  await panel.getByRole('button', { name: 'Tìm địa điểm phù hợp' }).click();

  await expect(panel).toContainText('4.1 phút lái xe');
  await expect(panel).toContainText('Cà phê khu FPT');
  await expect(panel).toContainText('ước tính bằng OSRM');
  expect(requests).toHaveLength(1);
  expect(requests[0]).toEqual({
    anchor: 'fpt', minutes: '5', category: 'cafe', limit: '12'
  });

  await panel.getByRole('button', { name: 'Xem ghim Cà phê khu FPT' }).click();
  await expect(page).toHaveURL(/place=611/);
});

test('Mobile discovery reports OSRM outages without inventing driving durations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests = await stubSite(page, { routingUnavailable: true });
  await page.goto('/map', { waitUntil: 'domcontentloaded' });

  const toggle = page.locator('.hm-mobile-list-toggle');
  await expect(toggle).toBeVisible();
  await toggle.click();
  const panel = page.getByTestId('travel-time-discovery');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: /Khám phá theo phút lái xe/ }).click();
  await panel.getByLabel('Mốc xuất phát lái xe').selectOption('dhqg');
  await panel.getByRole('button', { name: 'Tìm địa điểm phù hợp' }).click();

  await expect(panel.getByRole('alert'))
    .toContainText('Máy chủ định tuyến chưa phản hồi');
  await expect(panel.locator('.hm-travel-result')).toHaveCount(0);
  expect(requests).toHaveLength(1);
  expect(requests[0].anchor).toBe('dhqg');
});
