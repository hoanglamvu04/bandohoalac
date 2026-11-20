import { test, expect } from '@playwright/test';

test('unauthenticated visitors must sign in before submitting real estate', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/**', async (route) => {
    return route.fulfill({
      status: route.request().url().includes('/auth/refresh') ? 401 : 200,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Authentication required.', items: [] })
    });
  });

  await page.goto('/dang-tin-bat-dong-san', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('estate-login-required')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Đăng nhập' })).toBeVisible();
  await expect(page.getByTestId('estate-submission-form')).toHaveCount(0);
});

test('mobile sale request goes to PENDING moderation instead of publishing directly', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let submittedPayload = '';

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/refresh') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'test-session',
          user: { id: 77, name: 'Người gửi thử nghiệm', role: 'USER' }
        })
      });
    }

    if (url.pathname === '/api/contributions' && route.request().method() === 'POST') {
      submittedPayload = route.request().postData() || '';
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 415, status: 'PENDING' })
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], ok: true })
    });
  });

  await page.goto('/dang-tin-bat-dong-san?lat=21.013540&lng=105.525220', {
    waitUntil: 'domcontentloaded'
  });
  await expect(page.getByTestId('estate-submission-form')).toBeVisible();
  await page.locator('input[name="name"]').fill('Nhà 3 tầng gần Đại học FPT');
  await page.locator('input[name="address"]').fill('Hòa Lạc, Hà Nội');
  await page.locator('input[name="areaM2"]').fill('100');
  await page.locator('input[name="priceVnd"]').fill('3500000000');
  await page.locator('input[name="contactName"]').fill('Nguyễn An');
  await page.locator('input[name="phone"]').fill('0987654321');
  await page.locator('button.estate-confirm').click();
  await page.getByRole('button', { name: 'Gửi yêu cầu chờ duyệt' }).click();

  await expect(page.getByTestId('estate-submitted')).toContainText('CHỜ DUYỆT');
  expect(submittedPayload).toContain('CREATE_PLACE');
  expect(submittedPayload).toContain('bat-dong-san');
  expect(submittedPayload).toContain('"transactionType":"SALE"');
  expect(submittedPayload).toContain('"totalPriceVnd":3500000000');
  expect(submittedPayload).toContain('21.01354');
});
