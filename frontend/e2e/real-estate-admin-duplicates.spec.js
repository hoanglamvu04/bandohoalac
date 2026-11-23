import { expect, test } from '@playwright/test';

const contribution = {
  id: 6201, type: 'CREATE_PLACE', status: 'PENDING',
  userName: 'Người đăng QA', userEmail: 'qa@example.invalid',
  createdAt: '2026-11-20T08:00:00.000Z',
  payload: {
    location: { lat: 21.01354, lng: 105.52522 },
    place: {
      name: 'Nhà phố Hòa Lạc QA', categorySlug: 'bat-dong-san',
      address: 'Thạch Thất, Hà Nội', phone: '0987654321',
      realEstate: {
        transactionType: 'SALE', propertyType: 'HOUSE',
        areaM2: 100, totalPriceVnd: 3500000000,
        contactName: 'Người đăng QA', publicContactConsent: true
      }
    },
    photos: []
  }
};

async function serveAdmin(page, getNearby, onApprove) {
  await page.route('**/api/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/auth/refresh') return route.fulfill({ json: {
      token: 'test-admin-token', user: {
        id: 22, name: 'Admin QA', role: 'ADMIN',
        security: { adminTwoFactorSetupRequired: false }
      }
    } });
    if (pathname === '/api/admin/contributions' && route.request().method() === 'GET')
      return route.fulfill({ json: { items: [contribution] } });
    if (pathname === '/api/admin/contributions/6201/duplicates')
      return route.fulfill({ json: getNearby() });
    if (pathname === '/api/admin/contributions/6201/approve' && route.request().method() === 'POST') {
      onApprove(JSON.parse(route.request().postData() || '{}'));
      return route.fulfill({ json: { id: 6201, status: 'APPROVED' } });
    }
    return route.fulfill({ json: { items: [], ok: true } });
  });
  page.on('dialog', (dialog) => dialog.accept());
}

test('Admin sees published and pending matches and must acknowledge before approval', async ({ page }) => {
  let approved = null;
  let checks = 0;
  const matches = [
    { id: 9001, source: 'PUBLISHED', name: 'Nhà bên cạnh', address: 'Hòa Lạc',
      phone: '0911111111', distanceM: 11, risk: 'NEARBY' },
    { id: 9002, source: 'PENDING', name: 'Căn hộ 203', address: 'Hòa Lạc',
      phone: '0922222222', distanceM: 0, risk: 'NEARBY' }
  ];
  await serveAdmin(page, () => {
    checks += 1;
    return { items: matches, requiresReview: false, radiusM: 100 };
  }, (body) => { approved = body; });
  await page.goto('/admin/contributions');

  const results = page.getByTestId('estate-duplicate-check-6201');
  await expect(results).toBeVisible();
  await results.getByRole('button', { name: 'Kiểm tra tin gần vị trí (100 m)' }).click();
  await expect(results).toContainText('Nhà bên cạnh');
  await expect(results).toContainText('Đang chờ duyệt #9002');
  await expect(results.getByRole('link', { name: 'Nhà bên cạnh' }))
    .toHaveAttribute('href', '/place/9001');

  await page.getByRole('button', { name: 'Duyệt & đăng bản đồ' }).click();
  await expect.poll(() => checks).toBe(2);
  expect(approved).toBeNull();
  await results.getByLabel('Tôi đã đối chiếu tin gần vị trí 6201').check();
  await page.getByRole('button', { name: 'Duyệt & đăng bản đồ' }).click();
  await expect.poll(() => approved).not.toBeNull();
  expect(approved.nearbyListingsReviewed).toBe(true);
});

