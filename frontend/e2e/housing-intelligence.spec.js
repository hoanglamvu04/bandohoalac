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
  const viewportRequests = [];
  const marketRequests = [];
  const amenitiesRequests = [];
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
      if (url.searchParams.has('west')) {
        viewportRequests.push(Object.fromEntries(url.searchParams));
        return route.fulfill({ json: { items: [properties[0]],
          meta: { count: 1, total: 1, hasMore: false } } });
      }
      return route.fulfill({ json: { items: properties,
        meta: { count: 2, total: 2, hasMore: false } } });
    }
    if (url.pathname === '/api/housing/market-insights') {
      marketRequests.push(Object.fromEntries(url.searchParams));
      return route.fulfill({ json: {
        source: 'PUBLISHED_ACTIVE_ASKING_PRICES', listingType: 'SALE',
        propertyType: null, areaBasis: 'MAP_VIEWPORT',
        sampleCount: 6, minSample: 5, sufficientSample: true,
        unit: 'VND_PER_M2',
        quartiles: { p25: 20000000, median: 30000000, p75: 42000000 },
        disclaimer: 'Giá chào, không phải giá giao dịch hoặc định giá.'
      } });
    }
    if (/^\/api\/housing\/\d+\/amenities$/.test(url.pathname)) {
      amenitiesRequests.push(url.pathname);
      return route.fulfill({ json: {
        placeId: '701', radiusM: Number(url.searchParams.get('radius') || 1000),
        matchedCount: 2, capped: false,
        categories: [
          { categorySlug: 'truong-hoc', name: 'Trường học', count: 1 },
          { categorySlug: 'y-te', name: 'Y tế', count: 1 }
        ],
        places: [
          { id: '91', name: 'Trường FPT QA', categorySlug:'truong-hoc', distanceM: 350 },
          { id: '92', name: 'Trạm y tế QA', categorySlug:'y-te', distanceM: 790 }
        ],
        method: 'STRAIGHT_LINE_DISTANCE',
        disclaimer: 'Khoảng cách đường thẳng, không phải thời gian lái xe.'
      } });
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
  return { compareRequests, savedOperations, marketRequests, amenitiesRequests, viewportRequests };
}

test('Housing Sprint 2 compares 2 public listings with price/m² and FPT distance', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const requests = await stubHousing(page);
  await page.goto('/map?vertical=housing&category=bat-dong-san',
    { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: 'Công cụ', exact: true }).click();
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
  await page.getByRole('button', { name: 'Công cụ', exact: true }).click();
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
  await page.getByRole('button', { name: 'Công cụ', exact: true }).click();
  await panel.getByRole('button', { name: 'Xóa bộ lọc Đất FPT dưới 2 tỷ' }).click();
  await expect(panel.getByText('Bạn chưa lưu bộ lọc nào.')).toBeVisible();
  expect(calls.savedOperations.map((c) => c.method)).toEqual(['POST','PATCH','DELETE']);
});

test('Market + location intelligence works on approved property data without GPS or login', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const requests = await stubHousing(page);
  await page.goto('/map?vertical=housing&category=bat-dong-san',
    { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Công cụ', exact: true }).click();
  const panel = page.getByTestId('housing-intelligence');
  await panel.getByRole('button', { name: /So sánh & theo dõi tin mới/ }).click();
  await panel.getByRole('button', { name: 'Xem thống kê giá/m²' }).click();
  const market = panel.getByTestId('housing-market-insights');
  await expect(market).toContainText('Trung vị');
  await expect(market).toContainText('30.000.000 đ');
  await expect(market).toContainText('không phải giá giao dịch');
  expect(requests.marketRequests).toHaveLength(1);
  for (const secret of ['phone','lat','lng','email','token','q']) {
    expect(Object.hasOwn(requests.marketRequests[0], secret)).toBe(false);
  }
  await panel.getByRole('button', { name: 'Xem tiện ích gần tin' }).click();
  const amenities = panel.getByTestId('housing-amenities');
  await expect(amenities).toContainText('Trường học: 1');
  await expect(amenities).toContainText('Trạm y tế QA');
  await expect(amenities.getByRole('link', { name:'Trường FPT QA' }))
    .toHaveAttribute('href','/place/91');
  expect(requests.amenitiesRequests).toEqual(['/api/housing/701/amenities']);
});

test('Housing map searches the actual viewport on demand using spatial query', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const calls = await stubHousing(page);
  await page.goto('/map?vertical=housing&category=bat-dong-san&listingType=SALE',
    { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Công cụ', exact: true }).click();
  const panel = page.getByTestId('housing-intelligence');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: /So sánh & theo dõi tin mới/ }).click();
  const button = panel.getByRole('button', { name: 'Tìm tin trong vùng bản đồ' });
  await expect(button).toBeEnabled();
  await button.click();
  const result = panel.getByTestId('housing-viewport-results');
  await expect(result).toContainText('1 tin phù hợp');
  await expect(result.getByRole('link', { name: 'Đất A đã duyệt' }))
    .toHaveAttribute('href', '/place/701');
  expect(calls.viewportRequests).toHaveLength(1);
  const query = calls.viewportRequests[0];
  expect(query.listingType).toBe('SALE');
  for (const key of ['west','south','east','north']) expect(Number.isFinite(Number(query[key]))).toBe(true);
  expect(Number(query.west)).toBeLessThan(Number(query.east));
  expect(Number(query.south)).toBeLessThan(Number(query.north));
});
