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
