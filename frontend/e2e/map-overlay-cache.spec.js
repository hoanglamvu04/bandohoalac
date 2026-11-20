import { test, expect } from '@playwright/test';

test('small mobile map pans reuse geo overlay data; larger pans request a new view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let layerRequests = 0;

  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/map-layers') {
      layerRequests += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ type: 'FeatureCollection', features: [] })
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0, data: [], ok: true })
    });
  });

  await page.goto('/map', { waitUntil: 'domcontentloaded' });
  await expect.poll(async () => page.evaluate(() => {
    const map = window.__HOLA_MAP_INSTANCE__;
    return Boolean(map && map.isStyleLoaded() && !map.isMoving());
  }), { timeout: 20000 }).toBe(true);
  await expect.poll(() => layerRequests, { timeout: 20000 }).toBeGreaterThan(0);

  // Wait for the initial style and region focus to settle before counting.
  await page.waitForTimeout(850);
  const initialRequests = layerRequests;

  await page.evaluate(() => {
    window.__HOLA_MAP_INSTANCE__.panBy([30, 0], { duration: 0 });
  });
  await page.waitForTimeout(850);
  expect(layerRequests).toBe(initialRequests);

  // A pan beyond the padded area must still retrieve fresh visible features.
  await page.evaluate(() => {
    window.__HOLA_MAP_INSTANCE__.panBy([220, 0], { duration: 0 });
  });
  await expect.poll(() => layerRequests, { timeout: 15000 }).toBeGreaterThan(initialRequests);
});
