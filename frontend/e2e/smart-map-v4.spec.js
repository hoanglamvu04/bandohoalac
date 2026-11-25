import { expect, test } from '@playwright/test';

const listing = {
  id: 940, slug: 'dat-smart-map', name: 'Đất Smart Map đã duyệt',
  category: 'Bất động sản', categorySlug: 'bat-dong-san',
  address: 'Hòa Lạc, Hà Nội', status: 'PUBLISHED',
  lat: 21.01354, lng: 105.52522, images: [],
  housing: { listingType: 'SALE', propertyType: 'LAND', listingStatus: 'ACTIVE',
    totalPriceVnd: 2500000000, areaM2: 90 }
};

test('mobile map movement preserves pending housing results and filters open the result sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  let releaseFirst;
  const firstResponse = new Promise((resolve) => { releaseFirst = resolve; });
  const housingRequests = [];

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/housing') {
      housingRequests.push(Object.fromEntries(url.searchParams));
      if (housingRequests.length === 1) await firstResponse;
      return route.fulfill({
        json: { items: [listing], meta: { total: 1, count: 1, hasMore: false } }
      });
    }
    if (url.pathname === '/api/auth/refresh') return route.fulfill({ status: 401, json: {} });
    if (url.pathname === '/api/map-layers') {
      return route.fulfill({ json: { type: 'FeatureCollection', features: [] } });
    }
    return route.fulfill({ json: { items: [], ok: true } });
  });

  try {
    await page.goto('/map?vertical=housing&category=bat-dong-san', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.hm-map-shell')).toBeVisible();
    await expect.poll(() => housingRequests.length, { timeout: 20000 }).toBe(1);
    await page.evaluate(() => {
      const map = window.__HOLA_MAP_INSTANCE__;
      map.panBy([45, 0], { duration: 0 });
      map.panBy([45, 0], { duration: 0 });
    });
    // Keep the first request pending past the housing debounce.
    await page.waitForTimeout(450);
    expect(housingRequests).toHaveLength(1);
    releaseFirst();

    const list = page.getByRole('complementary', { name: 'Danh sách địa điểm' });
    await expect(list).toContainText(listing.name);
    await page.getByRole('button', { name: 'Mở bộ lọc địa điểm' }).click();
    const panel = page.getByRole('region', { name: 'Bộ lọc địa điểm' });
    const showResults = panel.getByRole('button', { name: 'Xem kết quả' });
    await expect(showResults).toBeInViewport();
    await panel.locator('summary').filter({ hasText: 'Tất cả tin' }).click();
    await panel.getByRole('option', { name: 'Cần bán' }).click();
    await expect(page).toHaveURL(/listingType=SALE/);
    await expect.poll(() => housingRequests.map((request) => request.listingType || 'ALL'))
      .toEqual(['ALL', 'SALE']);
    await showResults.click();
    await expect(panel).toHaveCount(0);
    await expect(list).toHaveClass(/open/);
    await expect(list).toContainText(listing.name);
  } finally {
    releaseFirst();
  }
});
