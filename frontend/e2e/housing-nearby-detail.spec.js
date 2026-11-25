import { expect, test } from '@playwright/test';

const property = {
  id: 777, slug: 'nha-pho-777', status: 'PUBLISHED',
  name: 'Nhà phố Hòa Lạc đã duyệt', category: 'Bất động sản',
  categorySlug: 'bat-dong-san', source: 'USER', address: 'Hòa Lạc, Hà Nội',
  lat: 21.01354, lng: 105.52522, images: []
};

async function mockDetail(page, { isHousing = true, amenities = null } = {}) {
  const calls = [];
  let failNext = false;
  await page.route('**/api/**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    if (pathname === '/api/auth/refresh') return route.fulfill({ status: 401, json: {} });
    if (pathname === '/api/places/777') {
      return route.fulfill({ json: isHousing ? property : {
        ...property, category: 'Cafe', categorySlug: 'cafe'
      } });
    }
    if (pathname === '/api/housing/777') {
      return route.fulfill({ json: { item: { ...property, housing: {
        listingType: 'SALE', propertyType: 'HOUSE',
        areaM2: 100, totalPriceVnd: 3500000000, listingStatus: 'ACTIVE'
      } } } });
    }
    if (pathname === '/api/housing/777/amenities') {
      calls.push({ pathname, params: Object.fromEntries(url.searchParams) });
      if (failNext) {
        failNext = false;
        return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
      }
      const radius = Number(url.searchParams.get('radius'));
      return route.fulfill({ json: amenities || {
        placeId: '777', radiusM: radius, matchedCount: radius === 2000 ? 3 : 2,
        capped: false, method: 'STRAIGHT_LINE_DISTANCE',
        dataQuality: {
          trackedCategoryCount: 8, freshnessDays: 180,
          verification: { recent: 1, older: 0, unknown: radius === 2000 ? 2 : 1 }
        },
        categories: [
          { categorySlug: 'truong-hoc', name: 'Trường học', count: 1 },
          { categorySlug: 'y-te', name: 'Y tế', count: 1 }
        ],
        places: [
          { id: '91', name: 'Trường Hòa Lạc', categorySlug: 'truong-hoc', distanceM: 350 },
          { id: '92', name: 'Trạm y tế', categorySlug: 'y-te', distanceM: 720 }
        ],
        disclaimer: 'Khoảng cách đường thẳng'
      } });
    }
    if (pathname === '/api/places/nearby') return route.fulfill({ json: { items: [] } });
    if (pathname === '/api/halo/v1/places/777') return route.fulfill({ json: { item: null } });
    return route.fulfill({ json: { items: [], ok: true } });
  });
  return { calls, failOnce: () => { failNext = true; } };
}

test('guest on mobile can inspect public amenities by radius, without GPS collection', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests = await mockDetail(page);
  await page.goto('/place/777', { waitUntil: 'domcontentloaded' });
  const section = page.getByTestId('housing-nearby-detail');
  await expect(section).toBeVisible();
  await expect(section.getByRole('heading', { name: 'Tiện ích quanh bất động sản' })).toBeVisible();
  expect(requests.calls).toHaveLength(0); // Expensive API is only user-triggered
  await section.getByRole('button', { name: 'Tra cứu tiện ích' }).click();
  const results = section.getByTestId('housing-nearby-results');
  await expect(results).toContainText('2 địa điểm được ghi nhận');
  await expect(results).toContainText('Đã ghi nhận 2/8 nhóm tiện ích trong bán kính này.');
  await expect(results).toContainText('1 địa điểm được HOLA xác minh trong 180 ngày gần đây');
  await expect(results).toContainText('1 chưa có ngày xác minh hợp lệ');
  await expect(results).toContainText('Trường học');
  await expect(results.getByRole('link', { name: 'Trường Hòa Lạc' }))
    .toHaveAttribute('href', '/place/91');
  await expect(results).toContainText('350 m');
  await expect(section).toContainText('không phải quãng đường hay thời gian di chuyển');
  expect(requests.calls).toHaveLength(1);
  expect(requests.calls[0]).toEqual({
    pathname: '/api/housing/777/amenities', params: { radius: '1000' }
  });
  await section.getByLabel('Bán kính tra cứu').selectOption('2000');
  await expect(section.getByTestId('housing-nearby-results')).toHaveCount(0);
  await section.getByRole('button', { name: 'Tra cứu tiện ích' }).click();
  await expect(results).toContainText('3 địa điểm được ghi nhận');
  expect(requests.calls[1].params).toEqual({ radius: '2000' });
});

test('errors are reversible and capped values never claim exhaustive totals', async ({ page }) => {
  const requests = await mockDetail(page, { amenities: {
    placeId: '777', radiusM: 1000, matchedCount: 100, capped: true,
    categories: [{ categorySlug: 'truong-hoc', name: 'Trường học', count: 100 }],
    places: [], method: 'STRAIGHT_LINE_DISTANCE',
    dataQuality: {
      trackedCategoryCount: 8, freshnessDays: 180,
      verification: { recent: 40, older: 10, unknown: 50 }
    }
  } });
  await page.goto('/place/777');
  const section = page.getByTestId('housing-nearby-detail');
  await expect(section).toBeVisible();
  requests.failOnce();
  await section.getByRole('button', { name: 'Tra cứu tiện ích' }).click();
  await expect(section.getByRole('alert')).toContainText('Chưa thể tải tiện ích');
  await section.getByRole('button', { name: 'Tra cứu lại' }).click();
  await expect(section.getByTestId('housing-nearby-results'))
    .toContainText('Ít nhất 100 địa điểm được ghi nhận');
  await expect(section).toContainText('Đã ghi nhận 1/8 nhóm tiện ích trong mẫu giới hạn.');
  await expect(section).toContainText('Trong mẫu: 40 địa điểm được HOLA xác minh');
});

test('regular public POIs do not show housing-only location intelligence', async ({ page }) => {
  const requests = await mockDetail(page, { isHousing: false });
  await page.goto('/place/777');
  await expect(page.getByRole('heading', { name: property.name })).toBeVisible();
  await expect(page.getByTestId('housing-nearby-detail')).toHaveCount(0);
  expect(requests.calls).toHaveLength(0);
});

test('empty amenities communicate missing observations', async ({ page }) => {
  await mockDetail(page, { amenities: {
    placeId: '777', radiusM: 1000, matchedCount: 0, capped: false,
    categories: [], places: [],
    dataQuality: {
      trackedCategoryCount: 8, freshnessDays: 180,
      verification: { recent: 0, older: 0, unknown: 0 }
    }
  } });
  await page.goto('/place/777');
  const section = page.getByTestId('housing-nearby-detail');
  await section.getByRole('button', { name: 'Tra cứu tiện ích' }).click();
  await expect(section).toContainText('Đã ghi nhận 0/8 nhóm tiện ích');
  await expect(section).toContainText('Chưa ghi nhận tiện ích nào trong dữ liệu hiện có');
  await expect(section).not.toContainText('0 địa điểm được HOLA xác minh');
});
