import { test, expect } from '@playwright/test';

test('mobile visitors can submit a pending report that a property is no longer available', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let posted = '';

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    const json = (body, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });

    if (pathname === '/api/auth/refresh') {
      return json({
        token: 'test-session',
        user: { id: 77, role: 'USER', name: 'Người dùng thử nghiệm' }
      });
    }
    if (pathname === '/api/places/101') {
      return json({
        id: 101, name: 'Nhà Hòa Lạc thử nghiệm',
        address: 'Hòa Lạc, Hà Nội',
        category: 'Bất động sản', categorySlug: 'bat-dong-san',
        description: 'Nhà ba tầng đang rao bán', lat: 21.01354, lng: 105.52522,
        rating: 0, images: [], thumbnails: [], status: 'PUBLISHED'
      });
    }
    if (pathname === '/api/housing/101') {
      return json({ item: {
        id: '101', housing: { listingType: 'SALE', propertyType: 'HOUSE',
          totalPriceVnd: 3200000000, areaM2: 90, listingStatus: 'ACTIVE' }
      } });
    }
    if (pathname === '/api/contributions' && route.request().method() === 'POST') {
      posted = route.request().postData() || '';
      return json({ id: 6501, status: 'PENDING' }, 201);
    }
    return json({ items: [], ok: true });
  });

  await page.goto('/place/101', { waitUntil: 'domcontentloaded' });
  const action = page.getByRole('button', { name: 'Báo tin không còn hiệu lực' });
  await expect(action).toBeVisible();
  await action.click();

  const form = page.locator('.place-trust-report-form');
  await expect(form).toContainText('Báo tin đã giao dịch hoặc không còn hiệu lực');
  await expect(form.locator('input')).toHaveCount(0);
  await form.locator('textarea').fill('Chủ nhà xác nhận đã bán và đề nghị gỡ tin khỏi bản đồ.');
  await form.getByRole('button', { name: 'Gửi báo cáo' }).click();

  await expect.poll(() => posted).toContain('REPORT_CLOSED');
  expect(posted).toContain('placeId');
  expect(posted).toContain('101');
  await expect(form).toHaveCount(0);
});
