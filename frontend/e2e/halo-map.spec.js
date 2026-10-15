import { test, expect } from '@playwright/test';

const spotFeature = {
  type: 'Feature',
  id: 'halo-1',
  geometry: { type: 'Point', coordinates: [105.544, 21.015] },
  properties: {
    haloSpotId: '1',
    name: 'Hồ Tân Xã',
    address: 'Tân Xã, Hòa Lạc, Hà Nội',
    postCount: 1,
    mediaCount: 6,
    coverUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="100%" height="100%" fill="%23dfe8e2"/></svg>'
  }
};

const spotDetail = {
  id: '1',
  label: 'Hồ Tân Xã',
  address: 'Tân Xã, Hòa Lạc, Hà Nội',
  lat: 21.015,
  lng: 105.544,
  mediaCount: 6,
  media: Array.from({ length: 6 }, (_, index) => ({
    id: String(index + 1),
    url: spotFeature.properties.coverUrl,
    thumbnailUrl: spotFeature.properties.coverUrl,
    caption: 'Một câu chuyện đủ dài để kiểm tra panel có thể cuộn trên màn hình thấp. '.repeat(8),
    postedAt: '2026-10-15T06:00:00.000Z',
    user: { name: 'HALO Test' },
    metadata: { title: `Góc nhìn ${index + 1}`, theme: 'Nắng Hòa Lạc' }
  }))
};

test('HALO deeplink opens selected spot with native scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 650 });
  await page.route('**/api/halo/v1/spots/1**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(spotDetail)
  }));
  await page.route('**/api/halo/v1/spots**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ type: 'FeatureCollection', features: [spotFeature] })
  }));
  await page.route('**/api/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ items: [], ok: true })
  }));

  await page.goto('/halo?spot=1', { waitUntil: 'domcontentloaded' });
  const detail = page.locator('.halo-story-detail');
  await expect(detail).toBeVisible();
  await expect(detail.getByText('Hồ Tân Xã')).toBeVisible();

  const overflowY = await detail.evaluate((node) => getComputedStyle(node).overflowY);
  expect(['auto', 'scroll']).toContain(overflowY);

  const scrollable = await detail.evaluate((node) => node.scrollHeight > node.clientHeight);
  expect(scrollable).toBeTruthy();

  await detail.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  const atBottom = await detail.evaluate((node) => node.scrollTop + node.clientHeight >= node.scrollHeight - 2);
  expect(atBottom).toBeTruthy();
  await expect(page.getByRole('button', { name: /Cuộn xuống/i })).toHaveCount(0);
});
