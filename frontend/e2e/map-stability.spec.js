import { test, expect } from '@playwright/test';

async function stubApi(page) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/categories')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
    }
    if (url.includes('/api/places')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0 }) });
    }
    if (url.includes('/api/map-layers')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: [] }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], data: [], ok: true }) });
  });
}

for (const viewport of [
  { width: 1536, height: 864, name: 'desktop-100' },
  { width: 1365, height: 768, name: 'laptop-100' },
  { width: 1228, height: 691, name: 'compact-desktop' }
]) {
  test(`map toolbar remains usable at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await stubApi(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('.hm-search-v2')).toBeVisible();
    const filter = page.locator('.hm-filter-trigger').first();
    await expect(filter).toBeVisible();
    await filter.click();

    const popover = page.locator('.hm-filter-popover').first();
    await expect(popover).toBeVisible();
    const box = await popover.boundingBox();
    expect(box).toBeTruthy();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 2);
    expect(box.y + Math.min(box.height, 120)).toBeLessThanOrEqual(viewport.height + 2);

    const sidebar = page.locator('.hm-left-panel').first();
    if (await sidebar.isVisible()) {
      const sideBox = await sidebar.boundingBox();
      expect(sideBox.height).toBeLessThanOrEqual(viewport.height);
    }
  });
}

test('mobile map keeps controls inside viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubApi(page);
  await page.goto('/map', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.hm-workspace')).toBeVisible();
  const workspace = await page.locator('.hm-workspace').boundingBox();
  expect(workspace.width).toBeLessThanOrEqual(390);
});
