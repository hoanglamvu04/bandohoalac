import { test, expect } from '@playwright/test';

const densePins = Array.from({ length: 65 }, (_, i) => ({
  id: 6000 + i,
  name: 'Điểm công khai giả lập ' + i,
  category: 'Quán cà phê',
  categorySlug: 'cafe',
  status: 'PUBLISHED',
  lng: 105.525 + (i % 13) * 0.00001,
  lat: 21.015 + Math.floor(i / 13) * 0.00001,
  images: [], address: 'Hòa Lạc'
}));

test('dense public POIs form WebGL clusters on a mobile viewport and show singles after zooming', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/refresh') {
      return route.fulfill({ status: 401, json: {} });
    }
    if (url.pathname === '/api/places' || url.pathname === '/api/places/bounds') {
      return route.fulfill({ json: {
        items: densePins,
        meta: { total: densePins.length, count: densePins.length, hasMore: false }
      } });
    }
    if (url.pathname === '/api/map-layers') {
      return route.fulfill({ json: { type:'FeatureCollection', features: [] } });
    }
    return route.fulfill({ json: { items: [], ok: true } });
  });

  await page.goto('/map', { waitUntil:'domcontentloaded' });
  await expect(page.locator('.hm-map-shell')).toBeVisible();
  await expect.poll(() => page.evaluate(() =>
    Boolean(window.__HOLA_MAP_INSTANCE__?.getSource('hola-place-points'))
  ), { timeout: 20000 }).toBe(true);

  await page.evaluate(() => window.__HOLA_MAP_INSTANCE__.jumpTo({
    center: [105.52505,21.01503], zoom: 12.5
  }));

  const clusters = () => page.evaluate(() => {
    const map = window.__HOLA_MAP_INSTANCE__;
    if (!map?.getLayer('hm-place-cluster-circle')) return 0;
    return map.queryRenderedFeatures({ layers:['hm-place-cluster-circle'] })
      .filter((feature) => Number(feature.properties?.point_count) > 1).length;
  });

  await expect.poll(clusters, { timeout:20000 }).toBeGreaterThan(0);
  await expect(page.getByRole('complementary', { name: 'Danh sách địa điểm' })).toHaveCount(1);

  await page.evaluate(() => window.__HOLA_MAP_INSTANCE__.jumpTo({
    center:[105.52505,21.01503],zoom:16.5
  }));
  await expect.poll(async () => page.evaluate(() => {
    const map = window.__HOLA_MAP_INSTANCE__;
    return map.getLayer('hm-place-point-label')
      ? map.queryRenderedFeatures({ layers:['hm-place-point-label'] }).length
      : 0;
  }), { timeout:20000 }).toBeGreaterThan(0);
});
