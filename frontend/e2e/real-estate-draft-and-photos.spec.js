import { test, expect } from '@playwright/test';

async function mockSignedInOwner(page, onSubmit = null) {
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/refresh') return route.fulfill({ json: {
      token: 'test-session', user: { id: 77, name: 'Người đăng', role: 'USER' }
    } });
    if (url.pathname === '/api/contributions' && route.request().method() === 'POST') {
      if (onSubmit) onSubmit(route.request());
      return route.fulfill({ status: 201, json: { id: 510, status: 'PENDING' } });
    }
    return route.fulfill({ json: { items: [], ok: true } });
  });
}

test('explicit session draft restores property data but never persists private contact or photos', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignedInOwner(page);
  await page.goto('/dang-tin-bat-dong-san?lat=21.013540&lng=105.525220');
  await expect(page.getByTestId('estate-submission-form')).toBeVisible();

  await page.locator('input[name="name"]').fill('Nhà phố 3 tầng gần FPT');
  await page.locator('input[name="address"]').fill('Hòa Lạc, Hà Nội');
  await page.locator('input[name="areaM2"]').fill('90');
  await page.locator('input[name="priceVnd"]').fill('2500000000');
  await page.locator('input[name="contactName"]').fill('Người liên hệ bí mật');
  await page.locator('input[name="phone"]').fill('0987654321');
  await page.getByRole('button', { name: 'Lưu nháp' }).click();

  const record = await page.evaluate(() =>
    sessionStorage.getItem('hola-maps-estate-draft-v1:77'));
  expect(record).toBeTruthy();
  const draft = JSON.parse(record);
  expect(draft.form.name).toBe('Nhà phố 3 tầng gần FPT');
  expect(draft.form.address).toBe('Hòa Lạc, Hà Nội');
  expect(draft.position.lat).toBe(21.01354);
  expect(record).not.toContain('Người liên hệ bí mật');
  expect(record).not.toContain('0987654321');
  expect(draft.form).not.toHaveProperty('phone');
  expect(draft.form).not.toHaveProperty('contactName');
  expect(draft).not.toHaveProperty('photos');
  expect(draft).not.toHaveProperty('publicContactConsent');

  await page.reload();
  await expect(page.locator('input[name="name"]')).toHaveValue('');
  await page.getByRole('button', { name: 'Khôi phục nháp' }).click();
  await expect(page.locator('input[name="name"]')).toHaveValue('Nhà phố 3 tầng gần FPT');
  await expect(page.locator('input[name="priceVnd"]')).toHaveValue('2500000000');
  await expect(page.locator('input[name="contactName"]')).toHaveValue('');
  await expect(page.locator('input[name="phone"]')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Xác nhận vị trí' })).toBeVisible();
  await page.getByRole('button', { name: 'Xóa nháp' }).click();
  expect(await page.evaluate(() =>
    sessionStorage.getItem('hola-maps-estate-draft-v1:77'))).toBeNull();
});

test('photo picker rejects excess, HEIC and large images without silently truncating files', async ({ page }) => {
  await mockSignedInOwner(page);
  await page.goto('/dang-tin-bat-dong-san');
  const input = page.getByLabel('Chọn ảnh tài sản');
  await expect(input).toBeVisible();

  await input.setInputFiles(Array.from({ length: 9 }, (_, index) => ({
    name: 'nha-' + index + '.jpg', mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9])
  })));
  await expect(page.getByRole('alert')).toContainText('tối đa 8 ảnh');
  await expect(page.locator('.estate-photo-files li')).toHaveCount(0);

  await input.setInputFiles({
    name: 'iphone.HEIC', mimeType: 'image/heic',
    buffer: Buffer.from('heic-test')
  });
  await expect(page.getByRole('alert')).toContainText('HEIC');
  await input.setInputFiles({
    name: 'huge.jpg', mimeType: 'image/jpeg',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 0xaa)
  });
  await expect(page.getByRole('alert')).toContainText('tối đa 5 MB');

  await input.setInputFiles([
    { name: 'anh-1.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8]) },
    { name: 'anh-2.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50]) }
  ]);
  await expect(page.locator('.estate-photo-files li')).toHaveCount(2);
  await expect(page.getByLabel('imageRightsConfirmed')).toHaveCount(0);
  await page.getByRole('button', { name: 'Xóa ảnh anh-1.jpg' }).click();
  await expect(page.locator('.estate-photo-files li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Xóa ảnh anh-2.png' }).click();
  await expect(page.locator('.estate-photo-files li')).toHaveCount(0);
});

test('property photo submission includes actual selected file and explicit rights consent', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let multipart = '';
  await mockSignedInOwner(page, (request) => {
    multipart = request.postData() || '';
  });
  await page.goto('/dang-tin-bat-dong-san?lat=21.013540&lng=105.525220');
  await page.locator('input[name="name"]').fill('Nhà thử nghiệm có ảnh');
  await page.locator('input[name="address"]').fill('Hòa Lạc, Hà Nội');
  await page.locator('input[name="areaM2"]').fill('90');
  await page.locator('input[name="priceVnd"]').fill('2500000000');
  await page.locator('input[name="contactName"]').fill('Nguyễn An');
  await page.locator('input[name="phone"]').fill('0987654321');
  await page.getByRole('button', { name: 'Xác nhận vị trí' }).click();
  await page.getByLabel('Chọn ảnh tài sản').setInputFiles({
    name: 'mat-tien.jpg', mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9])
  });
  await page.locator('input[name="publicContactConsent"]').check();
  await page.locator('input[name="imageRightsConfirmed"]').check();
  await page.getByRole('button', { name: 'Gửi yêu cầu chờ duyệt' }).click();

  await expect(page.getByTestId('estate-submitted')).toContainText('CHỜ DUYỆT');
  expect(multipart).toContain('mat-tien.jpg');
  expect(multipart).toContain('"imageRightsConfirmed":true');
  expect(multipart).toContain('"publicContactConsent":true');
  expect(multipart).toContain('"transactionType":"SALE"');
});
