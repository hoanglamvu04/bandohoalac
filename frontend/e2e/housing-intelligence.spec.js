import { expect, test } from '@playwright/test';

const base = {
  category: 'Bất động sản', categorySlug: 'bat-dong-san',
  address: 'Hòa Lạc, Hà Nội', status: 'PUBLISHED',
  rating: 4.5, reviews: 4, images: [], thumbnails: [], cardImages: []
};

const properties = [
  { ...base, id: 701, slug: 'dat-a', name: 'Đất A đã duyệt',
    lat: 21.01354, lng: 105.52522, distanceToFptM: 300,
    housing: { listingType: 'SALE', listingStatus: 'ACTIVE',
      totalPriceVnd: 2400000000, areaM2: 80, propertyType: 'LAND' } },
  { ...base, id: 702, slug: 'nha-b', name: 'Nhà B đã duyệt',
    lat: 21.014, lng: 105.526, distanceToFptM: 450,
    housing: { listingType: 'SALE', listingStatus: 'ACTIVE',
      totalPriceVnd: 3100000000, areaM2: 100, propertyType: 'HOUSE' } }
];
const comparison = {
  items: properties.map((place) => ({
    ...place,
    pricePerM2Vnd: Math.round(place.housing.totalPriceVnd / place.housing.areaM2)
  })),
  unavailableCount: 0, comparisonBasis: 'published_active_only',
  distanceNote: 'Khoảng cách tới FPT là đường chim bay.'
};

async function stubHousing(page, authenticated = false) {
  const compareRequests = [];
  let saved = [];
  const savedOperations = [];

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/refresh') {
      return route.fulfill(authenticated
        ? { status: 200, json: { token: 'fake-e2e-token',
          user: { id: 987, email: 'tester@example.test', role: 'USER', name: 'Test' } } }
        : { status: 401, json: { error: 'No session' } });
    }
    if (url.pathname === '/api/housing' && route.request().method() === 'GET') {
      return route.fulfill({ json: { items: properties,
        meta: { count: 2, total: 2, hasMore: false } } });
    }
    if (url.pathname === '/api/housing/compare') {
      compareRequests.push(url.searchParams.get('ids'));
      return route.fulfill({ json: comparison });
    }
    if (url.pathname === '/api/housing/saved-searches') {
      if (!authenticated) return route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      const method = route.request().method();
      if (method === 'POST') {
        const payload = route.request().postDataJSON();
        savedOperations.push({ method, payload });
        const item = { id: String(saved.length + 1), name: payload.name,
          filters: payload.filters, enabled: true, createdAt: new Date().toISOString() };
        saved = [item, ...saved];
        return route.fulfill({ status: 201, json: { item } });
      }
      return route.fulfill({ json: { items: saved } });
    }
    if (url.pathname.startsWith('/api/housing/saved-searches/')) {
      const id = url.pathname.split('/').pop();
      const method = route.request().method();
      savedOperations.push({ method, id });
      if (method === 'PATCH') {
        const newEnabled = route.request().postDataJSON().enabled;
        saved = saved.map((s) => s.id === id ? { ...s, enabled: newEnabled } : s);
        return route.fulfill({ json: { item: saved.find((s) => s.id === id) } });
      }
      if (method === 'DELETE') {
        saved = saved.filter((s) => s.id !== id);
        return route.fulfill({ json: { ok: true } });
      }
    }
    if (url.pathname === '/api/places/bounds') {
      return route.fulfill({ json: { items: properties, total: 2, hasMore: false } });
    }
    if (url.pathname === '/api/categories') {
      return route.fulfill({ json: { items: [] } });
    }
    if (url.pathname === '/api/notifications') {
      return route.fulfill({ json: { items: [], unreadCount: 0 } });
    }
    if (url.pathname.startsWith('/api/map-layers')) {
      return route.fulfill({ json: { type: 'FeatureCollection', features: [] } });
    }
    return route.fulfill({ json: { items: [], data: [], ok: true } });
  });
  return { compareRequests, savedOperations };
}

test('Housing Sprint 2 compares 2 public listings with price/m² and FPT distance', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const requests = await stubHousing(page);
  await page.goto('/map?vertical=housing&category=bat-dong-san',
    { waitUntil: 'domcontentloaded' });

  const panel = page.getByTestId('housing-intelligence');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: /So sánh & theo dõi tin mới/ }).click();
  const select = panel.getByLabel('Chọn bất động sản để so sánh');
  await expect(select.locator('option[value="701"]')).toHaveCount(1);
  await select.selectOption('701');
  await select.selectOption('702');
  await panel.getByRole('button', { name: 'So sánh 2 tin' }).click();

  await expect(panel.locator('.hm-intel-table')).toBeVisible();
  await expect(panel).toContainText('30.000.000 đ/m²');
  await expect(panel).toContainText('31.000.000 đ/m²');
  await expect(panel).toContainText('đường thẳng');
  expect(requests.compareRequests).toEqual(['701,702']);
  await expect(panel.getByRole('link', { name: 'Đất A đã duyệt' }))
    .toHaveAttribute('href', '/place/701');
});

test('Authenticated housing filters can be saved, paused, reapplied and removed', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const calls = await stubHousing(page, true);
  await page.goto('/map?vertical=housing&category=bat-dong-san&listingType=SALE',
    { waitUntil: 'domcontentloaded' });
  const panel = page.getByTestId('housing-intelligence');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: /So sánh & theo dõi tin mới/ }).click();

  await expect(panel.getByLabel('Tên bộ lọc bất động sản')).toBeVisible();
  await panel.getByLabel('Tên bộ lọc bất động sản').fill('Đất FPT dưới 2 tỷ');
  await panel.getByRole('button', { name: 'Lưu bộ lọc đang chọn' }).click();
  await expect(panel.getByText('Đất FPT dưới 2 tỷ')).toBeVisible();
  expect(calls.savedOperations.find((c) => c.method === 'POST')?.payload.filters)
    .toEqual({ listingType: 'SALE' });

  await panel.getByRole('button', { name: 'Tạm dừng Đất FPT dưới 2 tỷ' }).click();
  await expect(panel.getByText('Đã tạm dừng')).toBeVisible();
  await panel.getByRole('button', { name: 'Áp dụng' }).click();
  await expect(page).toHaveURL(/listingType=SALE/);
  await panel.getByRole('button', { name: 'Xóa bộ lọc Đất FPT dưới 2 tỷ' }).click();
  await expect(panel.getByText('Bạn chưa lưu bộ lọc nào.')).toBeVisible();
  expect(calls.savedOperations.map((c) => c.method)).toEqual(['POST','PATCH','DELETE']);
});
