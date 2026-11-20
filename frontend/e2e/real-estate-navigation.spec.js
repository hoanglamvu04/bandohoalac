import { test, expect } from '@playwright/test';

test('desktop header has a clear real-estate submission action', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const action = page.locator('.nav-estate-entry');
  await expect(action).toBeVisible();
  await expect(page.locator('.nav-cta')).toBeVisible();
  await action.click();

  await expect(page).toHaveURL(/\/dang-tin-bat-dong-san$/);
  await expect(page.getByTestId('estate-login-required')).toBeVisible();
});

test('map dropdown keeps real-estate posting accessible on compact desktop', async ({ page }) => {
  await page.setViewportSize({ width: 980, height: 780 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.nav-estate-entry')).toBeHidden();
  await page.getByRole('button', { name: /Bản đồ/ }).first().click();
  await expect(page.locator('.nav-estate-map-action')).toBeVisible();
  await page.locator('.nav-estate-map-action').click();
  await expect(page).toHaveURL(/\/dang-tin-bat-dong-san$/);
});

test('mobile housing map offers Đăng tin without removing general Đóng góp', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const navigation = page.getByRole('navigation', { name: 'Điều hướng di động' });

  await page.goto('/map?vertical=housing&category=bat-dong-san', {
    waitUntil: 'domcontentloaded'
  });
  const estateAction = navigation.getByRole('link', { name: 'Đăng tin' });
  await expect(estateAction).toBeVisible();
  await estateAction.click();
  await expect(page).toHaveURL(/\/dang-tin-bat-dong-san$/);
  await expect(navigation.getByRole('link', { name: 'Đăng tin' })).toBeVisible();

  await page.goto('/map', { waitUntil: 'domcontentloaded' });
  await expect(navigation.getByRole('link', { name: 'Đóng góp' })).toBeVisible();
});
