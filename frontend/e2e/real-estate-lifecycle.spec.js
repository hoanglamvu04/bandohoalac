import { expect, test } from '@playwright/test';

test('mobile owner can request price review and mark a sold property hidden', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let status = 'ACTIVE';
  let placeStatus = 'PUBLISHED';
  let priceRequest = null;
  let managementAction = '';

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const json = (data, code = 200) => route.fulfill({
      status: code,
      contentType: 'application/json',
      body: JSON.stringify(data)
    });

    if (path === '/api/auth/refresh') {
      return json({
        token: 'test-session',
        user: { id: 77, name: 'Người đăng thử nghiệm', role: 'USER' }
      });
    }
    if (path === '/api/housing/mine') return json({ items: [{
      id: '9001', name: 'Nhà phố Hòa Lạc', address: 'Hòa Lạc',
      listingType: 'SALE', listingStatus: status, placeStatus,
      totalPriceVnd: 3500000000, areaM2: 90,
      expiresAt: '2030-01-01T00:00:00Z'
    }] });
    if (path === '/api/contributions' && route.request().method() === 'POST') {
      priceRequest = route.request().postData();
      return json({ id: 501, status: 'PENDING' }, 201);
    }
    if (path === '/api/housing/9001/manage' && route.request().method() === 'PATCH') {
      managementAction = JSON.parse(route.request().postData() || '{}').action;
      if (managementAction === 'SOLD') {
        status = 'SOLD';
        placeStatus = 'ARCHIVED';
      }
      return json({ placeId: '9001', listingStatus: status, action: managementAction });
    }
    return json({ items: [], ok: true });
  });

  await page.goto('/tin-bat-dong-san-cua-toi', { waitUntil: 'domcontentloaded' });
  const card = page.getByTestId('my-estate-9001');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Đang hiển thị');

  await card.locator('input[type="number"]').fill('3200000000');
  page.once('dialog', dialog => dialog.accept());
  await card.getByRole('button', { name: 'Gửi chờ duyệt' }).click();
  await expect.poll(() => priceRequest).not.toBeNull();
  expect(priceRequest).toContain('"realEstatePriceVnd":3200000000');
  expect(priceRequest).toContain('UPDATE_PRICE');

  page.once('dialog', dialog => dialog.accept());
  await card.getByRole('button', { name: 'Đã bán' }).click();
  await expect.poll(() => managementAction).toBe('SOLD');
  await expect(card).toContainText('Tin đã ẩn khỏi bản đồ');
  await expect(card.getByRole('link', { name: 'Xem tin công khai' })).toHaveCount(0);
});