test('changed nearby results invalidate a previously acknowledged review', async ({ page }) => {
  let approved = null;
  let version = 0;
  await serveAdmin(page, () => ({
    items: [
      { id: 9001, source: 'PUBLISHED', name: 'Nhà bên cạnh', distanceM: 10, risk: 'NEARBY' },
      ...(version > 0 ? [{
        id: 9003, source: 'PENDING', name: 'Tin mới đang chờ',
        distanceM: 15, risk: 'REVIEW'
      }] : [])
    ]
  }), (body) => { approved = body; });
  await page.goto('/admin/contributions');
  const results = page.getByTestId('estate-duplicate-check-6201');
  await results.getByRole('button', { name: 'Kiểm tra tin gần vị trí (100 m)' }).click();
  await results.getByLabel('Tôi đã đối chiếu tin gần vị trí 6201').check();

  version = 1; // A second owner submitted while this Admin was reviewing.
  await page.getByRole('button', { name: 'Duyệt & đăng bản đồ' }).click();
  await expect(results).toContainText('Tin mới đang chờ');
  await expect(results.getByLabel('Tôi đã đối chiếu tin gần vị trí 6201')).not.toBeChecked();
  expect(approved).toBeNull();

  await results.getByLabel('Tôi đã đối chiếu tin gần vị trí 6201').check();
  await page.getByRole('button', { name: 'Duyệt & đăng bản đồ' }).click();
  await expect.poll(() => approved).not.toBeNull();
  expect(approved.nearbyListingsReviewed).toBe(true);
});

test('Data Trust V3 explains matching signals and invalidates acknowledgement when SAME candidate risk changes', async ({ page }) => {
  let approved = null;
  let riskVersion = 0;
  await serveAdmin(page, () => ({
    version: 3, radiusM: 100, requiresReview: true,
    items: [{
      id: 9001, source: 'PUBLISHED',
      name: 'Nhà phố Hòa Lạc', address: 'Hòa Lạc', distanceM: 12,
      phone: '0987654321',
      risk: riskVersion === 0 ? 'REVIEW' : 'LIKELY_DUPLICATE',
      confidence: riskVersion === 0 ? 69 : 92,
      titleSimilarity: riskVersion === 0 ? 0.85 : 0.98,
      evidence: riskVersion === 0
        ? ['SIMILAR_TITLE', 'SAME_PROPERTY_TYPE']
        : ['SAME_CONTACT', 'SAME_TITLE', 'SIMILAR_AREA', 'SIMILAR_PRICE']
    }]
  }), (body) => { approved = body; });

  await page.goto('/admin/contributions');
  const results = page.getByTestId('estate-duplicate-check-6201');
  await results.getByRole('button', { name: 'Kiểm tra tin gần vị trí (100 m)' }).click();
  await expect(results).toContainText('Tên gần giống');
  await expect(results).toContainText('Điểm tín hiệu: 69/100');
  await expect(results).toContainText('không phải xác suất trùng');
  await results.getByLabel('Tôi đã đối chiếu tin gần vị trí 6201').check();

  // The candidate still has the same published place ID, but its title /
  // evidence changed during Admin review. Old UI compared IDs only.
  riskVersion = 1;
  await page.getByRole('button', { name: 'Duyệt & đăng bản đồ' }).click();
  await expect(results).toContainText('Điểm tín hiệu: 92/100');
  await expect(results).toContainText('Cùng số liên hệ');
  await expect(results).toContainText('Giá gần bằng');
  await expect(results.getByLabel('Tôi đã đối chiếu tin gần vị trí 6201'))
    .not.toBeChecked();
  expect(approved).toBeNull();

  await results.getByLabel('Tôi đã đối chiếu tin gần vị trí 6201').check();
  await page.getByRole('button', { name: 'Duyệt & đăng bản đồ' }).click();
  await expect.poll(() => approved).not.toBeNull();
  expect(approved.nearbyListingsReviewed).toBe(true);
});

test('Data Trust V3 warns distinct apartment units are not automatically duplicates', async ({ page }) => {
  await serveAdmin(page, () => ({
    version: 3, requiresReview: true, radiusM: 100,
    items: [{
      id: 9005, source: 'PUBLISHED', name: 'Căn 102',
      distanceM: 0, risk: 'REVIEW', confidence: 24,
      titleSimilarity: 0.87, differentUnit: true,
      evidence: ['SAME_CONTACT','DIFFERENT_UNIT','SIMILAR_AREA','SIMILAR_PRICE']
    }]
  }), () => {});
  await page.goto('/admin/contributions');
  const results = page.getByTestId('estate-duplicate-check-6201');
  await results.getByRole('button', { name: 'Kiểm tra tin gần vị trí (100 m)' }).click();
  await expect(results).toContainText('Khác số căn/phòng/lô');
  await expect(results).toContainText('Gần nhau không có nghĩa là trùng');
  await expect(results).toContainText('không tự từ chối tin');
});
