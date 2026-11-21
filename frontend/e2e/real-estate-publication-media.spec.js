import { expect, test } from '@playwright/test';

function fixtureSvg(label) {
  return 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">' +
    '<rect width="40" height="40" fill="#4c8763"/>' +
    '<text x="10" y="25" fill="white">' + label + '</text></svg>'
  );
}
const goodOne = fixtureSvg('1');
const goodTwo = fixtureSvg('2');
const property = {
  id: 777, slug: 'property-test-777', status: 'PUBLISHED',
  name: 'Nhà phố Hòa Lạc cần cho thuê',
  description: 'Nhà nguyên căn có sân, mới được duyệt.',
  category: 'Bất động sản', categorySlug: 'bat-dong-san',
  address: 'Hòa Lạc, Hà Nội', phone: '0987654321',
  lat: 21.01354, lng: 105.52522, source: 'USER',
  images: ['/uploads/broken.jpg', goodOne, goodTwo]
};

async function servePublicProperty(page, place = property) {
  await page.route('**/uploads/broken.jpg', (route) =>
    route.fulfill({ status: 404, body: 'Not found' }));
  await page.route('**/api/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/auth/refresh') return route.fulfill({ status: 401, json: {} });
    if (pathname === '/api/places/777') return route.fulfill({ json: place });
    if (pathname === '/api/housing/777') return route.fulfill({ json: {
      item: {
        ...place,
        housing: {
          listingType: 'RENT', propertyType: 'HOUSE',
          areaM2: 90, monthlyRent: 7000000,
          listingStatus: 'ACTIVE', availabilityStatus: 'UNKNOWN',
          verificationSource: 'COMMUNITY'
        }
      }
    } });
    if (pathname === '/api/places/nearby') return route.fulfill({ json: { items: [] } });
    if (pathname === '/api/halo/v1/places/777') return route.fulfill({ json: { item: null } });
    return route.fulfill({ json: { items: [], ok: true } });
  });
}

test('public rental detail skips missing first image, keeps gallery usable and labels house rental correctly', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await servePublicProperty(page);
  await page.goto('/place/777');

  await expect(page.getByRole('heading', { name: 'Nhà phố Hòa Lạc cần cho thuê', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Thông tin bất động sản cho thuê' })).toBeVisible();
  await expect(page.getByText('Tin cho thuê')).toBeVisible();
  await expect(page.getByTestId('place-primary-image')).toHaveAttribute('src', goodOne);
  await expect(page.getByRole('button', { name: 'Ảnh tiếp theo' })).toBeVisible();
  await page.getByRole('button', { name: 'Ảnh tiếp theo' }).click();
  await expect(page.getByTestId('place-primary-image')).toHaveAttribute('src', goodTwo);
  await page.getByRole('button', { name: 'Ảnh trước' }).click();
  await expect(page.getByTestId('place-primary-image')).toHaveAttribute('src', goodOne);
});

test('all missing VPS images show accessible fallback without hiding contact information', async ({ page }) => {
  const noMedia = { ...property, images: ['/uploads/broken.jpg'] };
  await servePublicProperty(page, noMedia);
  await page.goto('/place/777');
  await expect(page.getByTestId('place-gallery-fallback'))
    .toContainText('Ảnh đang không khả dụng');
  await expect(page.getByTestId('place-primary-image')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Gọi' })).toHaveAttribute('href', 'tel:0987654321');
});

test('Admin approval verifies public property, housing and map pin without blocking success', async ({ page }) => {
  let posted = null;
  const contribution = {
    id: 6201, type: 'CREATE_PLACE', status: 'PENDING', createdAt: '2026-11-20T08:00:00Z',
    payload: {
      location: { lat: property.lat, lng: property.lng },
      place: {
        name: property.name, address: property.address,
        categorySlug: 'bat-dong-san', phone: property.phone,
        realEstate: {
          transactionType: 'SALE', propertyType: 'HOUSE', areaM2: 90,
          totalPriceVnd: 3500000000, publicContactConsent: true, contactName: 'Người bán QA'
        }
      }, photos: []
    }
  };
  await page.route('**/api/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/auth/refresh') return route.fulfill({ json: {
      token: 'test-session', user: {
        id: 12, role: 'ADMIN', name: 'Admin QA',
        security: { adminTwoFactorSetupRequired: false }
      }
    } });
    if (pathname === '/api/admin/contributions' && route.request().method() === 'GET')
      return route.fulfill({ json: { items: [contribution] } });
    if (pathname === '/api/admin/contributions/6201/duplicates')
      return route.fulfill({ json: { items: [], radiusM: 100 } });
    if (pathname === '/api/admin/contributions/6201/approve' && route.request().method() === 'POST') {
      posted = route.request().postDataJSON();
      return route.fulfill({ json: { id: 6201, status: 'APPROVED', placeId: 777 } });
    }
    if (pathname === '/api/places/777') return route.fulfill({ json: property });
    if (pathname === '/api/housing/777') return route.fulfill({ json: { item: {
      ...property, housing: { listingType: 'SALE', totalPriceVnd: 3500000000 }
    } } });
    if (pathname === '/api/places/bounds') return route.fulfill({ json: {
      items: [property], total: 1, hasMore: false
    } });
    return route.fulfill({ json: { items: [], ok: true } });
  });
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/admin/contributions');
  await expect(page.getByRole('button', { name: 'Duyệt & đăng bản đồ' })).toBeVisible();
  await page.getByRole('button', { name: 'Duyệt & đăng bản đồ' }).click();
  await expect.poll(() => posted).not.toBeNull();

  const check = page.getByTestId('estate-publication-check');
  await expect(check).toContainText('Tin đã được xác nhận trên API bản đồ và nhà đất');
  await expect(check).toContainText('Ghim bản đồ: Đã tìm thấy');
  await expect(check.getByRole('link', { name: 'Mở tin công khai' }))
    .toHaveAttribute('href', '/place/777');
  await expect(check.getByRole('link', { name: 'Xem ghim trên bản đồ' }))
    .toHaveAttribute('href', '/map?place=777&vertical=housing&category=bat-dong-san');
});
