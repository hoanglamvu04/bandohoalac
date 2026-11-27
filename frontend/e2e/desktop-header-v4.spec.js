import { test, expect } from '@playwright/test';

async function mockMember(page) {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/refresh') return route.fulfill({
      json: { token: 'test-token', user: { id: 7, role: 'USER', name: 'Test member', email: 'member@example.invalid' } }
    });
    if (path === '/api/notifications') return route.fulfill({ json: { items: [], unreadCount: 0 } });
    return route.fulfill({ json: { items: [], ok: true } });
  });
}

for (const width of [1920, 1440, 1280, 1180, 1024, 980, 800, 761]) {
  test('desktop header stays in one row at ' + width + 'px with all member actions', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockMember(page);
    await page.addInitScript(() => {
      window.addEventListener('load', () => {
        window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
      });
    });
    await page.goto('/');
    const header = page.locator('.navbar');
    await expect(header.getByRole('button', { name: 'Mở tài khoản' }).first()).toBeVisible();
    await expect(header.locator('.compact-install-button')).toBeVisible();
    await expect(header.locator('.nav-cta')).toBeVisible();
    if (width > 1020) await expect(header.locator('.nav-estate-entry')).toBeVisible();
    const geometry = await header.evaluate(el => {
      const headerRect = el.getBoundingClientRect();
      const items = [...el.querySelectorAll('.brand-official, .compact-primary-nav .nav-link, .compact-nav-actions > a, .compact-nav-actions > button, .nav-notification-control, .desktop-account-menu-control')]
        .filter(item => item.getClientRects().length && getComputedStyle(item).visibility !== 'hidden')
        .map(item => ({ rect: item.getBoundingClientRect().toJSON(), whiteSpace: getComputedStyle(item).whiteSpace, isNav: item.classList.contains('nav-link') }));
      return { height: headerRect.height, width: headerRect.width, items };
    });
    expect(geometry.height).toBeGreaterThanOrEqual(70);
    expect(geometry.height).toBeLessThanOrEqual(76);
    for (const item of geometry.items) {
      expect(item.rect.left).toBeGreaterThanOrEqual(-1);
      expect(item.rect.right).toBeLessThanOrEqual(width + 1);
      if (item.isNav) expect(item.whiteSpace).toBe('nowrap');
    }
    const sorted = geometry.items.sort((a,b) => a.rect.left - b.rect.left);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].rect.left).toBeGreaterThanOrEqual(sorted[i-1].rect.right - 1);
    }
  });
}

test('compact desktop keeps secondary navigation reachable and Escape closes More', async ({page}) => {
  await page.setViewportSize({ width: 800, height: 800 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
  const more = nav.getByRole('button', { name: 'Thêm' });
  await expect(more).toBeVisible();
  await more.click();
  for (const label of ['Khám phá', 'Cộng đồng', 'Đối tác', 'Góp ý']) {
    await expect(nav.locator('.nav-more-menu').getByRole('link', { name: label })).toBeVisible();
  }
  await more.focus();
  await page.keyboard.press('Escape');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await nav.locator('.nav-more-menu').getByRole('link', { name: 'Góp ý' }).click();
  await expect(page).toHaveURL(/\/gop-y$/);
  await expect(more).toHaveAttribute('aria-expanded', 'false');
});

test('mobile keeps original navigation and account controls', async ({page}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.nav-more-switcher')).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Điều hướng di động' })).toBeVisible();
  await expect(page.locator('.mobile-account-button')).toBeVisible();
});
