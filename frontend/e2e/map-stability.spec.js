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

    await expect(page.locator('body')).toHaveClass(/map-route-active/);
    await expect(page.locator('.hm-search-v2')).toBeVisible();

    const header = page.locator('.navbar').first();
    const filter = page.locator('.hm-filter-trigger').first();
    await expect(filter).toBeVisible();

    const headerBox = await header.boundingBox();
    const filterBox = await filter.boundingBox();
    expect(filterBox).toBeTruthy();
    if (headerBox) {
      expect(filterBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
    }

    await filter.click();

    const popover = page.locator('.hm-filter-popover').first();
    await expect(popover).toBeVisible();
    const box = await popover.boundingBox();
    expect(box).toBeTruthy();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 2);
    expect(box.y + Math.min(box.height, 120)).toBeLessThanOrEqual(viewport.height + 2);

    const sidebar = page.locator('.hm-left-panel').first();
    const workspace = page.locator('.hm-workspace').first();
    const mapSurface = page.locator('.hm-map-shell').first();
    await expect(workspace).toHaveClass(/hm-workspace-split/);
    await expect(sidebar).toBeVisible();

    const [workspaceBox, sideBox, mapBox] = await Promise.all([
      workspace.boundingBox(),
      sidebar.boundingBox(),
      mapSurface.boundingBox()
    ]);
    expect(workspaceBox).toBeTruthy();
    expect(sideBox).toBeTruthy();
    expect(mapBox).toBeTruthy();

    // Desktop is a real two-column layout: the map begins at the rail edge
    // instead of rendering underneath a floating sidebar card.
    expect(Math.abs(mapBox.x - (sideBox.x + sideBox.width))).toBeLessThanOrEqual(2);
    expect(Math.abs(sideBox.y - workspaceBox.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(sideBox.height - workspaceBox.height)).toBeLessThanOrEqual(2);
    expect(mapBox.width).toBeGreaterThan(360);
  });
}

test('mobile map keeps controls inside viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubApi(page);
  await page.goto('/map', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toHaveClass(/map-route-active/);
  const workspaceLocator = page.locator('.hm-workspace');
  await expect(workspaceLocator).toBeVisible();
  await expect(workspaceLocator).not.toHaveClass(/hm-workspace-split/);

  const workspace = await workspaceLocator.boundingBox();
  const mapSurface = await page.locator('.hm-map-shell').boundingBox();
  expect(workspace.width).toBeLessThanOrEqual(390);
  expect(Math.abs(mapSurface.x - workspace.x)).toBeLessThanOrEqual(2);

  const listToggle = page.locator('.hm-mobile-list-toggle');
  await expect(listToggle).toBeVisible();
  await listToggle.click();
  await expect(page.locator('.hm-left-panel')).toHaveClass(/open/);
  await expect(listToggle).toContainText('Ẩn danh sách');
  await expect(workspaceLocator).not.toHaveClass(/hm-workspace-split/);

  await listToggle.click();
  await expect(page.locator('.hm-left-panel')).not.toHaveClass(/open/);
  await expect(listToggle).toContainText('Danh sách');
});


test('place list loads additional pages and virtualizes long result sets', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const requestedOffsets = [];

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/categories') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] })
      });
    }

    if (url.pathname === '/api/places/bounds') {
      const offset = Number(url.searchParams.get('offset') || 0);
      requestedOffsets.push(offset);
      const items = Array.from({ length: 45 }, (_, index) => {
        const id = offset + index + 1;
        return {
          id,
          name: 'Địa điểm kiểm thử ' + id,
          slug: 'dia-diem-kiem-thu-' + id,
          category: 'Cafe',
          categorySlug: 'cafe',
          address: 'Hòa Lạc, Hà Nội',
          lat: 21.01354 + (index % 10) * 0.00008,
          lng: 105.52522 + (index % 10) * 0.00008,
          rating: 4.5,
          reviews: 12,
          images: [],
          thumbnails: [],
          cardImages: [],
          status: 'PUBLISHED'
        };
      });

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items,
          total: 90,
          hasMore: offset + items.length < 90
        })
      });
    }

    if (url.pathname.startsWith('/api/map-layers')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ type: 'FeatureCollection', features: [] })
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], data: [], ok: true })
    });
  });

  await page.goto('/map', { waitUntil: 'domcontentloaded' });
  const list = page.locator('.hm-place-list');
  const footer = page.locator('.hm-place-list-footer');

  await expect(page.locator('.hm-place-row').first()).toBeVisible({ timeout: 20000 });
  await expect(footer).toContainText('45 / 90');

  await list.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
    node.dispatchEvent(new Event('scroll'));
  });

  await expect.poll(() => requestedOffsets.includes(45), { timeout: 15000 }).toBeTruthy();
  await expect(footer).toContainText('90 / 90', { timeout: 15000 });

  const renderedRows = await page.locator('.hm-place-row').count();
  expect(renderedRows).toBeLessThan(45);

  await list.evaluate((node) => {
    node.scrollTop = 0;
    node.dispatchEvent(new Event('scroll'));
  });
  const beforeSelection = await list.evaluate((node) => node.scrollTop);
  await page.locator('.hm-place-row').first().click();
  const afterSelection = await list.evaluate((node) => node.scrollTop);
  expect(Math.abs(afterSelection - beforeSelection)).toBeLessThanOrEqual(2);
});
