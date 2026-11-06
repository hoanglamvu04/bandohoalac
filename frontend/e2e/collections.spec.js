import { test, expect } from '@playwright/test';

test('public HOLA Collection opens as a map with ordered places and a shareable URL', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  const places = [
    {
      id: '201',
      name: 'Cafe học tập Hòa Lạc',
      slug: 'cafe-hoc-tap-hoa-lac',
      address: 'Khu công nghệ cao Hòa Lạc',
      category: 'Cafe',
      categorySlug: 'cafe',
      rating: 4.7,
      reviews: 18,
      lat: 21.01354,
      lng: 105.52522,
      images: [],
      coverImage: null
    },
    {
      id: '202',
      name: 'Thư viện Xứ Đoài',
      slug: 'thu-vien-xu-doai',
      address: 'Thạch Thất, Hòa Lạc',
      category: 'Giáo dục',
      categorySlug: 'giao-duc',
      rating: 4.8,
      reviews: 12,
      lat: 21.018,
      lng: 105.536,
      images: [],
      coverImage: null
    }
  ];

  await page.route('**/api/collections/public/cafe-hoc-tap-test', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '77',
        title: 'Cafe học tập tại Hòa Lạc',
        slug: 'cafe-hoc-tap-test',
        description: 'Những nơi phù hợp để học tập và làm việc.',
        visibility: 'PUBLIC',
        isPublic: true,
        placeCount: places.length,
        owner: { name: 'HOLA Explorer', avatarUrl: null },
        places
      })
    });
  });

  await page.goto('/bo-suu-tap/cafe-hoc-tap-test', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Cafe học tập tại Hòa Lạc' })).toBeVisible();
  await expect(page.locator('.hc-public-map')).toBeVisible();
  await expect(page.locator('.hc-public-place-card')).toHaveCount(2);
  await expect(page.locator('.hc-public-place-card').first()).toContainText('Cafe học tập Hòa Lạc');

  await page.locator('.hc-public-place-card').nth(1).locator('.hc-public-place-select').click();
  await expect(page.locator('.hc-public-place-card').nth(1)).toHaveClass(/active/);

  await page.getByRole('button', { name: 'Chia sẻ' }).click();
  const sharedUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(sharedUrl).toContain('/bo-suu-tap/cafe-hoc-tap-test');
});
